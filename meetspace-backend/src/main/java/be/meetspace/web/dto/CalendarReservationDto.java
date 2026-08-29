package be.meetspace.web.dto;

import be.meetspace.entity.Event;
import be.meetspace.entity.Reservation;

import java.time.LocalDateTime;

public class CalendarReservationDto {

    private Long id;
    private String blockType;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;

    public static CalendarReservationDto fromEntity(Reservation reservation) {
        CalendarReservationDto dto = new CalendarReservationDto();
        dto.id = reservation.getId();
        dto.blockType = "RESERVATION";
        dto.startDateTime = reservation.getStartDateTime();
        dto.endDateTime = reservation.getEndDateTime();
        return dto;
    }

    public static CalendarReservationDto fromEvent(Event event) {
        CalendarReservationDto dto = new CalendarReservationDto();
        dto.id = event.getId();
        dto.blockType = "EVENT";
        dto.startDateTime = event.getStartDateTime();
        dto.endDateTime = event.getEndDateTime();
        return dto;
    }

    public Long getId() { return id; }
    public String getBlockType() { return blockType; }
    public LocalDateTime getStartDateTime() { return startDateTime; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
}

