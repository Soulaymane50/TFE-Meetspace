package be.meetspace.web.controller;

import be.meetspace.entity.Espace;
import be.meetspace.entity.EspaceStatus;
import be.meetspace.repository.EspaceRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public/espaces")
public class EspaceController {

    private final EspaceRepository espaceRepository;

    public EspaceController(EspaceRepository espaceRepository) {
        this.espaceRepository = espaceRepository;
    }

    @GetMapping
    public List<Espace> getAvailableEspaces() {
        return espaceRepository.findByStatus(EspaceStatus.AVAILABLE);
    }
}

