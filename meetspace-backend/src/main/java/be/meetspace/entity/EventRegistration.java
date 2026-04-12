package be.meetspace.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "event_registration")
public class EventRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private Event event;

    @Column(nullable = false)
    private Integer numberOfParticipants = 1;

    @Column(nullable = false)
    private Double totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EventRegistrationStatus status = EventRegistrationStatus.CONFIRMED;

    @Version
    private Long version;

    @Column(name = "payment_intent_id")
    private String paymentIntentId;

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

    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }

    public Integer getNumberOfParticipants() { return numberOfParticipants; }
    public void setNumberOfParticipants(Integer numberOfParticipants) { this.numberOfParticipants = numberOfParticipants; }

    public Double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(Double totalPrice) { this.totalPrice = totalPrice; }

    public EventRegistrationStatus getStatus() { return status; }
    public void setStatus(EventRegistrationStatus status) { this.status = status; }

    public String getPaymentIntentId() { return paymentIntentId; }
    public void setPaymentIntentId(String paymentIntentId) { this.paymentIntentId = paymentIntentId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}

