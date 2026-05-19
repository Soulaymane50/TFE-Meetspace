package be.meetspace.web.controller;

import be.meetspace.config.JwtService;
import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Role;
import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.AuditService;
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

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final PasswordResetService passwordResetService;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          AuditService auditService,
                          PasswordResetService passwordResetService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/register")
    public AuthResponseDto register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email déjà utilisé");
        }

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.MEMBER);
        user.setStatus(UserStatus.ACTIVE);

        User saved = userRepository.save(user);

        // Audit log for user registration
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

        // Check user status before attempting authentication
        User existingUser = userRepository.findByEmail(request.getEmail()).orElse(null);
        if (existingUser != null && existingUser.getStatus() != UserStatus.ACTIVE) {
            String statusMessage = switch (existingUser.getStatus()) {
                case BANNED -> "BANNED";
                case DELETED -> "DELETED";
                case INACTIVE -> "INACTIVE";
                default -> "SUSPENDED";
            };
            auditService.logSecurityEvent(AuditAction.LOGIN_FAILURE, request.getEmail(),
                    "Tentative de connexion avec compte " + statusMessage.toLowerCase(), ipAddress);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, statusMessage);
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()
                    )
            );

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = userRepository.findByEmail(userDetails.getUsername())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable"));

            String token = jwtService.generateToken(userDetails);

            // Audit log for successful login
            auditService.logSecurityEvent(AuditAction.LOGIN_SUCCESS, user.getEmail(),
                    "Connexion réussie", ipAddress);

            return new AuthResponseDto(token, UserResponseDto.fromEntity(user));
        } catch (LockedException e) {
            // This shouldn't happen anymore since we check status above, but handle just in case
            auditService.logSecurityEvent(AuditAction.LOGIN_FAILURE, request.getEmail(),
                    "Tentative de connexion avec compte verrouillé", ipAddress);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "SUSPENDED");
        } catch (BadCredentialsException e) {
            // Audit log for failed login
            auditService.logSecurityEvent(AuditAction.LOGIN_FAILURE, request.getEmail(),
                    "Échec de connexion - identifiants incorrects", ipAddress);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect");
        }
    }

    @PostMapping("/forgot-password")
    public Map<String, String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestPasswordReset(request.getEmail());
        return Map.of(
                "message",
                "Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé."
        );
    }

    @PostMapping("/reset-password")
    public Map<String, String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
        return Map.of("message", "Mot de passe réinitialisé avec succès.");
    }
}

