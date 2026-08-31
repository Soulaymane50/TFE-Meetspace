package be.meetspace.repository;

import be.meetspace.entity.ParkingInventory;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ParkingInventoryRepository extends JpaRepository<ParkingInventory, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT inventory FROM ParkingInventory inventory WHERE inventory.id = :id")
    Optional<ParkingInventory> findByIdForUpdate(@Param("id") Long id);
}
