package be.meetspace.repository;

import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ParkingSlotRepository extends JpaRepository<ParkingSlot, Long> {

    List<ParkingSlot> findByStatusAndSessionDateGreaterThanEqualOrderBySessionDateAsc(
            ParkingSlotStatus status,
            LocalDate date
    );
}

