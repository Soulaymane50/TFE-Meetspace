package be.meetspace.service;

import be.meetspace.entity.Event;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.PaymentType;
import be.meetspace.entity.User;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
public class EventBillingService {
    public static final double DEPOSIT_RATE = 0.30D;
    public static final double LATE_FEE_RATE = 0.05D;
    private static final double COMMISSION_RATE = 0.10D;

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final PaymentQuoteService quoteService;
    private final PaymentLifecycleService paymentLifecycleService;
    private final EventPlanningService eventPlanningService;

    public EventBillingService(EventRepository eventRepository,
                               EventRegistrationRepository registrationRepository,
                               PaymentQuoteService quoteService,
                               PaymentLifecycleService paymentLifecycleService,
                               EventPlanningService eventPlanningService) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.quoteService = quoteService;
        this.paymentLifecycleService = paymentLifecycleService;
        this.eventPlanningService = eventPlanningService;
    }

    public void prepareAfterApproval(Event event) {
        long roomCost = event.getSpace() == null ? 0L
                : quoteService.calculateRoomPriceCents(event.getSpace(), event.getStartDateTime(), event.getEndDateTime());
        event.setRoomCostCents(roomCost);
        event.setDepositAmountCents(Math.round(roomCost * DEPOSIT_RATE));
        event.setBalanceDueCents(Math.max(0L, roomCost - event.getDepositAmountCents()));
        event.setSettlementDueAt(event.getEndDateTime().plusHours(48));
        event.setLateFeeCents(0L);
        event.setPayoutAmountCents(0L);

        if (roomCost > 0L) {
            LocalDateTime normalDeadline = LocalDateTime.now().plusHours(48);
            LocalDateTime safetyDeadline = event.getStartDateTime().minusHours(12);
            event.setDepositDueAt(normalDeadline.isBefore(safetyDeadline) ? normalDeadline : safetyDeadline);
            if (!event.getDepositDueAt().isAfter(LocalDateTime.now())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cet événement est trop proche pour permettre le paiement de l'acompte.");
            }
            event.setStatus(EventStatus.AWAITING_DEPOSIT);
            event.setSettlementStatus("AWAITING_DEPOSIT");
        } else {
            event.setStatus(EventStatus.PUBLISHED);
            event.setSettlementStatus("HOLDING_REVENUE");
        }
    }

    @Transactional
    public Event payDeposit(Long eventId, String paymentIntentId, User organizer) {
        Event event = ownedEventForUpdate(eventId, organizer);
        if (event.getStatus() != EventStatus.AWAITING_DEPOSIT || event.getDepositPaidAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet acompte n'est plus en attente.");
        }
        if (event.getDepositDueAt() != null && !event.getDepositDueAt().isAfter(LocalDateTime.now())) {
            event.setStatus(EventStatus.CANCELLED);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le délai de paiement de l'acompte est expiré.");
        }
        paymentLifecycleService.consume(paymentIntentId, organizer, PaymentType.EVENT_DEPOSIT,
                event.getDepositAmountCents(), event.getId());
        event.setDepositPaymentIntentId(paymentIntentId);
        event.setDepositPaidAt(LocalDateTime.now());
        event.setStatus(EventStatus.PUBLISHED);
        event.setSettlementStatus("HOLDING_REVENUE");
        eventPlanningService.activateParkingForPublication(event);
        return eventRepository.save(event);
    }

    @Transactional
    public Event payBalance(Long eventId, String paymentIntentId, User organizer) {
        Event event = ownedEventForUpdate(eventId, organizer);
        if (event.getDepositPaidAt() == null || event.getBalancePaidAt() != null || event.getBalanceDueCents() <= 0L) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce solde n'est pas payable.");
        }
        if (event.getSettlementDueAt() != null && !event.getSettlementDueAt().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Le délai de paiement du solde est expiré; il sera déduit du reversement.");
        }
        paymentLifecycleService.consume(paymentIntentId, organizer, PaymentType.EVENT_BALANCE,
                event.getBalanceDueCents(), event.getId());
        event.setBalancePaymentIntentId(paymentIntentId);
        event.setBalancePaidAt(LocalDateTime.now());
        event.setSettlementStatus("BALANCE_PAID");
        return eventRepository.save(event);
    }

    @Scheduled(fixedDelayString = "${app.events.settlement-check-ms:300000}")
    @Transactional
    public void calculateDueSettlements() {
        LocalDateTime now = LocalDateTime.now();
        eventRepository.findAll().stream()
                .filter(event -> event.getStatus() == EventStatus.AWAITING_DEPOSIT)
                .filter(event -> event.getDepositDueAt() != null && !event.getDepositDueAt().isAfter(now))
                .forEach(event -> {
                    event.setStatus(EventStatus.CANCELLED);
                    event.setSettlementStatus("DEPOSIT_EXPIRED");
                    eventRepository.save(event);
                    eventPlanningService.syncParkingStatus(event);
                });

        eventRepository.findAll().stream()
                .filter(event -> event.getSettlementDueAt() != null && !event.getSettlementDueAt().isAfter(now))
                .filter(event -> !"READY_FOR_PAYOUT".equals(event.getSettlementStatus()))
                .filter(event -> event.getStatus() == EventStatus.PUBLISHED)
                .forEach(this::calculateSettlement);
    }

    private void calculateSettlement(Event event) {
        int participants = registrationRepository.countTotalParticipantsByEventId(event.getId());
        long grossRevenue = Math.round((event.getPrice() == null ? 0D : event.getPrice()) * participants * 100D);
        long commission = Math.round(grossRevenue * COMMISSION_RATE);
        long unpaidBalance = event.getBalancePaidAt() == null ? event.getBalanceDueCents() : 0L;
        long lateFee = unpaidBalance > 0L ? Math.round(unpaidBalance * LATE_FEE_RATE) : 0L;
        event.setLateFeeCents(lateFee);
        event.setPayoutAmountCents(Math.max(0L, grossRevenue - commission - unpaidBalance - lateFee));
        event.setSettlementStatus("READY_FOR_PAYOUT");
        eventRepository.save(event);
    }

    private Event ownedEventForUpdate(Long eventId, User organizer) {
        Event event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable."));
        boolean admin = "ADMIN".equals(organizer.getRole().name());
        if (!admin && (event.getCreatedBy() == null || !event.getCreatedBy().getId().equals(organizer.getId()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet événement ne vous appartient pas.");
        }
        return event;
    }
}
