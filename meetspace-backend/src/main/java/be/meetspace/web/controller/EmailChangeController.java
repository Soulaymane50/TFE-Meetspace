package be.meetspace.web.controller;

import be.meetspace.service.EmailChangeService;
import be.meetspace.web.dto.EmailChangeConfirmRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth/email-change")
public class EmailChangeController {

    private final EmailChangeService emailChangeService;

    public EmailChangeController(EmailChangeService emailChangeService) {
        this.emailChangeService = emailChangeService;
    }

    @PostMapping("/confirm")
    public Map<String, String> confirm(@Valid @RequestBody EmailChangeConfirmRequest request) {
        String email = emailChangeService.confirm(request.getToken());
        return Map.of("message", "EMAIL_CHANGE_CONFIRMED", "email", email);
    }
}
