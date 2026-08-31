package be.meetspace.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "parking_access_pass")
public class ParkingAccessPass {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "parking_reservation_id")
    private ParkingReservation parkingReservation;
    @Column(nullable = false, unique = true, length = 64)
    private String token;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ParkingAccessPassStatus status = ParkingAccessPassStatus.ACTIVE;
    private LocalDateTime checkedInAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_in_by")
    private User checkedInBy;
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    @Version
    private Long version;
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ParkingReservation getParkingReservation() { return parkingReservation; }
    public void setParkingReservation(ParkingReservation parkingReservation) { this.parkingReservation = parkingReservation; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public ParkingAccessPassStatus getStatus() { return status; }
    public void setStatus(ParkingAccessPassStatus status) { this.status = status; }
    public LocalDateTime getCheckedInAt() { return checkedInAt; }
    public void setCheckedInAt(LocalDateTime checkedInAt) { this.checkedInAt = checkedInAt; }
    public User getCheckedInBy() { return checkedInBy; }
    public void setCheckedInBy(User checkedInBy) { this.checkedInBy = checkedInBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
