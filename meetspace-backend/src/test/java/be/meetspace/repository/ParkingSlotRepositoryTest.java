package be.meetspace.repository;

import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class ParkingSlotRepositoryTest {
    @Autowired ParkingSlotRepository repository;

    @Test
    void groupedQueryIncludesHiddenStartedAndIndependentSlotsWithoutDuplicatingOverlaps() {
        LocalDate date = LocalDate.now();
        ParkingSlot target = save(date, 10, 14, ParkingSlotStatus.OPEN);
        ParkingSlot secondTarget = save(date, 12, 15, ParkingSlotStatus.OPEN);
        // Commence a minuit, sans evenement, et absent des cibles du catalogue.
        ParkingSlot hidden = save(date, 0, 13, ParkingSlotStatus.OPEN);
        save(date, 8, 10, ParkingSlotStatus.OPEN); // Fin exactement au debut : pas de chevauchement.
        save(date, 15, 18, ParkingSlotStatus.OPEN);
        save(date.plusDays(1), 10, 14, ParkingSlotStatus.OPEN);
        save(date, 10, 14, ParkingSlotStatus.CANCELLED);

        List<ParkingSlot> overlaps = repository.findOpenOverlappingSlotsForTargets(
                List.of(target.getId(), secondTarget.getId()));

        assertThat(overlaps).extracting(ParkingSlot::getId)
                .containsExactly(target.getId(), secondTarget.getId(), hidden.getId());
        assertThat(hidden.getEvent()).isNull();
    }

    private ParkingSlot save(LocalDate date, int start, int end, ParkingSlotStatus status) {
        ParkingSlot slot = new ParkingSlot();
        slot.setTitle("Parking test");
        slot.setDescription("Inventaire partage");
        slot.setSessionDate(date);
        slot.setStartTime(LocalTime.of(start, 0));
        slot.setEndTime(LocalTime.of(end, 0));
        slot.setCapacity(150);
        slot.setParkingRate(12D);
        slot.setStatus(status);
        return repository.saveAndFlush(slot);
    }
}
