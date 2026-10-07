package be.meetspace.service;

import be.meetspace.config.PaymentVerifier;
import be.meetspace.entity.*;
import be.meetspace.repository.*;
import be.meetspace.web.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class EventSettlementService {
    private final EventRepository events;
    private final EventRegistrationRepository registrations;
    private final PaymentRecordRepository payments;
    private final PaymentRefundRepository refunds;
    private final EventPayoutRepository payouts;
    private final UserRepository users;
    private final AuditService audit;
    private final NotificationService notifications;
    private final ParkingCapacityService parkingCapacity;

    public EventSettlementService(EventRepository events, EventRegistrationRepository registrations,
            PaymentRecordRepository payments, PaymentRefundRepository refunds, EventPayoutRepository payouts,
            UserRepository users, AuditService audit, NotificationService notifications, ParkingCapacityService parkingCapacity) {
        this.events=events; this.registrations=registrations; this.payments=payments; this.refunds=refunds;
        this.payouts=payouts; this.users=users; this.audit=audit; this.notifications=notifications; this.parkingCapacity=parkingCapacity;
    }

    @Transactional(readOnly=true)
    public List<EventSettlementDto> list(String email, boolean admin) {
        User user = users.findByEmail(email).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "Session expirée."));
        if (admin && user.getRole() != Role.ADMIN) throw error(HttpStatus.FORBIDDEN, "Accès administrateur requis.");
        return (admin ? events.findAllByOrderByCreatedAtDesc() : events.findByCreatedByIdOrderByCreatedAtDesc(user.getId()))
            .stream().filter(e -> e.getStatus()==EventStatus.PUBLISHED && e.getCreatedBy()!=null
                && hasOrganizerClaim(e))
            .sorted(Comparator.comparing(Event::getEndDateTime, Comparator.nullsLast(Comparator.reverseOrder())))
            .map(this::preview).toList();
    }

    private boolean hasOrganizerClaim(Event event) {
        // A later role promotion must not erase a rental already paid as an organizer.
        return event.getCreatedBy() != null && (event.getCreatedBy().getRole() != Role.ADMIN
                || event.getDepositPaidAt() != null || "PAID".equals(event.getSettlementStatus()));
    }

    public EventSettlementDto preview(Event event) {
        var paid=payouts.findByEventId(event.getId());
        if (paid.isPresent()) {
            EventPayout p=paid.get();
            return dto(event,p.getTicketRevenueCents(),p.getCommissionCents(),p.getRoomBalanceDeductedCents(),
                p.getAmountCents(),"PAID",p.getRecordedAt(),p.getTransferReference());
        }
        Map<Long,PaymentRecord> byBooking=new HashMap<>();
        boolean review=false, pending=false, paymentPending=false;
        // A provider-confirmed payment may still be awaiting booking finalization or refund.
        for (PaymentRecord p : settlementPayments(event.getId())) {
            if (p.getConsumedAt() == null && p.getStatus() != PaymentStatus.FAILED
                    && p.getStatus() != PaymentStatus.REFUNDED) paymentPending = true;
            if (p.getStatus() == PaymentStatus.REFUND_PENDING || refunds.findByPaymentIntentId(p.getPaymentIntentId()).stream()
                    .anyMatch(f -> !Set.of("succeeded", "full_succeeded").contains(f.getStatus()))) pending = true;
        }
        for (PaymentRecord p:payments.findByResourceIdAndType(event.getId(),PaymentType.EVENT)) {
            if (p.getBookingEntityId()!=null && p.getConsumedAt()!=null) {
                if (byBooking.put(p.getBookingEntityId(),p)!=null) review=true;
            }
        }
        long ticketNet=0;
        for (EventRegistration r:registrations.findByEventId(event.getId())) {
            long ticket=cents(r.getTotalPrice());
            if(ticket==0 || FinanceReportingPolicy.isTechnicalUser(r.getUser())) continue;
            if(r.getStatus()==EventRegistrationStatus.PENDING) { review=true; continue; }
            PaymentRecord p=byBooking.get(r.getId());
            if(p==null || !Objects.equals(p.getPaymentIntentId(),r.getPaymentIntentId())
                    || !Objects.equals(p.getUser().getId(),r.getUser().getId()) || !"eur".equalsIgnoreCase(p.getCurrency())) { review=true; continue; }
            long total=safe(p.getAmountCents()), refunded=safe(p.getRefundedAmountCents());
            List<PaymentRefund> journal=refunds.findByPaymentIntentId(p.getPaymentIntentId());
            long confirmedRefund=journal.stream().filter(f -> "succeeded".equals(f.getStatus()))
                .mapToLong(f -> safe(f.getAmountCents())).sum();
            if(p.getStatus()==PaymentStatus.REFUND_PENDING || journal.stream()
                    .anyMatch(f -> !Set.of("succeeded","full_succeeded").contains(f.getStatus()))) pending=true;
            if(total<ticket || refunded>total || confirmedRefund!=refunded
                    || !Set.of(PaymentStatus.CONSUMED,PaymentStatus.PARTIALLY_REFUNDED,PaymentStatus.REFUNDED,PaymentStatus.REFUND_PENDING).contains(p.getStatus())) {
                review=true; continue;
            }
            long ticketRefund=refunded;
            if(total>ticket && refunded>0 && refunded<total) {
                // Combined ticket + parking: only the standard proportional cancellation can be allocated automatically.
                String key=PaymentVerifier.operationKey(p.getPaymentIntentId(),"booking-cancellation");
                boolean standard= r.getStatus()==EventRegistrationStatus.CANCELLED && journal.stream()
                    .filter(f -> "succeeded".equals(f.getStatus())).allMatch(f -> key.equals(f.getOperationKey()))
                    && refunded==Math.round(total*0.5D);
                if(!standard) { review=true; continue; }
                ticketRefund=BigDecimal.valueOf(refunded).multiply(BigDecimal.valueOf(ticket))
                    .divide(BigDecimal.valueOf(total),0,RoundingMode.HALF_UP).longValueExact();
            }
            if(refunded==total) ticketRefund=ticket;
            ticketNet=Math.addExact(ticketNet,Math.max(0,ticket-ticketRefund));
        }
        long commission=BigDecimal.valueOf(ticketNet).multiply(new BigDecimal("0.10"))
            .setScale(0,RoundingMode.HALF_UP).longValueExact();
        long roomBalance=event.getBalancePaidAt()==null ? safe(event.getBalanceDueCents()) : 0;
        if("FULL".equals(event.getRoomPaymentMode()) && safe(event.getRoomCostCents())>0) {
            String intent=event.getDepositPaymentIntentId();
            var room=intent==null ? Optional.<PaymentRecord>empty() : payments.findByPaymentIntentId(intent);
            if(room.isEmpty() || room.get().getType()!=PaymentType.EVENT_DEPOSIT
                    || !Objects.equals(room.get().getResourceId(),event.getId()) || room.get().getConsumedAt()==null
                    || !Objects.equals(room.get().getBookingEntityId(),event.getId())
                    || !Objects.equals(room.get().getUser().getId(),event.getCreatedBy().getId())
                    || !"eur".equalsIgnoreCase(room.get().getCurrency())
                    || safe(room.get().getAmountCents())-safe(room.get().getRefundedAmountCents())!=safe(event.getRoomCostCents())
                    || room.get().getStatus()!=PaymentStatus.CONSUMED) review=true;
            if (intent != null) {
                List<PaymentRefund> roomRefunds = refunds.findByPaymentIntentId(intent);
                if (roomRefunds.stream().anyMatch(f -> !Set.of("succeeded", "full_succeeded").contains(f.getStatus()))) pending = true;
                long confirmed = roomRefunds.stream().filter(f -> "succeeded".equals(f.getStatus()))
                        .mapToLong(f -> safe(f.getAmountCents())).sum();
                if (room.isPresent() && confirmed != safe(room.get().getRefundedAmountCents())) review = true;
            }
        }
        long result=ticketNet-commission-roomBalance;
        LocalDateTime due=dueAt(event);
        String status=event.getStatus()!=EventStatus.PUBLISHED ? "NOT_ELIGIBLE"
            : pending ? "REFUND_PENDING" : paymentPending ? "PAYMENT_PENDING" : review ? "REVIEW_REQUIRED"
            : event.getCreatedBy() == null || event.getCreatedBy().getStatus() != UserStatus.ACTIVE ? "BENEFICIARY_UNAVAILABLE"
            : due==null || due.isAfter(LocalDateTime.now()) ? "HOLDING_REVENUE"
            : result<0 ? "BALANCE_OUTSTANDING" : result==0 ? "NOTHING_TO_PAY" : "READY_FOR_PAYOUT";
        return dto(event,ticketNet,commission,roomBalance,Math.max(0,result),status,null,null);
    }

    // Read the winner after waiting for the inventory/event lock, including on MySQL.
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public EventSettlementDto record(Long id, RecordEventPayoutRequest request, String email, String ip) {
        User admin=users.findByEmail(email).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED,"Session expirée."));
        if(admin.getRole()!=Role.ADMIN) throw error(HttpStatus.FORBIDDEN,"Accès administrateur requis.");
        parkingCapacity.lockInventory();
        Event event=events.findByIdForUpdate(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Événement introuvable."));
        String reference=request.reference().trim().toUpperCase(Locale.ROOT);
        var existing=payouts.findByEventId(id);
        if(existing.isPresent()) {
            if(existing.get().getTransferReference().equals(reference) && existing.get().getAmountCents().equals(request.amountCents())) return preview(event);
            throw error(HttpStatus.CONFLICT,"Un versement a déjà été enregistré pour cet événement.");
        }
        if(!hasOrganizerClaim(event)
                || event.getCreatedBy().getStatus()!=UserStatus.ACTIVE) throw error(HttpStatus.CONFLICT,"Bénéficiaire indisponible.");
        settlementPayments(id).stream()
            .sorted(Comparator.comparing(PaymentRecord::getPaymentIntentId))
            .forEach(p -> payments.findByPaymentIntentIdForUpdate(p.getPaymentIntentId()));
        if (event.getDepositPaymentIntentId() != null) {
            payments.findByPaymentIntentIdForUpdate(event.getDepositPaymentIntentId());
        }
        EventSettlementDto settlement=preview(event);
        if(!"READY_FOR_PAYOUT".equals(settlement.status())) throw error(HttpStatus.CONFLICT,"Ce décompte ne permet pas encore un versement.");
        if(request.amountCents()!=settlement.amountCents()) throw error(HttpStatus.CONFLICT,"Le montant a changé. Actualisez le décompte.");
        if(payouts.existsByTransferReference(reference)) throw error(HttpStatus.CONFLICT,"Cette référence de virement est déjà utilisée.");
        EventPayout p=new EventPayout(); p.setEvent(event); p.setRecipient(event.getCreatedBy());
        p.setAmountCents(settlement.amountCents()); p.setTicketRevenueCents(settlement.ticketRevenueCents());
        p.setCommissionCents(settlement.commissionCents()); p.setRoomBalanceDeductedCents(settlement.roomBalanceDeductedCents());
        p.setTransferReference(reference); p.setRecordedAt(LocalDateTime.now()); p.setRecordedBy(admin);
        payouts.saveAndFlush(p);
        event.setPayoutAmountCents(p.getAmountCents()); event.setSettlementStatus("PAID"); event.setLateFeeCents(0L);
        events.save(event);
        audit.log(AuditAction.EVENT_PAYOUT_RECORDED,"Event",id,"Virement organisateur enregistré : "+p.getAmountCents()+" centimes, référence "+reference,ip);
        notifications.create(event.getCreatedBy(),NotificationTone.SUCCESS,"Versement enregistré",
            "Le versement de votre événement « "+event.getTitle()+" » a été enregistré. Référence : "+reference,
            "/organizer/events","Event",id);
        return dto(event,p.getTicketRevenueCents(),p.getCommissionCents(),p.getRoomBalanceDeductedCents(),p.getAmountCents(),"PAID",p.getRecordedAt(),reference);
    }

    private List<PaymentRecord> settlementPayments(Long eventId) {
        List<PaymentRecord> records = new ArrayList<>();
        for (PaymentType type : List.of(PaymentType.EVENT, PaymentType.EVENT_DEPOSIT, PaymentType.EVENT_BALANCE)) {
            records.addAll(payments.findByResourceIdAndType(eventId, type));
        }
        return records;
    }

    private EventSettlementDto dto(Event e,long gross,long commission,long room,long amount,String status,LocalDateTime recorded,String reference) {
        String name=e.getCreatedBy()==null ? "" : e.getCreatedBy().getFirstName()+" "+e.getCreatedBy().getLastName();
        return new EventSettlementDto(e.getId(),e.getTitle(),name,e.getCreatedBy()==null ? "" : e.getCreatedBy().getEmail(),e.getEndDateTime(),dueAt(e),gross,commission,room,amount,status,recorded,reference);
    }
    private LocalDateTime dueAt(Event e) { return e.getEndDateTime(); }
    private long cents(Double value) { return value==null ? 0 : BigDecimal.valueOf(value).movePointRight(2).setScale(0,RoundingMode.HALF_UP).longValueExact(); }
    private long safe(Long value) { return value==null ? 0 : Math.max(0,value); }
    private ResponseStatusException error(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
}
