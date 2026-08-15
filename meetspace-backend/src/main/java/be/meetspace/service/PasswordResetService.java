package be.meetspace.service;

import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class PasswordResetService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int TOKEN_VALIDITY_MINUTES = 30;
    public static final String INVALID_TOKEN_CODE = "PASSWORD_RESET_INVALID";
    public static final String EXPIRED_TOKEN_CODE = "PASSWORD_RESET_EXPIRED";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final PasswordPolicyService passwordPolicyService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String frontendUrl;
    private final boolean logResetLinkWhenEmailDisabled;

    public PasswordResetService(UserRepository userRepository,
                                PasswordEncoder passwordEncoder,
                                EmailService emailService,
                                PasswordPolicyService passwordPolicyService,
                                @Value("${app.frontend-url:http://localhost:5174}") String frontendUrl,
                                @Value("${app.password-reset.log-reset-link-when-email-disabled:false}") boolean logResetLinkWhenEmailDisabled) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.passwordPolicyService = passwordPolicyService;
        this.frontendUrl = frontendUrl;
        this.logResetLinkWhenEmailDisabled = logResetLinkWhenEmailDisabled;
    }

    @Transactional
    public void requestPasswordReset(String email) {
        String normalizedEmail = normalizeEmail(email);
        userRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .ifPresent(this::createTokenAndSendEmail);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_CODE);
        }

        passwordPolicyService.validateOrThrow(newPassword);

        String tokenHash = hashToken(token);
        User user = userRepository.findByPasswordResetTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_CODE));

        if (user.getPasswordResetExpiresAt() == null || user.getPasswordResetExpiresAt().isBefore(LocalDateTime.now())) {
            clearResetToken(user);
            userRepository.save(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, EXPIRED_TOKEN_CODE);
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.incrementTokenVersion();
        clearResetToken(user);
        userRepository.save(user);
    }

    private void createTokenAndSendEmail(User user) {
        String token = generateToken();
        user.setPasswordResetTokenHash(hashToken(token));
        user.setPasswordResetExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_VALIDITY_MINUTES));
        userRepository.save(user);

        String resetUrl = frontendUrl.replaceAll("/+$", "") + "/reset-password?token=" + token;
        if (!emailService.canSendMail()) {
            handleMissingEmailConfiguration(user, resetUrl);
            return;
        }

        try {
            emailService.sendPasswordResetEmail(user.getEmail(), user.getFirstName(), resetUrl);
        } catch (ResponseStatusException ex) {
            LOGGER.warn("Password reset email could not be sent for user id {}", user.getId(), ex);
            if (logResetLinkWhenEmailDisabled) {
                LOGGER.info("Local password reset link for {}: {}", user.getEmail(), resetUrl);
            } else {
                clearResetToken(user);
                userRepository.save(user);
            }
        }
    }

    private void handleMissingEmailConfiguration(User user, String resetUrl) {
        if (logResetLinkWhenEmailDisabled) {
            LOGGER.info("Email service disabled. Local password reset link for {}: {}", user.getEmail(), resetUrl);
            return;
        }

        LOGGER.warn("Email service disabled. Password reset token cleared for user id {}", user.getId());
        clearResetToken(user);
        userRepository.save(user);
    }

    private void clearResetToken(User user) {
        user.setPasswordResetTokenHash(null);
        user.setPasswordResetExpiresAt(null);
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
