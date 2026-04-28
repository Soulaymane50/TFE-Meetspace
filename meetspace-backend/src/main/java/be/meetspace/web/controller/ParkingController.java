package be.meetspace.web.controller;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.web.dto.ParkingReservationRequest;
import be.meetspace.web.dto.ParkingReservationResponseDto;
import be.meetspace.web.dto.ParkingSlotResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/public/parking")
public class ParkingController {

    private final ParkingSlotRepository sessionRepository;
    private final ParkingReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final PaymentVerifier paymentVerifier;
    private final AuditService auditService;

    public ParkingController(ParkingSlotRepository sessionRepository,
                              ParkingReservationRepository reservationRepository,
                              UserRepository userRepository,
                              PaymentVerifier paymentVerifier,
                              AuditService auditService) {
        this.sessionRepository = sessionRepository;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.paymentVerifier = paymentVerifier;
        this.auditService = auditService;
    }

    @GetMapping("/sessions")
    public List<ParkingSlotResponseDto> listOpenSessions() {
        List<ParkingSlot> sessions =
                sessionRepository.findByStatusAndSessionDateGreaterThanEqualOrderBySessionDateAsc(
                        ParkingSlotStatus.OPEN,
                        LocalDate.now()
                );
        return sessions.stream()
                .map(s -> {
                    Integer registeredCount = reservationRepository.countReservedSpacesByParkingSlotId(s.getId());
                    return ParkingSlotResponseDto.fromEntity(s, registeredCount);
                })
                .toList();
    }

    @PostMapping("/reservations")
    public ParkingReservationResponseDto createReservation(
            @Valid @RequestBody ParkingReservationRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        paymentVerifier.verifyPayment(request.getPaymentIntentId());

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        ParkingSlot session = sessionRepository.findById(request.getParkingSlotId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Créneau parking introuvable"));

        if (session.getStatus() != ParkingSlotStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session non ouverte à la réservation");
        }

        int reservedSpaces = request.getReservedSpaces();
        if (reservedSpaces <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre de places invalide");
        }

        Integer currentReservedSpaces = reservationRepository.countReservedSpacesByParkingSlotId(session.getId());
        if (currentReservedSpaces + reservedSpaces > session.getCapacity()) {
            int remaining = session.getCapacity() - currentReservedSpaces;
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Capacité insuffisante. Places restantes : " + remaining);
        }

        double totalPrice = session.getParkingRate() * reservedSpaces;

        ParkingReservation reservation = new ParkingReservation();
        reservation.setUser(user);
        reservation.setParkingSlot(session);
        reservation.setReservedSpaces(reservedSpaces);
        reservation.setTotalPrice(totalPrice);
        reservation.setPaymentIntentId(request.getPaymentIntentId());
        reservation.setStatus(ParkingReservationStatus.CONFIRMED);

        ParkingReservation saved = reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PARKING_RESERVATION_CREATE, "ParkingReservation", saved.getId(),
                String.format("Réservation parking: %s (%d places)", session.getTitle(), reservedSpaces),
                ipAddress);

        return ParkingReservationResponseDto.fromEntity(saved);
    }

    @GetMapping("/reservations/me")
    public List<ParkingReservationResponseDto> listMyReservations(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        List<ParkingReservation> reservations =
                reservationRepository.findByUserId(user.getId());

        return reservations.stream()
                .map(ParkingReservationResponseDto::fromEntity)
                .toList();
    }

    @DeleteMapping("/reservations/{id}/cancel")
    public void cancelReservation(@PathVariable Long id, Authentication authentication, HttpServletRequest httpRequest) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        ParkingReservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Réservation introuvable"));

        if (!reservation.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas annuler cette réservation");
        }

        if (reservation.getParkingSlot().getSessionDate().isBefore(java.time.LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La session est déjà passée");
        }

        if (reservation.getStatus() == ParkingReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cette réservation est déjà annulée");
        }

        String oldStatus = reservation.getStatus().name();
        reservation.setStatus(ParkingReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PARKING_RESERVATION_CANCEL, "ParkingReservation", reservation.getId(),
                String.format("Annulation réservation parking: %s", reservation.getParkingSlot().getTitle()),
                oldStatus, "CANCELLED", ipAddress);
    }
}

