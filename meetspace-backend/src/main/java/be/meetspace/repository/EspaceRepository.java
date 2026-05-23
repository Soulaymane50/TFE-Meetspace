package be.meetspace.repository;

import be.meetspace.entity.Espace;
import be.meetspace.entity.EspaceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EspaceRepository extends JpaRepository<Espace, Long> {

    List<Espace> findByStatus(EspaceStatus status);

    Optional<Espace> findFirstByNameIgnoreCase(String name);
}

