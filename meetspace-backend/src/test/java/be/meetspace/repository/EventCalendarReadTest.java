package be.meetspace.repository;

import be.meetspace.entity.*;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {"spring.jpa.properties.hibernate.generate_statistics=true", "spring.jpa.show-sql=false"})
@ActiveProfiles("test")
class EventCalendarReadTest {
    @Autowired EntityManager em;
    @Autowired EventRepository events;

    @Test
    void monthReadPreservesOverlapsAndStatusRulesWithoutLoadingEntities() {
        Espace room = new Espace(); room.setName("Salle calendrier"); room.setBasePrice(10D); em.persist(room);
        Espace other = new Espace(); other.setName("Autre salle"); other.setBasePrice(10D); em.persist(other);
        var start = LocalDateTime.of(2026, 11, 1, 0, 0);
        var end = start.plusMonths(1);
        for (EventStatus status : EventStatus.values()) {
            event(room, status, start.plusDays(5), start.plusDays(5).plusHours(2));
        }
        event(room, EventStatus.PUBLISHED, start.minusHours(1), start.plusHours(1));
        event(room, EventStatus.PUBLISHED, end.minusHours(1), end.plusHours(1));
        event(room, EventStatus.PUBLISHED, start.minusHours(2), start);
        event(room, EventStatus.PUBLISHED, end, end.plusHours(2));
        event(other, EventStatus.PUBLISHED, start.plusDays(5), start.plusDays(6));
        for (int i=1; i<=30; i++) event(room, EventStatus.PUBLISHED, start.minusMonths(i), start.minusMonths(i).plusHours(2));
        em.flush(); em.clear();
        var statistics = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        var blocks = events.findCalendarBlocks(room.getId(), start, end);
        assertThat(blocks).hasSize(EventStatus.values().length);
        assertThat(blocks).allSatisfy(block -> {
            assertThat(block.getBlockType()).isEqualTo("EVENT");
            assertThat(block.getStartDateTime()).isBefore(end);
            assertThat(block.getEndDateTime()).isAfter(start);
        });
        assertThat(blocks).filteredOn(b -> b.getStartDateTime().isBefore(start)).hasSize(1);
        assertThat(blocks).filteredOn(b -> b.getEndDateTime().isAfter(end)).hasSize(1);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    void event(Espace room, EventStatus status, LocalDateTime start, LocalDateTime end) {
        Event event = new Event(); event.setTitle("Conférence"); event.setCapacity(30); event.setSpace(room);
        event.setLocationType(EventLocationType.EXISTING_SPACE); event.setStartDateTime(start);
        event.setEndDateTime(end); event.setStatus(status); em.persist(event);
    }
}
