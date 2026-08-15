package be.meetspace.repository;

import be.meetspace.entity.Espace;
import be.meetspace.entity.EspaceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface EspaceRepository extends JpaRepository<Espace, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Espace e WHERE e.id = :id")
    Optional<Espace> findByIdForUpdate(@Param("id") Long id);

    List<Espace> findByStatus(EspaceStatus status);

    Optional<Espace> findFirstByNameIgnoreCase(String name);
}

