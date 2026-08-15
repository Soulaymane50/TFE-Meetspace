package be.meetspace.service;

import be.meetspace.entity.BookingHoldStatus;
import be.meetspace.repository.BookingHoldRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class BookingHoldExpiryService {

    private final BookingHoldRepository holdRepository;

    public BookingHoldExpiryService(BookingHoldRepository holdRepository) {
        this.holdRepository = holdRepository;
    }

    @Scheduled(fixedDelayString = "${app.payments.hold-cleanup-ms:60000}")
    @Transactional
    public void expireOldHolds() {
        holdRepository.findByStatusAndExpiresAtBefore(BookingHoldStatus.ACTIVE, LocalDateTime.now())
                .forEach(hold -> hold.setStatus(BookingHoldStatus.EXPIRED));
    }
}
