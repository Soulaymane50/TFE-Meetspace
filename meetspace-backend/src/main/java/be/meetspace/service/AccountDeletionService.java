package be.meetspace.service;

import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
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

@Service
public class AccountDeletionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AccountDeletionService.class);
    private static final int TOKEN_VALIDITY_MINUTES = 30;

    public static final String EMAIL_UNAVAILABLE_CODE = "ACCOUNT_DELETION_EMAIL_UNAVAILABLE";
    public static final String INVALID_TOKEN_CODE = "ACCOUNT_DELETION_INVALID";
    public static final String EXPIRED_TOKEN_CODE = "ACCOUNT_DELETION_EXPIRED";

    private final UserRepository userRepository;
    private final UserService userService;
    private final EmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String frontendUrl;
    private final boolean logLinkWhenEmailDisabled;

    public AccountDeletionService(
            UserRepository userRepository,
            UserService userService,
            EmailService emailService,
            @Value("${app.frontend-url:http://localhost:5174}") String frontendUrl,
            @Value("${app.account-deletion.log-confirmation-link-when-email-disabled:false}") boolean logLinkWhenEmailDisabled
    ) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.emailService = emailService;
        this.frontendUrl = frontendUrl;
        this.logLinkWhenEmailDisabled = logLinkWhenEmailDisabled;
    }

    @Transactional
    public void requestDeletion(User user) {
        if (user == null || user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_CODE);
        }

        String token = generateToken();
        user.setAccountDeletionTokenHash(hashToken(token));
        user.setAccountDeletionExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_VALIDITY_MINUTES));
        userRepository.save(user);

        String confirmationUrl = frontendUrl.replaceAll("/+$", "") + "/confirm-account-deletion?token=" + token;
        if (!emailService.canSendMail()) {
            handleMissingEmailConfiguration(user, confirmationUrl);
            return;
        }

        try {
            emailService.sendAccountDeletionConfirmationEmail(user.getEmail(), user.getFirstName(), confirmationUrl);
        } catch (ResponseStatusException ex) {
            clearDeletionToken(user);
            userRepository.save(user);
            LOGGER.warn("Account deletion confirmation email could not be sent for user id {}", user.getId(), ex);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, EMAIL_UNAVAILABLE_CODE);
        }
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void confirmDeletion(User authenticatedUser, String token, String ipAddress) {
        if (authenticatedUser == null || token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_CODE);
        }

        String tokenHash = hashToken(token);
        User user = userRepository.findByAccountDeletionTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_CODE));

        if (!user.getId().equals(authenticatedUser.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_CODE);
        }

        if (user.getStatus() != UserStatus.ACTIVE) {
            clearDeletionToken(user);
            userRepository.save(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_TOKEN_CODE);
        }

        if (user.getAccountDeletionExpiresAt() == null || user.getAccountDeletionExpiresAt().isBefore(LocalDateTime.now())) {
            clearDeletionToken(user);
            userRepository.save(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, EXPIRED_TOKEN_CODE);
        }

        clearDeletionToken(user);
        userService.deactivateAccount(user, ipAddress, true);
    }

    private void handleMissingEmailConfiguration(User user, String confirmationUrl) {
        if (logLinkWhenEmailDisabled) {
            LOGGER.info("Email service disabled. Local account deletion confirmation link for user id {}: {}", user.getId(), confirmationUrl);
            return;
        }

        LOGGER.warn("Email service disabled. Account deletion token cleared for user id {}", user.getId());
        clearDeletionToken(user);
        userRepository.save(user);
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, EMAIL_UNAVAILABLE_CODE);
    }

    private void clearDeletionToken(User user) {
        user.setAccountDeletionTokenHash(null);
        user.setAccountDeletionExpiresAt(null);
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
}
