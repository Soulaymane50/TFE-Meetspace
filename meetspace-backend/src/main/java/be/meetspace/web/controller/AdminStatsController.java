package be.meetspace.web.controller;

import be.meetspace.entity.EventRegistrationStatus;
import be.meetspace.entity.ParkingReservationStatus;
import be.meetspace.entity.ReservationStatus;
import be.meetspace.repository.*;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/stats")
public class AdminStatsController {

    private final UserRepository userRepository;
    private final EspaceRepository espaceRepository;
    private final EventRepository eventRepository;
    private final ParkingSlotRepository parkingSlotRepository;
    private final ReservationRepository reservationRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;

    public AdminStatsController(
            UserRepository userRepository,
            EspaceRepository espaceRepository,
            EventRepository eventRepository,
            ParkingSlotRepository parkingSlotRepository,
            ReservationRepository reservationRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ParkingReservationRepository parkingReservationRepository
    ) {
        this.userRepository = userRepository;
        this.espaceRepository = espaceRepository;
        this.eventRepository = eventRepository;
        this.parkingSlotRepository = parkingSlotRepository;
        this.reservationRepository = reservationRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
    }

    @GetMapping
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();

        // Compteurs de base (requêtes SQL count() optimisées)
        stats.put("totalUsers", userRepository.count());
        stats.put("totalEspaces", espaceRepository.count());
        stats.put("totalEvents", eventRepository.count());
        stats.put("totalParkingSlots", parkingSlotRepository.count());

        // Stats espaces - requêtes SQL directes COUNT/SUM
        long confirmedSpaceRes = reservationRepository.countByStatus(ReservationStatus.CONFIRMED);
        long cancelledSpaceRes = reservationRepository.countByStatus(ReservationStatus.CANCELLED);
        double spaceRevenue = reservationRepository.sumTotalPriceByStatus(ReservationStatus.CONFIRMED);

        stats.put("confirmedSpaceReservations", confirmedSpaceRes);
        stats.put("cancelledSpaceReservations", cancelledSpaceRes);
        stats.put("spaceRevenue", spaceRevenue);

        // Stats événements - requêtes SQL directes COUNT/SUM
        long confirmedEventRes = eventRegistrationRepository.countByStatus(EventRegistrationStatus.CONFIRMED);
        long cancelledEventRes = eventRegistrationRepository.countByStatus(EventRegistrationStatus.CANCELLED);
        double eventRevenue = eventRegistrationRepository.sumTotalPriceByStatus(EventRegistrationStatus.CONFIRMED);

        stats.put("confirmedEventRegistrations", confirmedEventRes);
        stats.put("cancelledEventRegistrations", cancelledEventRes);
        stats.put("eventRevenue", eventRevenue);

        long confirmedParkingReservations = parkingReservationRepository.countByStatus(ParkingReservationStatus.CONFIRMED);
        long cancelledParkingReservations = parkingReservationRepository.countByStatus(ParkingReservationStatus.CANCELLED);
        double parkingRevenue = parkingReservationRepository.sumTotalPriceByStatus(ParkingReservationStatus.CONFIRMED);

        stats.put("confirmedParkingReservations", confirmedParkingReservations);
        stats.put("cancelledParkingReservations", cancelledParkingReservations);
        stats.put("parkingRevenue", parkingRevenue);

        stats.put("totalRevenue", spaceRevenue + eventRevenue + parkingRevenue);

        return stats;
    }
}

