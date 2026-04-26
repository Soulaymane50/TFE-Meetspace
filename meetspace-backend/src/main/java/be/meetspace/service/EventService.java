package be.meetspace.service;

import be.meetspace.web.dto.EventRequest;
import be.meetspace.web.dto.EventResponseDto;

import java.util.List;

public interface EventService {

    List<EventResponseDto> getPublicEvents();

    EventResponseDto createEvent(EventRequest request);

    EventResponseDto updateEvent(Long id, EventRequest request);

    void deleteEvent(Long id);

    List<EventResponseDto> getAllEventsForAdmin();
}

