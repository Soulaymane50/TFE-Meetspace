package be.meetspace.repository;

import be.meetspace.entity.*;
import be.meetspace.service.ParkingAccessService;
import be.meetspace.web.dto.ParkingReservationResponseDto;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import java.time.*;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {"spring.jpa.properties.hibernate.generate_statistics=true", "spring.jpa.show-sql=false"})
@ActiveProfiles("test")
@Import(ParkingAccessService.class)
class ParkingAccessReadRegressionTest {
    @Autowired EntityManager em;
    @Autowired ParkingReservationRepository reservations;
    @Autowired ParkingAccessService accesses;

    @Test
    void memberListPreservesEachQrAndCheckInWithoutReadingItTwice() {
        User user = new User(); user.setFirstName("Alice"); user.setLastName("Mertens");
        user.setEmail("parking-load@example.invalid"); user.setPasswordHash("unused-fixture"); user.setRole(Role.MEMBER); em.persist(user);
        ParkingSlot slot = new ParkingSlot(); slot.setTitle("Parking conférence"); slot.setDescription("Session");
        slot.setSessionDate(LocalDate.of(2026, 11, 20)); slot.setStartTime(LocalTime.of(9,0)); slot.setEndTime(LocalTime.of(11,0));
        slot.setCapacity(150); slot.setParkingRate(8D); em.persist(slot);
        for(int i=0; i<60; i++) {
            ParkingReservation reservation = new ParkingReservation(); reservation.setUser(user); reservation.setParkingSlot(slot);
            reservation.setReservedSpaces(2); reservation.setTotalPrice(16D); em.persist(reservation);
            for(int j=0; j<2; j++) {
                ParkingAccessPass pass = new ParkingAccessPass(); pass.setParkingReservation(reservation);
                pass.setToken(String.format("%032d", i*2+j));
                if(j==0) { pass.setStatus(ParkingAccessPassStatus.USED); pass.setCheckedInAt(LocalDateTime.of(2026, 11, 20, 9, 0)); }
                em.persist(pass);
            }
        }
        em.flush(); em.clear();
        var statistics = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics(); statistics.clear();
        var result = reservations.findByUserId(user.getId()).stream().peek(accesses::ensurePasses)
                .map(ParkingReservationResponseDto::fromEntity).toList();
        assertThat(result).hasSize(60);
        assertThat(result).allSatisfy(r -> {
            assertThat(r.getAccessPasses()).hasSize(2);
            assertThat(r.getAccessPasses().get(0).getStatus()).isEqualTo("USED");
            assertThat(r.getAccessPasses().get(0).getCheckedInAt()).isNotNull();
            assertThat(r.getAccessPasses().get(1).getStatus()).isEqualTo("ACTIVE");
        });
        assertThat(result.stream().flatMap(r -> r.getAccessPasses().stream()).map(p -> p.getToken()).distinct().count()).isEqualTo(120);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
        assertThat(statistics.getEntityInsertCount()).isZero();
        assertThat(statistics.getEntityUpdateCount()).isZero();
    }

    @Test
    void legacyMissingPassesAreCreatedOnceAndCancelledAccessStaysCancelled() {
        User user = new User(); user.setFirstName("Alice"); user.setLastName("Mertens");
        user.setEmail("parking-legacy@example.invalid"); user.setPasswordHash("unused-fixture"); user.setRole(Role.MEMBER); em.persist(user);
        ParkingSlot slot = new ParkingSlot(); slot.setTitle("Parking"); slot.setDescription("Session");
        slot.setSessionDate(LocalDate.of(2026,11,20)); slot.setStartTime(LocalTime.of(9,0)); slot.setEndTime(LocalTime.of(11,0)); slot.setCapacity(150); slot.setParkingRate(8D); em.persist(slot);
        ParkingReservation reservation = new ParkingReservation(); reservation.setUser(user); reservation.setParkingSlot(slot);
        reservation.setReservedSpaces(2); reservation.setTotalPrice(16D); reservation.setStatus(ParkingReservationStatus.CANCELLED); em.persist(reservation);
        var first = accesses.ensurePasses(reservation); em.flush();
        var second = accesses.ensurePasses(reservation); em.flush();
        assertThat(first).hasSize(2); assertThat(second).extracting(ParkingAccessPass::getToken).containsExactlyElementsOf(first.stream().map(ParkingAccessPass::getToken).toList());
        assertThat(second).allMatch(p -> p.getStatus()==ParkingAccessPassStatus.CANCELLED);
        assertThat(em.createQuery("select count(p) from ParkingAccessPass p", Long.class).getSingleResult()).isEqualTo(2);
    }
}
