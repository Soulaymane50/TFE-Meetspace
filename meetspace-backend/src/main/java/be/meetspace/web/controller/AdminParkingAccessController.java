package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.ParkingAccessPass;
import be.meetspace.entity.ParkingAccessPassStatus;
import be.meetspace.entity.ParkingReservationStatus;
import be.meetspace.entity.ParkingSlotStatus;
import be.meetspace.entity.User;
import be.meetspace.repository.ParkingAccessPassRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.web.dto.ParkingAccessCheckInRequest;
import be.meetspace.web.dto.ParkingAccessCheckInResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/admin/parking/access")
public class AdminParkingAccessController {
    private final ParkingAccessPassRepository passRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public AdminParkingAccessController(ParkingAccessPassRepository passRepository,
                                        UserRepository userRepository,
                                        AuditService auditService) {
        this.passRepository = passRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @PostMapping("/check-in")
    @Transactional
    public ParkingAccessCheckInResponse checkIn(@Valid @RequestBody ParkingAccessCheckInRequest request,
                                                Authentication authentication,
                                                HttpServletRequest httpRequest) {
        User admin = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
        ParkingAccessPass pass = passRepository.findByTokenForUpdate(normalize(request.getPass()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Laissez-passer parking invalide"));
        if (pass.getParkingReservation().getStatus() == ParkingReservationStatus.CANCELLED
                || pass.getStatus() == ParkingAccessPassStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce laissez-passer a été annulé");
        }
        if (pass.getParkingReservation().getParkingSlot().getStatus() != ParkingSlotStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Le créneau parking lié à ce laissez-passer n'est plus actif");
        }
        boolean alreadyUsed = pass.getStatus() == ParkingAccessPassStatus.USED;
        if (!alreadyUsed) {
            pass.setStatus(ParkingAccessPassStatus.USED);
            pass.setCheckedInAt(LocalDateTime.now());
            pass.setCheckedInBy(admin);
            passRepository.save(pass);
            auditService.log(AuditAction.PARKING_CHECK_IN, "ParkingAccessPass", pass.getId(),
                    "Contrôle d'accès parking: " + pass.getParkingReservation().getParkingSlot().getTitle(),
                    AuditService.getClientIpAddress(httpRequest));
        }
        return ParkingAccessCheckInResponse.fromEntity(pass, alreadyUsed);
    }

    private String normalize(String raw) {
        String value = raw == null ? "" : raw.trim().replaceAll("[\\u200B-\\u200D\\uFEFF]", "");
        if (value.regionMatches(true, 0, "MS-PARKING:", 0, 11)) value = value.substring(11);
        value = value.replaceAll("[\\s-]+", "");
        if (!value.matches("[A-Za-z0-9]{24,64}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de laissez-passer invalide");
        }
        return value;
    }
}
