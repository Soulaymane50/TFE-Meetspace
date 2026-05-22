package be.meetspace.service;

import be.meetspace.web.dto.SupportContactRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

@Service
public class SupportService {

    private static final Set<String> ALLOWED_CATEGORIES = Set.of(
            "account",
            "room_reservation",
            "event",
            "parking",
            "payment",
            "other"
    );

    private final EmailService emailService;

    public SupportService(EmailService emailService) {
        this.emailService = emailService;
    }

    public void handleContactRequest(SupportContactRequest request) {
        SupportContactRequest cleanRequest = sanitize(request);
        validate(cleanRequest);
        emailService.sendSupportContactEmail(cleanRequest, LocalDateTime.now());
    }

    private SupportContactRequest sanitize(SupportContactRequest request) {
        return new SupportContactRequest(
                cleanText(request.name()),
                cleanText(request.email()).toLowerCase(Locale.ROOT),
                cleanCategory(request.category()),
                cleanText(request.subject()),
                cleanMultilineText(request.message()),
                cleanText(request.reservationReference())
        );
    }

    private void validate(SupportContactRequest request) {
        if (!ALLOWED_CATEGORIES.contains(request.category())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SUPPORT_CATEGORY_INVALID");
        }

        if (!StringUtils.hasText(request.subject())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SUPPORT_SUBJECT_REQUIRED");
        }

        if (!StringUtils.hasText(request.message())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SUPPORT_MESSAGE_REQUIRED");
        }
    }

    private String cleanCategory(String value) {
        return cleanText(value).toLowerCase(Locale.ROOT).replace("-", "_");
    }

    private String cleanText(String value) {
        if (value == null) {
            return "";
        }
        return stripHtml(value)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String cleanMultilineText(String value) {
        if (value == null) {
            return "";
        }
        return stripHtml(value)
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .replaceAll("[ \t]+", " ")
                .replaceAll("(\\r?\\n){3,}", "\n\n")
                .trim();
    }

    private String stripHtml(String value) {
        return value.replaceAll("<[^>]*>", "");
    }
}
