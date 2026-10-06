package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.controller.AdminReservationsController;
import be.meetspace.web.controller.ReservationController;
import be.meetspace.web.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.*;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(PremiumPaymentExpiryService.class)
class PremiumPaymentExpiryRegressionTest {
    @Autowired ReservationRepository reservations;
    @Autowired TestEntityManager em;
    @Autowired PremiumPaymentExpiryService expiry;
    @MockBean AuditService audit;
    User user;
    Espace room;
    LocalDateTime now;

    @BeforeEach void setup() {
        now = LocalDateTime.now().withNano(0);
        user = new User(); user.setFirstName("Expiry"); user.setLastName("Fixture");
        user.setEmail("expiry@example.invalid"); user.setPasswordHash("unused-test-hash");
        user.setRole(Role.MEMBER); em.persist(user);
        room = new Espace(); room.setName("Salle expiration"); room.setBasePrice(320D);
        room.setType(EspaceType.PREMIUM_ROOM); em.persist(room);
    }

    Reservation booking(ReservationStatus status, LocalDateTime start, LocalDateTime approved, LocalDateTime due) {
        Reservation r = new Reservation(); r.setUser(user); r.setEspace(room); r.setStatus(status);
        r.setStartDateTime(start); r.setEndDateTime(start.plusHours(2)); r.setTotalPrice(640D);
        r.setApprovedAt(approved); r.setPaymentDueAt(due); return reservations.saveAndFlush(r);
    }

    @Test void legacyPastApprovalExpiresAndHistoryRemains() {
        Reservation old = booking(ReservationStatus.APPROVED, now.minusMonths(2), now.minusMonths(3), null);
        expiry.expireUnpaidApprovals(); em.flush(); em.clear();
        Reservation saved = reservations.findById(old.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
        assertThat(saved.getRejectionReason()).isEqualTo("Delai de paiement expire");
        assertThat(saved.getTotalPrice()).isEqualTo(640D);
        assertThat(saved.getPaymentIntentId()).isNull();
        assertThat(reservations.existsOverlappingReservation(room.getId(), old.getStartDateTime(), old.getEndDateTime())).isFalse();
        verify(audit).log(eq(AuditAction.RESERVATION_CANCEL), eq("Reservation"), eq(old.getId()), anyString(), eq("system"));
        expiry.expireUnpaidApprovals(); verifyNoMoreInteractions(audit);
    }

    @Test void expirationQueryUsesInclusiveBoundariesAndLegacyFallback() {
        Reservation due = booking(ReservationStatus.APPROVED, now.plusDays(3), now.minusHours(1), now);
        Reservation legacy = booking(ReservationStatus.APPROVED, now.plusDays(4), now.minusHours(48), null);
        Reservation started = booking(ReservationStatus.APPROVED, now, now.minusHours(1), now.plusHours(47));
        Reservation missingApproval = booking(ReservationStatus.APPROVED, now.minusDays(1), null, null);
        assertThat(reservations.findExpiredApprovedReservations(now, now.minusHours(48)))
                .extracting(Reservation::getId).containsExactlyInAnyOrder(due.getId(), legacy.getId(), started.getId(), missingApproval.getId());
    }

    @Test void schedulerKeepsValidApprovalsAndPaidReservations() {
        Reservation valid = booking(ReservationStatus.APPROVED, now.plusDays(5), now.minusHours(1), now.plusHours(47));
        Reservation legacyValid = booking(ReservationStatus.APPROVED, now.plusDays(6), now.minusHours(1), null);
        Reservation explicitExtension = booking(ReservationStatus.APPROVED, now.plusDays(7), now.minusDays(20), now.plusDays(1));
        Reservation paid = booking(ReservationStatus.CONFIRMED, now.minusMonths(2), now.minusMonths(3), now.minusMonths(2));
        paid.setPaymentIntentId("pi_already_paid_fixture"); em.flush();
        expiry.expireUnpaidApprovals(); em.flush(); em.clear();
        for (Reservation r : new Reservation[]{valid, legacyValid, explicitExtension})
            assertThat(reservations.findById(r.getId()).orElseThrow().getStatus()).isEqualTo(ReservationStatus.APPROVED);
        assertThat(reservations.findById(paid.getId()).orElseThrow().getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
        verifyNoInteractions(audit);
    }

    @Test void staleReservationCannotCreatePaymentHold() {
        Reservation old = booking(ReservationStatus.APPROVED, now.minusMonths(2), now.minusMonths(3), null);
        BookingHoldRepository holds = mock(BookingHoldRepository.class);
        BookingHoldService service = new BookingHoldService(holds, mock(EspaceRepository.class), mock(EventRepository.class),
                mock(ParkingSlotRepository.class), reservations, mock(EventRegistrationRepository.class), mock(ParkingReservationRepository.class), 15);
        PaymentRequest request = new PaymentRequest(); request.setReservationId(old.getId());
        assertThatThrownBy(() -> service.createHold(request, user, PaymentType.PREMIUM_ROOM, 64000))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(409));
        verifyNoInteractions(holds);
    }

    @Test void staleReservationCannotFinalizePaymentEvenBeforeSchedulerRuns() {
        Reservation old = booking(ReservationStatus.APPROVED, now.minusMonths(2), now.minusMonths(3), null);
        UserRepository users = mock(UserRepository.class); when(users.findByEmail(user.getEmail())).thenReturn(java.util.Optional.of(user));
        PaymentLifecycleService payments = mock(PaymentLifecycleService.class);
        ReservationController controller = new ReservationController(reservations, users, mock(EspaceRepository.class), mock(EventRepository.class),
                payments, mock(PaymentQuoteService.class), mock(CancellationPolicyService.class), audit,
                mock(EmailService.class), mock(NotificationService.class), mock(BookingHoldService.class));
        PayReservationRequest request = new PayReservationRequest(); request.setPaymentIntentId("pi_never_consumed");
        assertThatThrownBy(() -> controller.payApprovedReservation(old.getId(), request,
                new TestingAuthenticationToken(user.getEmail(), "unused"), new MockHttpServletRequest()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(409));
        verifyNoInteractions(payments);
    }

    AdminReservationsController adminController() {
        UserRepository users = mock(UserRepository.class); when(users.findByEmail(user.getEmail())).thenReturn(java.util.Optional.of(user));
        return new AdminReservationsController(reservations, mock(EventRegistrationRepository.class), mock(ParkingReservationRepository.class), users, audit, mock(NotificationService.class));
    }

    @Test void approvalCannotAuthorizeAPastSlot() {
        Reservation past = booking(ReservationStatus.PENDING_APPROVAL, now.minusHours(1), null, null);
        ReservationApprovalRequest request = new ReservationApprovalRequest(); request.setApproved(true);
        assertThatThrownBy(() -> adminController().approveReservation(past.getId(), request,
                new TestingAuthenticationToken(user.getEmail(), "unused"), new MockHttpServletRequest()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(409));
        assertThat(past.getStatus()).isEqualTo(ReservationStatus.PENDING_APPROVAL);
    }

    @Test void approvalDeadlineNeverExceedsStartOfSlot() {
        Reservation imminent = booking(ReservationStatus.PENDING_APPROVAL, now.plusHours(2), null, null);
        ReservationApprovalRequest request = new ReservationApprovalRequest(); request.setApproved(true);
        ReservationResponseDto dto = adminController().approveReservation(imminent.getId(), request,
                new TestingAuthenticationToken(user.getEmail(), "unused"), new MockHttpServletRequest());
        assertThat(dto.getPaymentDueAt()).isEqualTo(imminent.getStartDateTime());
        assertThat(dto.isPaymentExpired()).isFalse();
    }

    @Test void apiExposesLegacyDeadlineAndExpirationBeforeScheduledCleanup() {
        Reservation legacy = booking(ReservationStatus.APPROVED, now.plusDays(4), now.minusDays(3), null);
        ReservationResponseDto dto = ReservationResponseDto.fromEntity(legacy);
        assertThat(dto.getPaymentDueAt()).isEqualTo(legacy.getApprovedAt().plusHours(48));
        assertThat(dto.isPaymentExpired()).isTrue();
    }
}
