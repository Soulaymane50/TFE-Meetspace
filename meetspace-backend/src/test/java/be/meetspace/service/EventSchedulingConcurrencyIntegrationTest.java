package be.meetspace.service;

import be.meetspace.entity.Espace;
import be.meetspace.entity.EspaceStatus;
import be.meetspace.entity.EspaceType;
import be.meetspace.entity.Event;
import be.meetspace.entity.EventLocationType;
import be.meetspace.entity.EventStatus;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class EventSchedulingConcurrencyIntegrationTest {

    @Autowired
    private EventPlanningService eventPlanningService;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private EspaceRepository espaceRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private ExecutorService executor;
    private Espace room;

    @BeforeEach
    void setUp() {
        eventRepository.deleteAll();
        espaceRepository.deleteAll();
        room = espaceRepository.saveAndFlush(room("Salle test concurrence"));
        executor = Executors.newFixedThreadPool(2);
    }

    @AfterEach
    void tearDown() throws InterruptedException {
        executor.shutdownNow();
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
    }

    @Test
    void concurrentCreationsCannotOccupyTheSameRoomAndWindow() throws Exception {
        LocalDateTime start = LocalDateTime.now().plusDays(30).withNano(0);
        LocalDateTime end = start.plusHours(3);
        CountDownLatch firstEventSaved = new CountDownLatch(1);
        CountDownLatch allowFirstCommit = new CountDownLatch(1);

        Future<Long> first = executor.submit(() -> new TransactionTemplate(transactionManager).execute(status -> {
            Event event = new Event();
            eventPlanningService.applyAndValidate(event, data(room.getId(), start, end, "Premier événement"), null);
            event.setStatus(EventStatus.PUBLISHED);
            eventRepository.saveAndFlush(event);
            firstEventSaved.countDown();
            await(allowFirstCommit);
            return event.getId();
        }));

        assertTrue(firstEventSaved.await(5, TimeUnit.SECONDS));

        Future<HttpStatus> second = executor.submit(() -> {
            try {
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    Event event = new Event();
                    eventPlanningService.applyAndValidate(event, data(room.getId(), start, end, "Deuxième événement"), null);
                    event.setStatus(EventStatus.PUBLISHED);
                    eventRepository.saveAndFlush(event);
                });
                return HttpStatus.CREATED;
            } catch (ResponseStatusException exception) {
                return HttpStatus.valueOf(exception.getStatusCode().value());
            }
        });

        allowFirstCommit.countDown();

        assertNotNull(first.get(10, TimeUnit.SECONDS));
        assertEquals(HttpStatus.CONFLICT, second.get(10, TimeUnit.SECONDS));
        assertEquals(1, eventRepository.count());
    }

    @Test
    void simultaneousEventsRemainAllowedInDifferentRooms() throws Exception {
        Espace secondRoom = espaceRepository.saveAndFlush(room("Deuxième salle"));
        LocalDateTime start = LocalDateTime.now().plusDays(35).withNano(0);
        LocalDateTime end = start.plusHours(2);

        Future<Long> first = createEvent(room.getId(), start, end, "Conférence A");
        Future<Long> second = createEvent(secondRoom.getId(), start, end, "Conférence B");

        assertNotNull(first.get(10, TimeUnit.SECONDS));
        assertNotNull(second.get(10, TimeUnit.SECONDS));
        assertEquals(2, eventRepository.count());
    }

    private Future<Long> createEvent(Long roomId, LocalDateTime start, LocalDateTime end, String title) {
        return executor.submit(() -> new TransactionTemplate(transactionManager).execute(status -> {
            Event event = new Event();
            eventPlanningService.applyAndValidate(event, data(roomId, start, end, title), null);
            event.setStatus(EventStatus.PUBLISHED);
            eventRepository.saveAndFlush(event);
            return event.getId();
        }));
    }

    private static EventPlanningService.EventData data(Long roomId,
                                                       LocalDateTime start,
                                                       LocalDateTime end,
                                                       String title) {
        return new EventPlanningService.EventData(
                title,
                "Test de planification concurrente",
                start,
                end,
                20,
                30D,
                EventStatus.PUBLISHED,
                EventLocationType.EXISTING_SPACE,
                roomId,
                null,
                null,
                false,
                null,
                null
        );
    }

    private static Espace room(String name) {
        Espace espace = new Espace();
        espace.setName(name);
        espace.setType(EspaceType.SALLE);
        espace.setCapacity(80);
        espace.setBasePrice(100D);
        espace.setStatus(EspaceStatus.AVAILABLE);
        return espace;
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Le test a dépassé le délai d'attente");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Le test a été interrompu", exception);
        }
    }
}
