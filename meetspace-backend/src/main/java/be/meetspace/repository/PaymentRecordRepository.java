package be.meetspace.repository;

import be.meetspace.entity.PaymentRecord;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.*;

public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {
    @Override
    @EntityGraph(attributePaths = {"user", "bookingHold"})
    List<PaymentRecord> findAll();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PaymentRecord p JOIN FETCH p.user LEFT JOIN FETCH p.bookingHold WHERE p.paymentIntentId = :paymentIntentId")
    Optional<PaymentRecord> findByPaymentIntentIdForUpdate(@Param("paymentIntentId") String paymentIntentId);

    Optional<PaymentRecord> findByPaymentIntentId(String paymentIntentId);

    @Query("SELECT p.paymentIntentId FROM PaymentRecord p LEFT JOIN p.bookingHold h WHERE "
            + "(p.bookingEntityId IS NULL AND h IS NOT NULL AND "
            + "(h.expiresAt <= :now OR h.status IN (be.meetspace.entity.BookingHoldStatus.CANCELLED, "
            + "be.meetspace.entity.BookingHoldStatus.EXPIRED)) AND p.status <> be.meetspace.entity.PaymentStatus.REFUNDED) "
            + "OR p.status = be.meetspace.entity.PaymentStatus.REFUND_PENDING "
            + "OR EXISTS (SELECT r.id FROM PaymentRefund r WHERE r.paymentIntentId = p.paymentIntentId "
            + "AND r.status NOT IN ('succeeded', 'full_succeeded'))")
    List<String> findReconciliationCandidates(@Param("now") LocalDateTime now);
}
