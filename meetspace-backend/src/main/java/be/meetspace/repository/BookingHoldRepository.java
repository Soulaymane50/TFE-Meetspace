package be.meetspace.repository;

import be.meetspace.entity.BookingHold;
import be.meetspace.entity.BookingHoldStatus;
import be.meetspace.entity.PaymentType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingHoldRepository extends JpaRepository<BookingHold, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM BookingHold h JOIN FETCH h.user WHERE h.token = :token")
    Optional<BookingHold> findByTokenForUpdate(@Param("token") String token);

    @Query("SELECT h FROM BookingHold h WHERE h.type = :type AND h.resourceId = :resourceId " +
            "AND h.status = :status AND h.expiresAt > :now")
    List<BookingHold> findActiveForResource(@Param("type") PaymentType type,
                                            @Param("resourceId") Long resourceId,
                                            @Param("status") BookingHoldStatus status,
                                            @Param("now") LocalDateTime now);

    @Query("SELECT h FROM BookingHold h WHERE h.secondaryResourceId = :resourceId " +
            "AND h.status = :status AND h.expiresAt > :now")
    List<BookingHold> findActiveForSecondaryResource(@Param("resourceId") Long resourceId,
                                                     @Param("status") BookingHoldStatus status,
                                                     @Param("now") LocalDateTime now);

    @Query("SELECT h FROM BookingHold h JOIN ParkingSlot p ON " +
            "((h.type = be.meetspace.entity.PaymentType.PARKING AND h.resourceId = p.id) OR " +
            "(h.type = be.meetspace.entity.PaymentType.EVENT AND h.secondaryResourceId = p.id)) " +
            "WHERE h.status = :status AND h.expiresAt > :now AND p.status = 'OPEN' " +
            "AND p.sessionDate = :date AND p.startTime < :endTime AND p.endTime > :startTime")
    List<BookingHold> findActiveParkingForWindow(@Param("date") java.time.LocalDate date,
                                                @Param("startTime") java.time.LocalTime startTime,
                                                @Param("endTime") java.time.LocalTime endTime,
                                                @Param("status") BookingHoldStatus status,
                                                @Param("now") LocalDateTime now);

    @Query("SELECT h FROM PaymentRecord p JOIN p.bookingHold h JOIN FETCH h.user " +
            "WHERE p.paymentIntentId = :paymentIntentId")
    Optional<BookingHold> findByPaymentIntentId(@Param("paymentIntentId") String paymentIntentId);

    List<BookingHold> findByStatusAndExpiresAtBefore(BookingHoldStatus status, LocalDateTime now);
}
