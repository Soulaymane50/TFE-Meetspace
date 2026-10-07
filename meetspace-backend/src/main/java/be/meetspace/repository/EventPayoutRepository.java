package be.meetspace.repository;
import be.meetspace.entity.EventPayout;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface EventPayoutRepository extends JpaRepository<EventPayout, Long> {
    Optional<EventPayout> findByEventId(Long eventId);
    boolean existsByTransferReference(String reference);
}
