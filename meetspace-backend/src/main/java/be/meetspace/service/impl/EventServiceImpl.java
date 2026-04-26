package be.meetspace.service.impl;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.service.EventService;
import be.meetspace.service.EventPlanningService;
import be.meetspace.web.dto.EventRequest;
import be.meetspace.web.dto.EventResponseDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class EventServiceImpl implements EventService {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final EventPlanningService planningService;

    public EventServiceImpl(EventRepository eventRepository,
                            EventRegistrationRepository registrationRepository,
                            EventPlanningService planningService) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.planningService = planningService;
    }

    @Override
    public List<EventResponseDto> getPublicEvents() {
        List<Event> events = eventRepository
                .findByStatusAndStartDateTimeAfterOrderByStartDateTimeAsc(
                        EventStatus.PUBLISHED,
                        LocalDateTime.now()
                );
        return events.stream()
                .map(e -> {
                    Integer registeredCount = registrationRepository.countTotalParticipantsByEventId(e.getId());
                    return EventResponseDto.fromEntity(e, registeredCount);
                })
                .toList();
    }

    @Override
    public EventResponseDto createEvent(EventRequest request) {
        validateEventDates(request);

        Event e = new Event();
        planningService.applyAndValidate(e, EventPlanningService.EventData.from(request), null);
        Event saved = eventRepository.save(e);
        return EventResponseDto.fromEntity(saved, 0);
    }

    @Override
    public EventResponseDto updateEvent(Long id, EventRequest request) {
        validateEventDates(request);

        Event e = eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ã‰vÃ©nement introuvable"));

        planningService.applyAndValidate(e, EventPlanningService.EventData.from(request), id);
        Event saved = eventRepository.save(e);
        Integer registeredCount = registrationRepository.countTotalParticipantsByEventId(saved.getId());
        return EventResponseDto.fromEntity(saved, registeredCount);
    }

    @Override
    public void deleteEvent(Long id) {
        if (!eventRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ã‰vÃ©nement introuvable");
        }
        eventRepository.deleteById(id);
    }

    @Override
    public List<EventResponseDto> getAllEventsForAdmin() {
        return eventRepository.findAll()
                .stream()
                .map(e -> {
                    Integer registeredCount = registrationRepository.countTotalParticipantsByEventId(e.getId());
                    return EventResponseDto.fromEntity(e, registeredCount);
                })
                .toList();
    }

    private void validateEventDates(EventRequest request) {
        LocalDateTime now = LocalDateTime.now();

        if (request.getStartDateTime().isBefore(now)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, 
                "La date de dÃ©but ne peut pas Ãªtre dans le passÃ©"
            );
        }

        if (request.getEndDateTime().isBefore(now)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, 
                "La date de fin ne peut pas Ãªtre dans le passÃ©"
            );
        }

        if (request.getEndDateTime().isBefore(request.getStartDateTime()) || 
            request.getEndDateTime().isEqual(request.getStartDateTime())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, 
                "La date de fin doit Ãªtre aprÃ¨s la date de dÃ©but"
            );
        }
    }

    private void applyRequestToEntity(EventRequest request, Event e) {
        e.setTitle(request.getTitle());
        e.setDescription(request.getDescription());
        e.setStartDateTime(request.getStartDateTime());
        e.setEndDateTime(request.getEndDateTime());
        e.setCapacity(request.getCapacity());
        e.setPrice(request.getPrice());
        e.setStatus(request.getStatus());
    }
}

