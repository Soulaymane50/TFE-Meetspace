package be.meetspace.web.dto;

import be.meetspace.entity.EventLocationType;
import java.time.LocalDateTime;

/** Contrat du catalogue public : aucun champ de facturation ou d'approbation privée. */
public record PublicEventResponseDto(
        Long id,
        String title,
        String description,
        LocalDateTime startDateTime,
        LocalDateTime endDateTime,
        String location,
        EventLocationType locationType,
        Long spaceId,
        String externalAddress,
        Integer capacity,
        Double price,
        String status,
        Integer registeredCount,
        Integer availablePlaces,
        Long createdById,
        String createdByName,
        LocalDateTime createdAt,
        boolean parkingRequired,
        Long parkingSlotId,
        Double parkingPrice,
        Integer parkingCapacity,
        Integer parkingAvailableSpaces,
        Integer physicalParkingCapacity,
        Integer globalParkingRemainingSpaces,
        boolean sharedParkingInventory
) {
    public static PublicEventResponseDto fromPrivateDto(EventResponseDto dto) {
        return new PublicEventResponseDto(dto.getId(), dto.getTitle(), dto.getDescription(),
                dto.getStartDateTime(), dto.getEndDateTime(), dto.getLocation(), dto.getLocationType(),
                dto.getSpaceId(), dto.getExternalAddress(), dto.getCapacity(), dto.getPrice(), dto.getStatus(),
                dto.getRegisteredCount(), dto.getAvailablePlaces(), dto.getCreatedById(), dto.getCreatedByName(),
                dto.getCreatedAt(), dto.isParkingRequired(), dto.getParkingSlotId(), dto.getParkingPrice(),
                dto.getParkingCapacity(), dto.getParkingAvailableSpaces(), dto.getPhysicalParkingCapacity(),
                dto.getGlobalParkingRemainingSpaces(), dto.isSharedParkingInventory());
    }
}
