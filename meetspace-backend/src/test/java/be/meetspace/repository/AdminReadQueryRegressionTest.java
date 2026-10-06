package be.meetspace.repository;

import be.meetspace.entity.*;
import jakarta.persistence.EntityManager;
import org.hibernate.Hibernate;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import java.time.*;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {"spring.jpa.properties.hibernate.generate_statistics=true", "spring.jpa.show-sql=false"})
@ActiveProfiles("test")
class AdminReadQueryRegressionTest {
    @Autowired EntityManager em;
    @Autowired EventRegistrationRepository registrations;
    @Autowired ParkingReservationRepository parking;

    @Test
    void readingRegistrationsDoesNotLookUpParkingSeparatelyForEachEvent() {
        seed();
        var statistics = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        var result = registrations.findAll();
        assertThat(result).hasSize(12);
        assertThat(result).allSatisfy(r -> {
            assertThat(r.getUser().getEmail()).isEqualTo("fixture@example.invalid");
            assertThat(r.getEvent().getTitle()).startsWith("Conférence");
            assertThat(Hibernate.isInitialized(r.getEvent().getParkingSlot())).isTrue();
        });
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2L);
    }

    @Test
    void reportingReadsParkingWithoutLoadingUnusedQrPasses() {
        seed();
        var statistics = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        var result = parking.findAllForReporting();
        assertThat(result).hasSize(4);
        assertThat(result).allSatisfy(r -> {
            assertThat(r.getUser().getEmail()).isEqualTo("fixture@example.invalid");
            assertThat(r.getParkingSlot().getTitle()).startsWith("Parking");
            assertThat(Hibernate.isInitialized(r.getAccessPasses())).isFalse();
        });
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2L);
    }

    private void seed() {
        User user = new User(); user.setFirstName("Alice"); user.setLastName("Mertens");
        user.setEmail("fixture@example.invalid"); user.setPasswordHash("unused-fixture-hash"); user.setRole(Role.MEMBER);
        em.persist(user);
        for(int i=0;i<4;i++) {
            Event event = new Event(); event.setTitle("Conférence " + i); event.setCapacity(40); event.setPrice(20D);
            event.setStartDateTime(LocalDateTime.now().plusDays(i+5)); event.setEndDateTime(event.getStartDateTime().plusHours(2));
            event.setStatus(EventStatus.PUBLISHED); event.setCreatedBy(user); em.persist(event);
            ParkingSlot slot = new ParkingSlot(); slot.setTitle("Parking " + i); slot.setDescription("Session");
            slot.setSessionDate(event.getStartDateTime().toLocalDate()); slot.setStartTime(LocalTime.of(9,0)); slot.setEndTime(LocalTime.of(11,0));
            slot.setCapacity(150); slot.setParkingRate(8D); slot.setEvent(event); em.persist(slot); event.setParkingSlot(slot);
            ParkingReservation reservation = new ParkingReservation(); reservation.setUser(user); reservation.setParkingSlot(slot);
            reservation.setReservedSpaces(1); reservation.setTotalPrice(8D); em.persist(reservation);
            for(int j=0;j<3;j++){EventRegistration r=new EventRegistration(); r.setUser(user);r.setEvent(event);r.setNumberOfParticipants(1);r.setTotalPrice(20D);em.persist(r);}
        }
        em.flush(); em.clear();
    }
}
