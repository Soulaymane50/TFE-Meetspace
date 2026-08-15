package be.meetspace.service;

import be.meetspace.entity.User;
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
public class EmailChangeService {

    private static final int VALIDITY_MINUTES = 30;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final String frontendUrl;
    private final SecureRandom secureRandom = new SecureRandom();

    public EmailChangeService(UserRepository userRepository,
                              PasswordEncoder passwordEncoder,
                              EmailService emailService,
                              @Value("${app.frontend-url:http://localhost:5174}") String frontendUrl) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.frontendUrl = frontendUrl;
    }

    @Transactional
    public void request(User user, String newEmail, String currentPassword) {
        String normalized = normalize(newEmail);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INVALID");
        }
        if (normalized.equalsIgnoreCase(user.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EMAIL_UNCHANGED");
        }
        if (userRepository.existsByEmailIgnoreCase(normalized)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS");
        }
        if (!emailService.canSendMail()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_SERVICE_UNAVAILABLE");
        }

        String token = generateToken();
        user.setPendingEmail(normalized);
        user.setEmailChangeTokenHash(hash(token));
        user.setEmailChangeExpiresAt(LocalDateTime.now().plusMinutes(VALIDITY_MINUTES));
        userRepository.save(user);

        String confirmationUrl = frontendUrl.replaceAll("/+$", "") + "/confirm-email-change?token=" + token;
        emailService.sendEmailChangeConfirmation(normalized, user.getFirstName(), confirmationUrl);
    }

    @Transactional
    public String confirm(String token) {
        User user = userRepository.findByEmailChangeTokenHash(hash(token))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EMAIL_CHANGE_INVALID"));
        if (user.getEmailChangeExpiresAt() == null || user.getEmailChangeExpiresAt().isBefore(LocalDateTime.now())) {
            clear(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EMAIL_CHANGE_EXPIRED");
        }
        String target = normalize(user.getPendingEmail());
        if (target.isBlank() || userRepository.existsByEmailIgnoreCase(target)) {
            clear(user);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS");
        }
        user.setEmail(target);
        user.incrementTokenVersion();
        clear(user);
        userRepository.save(user);
        return target;
    }

    private static void clear(User user) {
        user.setPendingEmail(null);
        user.setEmailChangeTokenHash(null);
        user.setEmailChangeExpiresAt(null);
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EMAIL_CHANGE_INVALID");
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
