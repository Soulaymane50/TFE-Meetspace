package be.meetspace.service;

import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.UserRepository;
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

    private static final int TOKEN_VALIDITY_MINUTES = 30;
    private static final String EMAIL_NOT_CONFIGURED_MESSAGE =
            "Service email non configuré. Renseignez la configuration SMTP.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String frontendUrl;

    public PasswordResetService(UserRepository userRepository,
                                PasswordEncoder passwordEncoder,
                                EmailService emailService,
                                @Value("${app.frontend-url:http://localhost:5174}") String frontendUrl) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.frontendUrl = frontendUrl;
    }

    @Transactional
    public void requestPasswordReset(String email) {
        if (!emailService.canSendMail()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, EMAIL_NOT_CONFIGURED_MESSAGE);
        }

        String normalizedEmail = normalizeEmail(email);
        userRepository.findByEmail(normalizedEmail)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .ifPresent(this::createTokenAndSendEmail);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        String tokenHash = hashToken(token);
        User user = userRepository.findByPasswordResetTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lien de réinitialisation invalide"));

        if (user.getPasswordResetExpiresAt() == null || user.getPasswordResetExpiresAt().isBefore(LocalDateTime.now())) {
            clearResetToken(user);
            userRepository.save(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lien de réinitialisation expiré");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        clearResetToken(user);
        userRepository.save(user);
    }

    private void createTokenAndSendEmail(User user) {
        String token = generateToken();
        user.setPasswordResetTokenHash(hashToken(token));
        user.setPasswordResetExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_VALIDITY_MINUTES));
        userRepository.save(user);

        String resetUrl = frontendUrl.replaceAll("/+$", "") + "/reset-password?token=" + token;
        try {
            emailService.sendPasswordResetEmail(user.getEmail(), user.getFirstName(), resetUrl);
        } catch (ResponseStatusException ex) {
            clearResetToken(user);
            userRepository.save(user);
            throw ex;
        }
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
            throw new IllegalStateException("SHA-256 indisponible", ex);
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
