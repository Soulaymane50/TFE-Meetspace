package be.meetspace.web.controller;

import be.meetspace.service.FinancialSummaryService;
import be.meetspace.service.FinanceTrendService;
import be.meetspace.web.dto.EventFinanceDto;
import be.meetspace.web.dto.FinanceSummaryDto;
import be.meetspace.web.dto.FinanceTrendDto;
import org.springframework.security.core.Authentication;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api")
public class FinanceController {

    private final FinancialSummaryService financialSummaryService;
    private final FinanceTrendService financeTrendService;

    public FinanceController(FinancialSummaryService financialSummaryService, FinanceTrendService financeTrendService) {
        this.financialSummaryService = financialSummaryService;
        this.financeTrendService = financeTrendService;
    }

    @GetMapping("/organizer/finance/summary")
    public FinanceSummaryDto getOrganizerFinanceSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication authentication) {
        return financialSummaryService.getOrganizerSummary(getEmail(authentication), isAdmin(authentication), from, to);
    }

    @GetMapping("/organizer/events/{id}/finance")
    public EventFinanceDto getOrganizerEventFinance(@PathVariable Long id, Authentication authentication) {
        return financialSummaryService.getOrganizerEventFinance(id, getEmail(authentication), isAdmin(authentication));
    }

    @GetMapping("/admin/finance/summary")
    public FinanceSummaryDto getAdminFinanceSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return financialSummaryService.getAdminSummary(from, to);
    }

    @GetMapping("/admin/finance/trend")
    public FinanceTrendDto getAdminFinanceTrend(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "AUTO") String granularity) {
        return financeTrendService.getAdminTrend(from, to, granularity);
    }

    @GetMapping("/admin/events/{id}/finance")
    public EventFinanceDto getAdminEventFinance(@PathVariable Long id) {
        return financialSummaryService.getAdminEventFinance(id);
    }

    private String getEmail(Authentication authentication) {
        return authentication != null ? authentication.getName() : null;
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
