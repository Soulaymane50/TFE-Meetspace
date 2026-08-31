package be.meetspace.repository;

import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

public interface ParkingReservationRepository extends JpaRepository<ParkingReservation, Long> {

    @Override
    @EntityGraph(attributePaths = {"user", "parkingSlot", "accessPasses"})
    List<ParkingReservation> findAll();

    @Override
    @EntityGraph(attributePaths = {"user", "parkingSlot"})
    Optional<ParkingReservation> findById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT pr FROM ParkingReservation pr JOIN FETCH pr.user JOIN FETCH pr.parkingSlot LEFT JOIN FETCH pr.eventRegistration WHERE pr.id = :id")
    Optional<ParkingReservation> findByIdForUpdate(@Param("id") Long id);

    Optional<ParkingReservation> findByEventRegistrationId(Long eventRegistrationId);

    @Query("SELECT DISTINCT gr FROM ParkingReservation gr JOIN FETCH gr.parkingSlot JOIN FETCH gr.user LEFT JOIN FETCH gr.accessPasses WHERE gr.user.id = :userId")
    List<ParkingReservation> findByUserId(@Param("userId") Long userId);

    @Query("SELECT gr FROM ParkingReservation gr JOIN FETCH gr.user WHERE gr.parkingSlot.id = :parkingSlotId")
    List<ParkingReservation> findByParkingSlotId(@Param("parkingSlotId") Long parkingSlotId);

    @Query("SELECT COALESCE(SUM(r.reservedSpaces), 0) FROM ParkingReservation r WHERE r.parkingSlot.id = :parkingSlotId AND r.status != 'CANCELLED'")
    Integer countReservedSpacesByParkingSlotId(@Param("parkingSlotId") Long parkingSlotId);

    @Query("SELECT COALESCE(SUM(r.reservedSpaces), 0) FROM ParkingReservation r JOIN r.parkingSlot p " +
            "WHERE r.status != 'CANCELLED' AND p.status = 'OPEN' " +
            "AND p.sessionDate = :date AND p.startTime < :endTime AND p.endTime > :startTime")
    Integer countReservedSpacesForWindow(@Param("date") LocalDate date,
                                         @Param("startTime") LocalTime startTime,
                                         @Param("endTime") LocalTime endTime);

    boolean existsByParkingSlotIdAndUserIdAndComplimentaryTrueAndStatusNot(
            Long parkingSlotId,
            Long userId,
            ParkingReservationStatus status
    );

    @Modifying
    @Transactional
    @Query("DELETE FROM ParkingReservation gr WHERE gr.parkingSlot.id = :parkingSlotId")
    void deleteByParkingSlotId(@Param("parkingSlotId") Long parkingSlotId);

    @Query("SELECT COUNT(gr) FROM ParkingReservation gr WHERE gr.status = :status")
    long countByStatus(@Param("status") ParkingReservationStatus status);

    @Query("SELECT COALESCE(SUM(gr.totalPrice), 0) FROM ParkingReservation gr WHERE gr.status = :status")
    Double sumTotalPriceByStatus(@Param("status") ParkingReservationStatus status);
}

