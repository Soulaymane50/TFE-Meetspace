package be.meetspace.web;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventLocationType;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.Role;
import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        eventRepository.deleteAll();
        userRepository.deleteAll();

        User organizer = new User();
        organizer.setFirstName("Event");
        organizer.setLastName("Organizer");
        organizer.setEmail("event.organizer@meetspace.test");
        organizer.setPasswordHash("not-used-by-this-test");
        organizer.setRole(Role.ORGANIZER);
        organizer.setStatus(UserStatus.ACTIVE);
        organizer = userRepository.save(organizer);

        Event event = new Event();
        event.setTitle("Future event");
        event.setDescription("Integration fixture");
        event.setStartDateTime(LocalDateTime.now().plusDays(7));
        event.setEndDateTime(LocalDateTime.now().plusDays(7).plusHours(2));
        event.setLocationType(EventLocationType.EXTERNAL);
        event.setExternalAddress("Brussels");
        event.setCapacity(40);
        event.setPrice(25D);
        event.setStatus(EventStatus.PUBLISHED);
        event.setCreatedBy(organizer);
        eventRepository.save(event);
    }

    @Test
    void publishedEventsSerializeLazyRelationsWithOpenInViewDisabled() throws Exception {
        mockMvc.perform(get("/api/public/events").header("X-Request-Id", "integration-request-123"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", "integration-request-123"))
                .andExpect(jsonPath("$[0].title").value("Future event"))
                .andExpect(jsonPath("$[0].createdByName").value("Event Organizer"));
    }
}
