package be.meetspace.web.controller;

import be.meetspace.service.SupportService;
import be.meetspace.service.RequestRateLimitService;
import be.meetspace.service.AuditService;
import be.meetspace.web.dto.SupportContactRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Duration;

import java.util.Map;

@RestController
@RequestMapping("/api/support")
public class SupportController {

    private static final Logger LOGGER = LoggerFactory.getLogger(SupportController.class);

    private final SupportService supportService;
    private final RequestRateLimitService rateLimitService;

    public SupportController(SupportService supportService, RequestRateLimitService rateLimitService) {
        this.supportService = supportService;
        this.rateLimitService = rateLimitService;
    }

    @PostMapping("/contact")
    public ResponseEntity<Map<String, String>> contact(@Valid @RequestBody SupportContactRequest request,
                                                        HttpServletRequest httpRequest) {
        rateLimitService.check("support", AuditService.getClientIpAddress(httpRequest), 10, Duration.ofHours(1));
        supportService.handleContactRequest(request);
        return ResponseEntity.ok(Map.of("message", "SUPPORT_CONTACT_RECEIVED"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .findFirst()
                .map(FieldError::getDefaultMessage)
                .orElse("SUPPORT_VALIDATION_ERROR");
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", ex.getReason()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        LOGGER.warn("Support request failed unexpectedly", ex);
        return ResponseEntity.internalServerError().body(Map.of("message", "SUPPORT_CONTACT_FAILED"));
    }
}
