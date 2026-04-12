package be.meetspace.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "espace_reservation")
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "espace_id")
    private Espace espace;

    @Column(nullable = false)
    private LocalDateTime startDateTime;

    @Column(nullable = false)
    private LocalDateTime endDateTime;

    @Column(nullable = false)
    private Double totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReservationStatus status = ReservationStatus.CONFIRMED;

    @Version
    private Long version;

    @Column(name = "payment_intent_id")
    private String paymentIntentId;

    @Column(length = 1000)
    private String justification;

    @Column(length = 500)
    private String rejectionReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    private LocalDateTime approvedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Espace getEspace() { return espace; }
    public void setEspace(Espace espace) { this.espace = espace; }

    public LocalDateTime getStartDateTime() { return startDateTime; }
    public void setStartDateTime(LocalDateTime startDateTime) { this.startDateTime = startDateTime; }

    public LocalDateTime getEndDateTime() { return endDateTime; }
    public void setEndDateTime(LocalDateTime endDateTime) { this.endDateTime = endDateTime; }

    public Double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(Double totalPrice) { this.totalPrice = totalPrice; }

    public ReservationStatus getStatus() { return status; }
    public void setStatus(ReservationStatus status) { this.status = status; }

    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String paymentIntentId) { this.paymentIntentId = paymentIntentId; }

    public String getJustification() { return justification; }
    public void setJustification(String justification) { this.justification = justification; }

    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }

    public User getApprovedBy() { return approvedBy; }
    public void setApprovedBy(User approvedBy) { this.approvedBy = approvedBy; }

    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
