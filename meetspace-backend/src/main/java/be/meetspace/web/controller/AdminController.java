package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Espace;
import be.meetspace.entity.Event;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final EspaceRepository espaceRepository;
    private final ReservationRepository reservationRepository;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final AuditService auditService;

    public AdminController(EspaceRepository espaceRepository,
                           ReservationRepository reservationRepository,
                           EventRepository eventRepository,
                           EventRegistrationRepository eventRegistrationRepository,
                           ParkingReservationRepository parkingReservationRepository,
                           AuditService auditService) {
        this.espaceRepository = espaceRepository;
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.auditService = auditService;
    }

    @GetMapping("/espaces")
    public List<Espace> getAllEspaces() {
        return espaceRepository.findAll();
    }

    @GetMapping("/espaces/{id}")
    public Espace getEspace(@PathVariable Long id) {
        return espaceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Espace not found"));
    }

    @PostMapping("/espaces")
    public Espace createEspace(@RequestBody Espace e, HttpServletRequest httpRequest) {
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        Espace saved = espaceRepository.save(e);

        auditService.log(AuditAction.SPACE_CREATE, "ESPACE", saved.getId(),
                "Nouvel espace créé: " + saved.getName() + " (" + saved.getType() + ")",
                null, null, ipAddress);

        return saved;
    }

    @PutMapping("/espaces/{id}")
    public Espace updateEspace(@PathVariable Long id, @RequestBody Espace updated, HttpServletRequest httpRequest) {
        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        Espace existing = espaceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Espace not found"));

        String oldValues = String.format("name=%s, type=%s, capacity=%d, price=%.2f, status=%s",
                existing.getName(), existing.getType(), existing.getCapacity(), existing.getBasePrice(), existing.getStatus());

        existing.setName(updated.getName());
        existing.setType(updated.getType());
        existing.setCapacity(updated.getCapacity());
        existing.setBasePrice(updated.getBasePrice());
        existing.setStatus(updated.getStatus());

        Espace saved = espaceRepository.save(existing);

        String newValues = String.format("name=%s, type=%s, capacity=%d, price=%.2f, status=%s",
                saved.getName(), saved.getType(), saved.getCapacity(), saved.getBasePrice(), saved.getStatus());

        auditService.log(AuditAction.SPACE_UPDATE, "ESPACE", saved.getId(),
                "Espace modifié: " + saved.getName(),
                oldValues, newValues, ipAddress);

        return saved;
    }

    @DeleteMapping("/espaces/{id}")
    @Transactional
    public void deleteEspace(@PathVariable Long id, HttpServletRequest httpRequest) {
        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        Espace espace = espaceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Espace not found"));
        String espaceName = espace.getName();

        List<Event> eventsWithSpace = eventRepository.findBySpaceId(id);
        for (Event event : eventsWithSpace) {
            if (event.getParkingSlot() != null) {
                parkingReservationRepository.deleteByParkingSlotId(event.getParkingSlot().getId());
            }
            eventRegistrationRepository.deleteByEventId(event.getId());
            eventRepository.delete(event);
        }

        reservationRepository.deleteByEspaceId(id);
        espaceRepository.deleteById(id);

        auditService.log(AuditAction.SPACE_DELETE, "ESPACE", id,
                "Espace supprimé: " + espaceName + " (avec " + eventsWithSpace.size() + " événements associés)",
                null, null, ipAddress);
    }
}

