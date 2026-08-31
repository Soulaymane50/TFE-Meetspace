package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.repository.ReservationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
@Transactional
public class EventPlanningService {

    private final EspaceRepository espaceRepository;
    private final ReservationRepository reservationRepository;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final ParkingSlotRepository parkingSlotRepository;
    private final ParkingCapacityService parkingCapacityService;
    private final ParkingAccessService parkingAccessService;

    public EventPlanningService(EspaceRepository espaceRepository,
                                ReservationRepository reservationRepository,
                                EventRepository eventRepository,
                                EventRegistrationRepository eventRegistrationRepository,
                                ParkingReservationRepository parkingReservationRepository,
                                ParkingSlotRepository parkingSlotRepository,
                                ParkingCapacityService parkingCapacityService,
                                ParkingAccessService parkingAccessService) {
        this.espaceRepository = espaceRepository;
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.parkingSlotRepository = parkingSlotRepository;
        this.parkingCapacityService = parkingCapacityService;
        this.parkingAccessService = parkingAccessService;
    }

    public void applyAndValidate(Event event, EventData data, Long excludeEventId) {
        validateDates(data.startDateTime(), data.endDateTime());

        event.setTitle(data.title());
        event.setDescription(data.description());
        event.setStartDateTime(data.startDateTime());
        event.setEndDateTime(data.endDateTime());
        if (data.capacity() == null || data.capacity() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La capacité doit être renseignée et positive");
        }
        if (event.getId() != null) {
            int registeredParticipants = eventRegistrationRepository.countTotalParticipantsByEventId(event.getId());
            if (data.capacity() < registeredParticipants) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "La capacité de l'événement ne peut pas être inférieure aux participants déjà inscrits (" + registeredParticipants + ")"
                );
            }
        }
        event.setCapacity(data.capacity());
        event.setPrice(data.price());
        if (data.status() != null) {
            event.setStatus(data.status());
        }

        EventLocationType typeToUse = data.locationType() != null
                ? data.locationType()
                : EventLocationType.EXTERNAL;

        if (typeToUse == EventLocationType.EXISTING_SPACE) {
            if (data.spaceId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un espace existant doit être sélectionné");
            }

            Espace espace = lockAndValidateExistingSpace(
                    data.spaceId(), data.startDateTime(), data.endDateTime(), data.capacity(), excludeEventId);

            event.setSpace(espace);
            event.setLocation(espace.getName());
            event.setExternalAddress(null);
            event.setLocationType(EventLocationType.EXISTING_SPACE);
            event.setParkingRequired(true);
        } else {
            String resolvedAddress = StringUtils.hasText(data.externalAddress())
                    ? data.externalAddress()
                    : (StringUtils.hasText(data.locationLabel()) ? data.locationLabel() : null);

            if (!StringUtils.hasText(resolvedAddress)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Une adresse externe est requise");
            }
            event.setSpace(null);
            event.setExternalAddress(resolvedAddress);
            event.setLocation(resolvedAddress);
            event.setLocationType(EventLocationType.EXTERNAL);
            event.setParkingRequired(false);
        }

        syncParkingSlot(event, data);
    }

    public void validateAvailabilityForPublication(Event event) {
        if (event.getLocationType() != EventLocationType.EXISTING_SPACE || event.getSpace() == null) {
            return;
        }
        lockAndValidateExistingSpace(
                event.getSpace().getId(),
                event.getStartDateTime(),
                event.getEndDateTime(),
                event.getCapacity(),
                event.getId()
        );
    }

    private Espace lockAndValidateExistingSpace(Long spaceId,
                                                LocalDateTime start,
                                                LocalDateTime end,
                                                Integer eventCapacity,
                                                Long excludeEventId) {
        Espace espace = espaceRepository.findByIdForUpdate(spaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable pour l'événement"));

        if (espace.getStatus() != EspaceStatus.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Espace non disponible");
        }
        if (eventCapacity > espace.getCapacity()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "La capacité de l'événement ne peut pas dépasser la capacité de la salle (" + espace.getCapacity() + " personnes)"
            );
        }
        if (reservationRepository.existsOverlappingReservation(espace.getId(), start, end)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'espace sélectionné est déjà réservé sur ce créneau");
        }
        if (eventRepository.existsOverlappingEventForSpace(espace.getId(), start, end, excludeEventId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un autre événement occupe déjà cet espace sur ce créneau");
        }
        return espace;
    }

    private void validateDates(LocalDateTime start, LocalDateTime end) {
        LocalDateTime now = LocalDateTime.now();

        if (start.isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de début ne peut pas être dans le passé");
        }

        if (end.isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin ne peut pas être dans le passé");
        }

        if (!end.isAfter(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin doit être après la date de début");
        }
    }

    private void syncParkingSlot(Event event, EventData data) {
        if (event.getLocationType() != EventLocationType.EXISTING_SPACE) {
            event.setParkingSlot(null);
            return;
        }
        ParkingSlot parkingSlot = event.getParkingSlot() != null ? event.getParkingSlot() : new ParkingSlot();

        parkingSlot.setEvent(event);
        parkingSlot.setTitle("Parking — " + event.getTitle());
        parkingSlot.setDescription("Parking MeetSpace partagé automatiquement selon les événements qui se chevauchent.");
        parkingSlot.setSessionDate(event.getStartDateTime().toLocalDate());
        parkingSlot.setStartTime(event.getStartDateTime().toLocalTime());
        parkingSlot.setEndTime(event.getEndDateTime().toLocalTime());
        parkingSlot.setCapacity(Math.min(BusinessRules.TOTAL_PARKING_SPACES, data.capacity()));
        parkingSlot.setParkingRate(BusinessRules.calculateParkingRate(calculateDurationHours(event), getRoomCapacity(event)));
        parkingSlot.setStatus(event.getStatus() == EventStatus.PUBLISHED ? ParkingSlotStatus.OPEN : ParkingSlotStatus.CANCELLED);

        event.setParkingSlot(parkingSlot);
    }

    public void activateParkingForPublication(Event event) {
        if (event.getLocationType() != EventLocationType.EXISTING_SPACE || event.getParkingSlot() == null) return;
        ParkingSlot slot = event.getParkingSlot();
        slot.setStatus(ParkingSlotStatus.OPEN);
        parkingSlotRepository.save(slot);
        if (event.getCreatedBy() == null || parkingReservationRepository
                .existsByParkingSlotIdAndUserIdAndComplimentaryTrueAndStatusNot(
                        slot.getId(), event.getCreatedBy().getId(), ParkingReservationStatus.CANCELLED)) return;
        parkingCapacityService.lockAndAssertAvailable(slot, 1);
        ParkingReservation reservation = new ParkingReservation();
        reservation.setUser(event.getCreatedBy());
        reservation.setParkingSlot(slot);
        reservation.setReservedSpaces(1);
        reservation.setTotalPrice(0D);
        reservation.setComplimentary(true);
        reservation.setStatus(ParkingReservationStatus.CONFIRMED);
        ParkingReservation saved = parkingReservationRepository.save(reservation);
        parkingAccessService.ensurePasses(saved);
    }

    public void syncParkingStatus(Event event) {
        if (event.getParkingSlot() == null) return;
        boolean open = event.getStatus() == EventStatus.PUBLISHED;
        ParkingSlot slot = event.getParkingSlot();
        slot.setStatus(open ? ParkingSlotStatus.OPEN : ParkingSlotStatus.CANCELLED);
        parkingSlotRepository.save(slot);
        if (!open) {
            parkingReservationRepository.findByParkingSlotId(slot.getId()).stream()
                    .filter(ParkingReservation::isComplimentary)
                    .filter(reservation -> reservation.getStatus() != ParkingReservationStatus.CANCELLED)
                    .forEach(reservation -> {
                        reservation.setStatus(ParkingReservationStatus.CANCELLED);
                        parkingReservationRepository.save(reservation);
                        parkingAccessService.cancelPasses(reservation);
                    });
        }
    }

    private double calculateDurationHours(Event event) {
        if (event.getStartDateTime() == null || event.getEndDateTime() == null) {
            return 0D;
        }
        long minutes = Duration.between(event.getStartDateTime(), event.getEndDateTime()).toMinutes();
        return Math.max(0D, minutes / 60D);
    }

    private Integer getRoomCapacity(Event event) {
        return event.getSpace() != null ? event.getSpace().getCapacity() : event.getCapacity();
    }

    public record EventData(
            String title,
            String description,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime,
            Integer capacity,
            Double price,
            EventStatus status,
            EventLocationType locationType,
            Long spaceId,
            String externalAddress,
            String locationLabel,
            boolean parkingRequired,
            Double parkingPrice,
            Integer parkingCapacity
    ) {
        public static EventData from(be.meetspace.web.dto.EventRequestDto dto, EventStatus status) {
            return new EventData(
                    dto.getTitle(),
                    dto.getDescription(),
                    dto.getStartDateTime(),
                    dto.getEndDateTime(),
                    dto.getCapacity(),
                    dto.getPrice(),
                    status,
                    dto.getLocationType(),
                    dto.getSpaceId(),
                    dto.getExternalAddress(),
                    dto.getLocation(),
                    dto.getParkingRequired() != null && dto.getParkingRequired(),
                    dto.getParkingPrice(),
                    dto.getParkingCapacity()
            );
        }

        public static EventData from(be.meetspace.web.dto.EventRequest dto) {
            return new EventData(
                    dto.getTitle(),
                    dto.getDescription(),
                    dto.getStartDateTime(),
                    dto.getEndDateTime(),
                    dto.getCapacity(),
                    dto.getPrice(),
                    dto.getStatus(),
                    dto.getLocationType(),
                    dto.getSpaceId(),
                    dto.getExternalAddress(),
                    dto.getLocation(),
                    dto.isParkingRequired(),
                    dto.getParkingPrice(),
                    dto.getParkingCapacity()
            );
        }
    }
}
