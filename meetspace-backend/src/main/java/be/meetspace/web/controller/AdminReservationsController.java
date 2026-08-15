package be.meetspace.web.controller;

import be.meetspace.entity.*;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.web.dto.AdminReservationDto;
import be.meetspace.web.dto.AdminSpaceReservationDto;
import be.meetspace.web.dto.AdminEventRegistrationDto;
import be.meetspace.web.dto.AdminParkingReservationDto;
import be.meetspace.web.dto.ReservationApprovalRequest;
import be.meetspace.web.dto.ReservationResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/admin/reservations")
public class AdminReservationsController {

    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public AdminReservationsController(
            ReservationRepository reservationRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ParkingReservationRepository parkingReservationRepository,
            UserRepository userRepository,
            AuditService auditService
    ) {
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @GetMapping("/all")
    public List<AdminReservationDto> getAllReservations() {
        List<AdminReservationDto> allReservations = new ArrayList<>();

        reservationRepository.findAll().forEach(r -> {
            allReservations.add(AdminReservationDto.fromEspaceReservation(r));
        });

        eventRegistrationRepository.findAll().forEach(r -> {
            allReservations.add(AdminReservationDto.fromEventRegistration(r));
        });

        parkingReservationRepository.findAll().forEach(r -> {
            allReservations.add(AdminReservationDto.fromParkingReservation(r));
        });

        allReservations.sort(Comparator.comparing(AdminReservationDto::getCreatedAt).reversed());

        return allReservations;
    }

    @GetMapping("/spaces")
    public List<AdminSpaceReservationDto> getSpaceReservationsDetailed() {
        return reservationRepository.findAll().stream()
                .map(AdminSpaceReservationDto::fromEntity)
                .sorted(Comparator.comparing(AdminSpaceReservationDto::getCreatedAt).reversed())
                .toList();
    }

    @GetMapping("/events")
    public List<AdminEventRegistrationDto> getEventRegistrationsDetailed() {
        return eventRegistrationRepository.findAll().stream()
                .map(AdminEventRegistrationDto::fromEntity)
                .sorted(Comparator.comparing(AdminEventRegistrationDto::getCreatedAt).reversed())
                .toList();
    }

    @GetMapping("/parking")
    public List<AdminParkingReservationDto> getParkingReservationsDetailed() {
        return parkingReservationRepository.findAll().stream()
                .map(AdminParkingReservationDto::fromEntity)
                .sorted(Comparator.comparing(AdminParkingReservationDto::getCreatedAt).reversed())
                .toList();
    }

    @GetMapping("/espaces")
    public List<AdminReservationDto> getEspaceReservations() {
        return reservationRepository.findAll().stream()
                .map(AdminReservationDto::fromEspaceReservation)
                .sorted(Comparator.comparing(AdminReservationDto::getCreatedAt).reversed())
                .toList();
    }

    @GetMapping("/parking-summary")
    public List<AdminReservationDto> getParkingReservations() {
        return parkingReservationRepository.findAll().stream()
                .map(AdminReservationDto::fromParkingReservation)
                .sorted(Comparator.comparing(AdminReservationDto::getCreatedAt).reversed())
                .toList();
    }

    @GetMapping("/pending")
    public List<ReservationResponseDto> getPendingReservations() {
        return reservationRepository.findPendingApproval().stream()
                .map(ReservationResponseDto::fromEntity)
                .toList();
    }

    @GetMapping("/{id}")
    public ReservationResponseDto getReservationById(@PathVariable Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Réservation introuvable"));
        return ReservationResponseDto.fromEntity(reservation);
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public ReservationResponseDto approveReservation(
            @PathVariable Long id,
            @Valid @RequestBody ReservationApprovalRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        Reservation reservation = reservationRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Réservation introuvable"));

        if (reservation.getStatus() != ReservationStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cette réservation n'est pas en attente d'approbation");
        }

        String email = authentication.getName();
        User admin = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin introuvable"));

        ReservationStatus oldStatus = reservation.getStatus();

        if (request.getApproved()) {
            reservation.setStatus(ReservationStatus.APPROVED);
            reservation.setApprovedBy(admin);
            reservation.setApprovedAt(LocalDateTime.now());
            reservation.setPaymentDueAt(LocalDateTime.now().plusHours(48));

            auditService.log(AuditAction.RESERVATION_APPROVE, "RESERVATION", reservation.getId(),
                    "Réservation approuvée pour l'espace: " + reservation.getEspace().getName(),
                    oldStatus.name(), ReservationStatus.APPROVED.name(), ipAddress);
        } else {
            if (request.getRejectionReason() == null || request.getRejectionReason().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Une raison de rejet est requise");
            }
            reservation.setStatus(ReservationStatus.REJECTED);
            reservation.setRejectionReason(request.getRejectionReason());
            reservation.setApprovedBy(admin);
            reservation.setApprovedAt(LocalDateTime.now());
            reservation.setPaymentDueAt(null);

            auditService.log(AuditAction.RESERVATION_REJECT, "RESERVATION", reservation.getId(),
                    "Réservation rejetée - Raison: " + request.getRejectionReason(),
                    oldStatus.name(), ReservationStatus.REJECTED.name(), ipAddress);
        }

        Reservation saved = reservationRepository.save(reservation);
        return ReservationResponseDto.fromEntity(saved);
    }
}
