package be.meetspace.web.controller;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.service.ParkingCapacityService;
import be.meetspace.web.dto.EventResponseDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/public/events")
public class EventController {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final ParkingCapacityService parkingCapacityService;

    public EventController(
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            ParkingReservationRepository parkingReservationRepository,
            ParkingCapacityService parkingCapacityService
    ) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.parkingCapacityService = parkingCapacityService;
    }

    @GetMapping
    public List<EventResponseDto> getPublishedEvents() {
        List<Event> events = eventRepository.findByStatusAndStartDateTimeAfterOrderByStartDateTimeAsc(
                EventStatus.PUBLISHED, 
                LocalDateTime.now()
        );
        if (events.isEmpty()) return List.of();

        List<Long> eventIds = events.stream().map(Event::getId).toList();
        Map<Long, Integer> participantsByEvent = new HashMap<>();
        for (var row : registrationRepository.sumParticipantsByEventIds(eventIds)) {
            participantsByEvent.put(row.getEventId(), Math.toIntExact(row.getParticipantCount()));
        }

        var parkingSlots = events.stream()
                .map(Event::getParkingSlot)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, ParkingCapacityService.CapacitySnapshot> parkingCapacities =
                parkingCapacityService.snapshots(parkingSlots);

        return events.stream().map(event -> {
            int registered = participantsByEvent.getOrDefault(event.getId(), 0);
            var parkingSlot = event.getParkingSlot();
            ParkingCapacityService.CapacitySnapshot capacity = parkingSlot != null
                    ? parkingCapacities.get(parkingSlot.getId())
                    : null;
            int parkingReserved = capacity != null ? capacity.reservedForSlot() : 0;
            EventResponseDto dto = EventResponseDto.fromEntity(event, registered, parkingReserved);
            if (capacity != null) {
                dto.applyParkingCapacity(capacity.allocatedSpaces(), capacity.availableSpaces(),
                        capacity.physicalCapacity(), capacity.globalRemainingSpaces());
            }
            return dto;
        }).toList();
    }

    @GetMapping("/{id}")
    public EventResponseDto getEvent(@PathVariable Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable"));
        
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable");
        }
        
        int registered = registrationRepository.countTotalParticipantsByEventId(event.getId());
        int parkingReserved = event.getParkingSlot() != null
                ? parkingReservationRepository.countReservedSpacesByParkingSlotId(event.getParkingSlot().getId())
                : 0;
        EventResponseDto dto = EventResponseDto.fromEntity(event, registered, parkingReserved);
        if (event.getParkingSlot() != null) {
            ParkingCapacityService.CapacitySnapshot capacity = parkingCapacityService.snapshot(event.getParkingSlot());
            dto.applyParkingCapacity(capacity.allocatedSpaces(), capacity.availableSpaces(),
                    capacity.physicalCapacity(), capacity.globalRemainingSpaces());
        }
        return dto;
    }
}
