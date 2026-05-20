package be.meetspace.web.controller;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.web.dto.EventResponseDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/public/events")
public class EventController {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final ParkingReservationRepository parkingReservationRepository;

    public EventController(
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            ParkingReservationRepository parkingReservationRepository
    ) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
    }

    @GetMapping
    public List<EventResponseDto> getPublishedEvents() {
        return eventRepository.findByStatusAndStartDateTimeAfterOrderByStartDateTimeAsc(
                EventStatus.PUBLISHED, 
                LocalDateTime.now()
        ).stream()
        .map(e -> {
            int registered = registrationRepository.countTotalParticipantsByEventId(e.getId());
            int parkingReserved = e.getParkingSlot() != null
                    ? parkingReservationRepository.countReservedSpacesByParkingSlotId(e.getParkingSlot().getId())
                    : 0;
            return EventResponseDto.fromEntity(e, registered, parkingReserved);
        })
        .toList();
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
        return EventResponseDto.fromEntity(event, registered, parkingReserved);
    }
}
