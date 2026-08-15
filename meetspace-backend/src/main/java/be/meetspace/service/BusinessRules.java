package be.meetspace.service;

public final class BusinessRules {

    public static final double MEETSPACE_COMMISSION_RATE = 0.10D;
    public static final int TOTAL_PARKING_SPACES = 150;

    public static final double PARKING_HALF_DAY_RATE = 8D;
    public static final double PARKING_EVENT_DAY_RATE = 12D;
    public static final double PARKING_PREMIUM_LONG_RATE = 15D;

    private BusinessRules() {
    }

    public static double calculateMeetSpaceCommission(double grossRevenue) {
        return grossRevenue * MEETSPACE_COMMISSION_RATE;
    }

    public static double calculateOrganizerNet(double grossRevenue, double roomCost) {
        return grossRevenue - calculateMeetSpaceCommission(grossRevenue) - roomCost;
    }

    public static int calculateBreakEvenParticipants(double ticketPrice, double roomCost) {
        double organizerRevenuePerTicket = ticketPrice * (1D - MEETSPACE_COMMISSION_RATE);
        if (organizerRevenuePerTicket <= 0D || roomCost <= 0D) {
            return roomCost <= 0D ? 0 : -1;
        }
        return (int) Math.ceil(roomCost / organizerRevenuePerTicket);
    }

    public static int calculateParkingQuotaLimit(Integer eventCapacity, Integer roomCapacity) {
        int eventLimit = positiveOrMax(eventCapacity);
        int roomLimit = calculateRoomParkingLimit(roomCapacity);
        return Math.min(Math.min(eventLimit, roomLimit), TOTAL_PARKING_SPACES);
    }

    public static int calculateRoomParkingLimit(Integer roomCapacity) {
        int capacity = roomCapacity != null ? roomCapacity : 0;
        if (capacity <= 0) {
            return TOTAL_PARKING_SPACES;
        }
        if (capacity <= 20) {
            return Math.min(12, capacity);
        }
        if (capacity <= 50) {
            return 25;
        }
        if (capacity <= 100) {
            return 45;
        }
        if (capacity <= 300) {
            return 100;
        }
        return TOTAL_PARKING_SPACES;
    }

    public static double calculateParkingRate(double durationHours, Integer roomCapacity) {
        int capacity = roomCapacity != null ? roomCapacity : 0;
        if (durationHours >= 7D && capacity >= 300) {
            return PARKING_PREMIUM_LONG_RATE;
        }
        if (durationHours >= 4D || capacity >= 300) {
            return PARKING_EVENT_DAY_RATE;
        }
        return PARKING_HALF_DAY_RATE;
    }

    private static int positiveOrMax(Integer value) {
        if (value == null || value <= 0) {
            return Integer.MAX_VALUE;
        }
        return value;
    }
}
