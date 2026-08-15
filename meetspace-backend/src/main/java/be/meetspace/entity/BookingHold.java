package be.meetspace.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "booking_hold", indexes = {
        @Index(name = "idx_booking_hold_resource", columnList = "type,resource_id,status,expires_at"),
        @Index(name = "idx_booking_hold_secondary", columnList = "secondary_resource_id,status,expires_at")
})
public class BookingHold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private PaymentType type;

    @Column(name = "resource_id", nullable = false)
    private Long resourceId;

    @Column(name = "secondary_resource_id")
    private Long secondaryResourceId;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "secondary_quantity", nullable = false)
    private Integer secondaryQuantity = 0;

    @Column(name = "start_at")
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Column(name = "amount_cents", nullable = false)
    private Long amountCents;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingHoldStatus status = BookingHoldStatus.ACTIVE;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Version
    private Long version;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public PaymentType getType() { return type; }
    public void setType(PaymentType type) { this.type = type; }
    public Long getResourceId() { return resourceId; }
    public void setResourceId(Long resourceId) { this.resourceId = resourceId; }
    public Long getSecondaryResourceId() { return secondaryResourceId; }
    public void setSecondaryResourceId(Long secondaryResourceId) { this.secondaryResourceId = secondaryResourceId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Integer getSecondaryQuantity() { return secondaryQuantity; }
    public void setSecondaryQuantity(Integer secondaryQuantity) { this.secondaryQuantity = secondaryQuantity; }
    public LocalDateTime getStartAt() { return startAt; }
    public void setStartAt(LocalDateTime startAt) { this.startAt = startAt; }
    public LocalDateTime getEndAt() { return endAt; }
    public void setEndAt(LocalDateTime endAt) { this.endAt = endAt; }
    public Long getAmountCents() { return amountCents; }
    public void setAmountCents(Long amountCents) { this.amountCents = amountCents; }
    public BookingHoldStatus getStatus() { return status; }
    public void setStatus(BookingHoldStatus status) { this.status = status; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
