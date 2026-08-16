package be.meetspace.repository;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventWaitlistEntry;
import be.meetspace.entity.EventWaitlistStatus;
import be.meetspace.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventWaitlistRepository extends JpaRepository<EventWaitlistEntry, Long> {

    @EntityGraph(attributePaths = {"event", "user"})
    Optional<EventWaitlistEntry> findByUserAndEvent(User user, Event event);

    @EntityGraph(attributePaths = {"event", "user"})
    List<EventWaitlistEntry> findByUserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"event", "user"})
    List<EventWaitlistEntry> findByEventIdAndStatusOrderByCreatedAtAsc(Long eventId, EventWaitlistStatus status);
}
