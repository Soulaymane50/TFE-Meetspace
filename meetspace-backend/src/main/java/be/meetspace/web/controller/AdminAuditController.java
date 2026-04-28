package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.service.AuditService;
import be.meetspace.web.dto.AuditLogDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/admin/audit")
public class AdminAuditController {

    private final AuditService auditService;

    public AdminAuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public Page<AuditLogDto> getAllAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return auditService.getAllLogs(pageable).map(AuditLogDto::fromEntity);
    }

    @GetMapping("/filter")
    public Page<AuditLogDto> getFilteredAuditLogs(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return auditService.getLogsWithFilters(userId, action, entityType, startDate, endDate, pageable)
                .map(AuditLogDto::fromEntity);
    }

    @GetMapping("/user/{userId}")
    public Page<AuditLogDto> getAuditLogsByUser(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return auditService.getLogsByUser(userId, pageable).map(AuditLogDto::fromEntity);
    }

    @GetMapping("/action/{action}")
    public Page<AuditLogDto> getAuditLogsByAction(
            @PathVariable AuditAction action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return auditService.getLogsByAction(action, pageable).map(AuditLogDto::fromEntity);
    }

    @GetMapping("/entity/{entityType}")
    public Page<AuditLogDto> getAuditLogsByEntityType(
            @PathVariable String entityType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return auditService.getLogsByEntityType(entityType, pageable).map(AuditLogDto::fromEntity);
    }

    @GetMapping("/entity/{entityType}/{entityId}")
    public Page<AuditLogDto> getAuditLogsByEntity(
            @PathVariable String entityType,
            @PathVariable Long entityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return auditService.getLogsByEntity(entityType, entityId, pageable).map(AuditLogDto::fromEntity);
    }

    @GetMapping("/actions")
    public List<AuditAction> getAvailableActions() {
        return Arrays.stream(AuditAction.values()).toList();
    }

    @GetMapping("/entity-types")
    public List<String> getAvailableEntityTypes() {
        return Arrays.asList("USER", "EVENT", "RESERVATION", "ESPACE", "PARKING");
    }
}

