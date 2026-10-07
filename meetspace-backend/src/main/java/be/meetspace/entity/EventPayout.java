package be.meetspace.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Records a bank transfer performed outside MeetSpace; does not initiate a transfer. */
@Entity
@Table(name = "event_payout", uniqueConstraints = {
    @UniqueConstraint(name = "uk_event_payout_event", columnNames = "event_id"),
    @UniqueConstraint(name = "uk_event_payout_reference", columnNames = "transfer_reference")
})
public class EventPayout {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "event_id") private Event event;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "recipient_id") private User recipient;
    @Column(name = "amount_cents", nullable = false) private Long amountCents;
    @Column(name = "ticket_revenue_cents", nullable = false) private Long ticketRevenueCents;
    @Column(name = "commission_cents", nullable = false) private Long commissionCents;
    @Column(name = "room_balance_deducted_cents", nullable = false) private Long roomBalanceDeductedCents;
    @Column(name = "transfer_reference", nullable = false, length = 120) private String transferReference;
    @Column(name = "recorded_at", nullable = false) private LocalDateTime recordedAt;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "recorded_by") private User recordedBy;
    public Long getId() { return id; }
    public Event getEvent() { return event; }
    public void setEvent(Event value) { event = value; }
    public User getRecipient() { return recipient; }
    public void setRecipient(User value) { recipient = value; }
    public Long getAmountCents() { return amountCents; }
    public void setAmountCents(Long value) { amountCents = value; }
    public Long getTicketRevenueCents() { return ticketRevenueCents; }
    public void setTicketRevenueCents(Long value) { ticketRevenueCents = value; }
    public Long getCommissionCents() { return commissionCents; }
    public void setCommissionCents(Long value) { commissionCents = value; }
    public Long getRoomBalanceDeductedCents() { return roomBalanceDeductedCents; }
    public void setRoomBalanceDeductedCents(Long value) { roomBalanceDeductedCents = value; }
    public String getTransferReference() { return transferReference; }
    public void setTransferReference(String value) { transferReference = value; }
    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime value) { recordedAt = value; }
    public User getRecordedBy() { return recordedBy; }
    public void setRecordedBy(User value) { recordedBy = value; }
}
