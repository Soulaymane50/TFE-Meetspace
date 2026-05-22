package be.meetspace.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupportContactRequest(
        @NotBlank(message = "SUPPORT_NAME_REQUIRED")
        @Size(max = 120, message = "SUPPORT_NAME_TOO_LONG")
        String name,

        @NotBlank(message = "SUPPORT_EMAIL_REQUIRED")
        @Email(message = "SUPPORT_EMAIL_INVALID")
        @Size(max = 180, message = "SUPPORT_EMAIL_TOO_LONG")
        String email,

        @NotBlank(message = "SUPPORT_CATEGORY_REQUIRED")
        @Size(max = 40, message = "SUPPORT_CATEGORY_TOO_LONG")
        String category,

        @NotBlank(message = "SUPPORT_SUBJECT_REQUIRED")
        @Size(max = 160, message = "SUPPORT_SUBJECT_TOO_LONG")
        String subject,

        @NotBlank(message = "SUPPORT_MESSAGE_REQUIRED")
        @Size(max = 3000, message = "SUPPORT_MESSAGE_TOO_LONG")
        String message,

        @Size(max = 120, message = "SUPPORT_REFERENCE_TOO_LONG")
        String reservationReference
) {
}
