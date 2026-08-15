package be.meetspace.repository;

import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ParkingSlotRepository extends JpaRepository<ParkingSlot, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ParkingSlot p WHERE p.id = :id")
    Optional<ParkingSlot> findByIdForUpdate(@Param("id") Long id);

    List<ParkingSlot> findByStatusAndSessionDateGreaterThanEqualOrderBySessionDateAsc(
            ParkingSlotStatus status,
            LocalDate date
    );
}

