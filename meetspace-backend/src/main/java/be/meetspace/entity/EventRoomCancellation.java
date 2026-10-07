package be.meetspace.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Durable cancellation terms, retained if a provider response rolls back the event transaction. */
@Entity
@Table(name = "event_room_cancellation")
public class EventRoomCancellation {
    // No FK: persisting this journal must not wait on the caller's locked event row.
    @Id @Column(name = "event_id") private Long eventId;
    @Column(name = "refund_percent", nullable = false) private int refundPercent;
    @Column(name = "by_provider", nullable = false) private boolean byProvider;
    @Column(name = "requested_at", nullable = false) private LocalDateTime requestedAt;
    public Long getEventId() { return eventId; }
    public void setEventId(Long value) { eventId = value; }
    public int getRefundPercent() { return refundPercent; }
    public void setRefundPercent(int value) { refundPercent = value; }
    public boolean isByProvider() { return byProvider; }
    public void setByProvider(boolean value) { byProvider = value; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDateTime value) { requestedAt = value; }
}
