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
    // Historical field and payment type names remain readable for existing transactions.
    public static final double DEPOSIT_RATE = 1.00D;
    public static final double LATE_FEE_RATE = 0D;


    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final PaymentQuoteService quoteService;
    private final PaymentLifecycleService paymentLifecycleService;
    private final EventPlanningService eventPlanningService;
    private final EventSettlementService settlementService;

    public EventBillingService(EventRepository eventRepository,
                               EventRegistrationRepository registrationRepository,
                               PaymentQuoteService quoteService,
                               PaymentLifecycleService paymentLifecycleService,
                               EventPlanningService eventPlanningService,
                               EventSettlementService settlementService) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.quoteService = quoteService;
        this.paymentLifecycleService = paymentLifecycleService;
        this.eventPlanningService = eventPlanningService;
        this.settlementService = settlementService;
    }

    public void prepareAfterApproval(Event event) {
        long roomCost = event.getSpace() == null ? 0L
                : quoteService.calculateRoomPriceCents(event.getSpace(), event.getStartDateTime(), event.getEndDateTime());
        event.setRoomPaymentMode("FULL");
        event.setRoomCostCents(roomCost);
        event.setDepositAmountCents(Math.round(roomCost * DEPOSIT_RATE));
        event.setBalanceDueCents(Math.max(0L, roomCost - event.getDepositAmountCents()));
        event.setSettlementDueAt(event.getEndDateTime());
        event.setLateFeeCents(0L);
        event.setPayoutAmountCents(0L);

        if (roomCost > 0L) {
            LocalDateTime normalDeadline = LocalDateTime.now().plusHours(48);
            LocalDateTime safetyDeadline = event.getStartDateTime().minusHours(12);
            event.setDepositDueAt(normalDeadline.isBefore(safetyDeadline) ? normalDeadline : safetyDeadline);
            if (!event.getDepositDueAt().isAfter(LocalDateTime.now())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cet événement est trop proche pour permettre le paiement de la location.");
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce paiement de location n'est plus en attente.");
        }
        if (event.getDepositDueAt() != null && !event.getDepositDueAt().isAfter(LocalDateTime.now())) {
            event.setStatus(EventStatus.CANCELLED);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le délai de paiement de la location est expiré.");
        }
        paymentLifecycleService.consume(paymentIntentId, organizer, PaymentType.EVENT_DEPOSIT,
                event.getDepositAmountCents(), event.getId());
        event.setDepositPaymentIntentId(paymentIntentId);
        event.setDepositPaidAt(LocalDateTime.now());
        if ("FULL".equals(event.getRoomPaymentMode())) event.setBalancePaidAt(LocalDateTime.now());
        event.setStatus(EventStatus.PUBLISHED);
        event.setSettlementStatus("HOLDING_REVENUE");
        eventPlanningService.activateParkingForPublication(event);
        return eventRepository.save(event);
    }

    @Transactional
    public Event payBalance(Long eventId, String paymentIntentId, User organizer) {
        Event event = ownedEventForUpdate(eventId, organizer);
        if (!event.canPayRoomBalanceAt(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce solde n'est plus payable en ligne. Après la fin, il est pris en compte dans le décompte organisateur.");
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
        eventPlanningService.lockParkingInventory();
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
                .filter(event -> event.getEndDateTime() != null && !event.getEndDateTime().isAfter(now))
                .filter(event -> !"PAID".equals(event.getSettlementStatus()))
                .filter(event -> event.getStatus() == EventStatus.PUBLISHED)
                .forEach(this::calculateSettlement);
    }

    private void calculateSettlement(Event event) {
        event.setSettlementDueAt(event.getEndDateTime());
        var settlement = settlementService.preview(event);
        event.setLateFeeCents(0L);
        event.setPayoutAmountCents(settlement.amountCents());
        event.setSettlementStatus(settlement.status());
        eventRepository.save(event);
    }

    public void validatePaymentForPublication(Event event) {
        if ((event.getDepositPaidAt() != null && (!"FULL".equals(event.getRoomPaymentMode()) || event.getBalanceDueCents() == 0L)) || event.getSpace() == null
                || (event.getCreatedBy() != null && event.getCreatedBy().getRole() == be.meetspace.entity.Role.ADMIN)) {
            return;
        }
        if (quoteService.calculateRoomPriceCents(event.getSpace(), event.getStartDateTime(), event.getEndDateTime()) > 0L) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La location doit être entièrement payée après approbation avant publication.");
        }
    }

    private Event ownedEventForUpdate(Long eventId, User organizer) {
        eventPlanningService.lockParkingInventory();
        Event event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Événement introuvable."));
        boolean admin = "ADMIN".equals(organizer.getRole().name());
        if (!admin && (event.getCreatedBy() == null || !event.getCreatedBy().getId().equals(organizer.getId()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet événement ne vous appartient pas.");
        }
        return event;
    }
}
