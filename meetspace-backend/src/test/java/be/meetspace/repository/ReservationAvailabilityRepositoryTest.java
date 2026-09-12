package be.meetspace.repository;

import be.meetspace.entity.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class ReservationAvailabilityRepositoryTest {
    @Autowired ReservationRepository repository;
    @Autowired TestEntityManager em;

    @ParameterizedTest
    @EnumSource(ReservationStatus.class)
    void calendarAndConflictChecksAgreeForEveryStatus(ReservationStatus status) {
        User user = new User();
        user.setFirstName("Test"); user.setLastName("Calendrier");
        user.setEmail("calendar@test.invalid"); user.setPasswordHash("unused-test-hash");
        user.setRole(Role.MEMBER); em.persist(user);
        Espace room = new Espace(); room.setName("Salle calendrier");
        room.setBasePrice(10D); em.persist(room);
        LocalDateTime start = LocalDateTime.of(2026, 11, 20, 10, 0);
        Reservation reservation = new Reservation();
        reservation.setUser(user); reservation.setEspace(room);
        reservation.setStartDateTime(start); reservation.setEndDateTime(start.plusHours(2));
        reservation.setTotalPrice(20D); reservation.setStatus(status);
        repository.saveAndFlush(reservation);
        boolean blocking = status != ReservationStatus.CANCELLED && status != ReservationStatus.REJECTED;
        assertThat(repository.existsOverlappingReservation(room.getId(), start, start.plusHours(1))).isEqualTo(blocking);
        assertThat(repository.existsOverlappingReservationExcludingId(room.getId(), -1L, start, start.plusHours(1))).isEqualTo(blocking);
        assertThat(repository.findOverlappingReservations(room.getId(), start, start.plusHours(1))).hasSize(blocking ? 1 : 0);
        assertThat(repository.findByEspaceAndPeriod(room.getId(), start, start.plusHours(1))).hasSize(blocking ? 1 : 0);
        assertThat(repository.existsOverlappingReservationExcludingId(room.getId(), reservation.getId(), start, start.plusHours(1))).isFalse();
        assertThat(repository.existsOverlappingReservation(room.getId(), start.plusHours(2), start.plusHours(3))).isFalse();
    }
}