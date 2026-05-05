package be.meetspace.service;

import be.meetspace.entity.*;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ReservationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
@Transactional
public class EventPlanningService {

    private final EspaceRepository espaceRepository;
    private final ReservationRepository reservationRepository;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;

    public EventPlanningService(EspaceRepository espaceRepository,
                                ReservationRepository reservationRepository,
                                EventRepository eventRepository,
                                EventRegistrationRepository eventRegistrationRepository,
                                ParkingReservationRepository parkingReservationRepository) {
        this.espaceRepository = espaceRepository;
        this.reservationRepository = reservationRepository;
        this.eventRepository = eventRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
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
        event.setParkingRequired(data.parkingRequired());

        EventLocationType typeToUse = data.locationType() != null
                ? data.locationType()
                : EventLocationType.EXTERNAL;

        if (typeToUse == EventLocationType.EXISTING_SPACE) {
            if (data.spaceId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un espace existant doit être sélectionné");
            }

            Espace espace = espaceRepository.findById(data.spaceId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espace introuvable pour l'événement"));

            if (espace.getStatus() != EspaceStatus.AVAILABLE) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Espace non disponible");
            }

            if (data.capacity() > espace.getCapacity()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "La capacité de l'événement ne peut pas dépasser la capacité de la salle (" + espace.getCapacity() + " personnes)"
                );
            }

            if (reservationRepository.existsOverlappingReservation(
                    espace.getId(), data.startDateTime(), data.endDateTime())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "L'espace sélectionné est déjà réservé sur ce créneau");
            }

            if (eventRepository.existsOverlappingEventForSpace(
                    espace.getId(), data.startDateTime(), data.endDateTime(), excludeEventId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Un autre événement occupe déjà cet espace sur ce créneau");
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
        if (!data.parkingRequired()) {
            event.setParkingSlot(null);
            return;
        }

        if (data.parkingCapacity() == null || data.parkingCapacity() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nombre de places de parking est requis");
        }
        if (data.parkingCapacity() > data.capacity()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Le nombre de places de parking ne peut pas dépasser la capacité de l'événement"
            );
        }
        if (data.parkingPrice() == null || data.parkingPrice() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le tarif du parking est requis");
        }

        ParkingSlot parkingSlot = event.getParkingSlot();
        if (parkingSlot == null) {
            parkingSlot = new ParkingSlot();
        } else if (parkingSlot.getId() != null) {
            int reservedSpaces = parkingReservationRepository.countReservedSpacesByParkingSlotId(parkingSlot.getId());
            if (data.parkingCapacity() < reservedSpaces) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "La capacité parking ne peut pas être inférieure aux places déjà réservées (" + reservedSpaces + ")"
                );
            }
        }

        parkingSlot.setEvent(event);
        parkingSlot.setTitle("Accès parking - " + event.getTitle());
        parkingSlot.setDescription("Parking associé à l'événement " + event.getTitle());
        parkingSlot.setSessionDate(event.getStartDateTime().toLocalDate());
        parkingSlot.setStartTime(event.getStartDateTime().toLocalTime());
        parkingSlot.setEndTime(event.getEndDateTime().toLocalTime());
        parkingSlot.setCapacity(data.parkingCapacity());
        parkingSlot.setParkingRate(data.parkingPrice());
        parkingSlot.setStatus(ParkingSlotStatus.OPEN);

        event.setParkingSlot(parkingSlot);
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
