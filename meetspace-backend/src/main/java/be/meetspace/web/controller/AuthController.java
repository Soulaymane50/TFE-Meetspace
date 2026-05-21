package be.meetspace.web.controller;

import be.meetspace.config.JwtService;
import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Role;
import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
import be.meetspace.service.PasswordPolicyService;
import be.meetspace.service.PasswordResetService;
import be.meetspace.web.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final PasswordPolicyService passwordPolicyService;
    private final PasswordResetService passwordResetService;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          AuditService auditService,
                          PasswordPolicyService passwordPolicyService,
                          PasswordResetService passwordResetService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.passwordPolicyService = passwordPolicyService;
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/register")
    public AuthResponseDto register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        String normalizedEmail = normalizeEmail(request.getEmail());

        if (!Objects.equals(request.getPassword(), request.getConfirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PASSWORD_CONFIRMATION_MISMATCH");
        }

        passwordPolicyService.validateOrThrow(request.getPassword());

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS");
        }

        User user = new User();
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.MEMBER);
        user.setStatus(UserStatus.ACTIVE);

        User saved = userRepository.save(user);

        auditService.logSecurityEvent(AuditAction.USER_CREATE, saved.getEmail(),
                "Nouvel utilisateur inscrit: " + saved.getFirstName() + " " + saved.getLastName(), ipAddress);

        UserDetails userDetails = org.springframework.security.core.userdetails.User
                .withUsername(saved.getEmail())
                .password(saved.getPasswordHash())
                .authorities("ROLE_" + saved.getRole().name())
                .build();

        String token = jwtService.generateToken(userDetails);

        return new AuthResponseDto(token, UserResponseDto.fromEntity(saved));
    }

    @PostMapping("/logout")
    public void logout(Authentication authentication, HttpServletRequest httpRequest) {
        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        if (authentication != null && authentication.getName() != null) {
            auditService.logSecurityEvent(AuditAction.LOGOUT, authentication.getName(),
                    "Déconnexion utilisateur", ipAddress);
        }
    }

    @PostMapping("/login")
    public AuthResponseDto login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        String normalizedEmail = normalizeEmail(request.getEmail());

        User existingUser = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (existingUser != null && existingUser.getStatus() != UserStatus.ACTIVE) {
            String statusMessage = switch (existingUser.getStatus()) {
                case BANNED -> "BANNED";
                case DELETED -> "DELETED";
                case INACTIVE -> "INACTIVE";
                default -> "SUSPENDED";
            };
            auditService.logSecurityEvent(AuditAction.LOGIN_FAILURE, normalizedEmail,
                    "Tentative de connexion avec compte " + statusMessage.toLowerCase(), ipAddress);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, statusMessage);
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            normalizedEmail,
                            request.getPassword()
                    )
            );

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = userRepository.findByEmailIgnoreCase(userDetails.getUsername())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND"));

            String token = jwtService.generateToken(userDetails);

            auditService.logSecurityEvent(AuditAction.LOGIN_SUCCESS, user.getEmail(),
                    "Connexion réussie", ipAddress);

            return new AuthResponseDto(token, UserResponseDto.fromEntity(user));
        } catch (LockedException e) {
            auditService.logSecurityEvent(AuditAction.LOGIN_FAILURE, normalizedEmail,
                    "Tentative de connexion avec compte verrouillé", ipAddress);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "SUSPENDED");
        } catch (BadCredentialsException e) {
            auditService.logSecurityEvent(AuditAction.LOGIN_FAILURE, normalizedEmail,
                    "Échec de connexion - identifiants incorrects", ipAddress);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect");
        }
    }

    @PostMapping("/forgot-password")
    public Map<String, String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestPasswordReset(request.getEmail());
        return Map.of(
                "message",
                "Si un compte existe avec cette adresse, un lien de réinitialisation a été envoyé."
        );
    }

    @PostMapping("/reset-password")
    public Map<String, String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
        return Map.of("message", "Mot de passe réinitialisé avec succès.");
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
