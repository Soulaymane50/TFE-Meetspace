package be.meetspace.web.dto;

import be.meetspace.entity.Event;
import be.meetspace.entity.Reservation;
import be.meetspace.entity.BookingHold;

import java.time.LocalDateTime;

public class CalendarReservationDto {

    private Long id;
    private String blockType;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;

    public CalendarReservationDto() {}

    public CalendarReservationDto(Long id, String blockType, LocalDateTime startDateTime, LocalDateTime endDateTime) {
        this.id = id;
        this.blockType = blockType;
        this.startDateTime = startDateTime;
        this.endDateTime = endDateTime;
    }

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

    public static CalendarReservationDto fromHold(BookingHold hold) {
        CalendarReservationDto dto = new CalendarReservationDto();
        dto.id = hold.getId();
        dto.blockType = "PAYMENT_HOLD";
        dto.startDateTime = hold.getStartAt();
        dto.endDateTime = hold.getEndAt();
        return dto;
    }

    public Long getId() { return id; }
    public String getBlockType() { return blockType; }
    public LocalDateTime getStartDateTime() { return startDateTime; }
    public LocalDateTime getEndDateTime() { return endDateTime; }
}

