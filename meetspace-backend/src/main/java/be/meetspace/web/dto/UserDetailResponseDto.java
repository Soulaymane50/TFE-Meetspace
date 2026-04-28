package be.meetspace.web.dto;

import be.meetspace.entity.*;

import java.time.LocalDateTime;
import java.util.List;

public class UserDetailResponseDto {

    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private Role role;
    private UserStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private List<SimpleReservationDto> spaceReservations;
    private List<SimpleEventRegistrationDto> eventRegistrations;
    private List<SimpleParkingReservationDto> parkingReservations;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public UserStatus getStatus() { return status; }
    public void setStatus(UserStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<SimpleReservationDto> getSpaceReservations() { return spaceReservations; }
    public void setSpaceReservations(List<SimpleReservationDto> spaceReservations) { this.spaceReservations = spaceReservations; }

    public List<SimpleEventRegistrationDto> getEventRegistrations() { return eventRegistrations; }
    public void setEventRegistrations(List<SimpleEventRegistrationDto> eventRegistrations) { this.eventRegistrations = eventRegistrations; }

    public List<SimpleParkingReservationDto> getParkingReservations() { return parkingReservations; }
    public void setParkingReservations(List<SimpleParkingReservationDto> parkingReservations) { this.parkingReservations = parkingReservations; }

    // Inner DTOs to avoid circular references
    public static class SimpleReservationDto {
        private Long id;
        private String espaceName;
        private LocalDateTime startDateTime;
        private LocalDateTime endDateTime;
        private ReservationStatus status;
        private Double totalPrice;

        public static SimpleReservationDto fromEntity(Reservation r) {
            SimpleReservationDto dto = new SimpleReservationDto();
            dto.id = r.getId();
            dto.espaceName = r.getEspace() != null ? r.getEspace().getName() : null;
            dto.startDateTime = r.getStartDateTime();
            dto.endDateTime = r.getEndDateTime();
            dto.status = r.getStatus();
            dto.totalPrice = r.getTotalPrice();
            return dto;
        }

        public Long getId() { return id; }
        public String getEspaceName() { return espaceName; }
        public LocalDateTime getStartDateTime() { return startDateTime; }
        public LocalDateTime getEndDateTime() { return endDateTime; }
        public ReservationStatus getStatus() { return status; }
        public Double getTotalPrice() { return totalPrice; }
    }

    public static class SimpleEventRegistrationDto {
        private Long id;
        private String eventTitle;
        private LocalDateTime eventDate;
        private Integer numberOfParticipants;
        private EventRegistrationStatus status;
        private Double totalPrice;

        public static SimpleEventRegistrationDto fromEntity(EventRegistration r) {
            SimpleEventRegistrationDto dto = new SimpleEventRegistrationDto();
            dto.id = r.getId();
            dto.eventTitle = r.getEvent() != null ? r.getEvent().getTitle() : null;
            dto.eventDate = r.getEvent() != null ? r.getEvent().getStartDateTime() : null;
            dto.numberOfParticipants = r.getNumberOfParticipants();
            dto.status = r.getStatus();
            dto.totalPrice = r.getTotalPrice();
            return dto;
        }

        public Long getId() { return id; }
        public String getEventTitle() { return eventTitle; }
        public LocalDateTime getEventDate() { return eventDate; }
        public Integer getNumberOfParticipants() { return numberOfParticipants; }
        public EventRegistrationStatus getStatus() { return status; }
        public Double getTotalPrice() { return totalPrice; }
    }

    public static class SimpleParkingReservationDto {
        private Long id;
        private String parkingSlotTitle;
        private String slotDate;
        private Integer reservedSpaces;
        private ParkingReservationStatus status;
        private Double totalPrice;

        public static SimpleParkingReservationDto fromEntity(ParkingReservation r) {
            SimpleParkingReservationDto dto = new SimpleParkingReservationDto();
            dto.id = r.getId();
            dto.parkingSlotTitle = r.getParkingSlot() != null ? r.getParkingSlot().getTitle() : null;
            dto.slotDate = r.getParkingSlot() != null ? r.getParkingSlot().getSessionDate().toString() : null;
            dto.reservedSpaces = r.getReservedSpaces();
            dto.status = r.getStatus();
            dto.totalPrice = r.getTotalPrice();
            return dto;
        }

        public Long getId() { return id; }
        public String getParkingSlotTitle() { return parkingSlotTitle; }
        public String getSlotDate() { return slotDate; }
        public Integer getReservedSpaces() { return reservedSpaces; }
        public ParkingReservationStatus getStatus() { return status; }
        public Double getTotalPrice() { return totalPrice; }
    }
}

