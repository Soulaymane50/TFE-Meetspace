package be.meetspace.web;

import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import be.meetspace.web.dto.ParkingSlotResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ParkingSlotResponseDtoContractTest {
    @Test
    void editQuotaSurvivesARecomputedSharedAllocationInTheJsonContract() throws Exception {
        ParkingSlot slot = new ParkingSlot();
        slot.setId(1L); slot.setCapacity(150); slot.setParkingRate(0.0); slot.setStatus(ParkingSlotStatus.OPEN);
        var response = ParkingSlotResponseDto.fromEntity(slot, 12, 90, 78, 150, 130);
        var json = new ObjectMapper().findAndRegisterModules().valueToTree(response);
        assertThat(json.get("configuredCapacity").asInt()).isEqualTo(150);
        assertThat(json.get("parkingCapacity").asInt()).isEqualTo(90);
        assertThat(json.get("availableSpaces").asInt()).isEqualTo(78);
        assertThat(json.get("parkingRate").asDouble()).isZero();
        assertThat(json.get("status").asText()).isEqualTo("OPEN");
    }

    @Test
    void aClosedAllocationRetainsItsEditableQuotaAndValidStatus() {
        ParkingSlot slot = new ParkingSlot();
        slot.setId(2L); slot.setCapacity(80); slot.setParkingRate(0.0); slot.setStatus(ParkingSlotStatus.FULL);
        var response = ParkingSlotResponseDto.fromEntity(slot, 20, 0, 0, 150, 0);
        assertThat(response.getConfiguredCapacity()).isEqualTo(80);
        assertThat(response.getParkingCapacity()).isZero();
        assertThat(response.getRegisteredSpaces()).isEqualTo(20);
        assertThat(response.getAvailableSpaces()).isZero();
        assertThat(response.getStatus()).isEqualTo(ParkingSlotStatus.FULL);
    }
}
