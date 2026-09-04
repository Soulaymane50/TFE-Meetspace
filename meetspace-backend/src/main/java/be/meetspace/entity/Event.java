package be.meetspace.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

import be.meetspace.entity.Espace;
import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.EventLocationType;

@Entity
@Table(name = "event")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private LocalDateTime startDateTime;

    @Column(nullable = false)
    private LocalDateTime endDateTime;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventLocationType locationType = EventLocationType.EXTERNAL;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "space_id")
    private Espace space;

    private String externalAddress;

    @Column(nullable = false)
    private Integer capacity;

    private Double price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventStatus status = EventStatus.PENDING_APPROVAL;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    private String rejectionReason;

    @Column(name = "parking_required", nullable = false)
    private boolean parkingRequired = false;

    @OneToOne(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private ParkingSlot parkingSlot;

    @Column(name = "room_cost_cents", nullable = false)
    private Long roomCostCents = 0L;
    @Column(name = "deposit_amount_cents", nullable = false)
    private Long depositAmountCents = 0L;
    @Column(name = "deposit_payment_intent_id")
    private String depositPaymentIntentId;
    @Column(name = "deposit_paid_at")
    private LocalDateTime depositPaidAt;
    @Column(name = "deposit_due_at")
    private LocalDateTime depositDueAt;

    @Column(name = "balance_due_cents", nullable = false)
    private Long balanceDueCents = 0L;
    @Column(name = "balance_payment_intent_id")
    private String balancePaymentIntentId;
    @Column(name = "balance_paid_at")
    private LocalDateTime balancePaidAt;
    @Column(name = "settlement_due_at")
    private LocalDateTime settlementDueAt;
    @Column(name = "late_fee_cents", nullable = false)
    private Long lateFeeCents = 0L;
    @Column(name = "payout_amount_cents", nullable = false)
    private Long payoutAmountCents = 0L;
    @Column(name = "settlement_status", nullable = false, length = 32)
    private String settlementStatus = "NOT_APPLICABLE";

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getStartDateTime() { return startDateTime; }
    public void setStartDateTime(LocalDateTime startDateTime) { this.startDateTime = startDateTime; }

    public LocalDateTime getEndDateTime() { return endDateTime; }
    public void setEndDateTime(LocalDateTime endDateTime) { this.endDateTime = endDateTime; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public EventLocationType getLocationType() { return locationType; }
    public void setLocationType(EventLocationType locationType) { this.locationType = locationType; }

    public Espace getSpace() { return space; }
    public void setSpace(Espace space) { this.space = space; }

    public String getExternalAddress() { return externalAddress; }
    public void setExternalAddress(String externalAddress) { this.externalAddress = externalAddress; }

    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public EventStatus getStatus() { return status; }
    public void setStatus(EventStatus status) { this.status = status; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }

    public User getApprovedBy() { return approvedBy; }
    public void setApprovedBy(User approvedBy) { this.approvedBy = approvedBy; }

    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }

    public boolean isParkingRequired() { return parkingRequired; }
    public void setParkingRequired(boolean parkingRequired) { this.parkingRequired = parkingRequired; }

    public Long getRoomCostCents() { return roomCostCents; }
    public void setRoomCostCents(Long value) { this.roomCostCents = value; }
    public Long getDepositAmountCents() { return depositAmountCents; }
    public void setDepositAmountCents(Long value) { this.depositAmountCents = value; }
    public String getDepositPaymentIntentId() { return depositPaymentIntentId; }
    public void setDepositPaymentIntentId(String value) { this.depositPaymentIntentId = value; }
    public LocalDateTime getDepositPaidAt() { return depositPaidAt; }
    public LocalDateTime getDepositDueAt() { return depositDueAt; }
    public void setDepositDueAt(LocalDateTime value) { this.depositDueAt = value; }
    public void setDepositPaidAt(LocalDateTime value) { this.depositPaidAt = value; }
    public Long getBalanceDueCents() { return balanceDueCents; }
    public void setBalanceDueCents(Long value) { this.balanceDueCents = value; }
    public String getBalancePaymentIntentId() { return balancePaymentIntentId; }
    public void setBalancePaymentIntentId(String value) { this.balancePaymentIntentId = value; }
    public LocalDateTime getBalancePaidAt() { return balancePaidAt; }
    public void setBalancePaidAt(LocalDateTime value) { this.balancePaidAt = value; }
    public LocalDateTime getSettlementDueAt() { return settlementDueAt; }
    public void setSettlementDueAt(LocalDateTime value) { this.settlementDueAt = value; }
    public Long getLateFeeCents() { return lateFeeCents; }
    public void setLateFeeCents(Long value) { this.lateFeeCents = value; }
    public Long getPayoutAmountCents() { return payoutAmountCents; }
    public void setPayoutAmountCents(Long value) { this.payoutAmountCents = value; }
    public String getSettlementStatus() { return settlementStatus; }
    public void setSettlementStatus(String value) { this.settlementStatus = value; }
    public ParkingSlot getParkingSlot() { return parkingSlot; }
    public void setParkingSlot(ParkingSlot parkingSlot) { this.parkingSlot = parkingSlot; }
}

