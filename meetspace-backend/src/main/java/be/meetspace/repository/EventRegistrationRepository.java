package be.meetspace.repository;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.EventRegistrationStatus;
import be.meetspace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface EventRegistrationRepository extends JpaRepository<EventRegistration, Long> {

    @Override
    @EntityGraph(attributePaths = {"user", "event"})
    List<EventRegistration> findAll();

    @Override
    @EntityGraph(attributePaths = {"user", "event"})
    Optional<EventRegistration> findById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT er FROM EventRegistration er JOIN FETCH er.user JOIN FETCH er.event WHERE er.id = :id")
    Optional<EventRegistration> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT er FROM EventRegistration er JOIN FETCH er.event JOIN FETCH er.user WHERE er.user.id = :userId")
    List<EventRegistration> findByUserId(@Param("userId") Long userId);

    @Query("SELECT er FROM EventRegistration er JOIN FETCH er.user JOIN FETCH er.event WHERE er.event.id = :eventId ORDER BY er.createdAt")
    List<EventRegistration> findByEventId(@Param("eventId") Long eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT er FROM EventRegistration er JOIN FETCH er.user JOIN FETCH er.event WHERE er.ticketToken = :ticketToken")
    Optional<EventRegistration> findByTicketTokenForUpdate(@Param("ticketToken") String ticketToken);

    Optional<EventRegistration> findByUserAndEvent(User user, Event event);

    boolean existsByUserAndEvent(User user, Event event);

    boolean existsByUserAndEventAndStatusNot(User user, Event event, EventRegistrationStatus status);

    @Query("SELECT COALESCE(SUM(er.numberOfParticipants), 0) FROM EventRegistration er WHERE er.event.id = :eventId AND er.status != 'CANCELLED'")
    Integer countTotalParticipantsByEventId(@Param("eventId") Long eventId);

    @Query("SELECT er.event.id AS eventId, SUM(er.numberOfParticipants) AS participantCount " +
            "FROM EventRegistration er WHERE er.event.id IN :eventIds " +
            "AND er.status != 'CANCELLED' GROUP BY er.event.id")
    List<ParticipantsByEvent> sumParticipantsByEventIds(@Param("eventIds") List<Long> eventIds);

    interface ParticipantsByEvent {
        Long getEventId();
        Long getParticipantCount();
    }

    @Modifying
    @Transactional
    @Query("DELETE FROM EventRegistration er WHERE er.event.id = :eventId")
    void deleteByEventId(@Param("eventId") Long eventId);

    @Query("SELECT COUNT(er) FROM EventRegistration er WHERE er.status = :status")
    long countByStatus(@Param("status") EventRegistrationStatus status);

    @Query("SELECT COALESCE(SUM(er.totalPrice), 0) FROM EventRegistration er WHERE er.status = :status")
    Double sumTotalPriceByStatus(@Param("status") EventRegistrationStatus status);
}

