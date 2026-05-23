package be.meetspace.service;

import be.meetspace.entity.Espace;
import be.meetspace.entity.Event;
import be.meetspace.entity.EventRegistration;
import be.meetspace.entity.EventRegistrationStatus;
import be.meetspace.entity.EventStatus;
import be.meetspace.entity.ParkingReservationStatus;
import be.meetspace.entity.ReservationStatus;
import be.meetspace.entity.User;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.EventRegistrationRepository;
import be.meetspace.repository.EventRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ReservationRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.web.dto.EventFinanceDto;
import be.meetspace.web.dto.FinanceSummaryDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class FinancialSummaryService {

    public static final double MEETSPACE_COMMISSION_RATE = 0.10D;

    private final EventRepository eventRepository;
    private final EspaceRepository espaceRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final ReservationRepository reservationRepository;
    private final ParkingReservationRepository parkingReservationRepository;
    private final UserRepository userRepository;

    public FinancialSummaryService(
            EventRepository eventRepository,
            EspaceRepository espaceRepository,
            EventRegistrationRepository eventRegistrationRepository,
            ReservationRepository reservationRepository,
            ParkingReservationRepository parkingReservationRepository,
            UserRepository userRepository
    ) {
        this.eventRepository = eventRepository;
        this.espaceRepository = espaceRepository;
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.reservationRepository = reservationRepository;
        this.parkingReservationRepository = parkingReservationRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public FinanceSummaryDto getAdminSummary() {
        List<EventFinanceDto> eventFinances = eventRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(this::isMeetSpaceRevenueRelevant)
                .map(this::buildEventFinance)
                .toList();

        double directRoomRevenue = valueOrZero(reservationRepository.sumTotalPriceByStatus(ReservationStatus.CONFIRMED));
        double parkingRevenue = valueOrZero(parkingReservationRepository.sumTotalPriceByStatus(ParkingReservationStatus.CONFIRMED));

        return buildSummary(eventFinances, directRoomRevenue, parkingRevenue);
    }

    @Transactional(readOnly = true)
    public FinanceSummaryDto getOrganizerSummary(String email, boolean adminView) {
        if (adminView) {
            return getAdminSummary();
        }

        User organizer = findUser(email);
        List<EventFinanceDto> eventFinances = eventRepository.findByCreatedByIdOrderByCreatedAtDesc(organizer.getId()).stream()
                .filter(this::isFinanciallyRelevant)
                .map(this::buildEventFinance)
                .toList();

        return buildSummary(eventFinances, 0D, 0D);
    }

    @Transactional(readOnly = true)
    public EventFinanceDto getAdminEventFinance(Long eventId) {
        Event event = findEvent(eventId);
        return buildEventFinance(event);
    }

    @Transactional(readOnly = true)
    public EventFinanceDto getOrganizerEventFinance(Long eventId, String email, boolean adminView) {
        Event event = findEvent(eventId);
        if (adminView) {
            return buildEventFinance(event);
        }

        User organizer = findUser(email);
        if (event.getCreatedBy() == null || !Objects.equals(event.getCreatedBy().getId(), organizer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez consulter que vos propres estimations.");
        }

        return buildEventFinance(event);
    }

    private FinanceSummaryDto buildSummary(List<EventFinanceDto> eventFinances, double directRoomRevenue, double parkingRevenue) {
        int confirmedRegistrations = eventFinances.stream()
                .mapToInt(EventFinanceDto::getConfirmedRegistrations)
                .sum();
        int confirmedParticipants = eventFinances.stream()
                .mapToInt(EventFinanceDto::getConfirmedParticipants)
                .sum();
        double eventGrossRevenue = sum(eventFinances, EventFinanceDto::getGrossRevenue);
        double eventCommissionRevenue = sum(eventFinances, EventFinanceDto::getMeetSpaceCommission);
        double roomCostChargedToOrganizers = sum(eventFinances, EventFinanceDto::getRoomCost);
        double organizerNetEstimate = sum(eventFinances, EventFinanceDto::getOrganizerNetEstimate);
        double meetSpaceEstimatedRevenue = directRoomRevenue + parkingRevenue + eventCommissionRevenue + roomCostChargedToOrganizers;

        List<EventFinanceDto> sortedEvents = eventFinances.stream()
                .sorted(Comparator.comparing(EventFinanceDto::getGrossRevenue, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        return new FinanceSummaryDto(
                MEETSPACE_COMMISSION_RATE,
                sortedEvents.size(),
                confirmedRegistrations,
                confirmedParticipants,
                roundMoney(eventGrossRevenue),
                roundMoney(eventCommissionRevenue),
                roundMoney(roomCostChargedToOrganizers),
                roundMoney(organizerNetEstimate),
                roundMoney(directRoomRevenue),
                roundMoney(parkingRevenue),
                roundMoney(meetSpaceEstimatedRevenue),
                sortedEvents
        );
    }

    private EventFinanceDto buildEventFinance(Event event) {
        List<EventRegistration> confirmedRegistrations = eventRegistrationRepository.findByEventId(event.getId()).stream()
                .filter(registration -> registration.getStatus() == EventRegistrationStatus.CONFIRMED)
                .toList();

        int registrationCount = confirmedRegistrations.size();
        int participantCount = confirmedRegistrations.stream()
                .map(EventRegistration::getNumberOfParticipants)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();

        double ticketPrice = valueOrZero(event.getPrice());
        double durationHours = calculateDurationHours(event);
        double roomHourlyRate = getRoomHourlyRate(event);
        double grossRevenue = ticketPrice * participantCount;
        double roomCost = roomHourlyRate * durationHours;
        double commission = grossRevenue * MEETSPACE_COMMISSION_RATE;
        double organizerNet = grossRevenue - commission - roomCost;

        return new EventFinanceDto(
                event.getId(),
                event.getTitle(),
                event.getStatus() != null ? event.getStatus().name() : null,
                getOrganizerName(event),
                getRoomName(event),
                event.getCapacity(),
                registrationCount,
                participantCount,
                roundMoney(ticketPrice),
                roundHours(durationHours),
                roundMoney(roomHourlyRate),
                roundMoney(grossRevenue),
                roundMoney(roomCost),
                roundMoney(commission),
                roundMoney(organizerNet),
                MEETSPACE_COMMISSION_RATE
        );
    }

    private boolean isFinanciallyRelevant(Event event) {
        return event.getStatus() != EventStatus.CANCELLED && event.getStatus() != EventStatus.REJECTED;
    }

    private boolean isMeetSpaceRevenueRelevant(Event event) {
        return event.getStatus() == EventStatus.PUBLISHED;
    }

    private Event findEvent(Long eventId) {
        return eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable."));
    }

    private User findUser(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur non connecte.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Utilisateur introuvable."));
    }

    private double calculateDurationHours(Event event) {
        if (event.getStartDateTime() == null || event.getEndDateTime() == null) {
            return 0D;
        }
        long minutes = Duration.between(event.getStartDateTime(), event.getEndDateTime()).toMinutes();
        return Math.max(0D, minutes / 60D);
    }

    private double getRoomHourlyRate(Event event) {
        Espace space = event.getSpace();
        if (space != null) {
            return valueOrZero(space.getBasePrice());
        }
        if (event.getLocation() == null || event.getLocation().isBlank()) {
            return 0D;
        }
        return espaceRepository.findFirstByNameIgnoreCase(event.getLocation())
                .map(Espace::getBasePrice)
                .map(FinancialSummaryService::valueOrZero)
                .orElse(0D);
    }

    private String getRoomName(Event event) {
        if (event.getSpace() != null && event.getSpace().getName() != null) {
            return event.getSpace().getName();
        }
        return event.getLocation();
    }

    private String getOrganizerName(Event event) {
        User organizer = event.getCreatedBy();
        if (organizer == null) {
            return null;
        }
        return String.format("%s %s", nullToEmpty(organizer.getFirstName()), nullToEmpty(organizer.getLastName())).trim();
    }

    private static double sum(List<EventFinanceDto> events, java.util.function.ToDoubleFunction<EventFinanceDto> mapper) {
        return events.stream().mapToDouble(mapper).sum();
    }

    private static double valueOrZero(Double value) {
        return value != null ? value : 0D;
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private static double roundMoney(double value) {
        return Math.round(value * 100D) / 100D;
    }

    private static double roundHours(double value) {
        return Math.round(value * 10D) / 10D;
    }
}
