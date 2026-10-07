package be.meetspace.web.controller;
import be.meetspace.service.*;
import be.meetspace.web.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController
@RequestMapping("/api")
public class EventSettlementController {
    private final EventSettlementService service;
    public EventSettlementController(EventSettlementService service) { this.service=service; }
    @GetMapping("/admin/finance/settlements")
    public List<EventSettlementDto> adminList(Authentication auth) { return service.list(auth.getName(),true); }
    @GetMapping("/organizer/finance/settlements")
    public List<EventSettlementDto> organizerList(Authentication auth) { return service.list(auth.getName(),false); }
    @PostMapping("/admin/events/{id}/payout")
    public EventSettlementDto record(@PathVariable Long id,@Valid @RequestBody RecordEventPayoutRequest request,
            Authentication auth,HttpServletRequest http) { return service.record(id,request,auth.getName(),AuditService.getClientIpAddress(http)); }
}
