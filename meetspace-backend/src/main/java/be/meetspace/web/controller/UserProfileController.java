package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.User;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AccountDeletionService;
import be.meetspace.service.EmailChangeService;
import be.meetspace.web.dto.EmailChangeRequest;
import be.meetspace.service.AuditService;
import be.meetspace.service.PasswordPolicyService;
import be.meetspace.web.dto.AccountDeletionConfirmRequest;
import be.meetspace.web.dto.ChangePasswordRequest;
import be.meetspace.web.dto.UserProfileResponseDto;
import be.meetspace.web.dto.UserProfileUpdateRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;

@RestController
@RequestMapping("/api/user")
public class UserProfileController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final PasswordPolicyService passwordPolicyService;
    private final AccountDeletionService accountDeletionService;
    private final EmailChangeService emailChangeService;

    public UserProfileController(UserRepository userRepository,
                                 PasswordEncoder passwordEncoder,
                                 AuditService auditService,
                                 PasswordPolicyService passwordPolicyService,
                                 AccountDeletionService accountDeletionService,
                                 EmailChangeService emailChangeService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.passwordPolicyService = passwordPolicyService;
        this.accountDeletionService = accountDeletionService;
        this.emailChangeService = emailChangeService;
    }

    @GetMapping("/me")
    public UserProfileResponseDto getMe(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        return UserProfileResponseDto.fromEntity(user);
    }

    @PutMapping("/me")
    public UserProfileResponseDto updateMe(
            @Valid @RequestBody UserProfileUpdateRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        String oldEmail = user.getEmail();
        String normalizedEmail = normalizeEmail(request.getEmail());
        if (!oldEmail.equalsIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "EMAIL_CHANGE_REQUIRES_VERIFICATION");
        }

        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setUpdatedAt(LocalDateTime.now());

        User saved = userRepository.save(user);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.USER_UPDATE, "User", saved.getId(),
                String.format("Mise à jour profil utilisateur: %s %s", saved.getFirstName(), saved.getLastName()),
                oldEmail, saved.getEmail(), ipAddress);

        return UserProfileResponseDto.fromEntity(saved);
    }

    @PostMapping("/change-password")
    public void changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mot de passe actuel incorrect");
        }

        passwordPolicyService.validateOrThrow(request.getNewPassword());

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.incrementTokenVersion();
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // Audit log
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        auditService.log(AuditAction.PASSWORD_CHANGE, "User", user.getId(),
                "Changement de mot de passe effectué", ipAddress);
    }

    @PostMapping("/me/email-change-request")
    public void requestEmailChange(@Valid @RequestBody EmailChangeRequest request,
                                   Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }
        User user = userRepository.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));
        emailChangeService.request(user, request.getNewEmail(), request.getCurrentPassword());
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMyAccount(
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecté");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        accountDeletionService.requestDeletion(user);

        return ResponseEntity.accepted().build();
    }

    @PostMapping("/me/deletion-request")
    public ResponseEntity<Void> requestAccountDeletion(
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        return deleteMyAccount(authentication, httpRequest);
    }

    @PostMapping("/me/deletion-confirm")
    public ResponseEntity<Void> confirmAccountDeletion(
            @Valid @RequestBody AccountDeletionConfirmRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Non connecte");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        accountDeletionService.confirmDeletion(user, request.getToken(), ipAddress);

        return ResponseEntity.noContent().build();
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}

