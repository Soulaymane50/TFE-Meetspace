package be.meetspace.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

@Entity
@Table(name = "parking_slot")
public class ParkingSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false)
    private LocalDate sessionDate;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    @Column(nullable = false)
    private Integer capacity;

    @Column(name = "parking_rate", nullable = false)
    private Double parkingRate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParkingSlotStatus status = ParkingSlotStatus.OPEN;

    @Version
    private Long version;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", unique = true)
    private Event event;

    private Integer minAge;
    private Integer maxAge;

    public Long getId() { return id; }

    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }

    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }

    public void setDescription(String description) { this.description = description; }

    public LocalDate getSessionDate() { return sessionDate; }

    public void setSessionDate(LocalDate sessionDate) { this.sessionDate = sessionDate; }

    public LocalTime getStartTime() { return startTime; }

    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }

    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public Integer getCapacity() { return capacity; }

    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public Double getParkingRate() { return parkingRate; }

    public void setParkingRate(Double parkingRate) { this.parkingRate = parkingRate; }

    public ParkingSlotStatus getStatus() { return status; }

    public void setStatus(ParkingSlotStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Event getEvent() { return event; }

    public void setEvent(Event event) { this.event = event; }

    public Integer getMinAge() { return minAge; }

    public void setMinAge(Integer minAge) { this.minAge = minAge; }

    public Integer getMaxAge() { return maxAge; }

    public void setMaxAge(Integer maxAge) { this.maxAge = maxAge; }
}

