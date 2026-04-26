package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRepository;
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

    public EventPlanningService(EspaceRepository espaceRepository,
                                ReservationRepository reservationRepository,
                                EventRepository eventRepository) {
        this.espaceRepository = espaceRepository;
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
    }

    public void applyAndValidate(Event event, EventData data, Long excludeEventId) {
        validateDates(data.startDateTime(), data.endDateTime());

        event.setTitle(data.title());
        event.setDescription(data.description());
        event.setStartDateTime(data.startDateTime());
        event.setEndDateTime(data.endDateTime());
        if (data.capacity() == null || data.capacity() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La capacitÃƒÂ© doit ÃƒÂªtre renseignÃƒÂ©e et positive");
        }
        event.setCapacity(data.capacity());
        event.setPrice(data.price());
        event.setMinAge(data.minAge());
        event.setMaxAge(data.maxAge());
        if (data.minAge() != null && data.minAge() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'ÃƒÂ¢ge minimum doit ÃƒÂªtre positif");
        }
        if (data.maxAge() != null && data.maxAge() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'ÃƒÂ¢ge maximum doit ÃƒÂªtre positif");
        }
        if (data.minAge() != null && data.maxAge() != null && data.maxAge() < data.minAge()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'ÃƒÂ¢ge maximum doit ÃƒÂªtre supÃƒÂ©rieur ou ÃƒÂ©gal ÃƒÂ  l'ÃƒÂ¢ge minimum");
        }
        if (data.status() != null) {
            event.setStatus(data.status());
        }
        event.setParkingRequired(data.parkingRequired());

        EventLocationType typeToUse = data.locationType() != null
                ? data.locationType()
                : EventLocationType.EXTERNAL;

        if (typeToUse == EventLocationType.EXISTING_SPACE) {
            if (data.spaceId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un espace existant doit ÃƒÂªtre sÃƒÂ©lectionnÃƒÂ©");
            }

            Espace espace = espaceRepository.findById(data.spaceId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable pour l'ÃƒÂ©vÃƒÂ©nement"));

            if (espace.getStatus() != EspaceStatus.AVAILABLE) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Espace non disponible");
            }

            if (reservationRepository.existsOverlappingReservation(
                    espace.getId(), data.startDateTime(), data.endDateTime())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "L'espace sÃƒÂ©lectionnÃƒÂ© est dÃƒÂ©jÃƒÂ  rÃƒÂ©servÃƒÂ© sur ce crÃƒÂ©neau");
            }

            if (eventRepository.existsOverlappingEventForSpace(
                    espace.getId(), data.startDateTime(), data.endDateTime(), excludeEventId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Un autre ÃƒÂ©vÃƒÂ©nement occupe dÃƒÂ©jÃƒÂ  cet espace sur ce crÃƒÂ©neau");
            }

            event.setSpace(espace);
            event.setLocation(espace.getName());
            event.setExternalAddress(null);
            event.setLocationType(EventLocationType.EXISTING_SPACE);
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
        }

        syncParkingSlot(event, data);
    }

    private void validateDates(LocalDateTime start, LocalDateTime end) {
        LocalDateTime now = LocalDateTime.now();

        if (start.isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de dÃƒÂ©but ne peut pas ÃƒÂªtre dans le passÃƒÂ©");
        }

        if (end.isBefore(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin ne peut pas ÃƒÂªtre dans le passÃƒÂ©");
        }

        if (!end.isAfter(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin doit ÃƒÂªtre aprÃƒÂ¨s la date de dÃƒÂ©but");
        }
    }

    private void syncParkingSlot(Event event, EventData data) {
        if (!data.parkingRequired()) {
            event.setParkingSlot(null);
            return;
        }

        if (data.parkingCapacity() == null || data.parkingCapacity() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nombre de places de parking est requis");
        }
        if (data.parkingPrice() == null || data.parkingPrice() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le tarif du parking est requis");
        }

        ParkingSlot parkingSlot = event.getParkingSlot();
        if (parkingSlot == null) {
            parkingSlot = new ParkingSlot();
        }

        parkingSlot.setEvent(event);
        parkingSlot.setTitle("Parking pour event " + event.getTitle());
        parkingSlot.setDescription("Parking associÃƒÂ© ÃƒÂ  l'ÃƒÂ©vÃƒÂ©nement " + event.getTitle());
        parkingSlot.setSessionDate(event.getStartDateTime().toLocalDate());
        parkingSlot.setStartTime(event.getStartDateTime().toLocalTime());
        parkingSlot.setEndTime(event.getEndDateTime().toLocalTime());
        parkingSlot.setCapacity(data.parkingCapacity());
        parkingSlot.setParkingRate(data.parkingPrice());
        parkingSlot.setStatus(ParkingSlotStatus.OPEN);
        parkingSlot.setMinAge(data.parkingMinDuration());
        parkingSlot.setMaxAge(data.parkingMaxDuration());

        event.setParkingSlot(parkingSlot);
    }

    public record EventData(
            String title,
            String description,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime,
            Integer capacity,
            Double price,
            Integer minAge,
            Integer maxAge,
            EventStatus status,
            EventLocationType locationType,
            Long spaceId,
            String externalAddress,
            String locationLabel,
            boolean parkingRequired,
            Double parkingPrice,
            Integer parkingCapacity,
            Integer parkingMinDuration,
            Integer parkingMaxDuration
    ) {
        public static EventData from(be.meetspace.web.dto.EventRequestDto dto, EventStatus status) {
            return new EventData(
                    dto.getTitle(),
                    dto.getDescription(),
                    dto.getStartDateTime(),
                    dto.getEndDateTime(),
                    dto.getCapacity(),
                    dto.getPrice(),
                    dto.getMinAge(),
                    dto.getMaxAge(),
                    status,
                    dto.getLocationType(),
                    dto.getSpaceId(),
                    dto.getExternalAddress(),
                    dto.getLocation(),
                    dto.getParkingRequired() != null && dto.getParkingRequired(),
                    dto.getParkingPrice(),
                    dto.getParkingCapacity(),
                    dto.getParkingMinDuration(),
                    dto.getParkingMaxDuration()
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
                    dto.getMinAge(),
                    dto.getMaxAge(),
                    dto.getStatus(),
                    dto.getLocationType(),
                    dto.getSpaceId(),
                    dto.getExternalAddress(),
                    dto.getLocation(),
                    dto.isParkingRequired(),
                    dto.getParkingPrice(),
                    dto.getParkingCapacity(),
                    dto.getParkingMinDuration(),
                    dto.getParkingMaxDuration()
            );
        }
    }
}

