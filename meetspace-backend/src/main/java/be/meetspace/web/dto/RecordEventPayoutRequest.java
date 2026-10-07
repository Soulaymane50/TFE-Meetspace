package be.meetspace.web.dto;
import jakarta.validation.constraints.*;
public record RecordEventPayoutRequest(
    @NotBlank @Size(min = 3, max = 120) @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9 ./_-]{2,119}") String reference,
    @NotNull @Positive Long amountCents) {}
