package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.repository.ReservationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
@Transactional
public class EventPlanningService {

    private final EspaceRepository espaceRepository;
    private final ReservationRepository reservationRepository;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final ParkingSlotRepository parkingSlotRepository;
    private final ParkingCapacityService parkingCapacityService;
    private final ParkingAccessService parkingAccessService;
    private final PaymentLifecycleService paymentLifecycleService;
    private final NotificationService notificationService;
    private final BookingHoldService bookingHoldService;
    private final EventRoomCancellationService roomCancellationService;

    public EventPlanningService(EspaceRepository espaceRepository,
                                ReservationRepository reservationRepository,
                                EventRepository eventRepository,
                                EventRegistrationRepository eventRegistrationRepository,
                                ParkingReservationRepository parkingReservationRepository,
                                ParkingSlotRepository parkingSlotRepository,
                                ParkingCapacityService parkingCapacityService,
                                ParkingAccessService parkingAccessService,
                                PaymentLifecycleService paymentLifecycleService,
                                NotificationService notificationService,
                                BookingHoldService bookingHoldService,
                                EventRoomCancellationService roomCancellationService) {
        this.espaceRepository = espaceRepository;
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.parkingSlotRepository = parkingSlotRepository;
        this.parkingCapacityService = parkingCapacityService;
        this.parkingAccessService = parkingAccessService;
        this.paymentLifecycleService = paymentLifecycleService;
        this.notificationService = notificationService;
        this.bookingHoldService = bookingHoldService;
        this.roomCancellationService = roomCancellationService;
    }

    public void lockParkingInventory() { parkingCapacityService.lockInventory(); }

    public void applyAndValidate(Event event, EventData data, Long excludeEventId) {
        lockParkingInventory();
        validateDates(data.startDateTime(), data.endDateTime());
        if (data.locationType() == EventLocationType.EXISTING_SPACE) {
            validateParkingDateWindow(data.startDateTime(), data.endDateTime());
        }
        validateRoomContractChange(event, data);
        validateWindowChangeBeforeBookings(event, data);
        validateParkingAllocationChange(event, data);

        event.setTitle(data.title());
        event.setDescription(data.description());
        event.setStartDateTime(data.startDateTime());
        event.setEndDateTime(data.endDateTime());
        if (data.capacity() == null || data.capacity() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La capacité doit être renseignée et positive");
        }
        if (event.getId() != null) {
            int registeredParticipants = eventRegistrationRepository.countTotalParticipantsByEventId(event.getId());
            if (data.capacity() < registeredParticipants) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "La capacité de l'événement ne peut pas être inférieure aux participants déjà inscrits (" + registeredParticipants + ")"
                );
            }
        }
        event.setCapacity(data.capacity());
        event.setPrice(data.price());
        if (data.status() != null) {
            event.setStatus(data.status());
        }

        EventLocationType typeToUse = data.locationType() != null
                ? data.locationType()
                : EventLocationType.EXTERNAL;

        if (typeToUse == EventLocationType.EXISTING_SPACE) {
            if (data.spaceId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un espace existant doit être sélectionné");
            }

            Espace espace = lockAndValidateExistingSpace(
                    data.spaceId(), data.startDateTime(), data.endDateTime(), data.capacity(), excludeEventId);

            event.setSpace(espace);
            event.setLocation(espace.getName());
            event.setExternalAddress(null);
            event.setLocationType(EventLocationType.EXISTING_SPACE);
            event.setParkingRequired(true);
        } else {
            String resolvedAddress = StringUtils.hasText(data.externalAddress())
                    ? data.externalAddress()
                    : (StringUtils.hasText(data.locationLabel()) ? data.locationLabel() : null);

            if (!StringUtils.hasText(resolvedAddress)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Une adresse externe est requise");
            }
            event.setSpace(null);
            event.setExternalAddress(resolvedAddress);
            event.setLocation(resolvedAddress);
            event.setLocationType(EventLocationType.EXTERNAL);
            event.setParkingRequired(false);
        }

        syncParkingSlot(event, data);
    }

    public void validateAvailabilityForPublication(Event event) {
        lockParkingInventory();
        if (event.getLocationType() != EventLocationType.EXISTING_SPACE || event.getSpace() == null) {
            return;
        }
        validateParkingDateWindow(event.getStartDateTime(), event.getEndDateTime());
        lockAndValidateExistingSpace(
                event.getSpace().getId(),
                event.getStartDateTime(),
                event.getEndDateTime(),
                event.getCapacity(),
                event.getId()
        );
    }

    private Espace lockAndValidateExistingSpace(Long spaceId,
                                                LocalDateTime start,
                                                LocalDateTime end,
                                                Integer eventCapacity,
                                                Long excludeEventId) {
        Espace espace = espaceRepository.findByIdForUpdate(spaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable pour l'événement"));

        bookingHoldService.assertNoOverlappingSpaceHold(spaceId, start, end, null);
        if (espace.getStatus() != EspaceStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Espace non disponible");
        }
        if (eventCapacity > espace.getCapacity()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "La capacité de l'événement ne peut pas dépasser la capacité de la salle (" + espace.getCapacity() + " personnes)"
            );
        }
        if (reservationRepository.existsOverlappingReservation(espace.getId(), start, end)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'espace sélectionné est déjà réservé sur ce créneau");
        }
        if (eventRepository.existsOverlappingEventForSpace(espace.getId(), start, end, excludeEventId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un autre événement occupe déjà cet espace sur ce créneau");
        }
        return espace;
    }

    private void validateRoomContractChange(Event event, EventData data) {
        if (event.getId() == null || !event.isRoomContractLocked()) return;
        Long oldSpace = event.getSpace() == null ? null : event.getSpace().getId();
        Long newSpace = data.locationType() == EventLocationType.EXISTING_SPACE ? data.spaceId() : null;
        if (!java.util.Objects.equals(event.getStartDateTime(), data.startDateTime())
                || !java.util.Objects.equals(event.getEndDateTime(), data.endDateTime())
                || event.getLocationType() != data.locationType()
                || !java.util.Objects.equals(oldSpace, newSpace)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La salle et les horaires d'une location approuvée ou payée ne peuvent plus être modifiés. Annulez la demande avant de choisir un autre créneau.");
        }
    }

    private void validateWindowChangeBeforeBookings(Event event, EventData data) {
        if (event.getId() == null
                || (java.util.Objects.equals(event.getStartDateTime(), data.startDateTime())
                && java.util.Objects.equals(event.getEndDateTime(), data.endDateTime()))) {
            return;
        }
        boolean confirmedAttendees = eventRegistrationRepository.findByEventId(event.getId()).stream()
                .anyMatch(registration -> registration.getStatus() == EventRegistrationStatus.CONFIRMED);
        boolean confirmedCustomerParking = event.getParkingSlot() != null
                && parkingReservationRepository.findByParkingSlotId(event.getParkingSlot().getId()).stream()
                .anyMatch(reservation -> reservation.getStatus() == ParkingReservationStatus.CONFIRMED
                        && !reservation.isComplimentary());
        if (confirmedAttendees || confirmedCustomerParking) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Les dates et horaires ne peuvent plus être modifiés : cet événement possède des inscriptions ou réservations parking confirmées.");
        }
    }

    private void validateParkingAllocationChange(Event event, EventData data) {
        ParkingSlot old = event.getParkingSlot();
        boolean existingSpace = data.locationType() == EventLocationType.EXISTING_SPACE;
        boolean changed = old == null || !existingSpace
                || !java.util.Objects.equals(event.getStartDateTime(), data.startDateTime())
                || !java.util.Objects.equals(event.getEndDateTime(), data.endDateTime())
                || !java.util.Objects.equals(event.getCapacity(), data.capacity())
                || (data.status() != null && event.getStatus() != data.status());
        if (!changed) return;
        if (old != null) assertNoParkingHolds(old);
        if (existingSpace) {
            parkingCapacityService.assertNoActiveHoldsForWindow(data.startDateTime().toLocalDate(),
                    data.startDateTime().toLocalTime(), data.endDateTime().toLocalTime());
        }
    }

    private void assertNoParkingHolds(ParkingSlot slot) {
        parkingCapacityService.assertNoActiveHoldsForWindow(slot.getSessionDate(), slot.getStartTime(), slot.getEndTime());
    }

    private void validateParkingDateWindow(LocalDateTime start, LocalDateTime end) {
        if (!start.toLocalDate().equals(end.toLocalDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Un événement avec parking doit commencer et se terminer le même jour. Le parking multijours n'est pas disponible.");
        }
    }

    private void validateDates(LocalDateTime start, LocalDateTime end) {
        LocalDateTime now = LocalDateTime.now();

        if (start.isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de début ne peut pas être dans le passé");
        }

        if (end.isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin ne peut pas être dans le passé");
        }

        if (!end.isAfter(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin doit être après la date de début");
        }
    }

    private void syncParkingSlot(Event event, EventData data) {
        if (event.getLocationType() != EventLocationType.EXISTING_SPACE) {
            event.setParkingSlot(null);
            return;
        }
        ParkingSlot parkingSlot = event.getParkingSlot() != null ? event.getParkingSlot() : new ParkingSlot();

        parkingSlot.setEvent(event);
        parkingSlot.setTitle("Parking — " + event.getTitle());
        parkingSlot.setDescription("Parking MeetSpace partagé automatiquement selon les événements qui se chevauchent.");
        parkingSlot.setSessionDate(event.getStartDateTime().toLocalDate());
        parkingSlot.setStartTime(event.getStartDateTime().toLocalTime());
        parkingSlot.setEndTime(event.getEndDateTime().toLocalTime());
        parkingSlot.setCapacity(Math.min(BusinessRules.TOTAL_PARKING_SPACES, data.capacity()));
        parkingSlot.setParkingRate(BusinessRules.calculateParkingRate(calculateDurationHours(event), getRoomCapacity(event)));
        parkingSlot.setStatus(event.getStatus() == EventStatus.PUBLISHED ? ParkingSlotStatus.OPEN : ParkingSlotStatus.CANCELLED);

        event.setParkingSlot(parkingSlot);
    }

    public void activateParkingForPublication(Event event) {
        lockParkingInventory();
        if (event.getLocationType() != EventLocationType.EXISTING_SPACE || event.getParkingSlot() == null) return;
        validateParkingDateWindow(event.getStartDateTime(), event.getEndDateTime());
        ParkingSlot slot = event.getParkingSlot();
        if (slot.getStatus() != ParkingSlotStatus.OPEN) assertNoParkingHolds(slot);
        slot.setStatus(ParkingSlotStatus.OPEN);
        parkingSlotRepository.save(slot);
        if (event.getCreatedBy() == null || parkingReservationRepository
                .existsByParkingSlotIdAndUserIdAndComplimentaryTrueAndStatusNot(
                        slot.getId(), event.getCreatedBy().getId(), ParkingReservationStatus.CANCELLED)) return;
        parkingCapacityService.lockAndAssertAvailable(slot, 1);
        ParkingReservation reservation = new ParkingReservation();
        reservation.setUser(event.getCreatedBy());
        reservation.setParkingSlot(slot);
        reservation.setReservedSpaces(1);
        reservation.setTotalPrice(0D);
        reservation.setComplimentary(true);
        reservation.setStatus(ParkingReservationStatus.CONFIRMED);
        ParkingReservation saved = parkingReservationRepository.save(reservation);
        parkingAccessService.ensurePasses(saved);
    }

    public void syncParkingStatus(Event event) { syncParkingStatus(event, true); }

    public void syncParkingStatus(Event event, boolean cancelledByProvider) {
        lockParkingInventory();
        ParkingSlot currentSlot = event.getParkingSlot();
        ParkingSlotStatus targetStatus = event.getStatus() == EventStatus.PUBLISHED ? ParkingSlotStatus.OPEN : ParkingSlotStatus.CANCELLED;
        if (currentSlot != null && currentSlot.getStatus() != targetStatus) {
            // Check before the durable refund calls: a rejected allocation change must not refund an open event.
            assertNoParkingHolds(currentSlot);
        }
        if (event.getStatus() == EventStatus.CANCELLED) {
            roomCancellationService.refundRoom(event, cancelledByProvider);
            // Restituer le paiement historique, sans barème client, avant d'invalider les accès.
            // Le journal durable permet de reprendre une réponse Stripe perdue après rollback.
            for (EventRegistration candidate : eventRegistrationRepository.findByEventId(event.getId())) {
                EventRegistration registration = eventRegistrationRepository.findByIdForUpdate(candidate.getId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Inscription introuvable pendant l'annulation"));
                boolean newlyCancelled = registration.getStatus() != EventRegistrationStatus.CANCELLED;
                var refund = refundProviderCancelledRegistration(registration);
                registration.setStatus(EventRegistrationStatus.CANCELLED);
                eventRegistrationRepository.save(registration);
                if (newlyCancelled || refund.refundedNowCents() > 0) {
                    notifyProviderCancellation(registration.getUser(), event, "EventRegistration", registration.getId(), refund);
                }
            }
        }
        if (event.getParkingSlot() == null) return;
        boolean open = event.getStatus() == EventStatus.PUBLISHED;
        ParkingSlot slot = event.getParkingSlot();
        slot.setStatus(open ? ParkingSlotStatus.OPEN : ParkingSlotStatus.CANCELLED);
        parkingSlotRepository.save(slot);
        if (!open) {
            parkingReservationRepository.findByParkingSlotId(slot.getId()).stream()
                    .filter(reservation -> event.getStatus() == EventStatus.CANCELLED || reservation.isComplimentary())
                    .filter(reservation -> event.getStatus() == EventStatus.CANCELLED || reservation.getStatus() != ParkingReservationStatus.CANCELLED)
                    .forEach(candidate -> {
                        ParkingReservation reservation = parkingReservationRepository.findByIdForUpdate(candidate.getId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Réservation parking introuvable pendant l'annulation"));
                        boolean newlyCancelled = reservation.getStatus() != ParkingReservationStatus.CANCELLED;
                        if (event.getStatus() == EventStatus.CANCELLED && !reservation.isComplimentary()
                                && (reservation.getEventRegistration() == null
                                || !java.util.Objects.equals(reservation.getPaymentIntentId(), reservation.getEventRegistration().getPaymentIntentId()))) {
                            long paid = priceCents(reservation.getTotalPrice());
                            var refund = refundProviderPayment(reservation.getPaymentIntentId(), paid, reservation.getUser(),
                                    PaymentType.PARKING, slot.getId(), reservation.getId());
                            if (newlyCancelled || refund.refundedNowCents() > 0) {
                                notifyProviderCancellation(reservation.getUser(), event, "ParkingReservation", reservation.getId(), refund);
                            }
                        }
                        reservation.setStatus(ParkingReservationStatus.CANCELLED);
                        parkingReservationRepository.save(reservation);
                        parkingAccessService.cancelPasses(reservation);
                    });
        }
    }

    /** Retryable even after the ticket was cancelled: service cancellation preserves refund rights. */
    public PaymentLifecycleService.RefundResult refundProviderCancelledRegistration(EventRegistration registration) {
        lockParkingInventory();
        if (registration.getEvent().getStatus() != EventStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'événement n'est pas annulé par son prestataire.");
        }
        ParkingReservation linked = parkingReservationRepository.findByEventRegistrationId(registration.getId()).orElse(null);
        long paid = priceCents(registration.getTotalPrice());
        if (linked != null && !linked.isComplimentary()
                && java.util.Objects.equals(linked.getPaymentIntentId(), registration.getPaymentIntentId())) {
            // Include the original parking charge even when its access has already been cancelled.
            paid += priceCents(linked.getTotalPrice());
        }
        return refundProviderPayment(registration.getPaymentIntentId(), paid, registration.getUser(),
                PaymentType.EVENT, registration.getEvent().getId(), registration.getId());
    }

    private PaymentLifecycleService.RefundResult refundProviderPayment(String intentId, long paid, User user,
                                                                       PaymentType type, Long resourceId,
                                                                       Long bookingId) {
        if (paid == 0L) return new PaymentLifecycleService.RefundResult(0L, 0L, PaymentStatus.REFUNDED);
        if (!StringUtils.hasText(intentId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Paiement historique manquant : la restitution intégrale doit être régularisée avant de confirmer l'annulation.");
        }
        return paymentLifecycleService.refundFullBookingPayment(intentId, paid, user, type, resourceId, bookingId);
    }

    private long priceCents(Double price) { return Math.round((price == null ? 0D : price) * 100D); }

    private void notifyProviderCancellation(User user, Event event, String sourceType, Long sourceId,
                                           PaymentLifecycleService.RefundResult refund) {
        if (user == null) return;
        String message = event.getTitle() + " a été annulé par son prestataire. "
                + (refund.status() == PaymentStatus.REFUNDED
                    ? "La restitution intégrale du paiement est confirmée."
                    : "Vous conservez le droit à la restitution intégrale du paiement. Le remboursement est en cours de traitement.");
        notificationService.create(user, NotificationTone.WARNING, "Événement annulé par le prestataire",
                message, "/my-reservations?tab=events", sourceType, sourceId);
    }

    private double calculateDurationHours(Event event) {
        if (event.getStartDateTime() == null || event.getEndDateTime() == null) {
            return 0D;
        }
        long minutes = Duration.between(event.getStartDateTime(), event.getEndDateTime()).toMinutes();
        return Math.max(0D, minutes / 60D);
    }

    private Integer getRoomCapacity(Event event) {
        return event.getSpace() != null ? event.getSpace().getCapacity() : event.getCapacity();
    }

    public record EventData(
            String title,
            String description,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime,
            Integer capacity,
            Double price,
            EventStatus status,
            EventLocationType locationType,
            Long spaceId,
            String externalAddress,
            String locationLabel,
            boolean parkingRequired,
            Double parkingPrice,
            Integer parkingCapacity
    ) {
        public static EventData from(be.meetspace.web.dto.EventRequestDto dto, EventStatus status) {
            return new EventData(
                    dto.getTitle(),
                    dto.getDescription(),
                    dto.getStartDateTime(),
                    dto.getEndDateTime(),
                    dto.getCapacity(),
                    dto.getPrice(),
                    status,
                    dto.getLocationType(),
                    dto.getSpaceId(),
                    dto.getExternalAddress(),
                    dto.getLocation(),
                    dto.getParkingRequired() != null && dto.getParkingRequired(),
                    dto.getParkingPrice(),
                    dto.getParkingCapacity()
            );
        }

        public static EventData from(be.meetspace.web.dto.EventRequest dto) {
            return new EventData(
                    dto.getTitle(),
                    dto.getDescription(),
                    dto.getStartDateTime(),
                    dto.getEndDateTime(),
                    dto.getCapacity(),
                    dto.getPrice(),
                    dto.getStatus(),
                    dto.getLocationType(),
                    dto.getSpaceId(),
                    dto.getExternalAddress(),
                    dto.getLocation(),
                    dto.isParkingRequired(),
                    dto.getParkingPrice(),
                    dto.getParkingCapacity()
            );
        }
    }
}
