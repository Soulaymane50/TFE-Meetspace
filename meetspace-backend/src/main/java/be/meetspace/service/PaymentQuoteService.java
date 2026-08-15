package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.dto.PaymentRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.Locale;

@Service
public class PaymentQuoteService {

    private final EventRepository eventRepository;
    private final EspaceRepository espaceRepository;
    private final ParkingSlotRepository parkingSlotRepository;
    private final ReservationRepository reservationRepository;

    public PaymentQuoteService(EventRepository eventRepository,
                               EspaceRepository espaceRepository,
                               ParkingSlotRepository parkingSlotRepository,
                               ReservationRepository reservationRepository) {
        this.eventRepository = eventRepository;
        this.espaceRepository = espaceRepository;
        this.parkingSlotRepository = parkingSlotRepository;
        this.reservationRepository = reservationRepository;
    }

    public PaymentQuote quote(PaymentRequest request, User user) {
        PaymentType type = normalizeType(request);
        long amountCents = switch (type) {
            case EVENT -> quoteEvent(request);
            case PARKING -> quoteParking(request);
            case SPACE -> quoteSpace(request);
            case PREMIUM_ROOM -> quotePremiumRoom(request, user);
        };
        if (amountCents <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le montant doit etre superieur a zero.");
        }
        if (request.getAmount() != null && request.getAmount() != amountCents) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le montant affiche n'est plus a jour. Actualisez la reservation.");
        }
        String currency = request.getCurrency() == null ? "eur" : request.getCurrency().trim().toLowerCase(Locale.ROOT);
        if (!"eur".equals(currency)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MeetSpace accepte uniquement les paiements en euros.");
        }
        Long resourceId = switch (type) {
            case EVENT -> request.getEventId();
            case PARKING -> request.getParkingSlotId();
            case SPACE -> request.getEspaceId();
            case PREMIUM_ROOM -> request.getReservationId();
        };
        return new PaymentQuote(type, amountCents, currency, resourceId);
    }

    public long calculateRoomPriceCents(Espace espace, java.time.LocalDateTime start, java.time.LocalDateTime end) {
        if (start == null || end == null || !end.isAfter(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le creneau de reservation est invalide.");
        }
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes < 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La duree minimale de reservation est d'une heure.");
        }
        BigDecimal hours = BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
        BigDecimal base = BigDecimal.valueOf(espace.getBasePrice() != null ? espace.getBasePrice() : 0D);
        BigDecimal discount = minutes >= 8 * 60 ? BigDecimal.valueOf(0.85)
                : minutes >= 4 * 60 ? BigDecimal.valueOf(0.92)
                : BigDecimal.ONE;
        return toCents(base.multiply(hours).multiply(discount));
    }

    private long quoteSpace(PaymentRequest request) {
        if (request.getEspaceId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La salle est requise.");
        }
        Espace espace = espaceRepository.findById(request.getEspaceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salle introuvable."));
        if (espace.getType() == EspaceType.PREMIUM_ROOM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette salle premium necessite une validation prealable.");
        }
        return calculateRoomPriceCents(espace, request.getStartDateTime(), request.getEndDateTime());
    }

    private long quotePremiumRoom(PaymentRequest request, User user) {
        if (request.getReservationId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La reservation est requise.");
        }
        Reservation reservation = reservationRepository.findById(request.getReservationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation introuvable."));
        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette reservation ne vous appartient pas.");
        }
        return toCents(BigDecimal.valueOf(reservation.getTotalPrice() != null ? reservation.getTotalPrice() : 0D));
    }

    private long quoteEvent(PaymentRequest request) {
        if (request.getEventId() == null || request.getNumberOfParticipants() == null || request.getNumberOfParticipants() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les participants sont requis.");
        }
        Event event = eventRepository.findById(request.getEventId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable."));
        BigDecimal total = BigDecimal.valueOf(event.getPrice() != null ? event.getPrice() : 0D)
                .multiply(BigDecimal.valueOf(request.getNumberOfParticipants()));
        if (request.getReservedSpaces() != null && request.getReservedSpaces() > 0) {
            ParkingSlot slot = event.getParkingSlot();
            if (slot == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet evenement ne propose pas de parking.");
            }
            total = total.add(BigDecimal.valueOf(slot.getParkingRate() != null ? slot.getParkingRate() : 0D)
                    .multiply(BigDecimal.valueOf(request.getReservedSpaces())));
        }
        return toCents(total);
    }

    private long quoteParking(PaymentRequest request) {
        if (request.getParkingSlotId() == null || request.getReservedSpaces() == null || request.getReservedSpaces() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les places de parking sont requises.");
        }
        ParkingSlot slot = parkingSlotRepository.findById(request.getParkingSlotId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Creneau parking introuvable."));
        return toCents(BigDecimal.valueOf(slot.getParkingRate() != null ? slot.getParkingRate() : 0D)
                .multiply(BigDecimal.valueOf(request.getReservedSpaces())));
    }

    private static PaymentType normalizeType(PaymentRequest request) {
        String raw = request.getReservationType() == null ? "" : request.getReservationType().trim().toUpperCase(Locale.ROOT);
        if (("SPACE".equals(raw) || "ESPACE".equals(raw) || "PREMIUM_ROOM".equals(raw))
                && request.getReservationId() != null) {
            return PaymentType.PREMIUM_ROOM;
        }
        return switch (raw) {
            case "SPACE", "ESPACE" -> PaymentType.SPACE;
            case "PREMIUM_ROOM" -> PaymentType.PREMIUM_ROOM;
            case "EVENT" -> PaymentType.EVENT;
            case "PARKING" -> PaymentType.PARKING;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type de reservation invalide.");
        };
    }

    private static long toCents(BigDecimal amount) {
        return amount.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    public record PaymentQuote(PaymentType type, long amountCents, String currency, Long resourceId) {}
}
