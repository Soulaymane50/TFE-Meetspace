package be.meetspace.repository;
import be.meetspace.entity.EventRoomCancellation;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EventRoomCancellationRepository extends JpaRepository<EventRoomCancellation, Long> {}
