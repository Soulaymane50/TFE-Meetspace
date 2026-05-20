package be.meetspace.repository;

import be.meetspace.entity.Espace;
import be.meetspace.entity.Reservation;
import be.meetspace.entity.ReservationStatus;
import be.meetspace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    @Query("SELECT r FROM Reservation r JOIN FETCH r.espace WHERE r.user = :user")
    List<Reservation> findByUser(@Param("user") User user);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.user WHERE r.espace = :espace")
    List<Reservation> findByEspace(@Param("espace") Espace espace);

    @Query("SELECT COUNT(r) > 0 FROM Reservation r " +
           "WHERE r.espace.id = :espaceId " +
           "AND r.status != 'CANCELLED' " +
           "AND r.startDateTime < :endDateTime " +
           "AND r.endDateTime > :startDateTime")
    boolean existsOverlappingReservation(
            @Param("espaceId") Long espaceId,
            @Param("startDateTime") LocalDateTime startDateTime,
            @Param("endDateTime") LocalDateTime endDateTime
    );

    @Query("SELECT r FROM Reservation r " +
           "WHERE r.espace.id = :espaceId " +
           "AND r.status != 'CANCELLED' " +
           "AND r.startDateTime < :endDateTime " +
           "AND r.endDateTime > :startDateTime")
    List<Reservation> findOverlappingReservations(
            @Param("espaceId") Long espaceId,
            @Param("startDateTime") LocalDateTime startDateTime,
            @Param("endDateTime") LocalDateTime endDateTime
    );

    @Query("SELECT r FROM Reservation r " +
           "WHERE r.espace.id = :espaceId " +
           "AND r.status != 'CANCELLED' " +
           "AND r.startDateTime < :endDateTime " +
           "AND r.endDateTime > :startDateTime " +
           "ORDER BY r.startDateTime")
    List<Reservation> findByEspaceAndPeriod(
            @Param("espaceId") Long espaceId,
            @Param("startDateTime") LocalDateTime startDateTime,
            @Param("endDateTime") LocalDateTime endDateTime
    );

    @Query("SELECT r FROM Reservation r JOIN FETCH r.user JOIN FETCH r.espace " +
           "WHERE r.status = 'PENDING_APPROVAL' " +
           "ORDER BY r.createdAt DESC")
    List<Reservation> findPendingApproval();

    @Modifying
    @Transactional
    @Query("DELETE FROM Reservation r WHERE r.espace.id = :espaceId")
    void deleteByEspaceId(@Param("espaceId") Long espaceId);

    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.status = :status")
    long countByStatus(@Param("status") ReservationStatus status);

    @Query("SELECT COALESCE(SUM(r.totalPrice), 0) FROM Reservation r WHERE r.status = :status")
    Double sumTotalPriceByStatus(@Param("status") ReservationStatus status);
}

