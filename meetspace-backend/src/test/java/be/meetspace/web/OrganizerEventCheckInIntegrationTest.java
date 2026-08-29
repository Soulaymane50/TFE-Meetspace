package be.meetspace.web;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventLocationType;
import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.EventRegistrationStatus;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.Role;
import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.AuditLogRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.web.controller.OrganizerEventController;
import be.meetspace.web.dto.EventCheckInRequest;
import be.meetspace.web.dto.EventCheckInResponseDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class OrganizerEventCheckInIntegrationTest {

    @Autowired
    private OrganizerEventController controller;

    @Autowired
    private EventRegistrationRepository registrationRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private User organizer;
    private User attendee;
    private Event event;
    private EventRegistration registration;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        registrationRepository.deleteAll();
        eventRepository.deleteAll();
        userRepository.deleteAll();

        organizer = userRepository.save(user("orga.checkin@meetspace.test", Role.ORGANIZER));
        attendee = userRepository.save(user("participant.checkin@meetspace.test", Role.MEMBER));

        event = new Event();
        event.setTitle("Événement avec contrôle");
        event.setDescription("Scénario de test du billet");
        event.setStartDateTime(LocalDateTime.now().plusDays(7));
        event.setEndDateTime(LocalDateTime.now().plusDays(7).plusHours(2));
        event.setLocationType(EventLocationType.EXTERNAL);
        event.setExternalAddress("Bruxelles");
        event.setLocation("Bruxelles");
        event.setCapacity(40);
        event.setPrice(20D);
        event.setStatus(EventStatus.PUBLISHED);
        event.setCreatedBy(organizer);
        event = eventRepository.save(event);

        registration = new EventRegistration();
        registration.setUser(attendee);
        registration.setEvent(event);
        registration.setNumberOfParticipants(2);
        registration.setTotalPrice(40D);
        registration.setStatus(EventRegistrationStatus.CONFIRMED);
        registration = registrationRepository.save(registration);
    }

    @Test
    void organizerCanCheckInAValidTicketAndTheOperationIsIdempotent() {
        EventCheckInRequest request = new EventCheckInRequest();
        request.setTicket("MS-CHECKIN:" + event.getId() + ":" + registration.getTicketToken());

        EventCheckInResponseDto first = controller.checkInAttendee(
                event.getId(), request, authentication(organizer), new MockHttpServletRequest());
        EventCheckInResponseDto second = controller.checkInAttendee(
                event.getId(), request, authentication(organizer), new MockHttpServletRequest());

        assertFalse(first.isAlreadyCheckedIn());
        assertTrue(second.isAlreadyCheckedIn());
        assertEquals(2, first.getNumberOfParticipants());
        assertNotNull(registrationRepository.findById(registration.getId()).orElseThrow().getCheckedInAt());
        assertEquals(1, auditLogRepository.count());
    }

    @Test
    void organizerCanUseTheHumanReadableGroupedTicketCode() {
        EventCheckInRequest request = new EventCheckInRequest();
        String groupedTicket = registration.getTicketToken().replaceAll("(.{4})(?!$)", "$1 ");
        request.setTicket(groupedTicket);

        EventCheckInResponseDto response = controller.checkInAttendee(
                event.getId(), request, authentication(organizer), new MockHttpServletRequest());

        assertFalse(response.isAlreadyCheckedIn());
        assertEquals(registration.getId(), response.getRegistrationId());
        assertNotNull(registrationRepository.findById(registration.getId()).orElseThrow().getCheckedInAt());
    }

    @Test
    void anotherOrganizerCannotAccessTheAttendeeListOrValidateTheTicket() {
        User outsider = userRepository.save(user("other.organizer@meetspace.test", Role.ORGANIZER));
        EventCheckInRequest request = new EventCheckInRequest();
        request.setTicket(registration.getTicketToken());

        assertThrows(ResponseStatusException.class,
                () -> controller.getEventAttendees(event.getId(), authentication(outsider)));
        assertThrows(ResponseStatusException.class,
                () -> controller.checkInAttendee(event.getId(), request, authentication(outsider), new MockHttpServletRequest()));
    }

    private static User user(String email, Role role) {
        User user = new User();
        user.setFirstName(role == Role.ORGANIZER ? "Organisateur" : "Participant");
        user.setLastName("MeetSpace");
        user.setEmail(email);
        user.setPasswordHash("not-used-by-this-test");
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private static UsernamePasswordAuthenticationToken authentication(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null);
    }
}
