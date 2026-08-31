package be.meetspace.service;

import be.meetspace.entity.ParkingAccessPass;
import be.meetspace.entity.ParkingAccessPassStatus;
import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingReservationStatus;
import be.meetspace.repository.ParkingAccessPassRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ParkingAccessService {
    private final ParkingAccessPassRepository passRepository;

    public ParkingAccessService(ParkingAccessPassRepository passRepository) {
        this.passRepository = passRepository;
    }

    public List<ParkingAccessPass> ensurePasses(ParkingReservation reservation) {
        List<ParkingAccessPass> passes = new ArrayList<>(
                passRepository.findByParkingReservationIdOrderByIdAsc(reservation.getId()));
        int expected = reservation.getReservedSpaces() != null ? reservation.getReservedSpaces() : 0;
        while (passes.size() < expected) {
            ParkingAccessPass pass = new ParkingAccessPass();
            pass.setParkingReservation(reservation);
            pass.setToken(UUID.randomUUID().toString().replace("-", ""));
            pass.setStatus(reservation.getStatus() == ParkingReservationStatus.CANCELLED
                    ? ParkingAccessPassStatus.CANCELLED : ParkingAccessPassStatus.ACTIVE);
            passes.add(passRepository.save(pass));
        }
        reservation.setAccessPasses(passes);
        return passes;
    }

    public void cancelPasses(ParkingReservation reservation) {
        List<ParkingAccessPass> passes = passRepository.findByParkingReservationIdOrderByIdAsc(reservation.getId());
        passes.stream().filter(pass -> pass.getStatus() != ParkingAccessPassStatus.CANCELLED)
                .forEach(pass -> pass.setStatus(ParkingAccessPassStatus.CANCELLED));
        passRepository.saveAll(passes);
        reservation.setAccessPasses(passes);
    }
}
