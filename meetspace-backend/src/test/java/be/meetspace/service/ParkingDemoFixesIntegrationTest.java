package be.meetspace.service;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.controller.AdminParkingController;
import be.meetspace.web.controller.ReservationController;
import be.meetspace.web.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:parking-demo-fixes;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"})
@ActiveProfiles("test")
class ParkingDemoFixesIntegrationTest {
    @org.springframework.boot.test.context.TestConfiguration
    static class InventoryFixture {
        @org.springframework.context.annotation.Bean
        org.springframework.beans.factory.InitializingBean parkingInventoryBeforeSchedulers(ParkingInventoryRepository repository) {
            return () -> {
                if (!repository.existsById(1L)) {
                    ParkingInventory inventory = new ParkingInventory(); inventory.setId(1L); inventory.setCapacity(150);
                    repository.saveAndFlush(inventory);
                }
            };
        }
    }

    @Autowired be.meetspace.web.controller.ParkingController parkingController;
    @Autowired BookingHoldService holds;
    @Autowired ParkingCapacityService capacity;
    @Autowired BookingHoldRepository holdRepo;
    @Autowired ParkingSlotRepository slots;
    @Autowired ParkingInventoryRepository inventories;
    @Autowired ParkingReservationRepository parkingReservations;
    @Autowired PaymentRecordRepository payments;
    @Autowired UserRepository users;
    @Autowired EspaceRepository rooms;
    @Autowired EventRepository events;
    @Autowired ReservationRepository reservations;
    @Autowired AdminParkingController admin;
    @Autowired ReservationController roomController;
    @Autowired PlatformTransactionManager transactionManager;
    @MockBean PaymentVerifier verifier;
    @MockBean EmailService email;
    @MockBean NotificationService notifications;
    @MockBean AuditService audit;
    User customer;
    LocalDate date;
    TransactionTemplate tx;

    @BeforeEach void setup() {
        tx = new TransactionTemplate(transactionManager);
        customer = new User();
        customer.setFirstName("Test"); customer.setLastName("Parking");
        customer.setEmail(UUID.randomUUID() + "@meetspace.test");
        customer.setPasswordHash("isolated-test"); customer.setRole(Role.MEMBER);
        customer = users.saveAndFlush(customer);
        // Each scenario uses a separate date; committed fixtures do not interfere.
        date = LocalDate.now().plusDays(40 + users.count());
        ParkingInventory inventory = inventories.findById(1L).orElseGet(ParkingInventory::new); inventory.setId(1L); inventory.setCapacity(150);
        inventories.saveAndFlush(inventory);
    }

    @Test void sharedAllocationMustBeCheckedBeforePayment() {
        ParkingSlot a = slot(9, 12, 150); slot(9, 12, 150);
        assertEquals(75, capacity.snapshot(a).availableSpaces());
        conflict(() -> parkingHold(a, 100));
        assertEquals(0, holdRepo.findActiveForResource(PaymentType.PARKING, a.getId(), BookingHoldStatus.ACTIVE, LocalDateTime.now()).size());
    }

    @Test void advanceReserveMustAlsoApplyToHolds() {
        ParkingSlot a = slot(9, 12, 150);
        assertEquals(100, capacity.snapshot(a).availableSpaces());
        conflict(() -> parkingHold(a, 101));
    }

    @Test void soldSlotCannotMoveAndKeepsOriginalContract() {
        ParkingSlot a = slot(9, 12, 150), b = slot(14, 17, 150);
        sold(a, 100); sold(b, 100);
        ParkingSlotRequest request = edit(b); request.setStartTime(a.getStartTime()); request.setEndTime(a.getEndTime());
        conflict(() -> admin.updateSession(b.getId(), request, new MockHttpServletRequest()));
        ParkingSlot unchanged = slots.findById(b.getId()).orElseThrow();
        assertEquals(LocalTime.of(14, 0), unchanged.getStartTime());
        assertEquals(LocalTime.of(17, 0), unchanged.getEndTime());
        assertEquals(100, parkingReservations.countReservedSpacesByParkingSlotId(b.getId()));
    }

    @Test void roomPaymentCannotBeUsedForAnotherWindowOfSamePrice() {
        Espace room = room();
        LocalDateTime start = date.atTime(10, 0), end = start.plusHours(2);
        PaymentRequest request = new PaymentRequest(); request.setEspaceId(room.getId());
        request.setStartDateTime(start); request.setEndDateTime(end);
        BookingHold hold = holds.createHold(request, customer, PaymentType.SPACE, 20000);
        String pi = payment(hold, room.getId(), 20000);
        when(verifier.inspectPayment(pi)).thenReturn(new PaymentVerifier.PaymentSnapshot(20000, "eur", Map.of(), true));
        CreateReservationRequest changed = new CreateReservationRequest(); changed.setEspaceId(room.getId());
        changed.setStartDateTime(start.plusHours(4)); changed.setEndDateTime(end.plusHours(4)); changed.setPaymentIntentId(pi);
        assertThrows(ResponseStatusException.class, () -> roomController.create(changed,
                new UsernamePasswordAuthenticationToken(customer.getEmail(), "unused"), new MockHttpServletRequest()));
        assertEquals(BookingHoldStatus.ACTIVE, holdRepo.findById(hold.getId()).orElseThrow().getStatus());
        assertEquals(PaymentStatus.SUCCEEDED, payments.findByPaymentIntentId(pi).orElseThrow().getStatus());
        assertFalse(reservations.existsOverlappingReservation(room.getId(), changed.getStartDateTime(), changed.getEndDateTime()));
        verify(verifier, never()).inspectPayment(pi);
    }

    @Test void eventAndStandaloneHoldsShareTheSameQuota() {
        ParkingSlot a = slot(9, 12, 150);
        Event event = event(a);
        PaymentRequest request = new PaymentRequest(); request.setEventId(event.getId());
        request.setNumberOfParticipants(60); request.setReservedSpaces(60);
        holds.createHold(request, customer, PaymentType.EVENT, 12000);
        conflict(() -> parkingHold(a, 41));
        parkingHold(a, 40);
        conflict(() -> eventHold(event, 1));
    }

    @Test void otherSlotHoldsCountAgainstPhysicalCapacity() {
        ParkingSlot a = slot(9, 12, 150), b = slot(9, 12, 150);
        // Historical confirmed sales above today's proportional share remain protected.
        sold(a, 70); sold(b, 60);
        parkingHold(b, 15);
        conflict(() -> parkingHold(a, 6));
        parkingHold(a, 5);
        assertEquals(150, 70 + 60 + 15 + 5);
    }

    @Test void cancelledExpiredAndAdjacentHoldsDoNotConsumeQuota() {
        ParkingSlot a = slot(9, 12, 150), next = slot(12, 15, 150);
        BookingHold expired = parkingHold(a, 100);
        tx.executeWithoutResult(status -> holdRepo.findById(expired.getId()).orElseThrow().setExpiresAt(LocalDateTime.now().minusSeconds(1)));
        BookingHold cancelled = parkingHold(a, 100);
        tx.executeWithoutResult(status -> holds.cancel(holdRepo.findById(cancelled.getId()).orElseThrow()));
        parkingHold(a, 100); parkingHold(next, 100);
    }

    @Test void pendingPaymentPreventsSlotScheduleChangesButAllowsTitleEdits() {
        ParkingSlot a = slot(9, 12, 150); parkingHold(a, 10);
        ParkingSlotRequest changed = edit(a); changed.setStartTime(LocalTime.of(10, 0));
        conflict(() -> admin.updateSession(a.getId(), changed, new MockHttpServletRequest()));
        ParkingSlotRequest titleOnly = edit(a); titleOnly.setTitle("Titre modifié");
        admin.updateSession(a.getId(), titleOnly, new MockHttpServletRequest());
        assertEquals("Titre modifié", slots.findById(a.getId()).orElseThrow().getTitle());
        assertEquals(LocalTime.of(9, 0), slots.findById(a.getId()).orElseThrow().getStartTime());
    }

    @Test void roomPaymentFinalizesOnlyItsExactWindowWithoutBlockingAdjacentHold() {
        Espace room = room(); LocalDateTime start = date.atTime(10, 0), end = start.plusHours(2);
        BookingHold own = spaceHold(room, start, end);
        spaceHold(room, end, end.plusHours(2));
        String pi = payment(own, room.getId(), 20000);
        when(verifier.inspectPayment(pi)).thenReturn(new PaymentVerifier.PaymentSnapshot(20000, "eur", Map.of(), true));
        CreateReservationRequest request = new CreateReservationRequest(); request.setEspaceId(room.getId());
        request.setStartDateTime(start); request.setEndDateTime(end); request.setPaymentIntentId(pi);
        roomController.create(request, new UsernamePasswordAuthenticationToken(customer.getEmail(), "unused"), new MockHttpServletRequest());
        assertEquals(BookingHoldStatus.CONSUMED, holdRepo.findById(own.getId()).orElseThrow().getStatus());
        assertEquals(PaymentStatus.CONSUMED, payments.findByPaymentIntentId(pi).orElseThrow().getStatus());
        assertNotNull(payments.findByPaymentIntentId(pi).orElseThrow().getBookingEntityId());
        assertTrue(reservations.existsOverlappingReservation(room.getId(), start, end));
    }

    @Test void reschedulingCannotTakeAnotherCustomersActiveSpaceHold() {
        Espace room = room(); LocalDateTime start = date.atTime(10, 0), end = start.plusHours(2);
        Reservation sold = new Reservation(); sold.setUser(customer); sold.setEspace(room); sold.setStartDateTime(start);
        sold.setEndDateTime(end); sold.setStatus(ReservationStatus.CONFIRMED); sold.setTotalPrice(200D);
        sold = reservations.saveAndFlush(sold);
        spaceHold(room, start.plusHours(4), end.plusHours(4));
        RescheduleReservationRequest request = new RescheduleReservationRequest();
        request.setStartDateTime(start.plusHours(4)); request.setEndDateTime(end.plusHours(4));
        Long id = sold.getId();
        conflict(() -> roomController.rescheduleReservation(id, request,
                new UsernamePasswordAuthenticationToken(customer.getEmail(), "unused"), new MockHttpServletRequest()));
        tx.executeWithoutResult(status -> assertEquals(start, reservations.findById(id).orElseThrow().getStartDateTime()));
    }

    @Test void concurrentEventAndParkingHoldTransactionsCannotPromiseMoreThanQuota() throws Exception {
        ParkingSlot a = slot(9, 12, 150); Event event = event(a);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var saved = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        var secondStarted = new java.util.concurrent.CountDownLatch(1);
        try {
            var first = executor.submit(() -> tx.execute(status -> {
                BookingHold h = eventHold(event, 60); saved.countDown(); await(release); return h.getId();
            }));
            assertTrue(saved.await(10, java.util.concurrent.TimeUnit.SECONDS));
            var second = executor.submit(() -> {
                secondStarted.countDown();
                try { parkingHold(a, 60); return 201; }
                catch (ResponseStatusException ex) { return ex.getStatusCode().value(); }
            });
            assertTrue(secondStarted.await(5, java.util.concurrent.TimeUnit.SECONDS));
            assertThrows(java.util.concurrent.TimeoutException.class,
                    () -> second.get(200, java.util.concurrent.TimeUnit.MILLISECONDS));
            release.countDown();
            assertNotNull(first.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(409, second.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(60, holdRepo.findActiveForSecondaryResource(a.getId(), BookingHoldStatus.ACTIVE, LocalDateTime.now())
                    .stream().mapToInt(BookingHold::getSecondaryQuantity).sum());
            assertTrue(holdRepo.findActiveForResource(PaymentType.PARKING, a.getId(), BookingHoldStatus.ACTIVE, LocalDateTime.now()).isEmpty());
        } finally { release.countDown(); executor.shutdownNow(); assertTrue(executor.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)); }
    }

    @Test void concurrentHoldsForDifferentSlotsKeepTheirShares() throws Exception {
        ParkingSlot a = slot(9, 12, 150), b = slot(9, 12, 150);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            var first = executor.submit(() -> { await(start); return parkingHold(a, 75); });
            var second = executor.submit(() -> { await(start); return parkingHold(b, 75); });
            start.countDown(); assertNotNull(first.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertNotNull(second.get(15, java.util.concurrent.TimeUnit.SECONDS));
            conflict(() -> parkingHold(a, 1)); conflict(() -> parkingHold(b, 1));
        } finally { executor.shutdownNow(); assertTrue(executor.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)); }
    }

    Event event(ParkingSlot slot) {
        return tx.execute(status -> {
            Event e = new Event(); e.setTitle("Événement régression"); e.setCapacity(100); e.setPrice(1D);
            e.setStatus(EventStatus.PUBLISHED); e.setStartDateTime(date.atTime(9, 0)); e.setEndDateTime(date.atTime(12, 0));
            e = events.saveAndFlush(e);
            ParkingSlot persisted = slots.findById(slot.getId()).orElseThrow(); persisted.setEvent(e);
            e.setParkingSlot(persisted); slots.saveAndFlush(persisted); return e;
        });
    }
    BookingHold eventHold(Event e, int count) {
        PaymentRequest r = new PaymentRequest(); r.setEventId(e.getId()); r.setNumberOfParticipants(count); r.setReservedSpaces(count);
        return holds.createHold(r, customer, PaymentType.EVENT, count * 200L);
    }
    BookingHold spaceHold(Espace room, LocalDateTime start, LocalDateTime end) {
        PaymentRequest r = new PaymentRequest(); r.setEspaceId(room.getId()); r.setStartDateTime(start); r.setEndDateTime(end);
        return holds.createHold(r, customer, PaymentType.SPACE, 20000);
    }
    static void await(java.util.concurrent.CountDownLatch latch) {
        try { if (!latch.await(15, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("Timeout transaction test"); }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); }
    }

    @Test void capacityCannotBeReducedBelowConfirmedSales() {
        ParkingSlot a = slot(9, 12, 150); sold(a, 20);
        ParkingSlotRequest request = edit(a); request.setParkingCapacity(19);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> admin.updateSession(a.getId(), request, new MockHttpServletRequest()));
        assertEquals(400, ex.getStatusCode().value());
        assertEquals(150, slots.findById(a.getId()).orElseThrow().getCapacity());
        assertEquals(20, parkingReservations.countReservedSpacesByParkingSlotId(a.getId()));
    }

    @Test void twoConcurrentRequestsForLastPlaceOnlyCreateOneHold() throws Exception {
        ParkingSlot a = slot(9, 12, 150); sold(a, 99);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            java.util.concurrent.Callable<Integer> request = () -> {
                await(start);
                try { parkingHold(a, 1); return 201; }
                catch (ResponseStatusException ex) { return ex.getStatusCode().value(); }
            };
            var first = executor.submit(request); var second = executor.submit(request);
            start.countDown();
            var results = java.util.List.of(first.get(15, java.util.concurrent.TimeUnit.SECONDS),
                    second.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, results.stream().filter(code -> code == 201).count());
            assertEquals(1, results.stream().filter(code -> code == 409).count());
            assertEquals(1, holdRepo.findActiveForResource(PaymentType.PARKING, a.getId(), BookingHoldStatus.ACTIVE, LocalDateTime.now())
                    .stream().mapToInt(BookingHold::getQuantity).sum());
        } finally { start.countDown(); executor.shutdownNow(); assertTrue(executor.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)); }
    }

    @Test void freeBookingMustNotStealTheLastPhysicalPlaceHeldForPayment() throws Exception {
        ParkingSlot paying = slot(9, 12, 150), historical = slot(9, 12, 150), free = slot(9, 12, 150);
        // Historic contracts remain valid after allocation changes: 149 confirmed physical places.
        sold(paying, 49); sold(historical, 100);
        free.setParkingRate(0D); slots.saveAndFlush(free);
        assertEquals(1, capacity.snapshot(paying).availableSpaces());
        assertEquals(1, capacity.snapshot(free).availableSpaces());
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var holdSaved = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        var freeStarted = new java.util.concurrent.CountDownLatch(1);
        try {
            var first = executor.submit(() -> tx.execute(status -> {
                BookingHold hold = parkingHold(paying, 1); holdSaved.countDown(); await(release); return hold.getId();
            }));
            assertTrue(holdSaved.await(10, java.util.concurrent.TimeUnit.SECONDS));
            var second = executor.submit(() -> {
                ParkingReservationRequest request = new ParkingReservationRequest(); request.setParkingSlotId(free.getId()); request.setReservedSpaces(1);
                freeStarted.countDown();
                try { parkingController.createReservation(request,
                        new UsernamePasswordAuthenticationToken(customer.getEmail(), "unused"), new MockHttpServletRequest()); return 201; }
                catch (ResponseStatusException ex) { return ex.getStatusCode().value(); }
            });
            assertTrue(freeStarted.await(5, java.util.concurrent.TimeUnit.SECONDS));
            assertThrows(java.util.concurrent.TimeoutException.class, () -> second.get(200, java.util.concurrent.TimeUnit.MILLISECONDS));
            release.countDown(); assertNotNull(first.get(15, java.util.concurrent.TimeUnit.SECONDS));
            int result = second.get(15, java.util.concurrent.TimeUnit.SECONDS);
            int actual = parkingReservations.countReservedSpacesForWindow(date, LocalTime.of(9, 0), LocalTime.of(12, 0));
            int held = holdRepo.findActiveForResource(PaymentType.PARKING, paying.getId(), BookingHoldStatus.ACTIVE, LocalDateTime.now())
                    .stream().mapToInt(BookingHold::getQuantity).sum();
            assertEquals(409, result, "Booking gratuit a pris la place du hold : confirmés=" + actual + ", holds=" + held);
            assertEquals(149, actual); assertEquals(1, held);
        } finally { release.countDown(); executor.shutdownNow(); assertTrue(executor.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)); }
    }

    @Test void paidBookingExcludesOnlyItsOwnHoldAndProtectsAllOthers() {
        ParkingSlot a = slot(9, 12, 150); sold(a, 96);
        BookingHold own = parkingHold(a, 2); parkingHold(a, 2);
        PaymentRecord p = new PaymentRecord(); p.setPaymentIntentId("test_parking_" + UUID.randomUUID()); p.setUser(customer);
        p.setType(PaymentType.PARKING); p.setAmountCents(200L); p.setResourceId(a.getId()); p.setBookingHold(own); p.setStatus(PaymentStatus.SUCCEEDED);
        String pi = payments.saveAndFlush(p).getPaymentIntentId();
        when(verifier.inspectPayment(pi)).thenReturn(new PaymentVerifier.PaymentSnapshot(200, "eur", Map.of(), true));
        ParkingReservationRequest request = new ParkingReservationRequest(); request.setParkingSlotId(a.getId());
        request.setReservedSpaces(2); request.setPaymentIntentId(pi);
        parkingController.createReservation(request, new UsernamePasswordAuthenticationToken(customer.getEmail(), "unused"), new MockHttpServletRequest());
        assertEquals(98, parkingReservations.countReservedSpacesByParkingSlotId(a.getId()));
        assertEquals(BookingHoldStatus.CONSUMED, holdRepo.findById(own.getId()).orElseThrow().getStatus());
        assertEquals(2, holdRepo.findActiveForResource(PaymentType.PARKING, a.getId(), BookingHoldStatus.ACTIVE, LocalDateTime.now())
                .stream().mapToInt(BookingHold::getQuantity).sum());
        assertEquals(PaymentStatus.CONSUMED, payments.findByPaymentIntentId(pi).orElseThrow().getStatus());
        conflict(() -> parkingHold(a, 1));
    }

    @Test void finalBookingCannotExcludeAnUnownedHold() {
        ParkingSlot a = slot(9, 12, 150);
        User other = new User(); other.setFirstName("Other"); other.setLastName("Owner"); other.setEmail(UUID.randomUUID() + "@meetspace.test");
        other.setPasswordHash("isolated-test"); other.setRole(Role.MEMBER); other = users.saveAndFlush(other);
        PaymentRequest r = new PaymentRequest(); r.setParkingSlotId(a.getId()); r.setReservedSpaces(1);
        BookingHold thirdParty = holds.createHold(r, other, PaymentType.PARKING, 100);
        PaymentRecord p = new PaymentRecord(); p.setPaymentIntentId("test_parking_" + UUID.randomUUID()); p.setUser(other);
        p.setType(PaymentType.PARKING); p.setAmountCents(100L); p.setResourceId(a.getId()); p.setBookingHold(thirdParty); p.setStatus(PaymentStatus.SUCCEEDED);
        String pi = payments.saveAndFlush(p).getPaymentIntentId();
        ParkingReservationRequest request = new ParkingReservationRequest(); request.setParkingSlotId(a.getId()); request.setReservedSpaces(1); request.setPaymentIntentId(pi);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> parkingController.createReservation(request,
                new UsernamePasswordAuthenticationToken(customer.getEmail(), "unused"), new MockHttpServletRequest()));
        assertEquals(403, ex.getStatusCode().value());
        assertEquals(BookingHoldStatus.ACTIVE, holdRepo.findById(thirdParty.getId()).orElseThrow().getStatus());
        assertEquals(0, parkingReservations.countReservedSpacesByParkingSlotId(a.getId()));
        verify(verifier, never()).inspectPayment(pi);
    }

    @Test void adminCannotCreateOrResizeOverlappingSlotDuringPayment() {
        ParkingSlot a = slot(9, 12, 150), neighbor = slot(9, 12, 150);
        parkingHold(a, 75);
        long before = slots.count();
        ParkingSlotRequest create = edit(a);
        conflict(() -> admin.createSession(create, new MockHttpServletRequest()));
        assertEquals(before, slots.count());
        ParkingSlotRequest resize = edit(neighbor); resize.setParkingCapacity(100);
        conflict(() -> admin.updateSession(neighbor.getId(), resize, new MockHttpServletRequest()));
        assertEquals(150, slots.findById(neighbor.getId()).orElseThrow().getCapacity());
        create.setStartTime(LocalTime.of(12, 0)); create.setEndTime(LocalTime.of(15, 0));
        admin.createSession(create, new MockHttpServletRequest());
        assertEquals(before + 1, slots.count());
    }

    @Test void roundedFreeBookingCannotExcludeTheUnconsumedPaymentHold() {
        ParkingSlot a = slot(9, 12, 150); sold(a, 99);
        BookingHold own = parkingHold(a, 1);
        PaymentRecord p = new PaymentRecord(); p.setPaymentIntentId("test_parking_" + UUID.randomUUID()); p.setUser(customer);
        p.setType(PaymentType.PARKING); p.setAmountCents(100L); p.setResourceId(a.getId()); p.setBookingHold(own); p.setStatus(PaymentStatus.SUCCEEDED);
        String pi = payments.saveAndFlush(p).getPaymentIntentId();
        ParkingSlotRequest edit = edit(a); edit.setParkingRate(0.001D);
        admin.updateSession(a.getId(), edit, new MockHttpServletRequest());
        ParkingReservationRequest request = new ParkingReservationRequest(); request.setParkingSlotId(a.getId()); request.setReservedSpaces(1); request.setPaymentIntentId(pi);
        conflict(() -> parkingController.createReservation(request,
                new UsernamePasswordAuthenticationToken(customer.getEmail(), "unused"), new MockHttpServletRequest()));
        assertEquals(99, parkingReservations.countReservedSpacesByParkingSlotId(a.getId()));
        assertEquals(BookingHoldStatus.ACTIVE, holdRepo.findById(own.getId()).orElseThrow().getStatus());
        verify(verifier, never()).inspectPayment(pi);
    }

    @Test void adminCannotDeleteSlotWhilePaymentHoldIsActive() {
        ParkingSlot a = slot(9, 12, 150); BookingHold own = parkingHold(a, 1);
        conflict(() -> admin.deleteSession(a.getId(), new MockHttpServletRequest()));
        assertTrue(slots.existsById(a.getId()));
        tx.executeWithoutResult(status -> holds.cancel(holdRepo.findById(own.getId()).orElseThrow()));
        admin.deleteSession(a.getId(), new MockHttpServletRequest());
        assertFalse(slots.existsById(a.getId()));
    }

    @Test void eventPaymentHelperExcludesOnlyItsSecondaryParkingQuantity() {
        ParkingSlot a = slot(9, 12, 150); sold(a, 96); Event e = event(a);
        BookingHold own = eventHold(e, 2); parkingHold(a, 2);
        PaymentRecord p = new PaymentRecord(); p.setPaymentIntentId("test_event_" + UUID.randomUUID()); p.setUser(customer);
        p.setType(PaymentType.EVENT); p.setAmountCents(400L); p.setResourceId(e.getId()); p.setBookingHold(own); p.setStatus(PaymentStatus.SUCCEEDED);
        String pi = payments.saveAndFlush(p).getPaymentIntentId();
        tx.executeWithoutResult(status -> {
            capacity.lockInventory();
            ParkingSlot locked = slots.findByIdForUpdate(a.getId()).orElseThrow();
            assertEquals(2, capacity.lockAndAssertAvailable(locked, 2, pi, customer).availableSpaces());
            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> capacity.lockAndAssertAvailable(locked, 3, pi, customer));
            assertEquals(400, ex.getStatusCode().value());
        });
        assertEquals(BookingHoldStatus.ACTIVE, holdRepo.findById(own.getId()).orElseThrow().getStatus());
    }

    BookingHold parkingHold(ParkingSlot slot, int count) {
        PaymentRequest r = new PaymentRequest(); r.setParkingSlotId(slot.getId()); r.setReservedSpaces(count);
        return holds.createHold(r, customer, PaymentType.PARKING, count * 100L);
    }
    ParkingSlot slot(int start, int end, int count) {
        ParkingSlot s = new ParkingSlot(); s.setTitle("Parking régression"); s.setDescription("Contrat de parking isolé");
        s.setSessionDate(date); s.setStartTime(LocalTime.of(start, 0)); s.setEndTime(LocalTime.of(end, 0));
        s.setCapacity(count); s.setParkingRate(1D); s.setStatus(ParkingSlotStatus.OPEN); return slots.saveAndFlush(s);
    }
    void sold(ParkingSlot slot, int count) {
        ParkingReservation r = new ParkingReservation(); r.setUser(customer); r.setParkingSlot(slot);
        r.setReservedSpaces(count); r.setTotalPrice((double) count); r.setStatus(ParkingReservationStatus.CONFIRMED);
        parkingReservations.saveAndFlush(r);
    }
    ParkingSlotRequest edit(ParkingSlot s) {
        ParkingSlotRequest r = new ParkingSlotRequest(); r.setTitle(s.getTitle()); r.setDescription(s.getDescription());
        r.setSlotDate(s.getSessionDate()); r.setStartTime(s.getStartTime()); r.setEndTime(s.getEndTime());
        r.setParkingCapacity(s.getCapacity()); r.setParkingRate(s.getParkingRate()); r.setStatus(s.getStatus()); return r;
    }
    Espace room() {
        Espace r = new Espace(); r.setName("Salle régression"); r.setType(EspaceType.SALLE); r.setCapacity(80);
        r.setBasePrice(100D); r.setStatus(EspaceStatus.AVAILABLE); return rooms.saveAndFlush(r);
    }
    String payment(BookingHold hold, Long resourceId, long amount) {
        PaymentRecord p = new PaymentRecord(); p.setPaymentIntentId("test_space_" + UUID.randomUUID()); p.setUser(customer);
        p.setType(PaymentType.SPACE); p.setAmountCents(amount); p.setResourceId(resourceId); p.setBookingHold(hold);
        p.setStatus(PaymentStatus.SUCCEEDED); return payments.saveAndFlush(p).getPaymentIntentId();
    }
    static void conflict(Runnable action) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, action::run);
        assertEquals(409, e.getStatusCode().value());
    }
}
