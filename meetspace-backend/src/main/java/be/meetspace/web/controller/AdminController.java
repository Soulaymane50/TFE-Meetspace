package be.meetspace.web.controller;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.Espace;
import be.meetspace.entity.Event;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.BookingHoldRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import be.meetspace.entity.BookingHoldStatus;
import be.meetspace.entity.PaymentType;
import java.time.LocalDateTime;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final EspaceRepository espaceRepository;
    private final ReservationRepository reservationRepository;
    private final EventRepository eventRepository;
    private final BookingHoldRepository holdRepository;
    private final AuditService auditService;

    public AdminController(EspaceRepository espaceRepository,
                           ReservationRepository reservationRepository,
                           EventRepository eventRepository,
                           BookingHoldRepository holdRepository,
                           AuditService auditService) {
        this.espaceRepository = espaceRepository;
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.holdRepository = holdRepository;
        this.auditService = auditService;
    }

    @GetMapping("/espaces")
    public List<Espace> getAllEspaces() {
        return espaceRepository.findAll();
    }

    @GetMapping("/espaces/{id}")
    public Espace getEspace(@PathVariable Long id) {
        return espaceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable."));
    }

    @PostMapping("/espaces")
    public Espace createEspace(@RequestBody Espace e, HttpServletRequest httpRequest) {
        validateSpace(e);
        if (e.getId() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un nouvel espace ne doit pas avoir d’identifiant.");
        }
        String ipAddress = AuditService.getClientIpAddress(httpRequest);
        Espace saved = espaceRepository.save(e);

        auditService.log(AuditAction.SPACE_CREATE, "ESPACE", saved.getId(),
                "Nouvel espace créé: " + saved.getName() + " (" + saved.getType() + ")",
                null, null, ipAddress);

        return saved;
    }

    @PutMapping("/espaces/{id}")
    public Espace updateEspace(@PathVariable Long id, @RequestBody Espace updated, HttpServletRequest httpRequest) {
        validateSpace(updated);
        String ipAddress = AuditService.getClientIpAddress(httpRequest);

        Espace existing = espaceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable."));

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

        Espace espace = espaceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable."));
        String espaceName = espace.getName();

        List<Event> eventsWithSpace = eventRepository.findBySpaceId(id);
        if (!eventsWithSpace.isEmpty() || !reservationRepository.findByEspace(espace).isEmpty()
                || !holdRepository.findActiveForResource(PaymentType.SPACE, id, BookingHoldStatus.ACTIVE, LocalDateTime.now()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cette salle possède des réservations, des événements ou un paiement en cours. Rendez-la indisponible plutôt que de la supprimer.");
        }

        espaceRepository.deleteById(id);

        auditService.log(AuditAction.SPACE_DELETE, "ESPACE", id,
                "Espace supprimé: " + espaceName + " (avec " + eventsWithSpace.size() + " événements associés)",
                null, null, ipAddress);
    }

    private static void validateSpace(Espace espace) {
        if (espace.getName() == null || espace.getName().isBlank() || espace.getName().length() > 120
                || espace.getType() == null || espace.getStatus() == null
                || espace.getCapacity() == null || espace.getCapacity() < 1
                || espace.getBasePrice() == null || !Double.isFinite(espace.getBasePrice()) || espace.getBasePrice() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Renseignez un nom, un type, un statut, une capacité positive et un tarif positif ou nul.");
        }
    }
}

