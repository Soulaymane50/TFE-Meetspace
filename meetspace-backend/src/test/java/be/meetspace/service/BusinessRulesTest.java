package be.meetspace.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BusinessRulesTest {

    @Test
    void parkingQuotaNeverExceedsEventRoomOrSiteCapacity() {
        assertEquals(12, BusinessRules.calculateParkingQuotaLimit(18, 20));
        assertEquals(25, BusinessRules.calculateParkingQuotaLimit(40, 50));
        assertEquals(150, BusinessRules.calculateParkingQuotaLimit(500, 500));
    }

    @Test
    void parkingRateDependsOnDurationAndRoomCapacity() {
        assertEquals(8D, BusinessRules.calculateParkingRate(2D, 50));
        assertEquals(12D, BusinessRules.calculateParkingRate(4D, 50));
        assertEquals(15D, BusinessRules.calculateParkingRate(7D, 300));
    }

    @Test
    void commissionUsesCentralRate() {
        assertEquals(10D, BusinessRules.calculateMeetSpaceCommission(100D));
    }
}
