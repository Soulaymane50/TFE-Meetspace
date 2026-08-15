package be.meetspace.repository;

import be.meetspace.entity.PaymentRecord;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {

    @Override
    @EntityGraph(attributePaths = {"user", "bookingHold"})
    java.util.List<PaymentRecord> findAll();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PaymentRecord p JOIN FETCH p.user LEFT JOIN FETCH p.bookingHold WHERE p.paymentIntentId = :paymentIntentId")
    Optional<PaymentRecord> findByPaymentIntentIdForUpdate(@Param("paymentIntentId") String paymentIntentId);

    Optional<PaymentRecord> findByPaymentIntentId(String paymentIntentId);
}
