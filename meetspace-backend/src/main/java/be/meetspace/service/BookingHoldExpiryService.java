package be.meetspace.service;

import be.meetspace.entity.BookingHoldStatus;
import be.meetspace.repository.BookingHoldRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;

@Service
public class BookingHoldExpiryService {
    private final BookingHoldRepository holdRepository;
    private final PaymentLifecycleService payments;
    private final TransactionTemplate transaction;
    public BookingHoldExpiryService(BookingHoldRepository holdRepository, PaymentLifecycleService payments,
                                    PlatformTransactionManager transactionManager) {
        this.holdRepository = holdRepository;
        this.payments = payments;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedDelayString = "${app.payments.hold-cleanup-ms:60000}")
    public void expireOldHolds() {
        payments.reconcilePayments();
        transaction.executeWithoutResult(tx ->
                holdRepository.findByStatusAndExpiresAtBefore(BookingHoldStatus.ACTIVE, LocalDateTime.now())
                        .forEach(hold -> hold.setStatus(BookingHoldStatus.EXPIRED)));
    }
}
