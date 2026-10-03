package be.meetspace.web;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.controller.AdminEventController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@org.springframework.context.annotation.Import(be.meetspace.service.EventParkingInventoryTestConfig.class)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AdminEventDeletionIntegrationTest {
    @Autowired be.meetspace.repository.ParkingInventoryRepository inventory;
    @Autowired AdminEventController controller;
    @Autowired EventRepository events;
    @Autowired UserRepository users;
    @Autowired ParkingSlotRepository slots;
    @Autowired ParkingReservationRepository reservations;
    @Autowired ParkingAccessPassRepository passes;
    @Autowired EventRegistrationRepository registrations;

    @Test
    void deletesEmptyEventAndComplimentaryPassWithOrmCascade() {
        ParkingReservation reservation = fixture();
        Long slotId = reservation.getParkingSlot().getId();
        Long eventId = reservation.getParkingSlot().getEvent().getId();
        Long passId = reservation.getAccessPasses().get(0).getId();
        controller.deleteEvent(eventId, new MockHttpServletRequest());
        events.flush();
        assertFalse(passes.existsById(passId));
        assertFalse(reservations.existsById(reservation.getId()));
        assertFalse(slots.existsById(slotId));
        assertFalse(events.existsById(eventId));
    }

    @Test
    void refusesDeletionOfCustomerParkingHistory() {
        ParkingReservation reservation = fixture();
        reservation.setComplimentary(false);
        reservation.setTotalPrice(12D);
        reservations.saveAndFlush(reservation);
        Long eventId = reservation.getParkingSlot().getEvent().getId();
        var error = assertThrows(ResponseStatusException.class,
                () -> controller.deleteEvent(eventId, new MockHttpServletRequest()));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertTrue(events.existsById(eventId));
        assertTrue(reservations.existsById(reservation.getId()));
        assertTrue(passes.existsById(reservation.getAccessPasses().get(0).getId()));
    }

    @Test
    void refusesDeletionOfEventWithPaidDeposit() {
        ParkingReservation reservation = fixture();
        Event event = reservation.getParkingSlot().getEvent();
        event.setDepositPaidAt(LocalDateTime.now());
        events.saveAndFlush(event);
        assertThrows(ResponseStatusException.class,
                () -> controller.deleteEvent(event.getId(), new MockHttpServletRequest()));
        assertTrue(events.existsById(event.getId()));
    }

    @Test
    void preservesEvenCancelledParticipantHistory() {
        ParkingReservation reservation = fixture();
        Event event = reservation.getParkingSlot().getEvent();
        EventRegistration registration = new EventRegistration();
        registration.setUser(reservation.getUser());
        registration.setEvent(event);
        registration.setNumberOfParticipants(1);
        registration.setTotalPrice(0D);
        registration.setStatus(EventRegistrationStatus.CANCELLED);
        registrations.saveAndFlush(registration);
        assertThrows(ResponseStatusException.class,
                () -> controller.deleteEvent(event.getId(), new MockHttpServletRequest()));
        assertTrue(registrations.existsById(registration.getId()));
    }

    private ParkingReservation fixture() {
        if (!inventory.existsById(1L)) {
            be.meetspace.entity.ParkingInventory physical = new be.meetspace.entity.ParkingInventory();
            physical.setId(1L); physical.setCapacity(150); inventory.saveAndFlush(physical);
        }
        User user = new User();
        user.setFirstName("Audit");
        user.setLastName("Suppression");
        user.setEmail(UUID.randomUUID() + "@meetspace.test");
        user.setPasswordHash("unused-test-fixture");
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        users.saveAndFlush(user);
        Event event = new Event();
        event.setTitle("Audit suppression");
        event.setStartDateTime(LocalDateTime.now().plusDays(10).withHour(10));
        event.setEndDateTime(event.getStartDateTime().plusHours(2));
        event.setCapacity(20);
        event.setStatus(EventStatus.PUBLISHED);
        event.setCreatedBy(user);
        ParkingSlot slot = new ParkingSlot();
        slot.setTitle("Audit parking");
        slot.setDescription("Fixture locale");
        slot.setSessionDate(event.getStartDateTime().toLocalDate());
        slot.setStartTime(event.getStartDateTime().toLocalTime());
        slot.setEndTime(event.getEndDateTime().toLocalTime());
        slot.setCapacity(20);
        slot.setParkingRate(12D);
        slot.setEvent(event);
        event.setParkingSlot(slot);
        events.saveAndFlush(event);
        ParkingReservation reservation = new ParkingReservation();
        reservation.setUser(user);
        reservation.setParkingSlot(slot);
        reservation.setReservedSpaces(1);
        reservation.setTotalPrice(0D);
        reservation.setComplimentary(true);
        ParkingAccessPass pass = new ParkingAccessPass();
        pass.setToken(UUID.randomUUID().toString());
        pass.setParkingReservation(reservation);
        reservation.getAccessPasses().add(pass);
        return reservations.saveAndFlush(reservation);
    }
}
