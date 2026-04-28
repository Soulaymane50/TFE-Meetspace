package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Role;
import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.UserRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.UserService;
import be.meetspace.web.dto.UpdateUserRoleRequest;
import be.meetspace.web.dto.UserResponseDto;
import be.meetspace.web.dto.UserDetailResponseDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final UserRepository userRepository;
    private final AuditService auditService;
    private final UserService userService;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;

    public AdminUserController(UserRepository userRepository,
                               AuditService auditService,
                               UserService userService,
                               ReservationRepository reservationRepository,
                               EventRegistrationRepository eventRegistrationRepository,
                               ParkingReservationRepository parkingReservationRepository) {
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.userService = userService;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
    }

    @GetMapping
    public List<UserResponseDto> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponseDto> getUser(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(user -> ResponseEntity.ok(toDto(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<UserResponseDto> updateUserRole(
            @PathVariable Long id,
            @RequestBody UpdateUserRoleRequest request,
            HttpServletRequest httpRequest) {

        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        return userRepository.findById(id)
                .map(user -> {
                    Role oldRole = user.getRole();
                    user.setRole(request.getRole());
                    User saved = userRepository.save(user);

                    auditService.log(AuditAction.USER_ROLE_CHANGE, "USER", saved.getId(),
                            "Changement de rôle pour " + saved.getEmail(),
                            oldRole.name(), request.getRole().name(), ipAddress);

                    return ResponseEntity.ok(toDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<UserResponseDto> updateUserStatus(
            @PathVariable Long id,
            @RequestBody UpdateUserStatusRequest request,
            HttpServletRequest httpRequest) {

        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        return userRepository.findById(id)
                .map(user -> {
                    UserStatus oldStatus = user.getStatus();
                    user.setStatus(request.getStatus());
                    User saved = userRepository.save(user);

                    auditService.log(AuditAction.USER_STATUS_CHANGE, "USER", saved.getId(),
                            "Changement de statut pour " + saved.getEmail(),
                            oldStatus.name(), request.getStatus().name(), ipAddress);

                    return ResponseEntity.ok(toDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private UserResponseDto toDto(User user) {
        UserResponseDto dto = new UserResponseDto();
        dto.setId(user.getId());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole());
        dto.setStatus(user.getStatus());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        return dto;
    }

    public static class UpdateUserStatusRequest {
        private UserStatus status;

        public UserStatus getStatus() {
            return status;
        }

        public void setStatus(UserStatus status) {
            this.status = status;
        }
    }

    @PostMapping("/{id}/ban")
    public ResponseEntity<UserResponseDto> banUser(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {

        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        return userRepository.findById(id)
                .map(user -> {
                    User banned = userService.banUser(user, ipAddress);
                    return ResponseEntity.ok(toDto(banned));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/reactivate")
    public ResponseEntity<UserResponseDto> reactivateUser(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {

        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        return userRepository.findById(id)
                .map(user -> {
                    User reactivated = userService.reactivateUser(user, ipAddress);
                    return ResponseEntity.ok(toDto(reactivated));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/details")
    public ResponseEntity<UserDetailResponseDto> getUserDetails(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(user -> {
                    UserDetailResponseDto dto = new UserDetailResponseDto();
                    dto.setId(user.getId());
                    dto.setFirstName(user.getFirstName());
                    dto.setLastName(user.getLastName());
                    dto.setEmail(user.getEmail());
                    dto.setRole(user.getRole());
                    dto.setStatus(user.getStatus());
                    dto.setCreatedAt(user.getCreatedAt());
                    dto.setUpdatedAt(user.getUpdatedAt());

                    // Get all reservations and convert to simple DTOs to avoid circular references
                    dto.setSpaceReservations(
                        reservationRepository.findByUser(user).stream()
                            .map(UserDetailResponseDto.SimpleReservationDto::fromEntity)
                            .toList()
                    );
                    dto.setEventRegistrations(
                        eventRegistrationRepository.findByUserId(user.getId()).stream()
                            .map(UserDetailResponseDto.SimpleEventRegistrationDto::fromEntity)
                            .toList()
                    );
                    dto.setParkingReservations(
                        parkingReservationRepository.findByUserId(user.getId()).stream()
                            .map(UserDetailResponseDto.SimpleParkingReservationDto::fromEntity)
                            .toList()
                    );

                    return ResponseEntity.ok(dto);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

