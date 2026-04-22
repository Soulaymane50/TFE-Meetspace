package be.meetspace.repository;

import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface ParkingReservationRepository extends JpaRepository<ParkingReservation, Long> {

    @Query("SELECT gr FROM ParkingReservation gr JOIN FETCH gr.parkingSlot JOIN FETCH gr.user WHERE gr.user.id = :userId")
    List<ParkingReservation> findByUserId(@Param("userId") Long userId);

    @Query("SELECT gr FROM ParkingReservation gr JOIN FETCH gr.user WHERE gr.parkingSlot.id = :parkingSlotId")
    List<ParkingReservation> findByParkingSlotId(@Param("parkingSlotId") Long parkingSlotId);

    @Query("SELECT COALESCE(SUM(r.reservedSpaces), 0) FROM ParkingReservation r WHERE r.parkingSlot.id = :parkingSlotId AND r.status != 'CANCELLED'")
    Integer countReservedSpacesByParkingSlotId(@Param("parkingSlotId") Long parkingSlotId);

    @Modifying
    @Transactional
    @Query("DELETE FROM ParkingReservation gr WHERE gr.parkingSlot.id = :parkingSlotId")
    void deleteByParkingSlotId(@Param("parkingSlotId") Long parkingSlotId);

    @Query("SELECT COUNT(gr) FROM ParkingReservation gr WHERE gr.status = :status")
    long countByStatus(@Param("status") ParkingReservationStatus status);

    @Query("SELECT COALESCE(SUM(gr.totalPrice), 0) FROM ParkingReservation gr WHERE gr.status = :status")
    Double sumTotalPriceByStatus(@Param("status") ParkingReservationStatus status);
}

