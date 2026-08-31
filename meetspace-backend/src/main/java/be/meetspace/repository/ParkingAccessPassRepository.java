package be.meetspace.repository;

import be.meetspace.entity.ParkingAccessPass;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ParkingAccessPassRepository extends JpaRepository<ParkingAccessPass, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT pass FROM ParkingAccessPass pass " +
            "JOIN FETCH pass.parkingReservation reservation " +
            "JOIN FETCH reservation.user " +
            "JOIN FETCH reservation.parkingSlot " +
            "WHERE pass.token = :token")
    Optional<ParkingAccessPass> findByTokenForUpdate(@Param("token") String token);

    List<ParkingAccessPass> findByParkingReservationIdOrderByIdAsc(Long reservationId);
}
