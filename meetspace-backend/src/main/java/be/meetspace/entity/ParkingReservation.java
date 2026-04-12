package be.meetspace.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "parking_reservation")
public class ParkingReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "parking_slot_id")
    private ParkingSlot parkingSlot;

    @Column(name = "reserved_spaces", nullable = false)
    private Integer reservedSpaces;

    @Column(nullable = false)
    private Double totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParkingReservationStatus status = ParkingReservationStatus.CONFIRMED;

    @Version
    private Long version;

    @Column(name = "payment_intent_id")
    private String paymentIntentId;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public ParkingSlot getParkingSlot() { return parkingSlot; }
    public void setParkingSlot(ParkingSlot parkingSlot) { this.parkingSlot = parkingSlot; }

    public Integer getReservedSpaces() { return reservedSpaces; }
    public void setReservedSpaces(Integer reservedSpaces) {
        this.reservedSpaces = reservedSpaces;
    }

    public Double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(Double totalPrice) { this.totalPrice = totalPrice; }

    public ParkingReservationStatus getStatus() { return status; }
    public void setStatus(ParkingReservationStatus status) { this.status = status; }

    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String paymentIntentId) { this.paymentIntentId = paymentIntentId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
