package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.dto.PaymentRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class BookingHoldService {

    private final BookingHoldRepository holdRepository;
    private final EspaceRepository espaceRepository;
    private final EventRepository eventRepository;
    private final ParkingSlotRepository parkingSlotRepository;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final long holdMinutes;

    public BookingHoldService(
            BookingHoldRepository holdRepository,
            EspaceRepository espaceRepository,
            EventRepository eventRepository,
            ParkingSlotRepository parkingSlotRepository,
            ReservationRepository reservationRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ParkingReservationRepository parkingReservationRepository,
            @Value("${app.payments.hold-minutes:15}") long holdMinutes
    ) {
        this.holdRepository = holdRepository;
        this.espaceRepository = espaceRepository;
        this.eventRepository = eventRepository;
        this.parkingSlotRepository = parkingSlotRepository;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.holdMinutes = Math.max(5L, holdMinutes);
    }

    @Transactional
    public BookingHold createHold(PaymentRequest request, User user, PaymentType type, long amountCents) {
        BookingHold hold = switch (type) {
            case SPACE -> createSpaceHold(request, user, amountCents);
            case PREMIUM_ROOM -> createPremiumRoomHold(request, user, amountCents);
            case EVENT -> createEventHold(request, user, amountCents);
            case PARKING -> createParkingHold(request, user, amountCents);
        };
        hold.setToken(UUID.randomUUID().toString().replace("-", ""));
        hold.setUser(user);
        hold.setType(type);
        hold.setAmountCents(amountCents);
        hold.setStatus(BookingHoldStatus.ACTIVE);
        hold.setExpiresAt(LocalDateTime.now().plusMinutes(holdMinutes));
        return holdRepository.save(hold);
    }

    @Transactional
    public BookingHold consume(String token, User user, PaymentType type, long amountCents) {
        BookingHold hold = holdRepository.findByTokenForUpdate(token)
                .orElseThrow(() -> conflict("Le blocage temporaire de la reservation est introuvable."));
        if (hold.getStatus() != BookingHoldStatus.ACTIVE || !hold.getExpiresAt().isAfter(LocalDateTime.now())) {
            hold.setStatus(BookingHoldStatus.EXPIRED);
            throw conflict("Le delai de paiement est expire. Veuillez verifier de nouveau la disponibilite.");
        }
        if (!hold.getUser().getId().equals(user.getId()) || hold.getType() != type || hold.getAmountCents() != amountCents) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce blocage ne correspond pas a votre paiement.");
        }
        hold.setStatus(BookingHoldStatus.CONSUMED);
        return hold;
    }

    @Transactional
    public void cancel(BookingHold hold) {
        if (hold != null && hold.getStatus() == BookingHoldStatus.ACTIVE) {
            hold.setStatus(BookingHoldStatus.CANCELLED);
        }
    }

    public long getHoldSeconds() {
        return holdMinutes * 60L;
    }

    private BookingHold createSpaceHold(PaymentRequest request, User user, long amountCents) {
        if (request.getEspaceId() == null || request.getStartDateTime() == null || request.getEndDateTime() == null) {
            throw badRequest("Le creneau complet de la salle est requis.");
        }
        Espace espace = espaceRepository.findByIdForUpdate(request.getEspaceId())
                .orElseThrow(() -> notFound("Salle introuvable."));
        if (espace.getStatus() != EspaceStatus.AVAILABLE || espace.getType() == EspaceType.PREMIUM_ROOM) {
            throw badRequest("Cette salle n'est pas disponible en reservation immediate.");
        }
        validateDateWindow(request.getStartDateTime(), request.getEndDateTime());
        if (reservationRepository.existsOverlappingReservation(espace.getId(), request.getStartDateTime(), request.getEndDateTime())
                || eventRepository.existsOverlappingEventForSpace(espace.getId(), request.getStartDateTime(), request.getEndDateTime(), null)
                || hasOverlappingHold(PaymentType.SPACE, espace.getId(), request.getStartDateTime(), request.getEndDateTime())) {
            throw conflict("Ce creneau vient d'etre reserve. Choisissez un autre horaire.");
        }

        BookingHold hold = baseHold(espace.getId(), amountCents);
        hold.setStartAt(request.getStartDateTime());
        hold.setEndAt(request.getEndDateTime());
        return hold;
    }

    private BookingHold createPremiumRoomHold(PaymentRequest request, User user, long amountCents) {
        if (request.getReservationId() == null) {
            throw badRequest("La demande de salle premium est requise.");
        }
        Reservation reservation = reservationRepository.findByIdForUpdate(request.getReservationId())
                .orElseThrow(() -> notFound("Reservation introuvable."));
        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette reservation ne vous appartient pas.");
        }
        if (reservation.getStatus() != ReservationStatus.APPROVED) {
            throw badRequest("Cette demande n'est pas en attente de paiement.");
        }
        if (reservation.getPaymentDueAt() != null && !reservation.getPaymentDueAt().isAfter(LocalDateTime.now())) {
            reservation.setStatus(ReservationStatus.CANCELLED);
            throw conflict("Le delai de paiement de cette demande est expire.");
        }
        return baseHold(reservation.getId(), amountCents);
    }

    private BookingHold createEventHold(PaymentRequest request, User user, long amountCents) {
        if (request.getEventId() == null || request.getNumberOfParticipants() == null || request.getNumberOfParticipants() < 1) {
            throw badRequest("Le nombre de participants est invalide.");
        }
        Event event = eventRepository.findByIdForUpdate(request.getEventId())
                .orElseThrow(() -> notFound("Evenement introuvable."));
        if (event.getStatus() != EventStatus.PUBLISHED || !event.getStartDateTime().isAfter(LocalDateTime.now())) {
            throw badRequest("Cet evenement n'est plus ouvert aux inscriptions.");
        }
        if (eventRegistrationRepository.existsByUserAndEventAndStatusNot(user, event, EventRegistrationStatus.CANCELLED)) {
            throw badRequest("Vous etes deja inscrit a cet evenement.");
        }

        int actualParticipants = eventRegistrationRepository.countTotalParticipantsByEventId(event.getId());
        int heldParticipants = activeQuantity(PaymentType.EVENT, event.getId());
        if (event.getCapacity() != null && actualParticipants + heldParticipants + request.getNumberOfParticipants() > event.getCapacity()) {
            throw conflict("Le nombre de places restantes a change. Actualisez votre inscription.");
        }

        BookingHold hold = baseHold(event.getId(), amountCents);
        hold.setQuantity(request.getNumberOfParticipants());
        hold.setStartAt(event.getStartDateTime());
        hold.setEndAt(event.getEndDateTime());

        if (request.getReservedSpaces() != null && request.getReservedSpaces() > 0) {
            ParkingSlot slot = event.getParkingSlot();
            if (slot == null || slot.getStatus() != ParkingSlotStatus.OPEN) {
                throw badRequest("Le parking n'est pas disponible pour cet evenement.");
            }
            validateParkingCapacity(slot, request.getReservedSpaces());
            hold.setSecondaryResourceId(slot.getId());
            hold.setSecondaryQuantity(request.getReservedSpaces());
        }
        return hold;
    }

    private BookingHold createParkingHold(PaymentRequest request, User user, long amountCents) {
        if (request.getParkingSlotId() == null || request.getReservedSpaces() == null || request.getReservedSpaces() < 1) {
            throw badRequest("Le nombre de places de parking est invalide.");
        }
        ParkingSlot slot = parkingSlotRepository.findByIdForUpdate(request.getParkingSlotId())
                .orElseThrow(() -> notFound("Creneau parking introuvable."));
        if (slot.getStatus() != ParkingSlotStatus.OPEN || slot.getSessionDate().isBefore(java.time.LocalDate.now())) {
            throw badRequest("Ce creneau parking n'est plus disponible.");
        }
        validateParkingCapacity(slot, request.getReservedSpaces());

        BookingHold hold = baseHold(slot.getId(), amountCents);
        hold.setQuantity(request.getReservedSpaces());
        hold.setStartAt(LocalDateTime.of(slot.getSessionDate(), slot.getStartTime()));
        hold.setEndAt(LocalDateTime.of(slot.getSessionDate(), slot.getEndTime()));
        return hold;
    }

    private void validateParkingCapacity(ParkingSlot slot, int requested) {
        int actual = parkingReservationRepository.countReservedSpacesByParkingSlotId(slot.getId());
        int held = activeQuantity(PaymentType.PARKING, slot.getId()) + activeSecondaryQuantity(slot.getId());
        if (actual + held + requested > slot.getCapacity()) {
            throw conflict("Le nombre de places parking restantes a change. Actualisez votre demande.");
        }
    }

    private int activeQuantity(PaymentType type, Long resourceId) {
        return holdRepository.findActiveForResource(type, resourceId, BookingHoldStatus.ACTIVE, LocalDateTime.now()).stream()
                .map(BookingHold::getQuantity)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
    }

    private int activeSecondaryQuantity(Long resourceId) {
        return holdRepository.findActiveForSecondaryResource(resourceId, BookingHoldStatus.ACTIVE, LocalDateTime.now()).stream()
                .map(BookingHold::getSecondaryQuantity)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
    }

    private boolean hasOverlappingHold(PaymentType type, Long resourceId, LocalDateTime start, LocalDateTime end) {
        return holdRepository.findActiveForResource(type, resourceId, BookingHoldStatus.ACTIVE, LocalDateTime.now()).stream()
                .anyMatch(hold -> hold.getStartAt() != null && hold.getEndAt() != null
                        && hold.getStartAt().isBefore(end) && hold.getEndAt().isAfter(start));
    }

    private static BookingHold baseHold(Long resourceId, long amountCents) {
        BookingHold hold = new BookingHold();
        hold.setResourceId(resourceId);
        hold.setQuantity(1);
        hold.setSecondaryQuantity(0);
        hold.setAmountCents(amountCents);
        return hold;
    }

    private static void validateDateWindow(LocalDateTime start, LocalDateTime end) {
        if (!start.isAfter(LocalDateTime.now()) || !end.isAfter(start)) {
            throw badRequest("Le creneau doit etre futur et sa fin posterieure a son debut.");
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
