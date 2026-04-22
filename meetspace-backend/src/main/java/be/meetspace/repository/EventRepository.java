package be.meetspace.repository;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByStatusAndStartDateTimeAfterOrderByStartDateTimeAsc(EventStatus status, LocalDateTime dateTime);

    List<Event> findByStatusOrderByCreatedAtDesc(EventStatus status);

    List<Event> findByCreatedByIdOrderByCreatedAtDesc(Long userId);

    List<Event> findAllByOrderByCreatedAtDesc();

    @Query("""
            SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END
            FROM Event e
            WHERE e.locationType = be.meetspace.entity.EventLocationType.EXISTING_SPACE
              AND e.space.id = :spaceId
              AND e.startDateTime < :endDateTime
              AND e.endDateTime > :startDateTime
              AND (:excludeId IS NULL OR e.id <> :excludeId)
            """)
    boolean existsOverlappingEventForSpace(@Param("spaceId") Long spaceId,
                                           @Param("startDateTime") LocalDateTime startDateTime,
                                           @Param("endDateTime") LocalDateTime endDateTime,
                                           @Param("excludeId") Long excludeId);

    @Query("SELECT e FROM Event e WHERE e.space.id = :spaceId")
    List<Event> findBySpaceId(@Param("spaceId") Long spaceId);
}

