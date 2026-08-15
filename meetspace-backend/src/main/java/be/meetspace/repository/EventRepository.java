package be.meetspace.repository;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Event e LEFT JOIN FETCH e.parkingSlot WHERE e.id = :id")
    Optional<Event> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"space", "createdBy", "approvedBy", "parkingSlot"})
    List<Event> findByStatusAndStartDateTimeAfterOrderByStartDateTimeAsc(EventStatus status, LocalDateTime dateTime);

    @EntityGraph(attributePaths = {"space", "createdBy", "approvedBy", "parkingSlot"})
    List<Event> findByStatusOrderByCreatedAtDesc(EventStatus status);

    @EntityGraph(attributePaths = {"space", "createdBy", "approvedBy", "parkingSlot"})
    List<Event> findByCreatedByIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"space", "createdBy", "approvedBy", "parkingSlot"})
    List<Event> findAllByOrderByCreatedAtDesc();

    @Override
    @EntityGraph(attributePaths = {"space", "createdBy", "approvedBy", "parkingSlot"})
    Optional<Event> findById(Long id);

    @Query("""
            SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END
            FROM Event e
            WHERE e.locationType = be.meetspace.entity.EventLocationType.EXISTING_SPACE
              AND e.space.id = :spaceId
              AND e.startDateTime < :endDateTime
              AND e.endDateTime > :startDateTime
              AND e.status <> be.meetspace.entity.EventStatus.CANCELLED
              AND e.status <> be.meetspace.entity.EventStatus.REJECTED
              AND (:excludeId IS NULL OR e.id <> :excludeId)
            """)
    boolean existsOverlappingEventForSpace(@Param("spaceId") Long spaceId,
                                           @Param("startDateTime") LocalDateTime startDateTime,
                                           @Param("endDateTime") LocalDateTime endDateTime,
                                           @Param("excludeId") Long excludeId);

    @Query("SELECT e FROM Event e WHERE e.space.id = :spaceId")
    List<Event> findBySpaceId(@Param("spaceId") Long spaceId);
}

