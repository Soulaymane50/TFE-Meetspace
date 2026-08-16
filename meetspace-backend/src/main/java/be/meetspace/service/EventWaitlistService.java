package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventWaitlistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventWaitlistService {

    private final EventWaitlistRepository waitlistRepository;
    private final EventRegistrationRepository registrationRepository;
    private final NotificationService notificationService;

    public EventWaitlistService(
            EventWaitlistRepository waitlistRepository,
            EventRegistrationRepository registrationRepository,
            NotificationService notificationService
    ) {
        this.waitlistRepository = waitlistRepository;
        this.registrationRepository = registrationRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public void offerAvailablePlaces(Event event) {
        if (event.getCapacity() == null) return;
        int registered = registrationRepository.countTotalParticipantsByEventId(event.getId());
        int available = Math.max(0, event.getCapacity() - registered);
        if (available == 0) return;

        for (EventWaitlistEntry entry : waitlistRepository
                .findByEventIdAndStatusOrderByCreatedAtAsc(event.getId(), EventWaitlistStatus.WAITING)) {
            if (entry.getParticipantCount() > available) continue;
            entry.setStatus(EventWaitlistStatus.OFFERED);
            waitlistRepository.save(entry);
            notificationService.create(entry.getUser(), NotificationTone.ACTION,
                    "Une place est disponible",
                    "Vous pouvez maintenant finaliser votre inscription à " + event.getTitle() + ".",
                    "/events/register/" + event.getId(), "EventWaitlist", entry.getId());
            break;
        }
    }

    @Transactional
    public void markFulfilled(User user, Event event) {
        waitlistRepository.findByUserAndEvent(user, event).ifPresent(entry -> {
            entry.setStatus(EventWaitlistStatus.FULFILLED);
            waitlistRepository.save(entry);
        });
    }
}
