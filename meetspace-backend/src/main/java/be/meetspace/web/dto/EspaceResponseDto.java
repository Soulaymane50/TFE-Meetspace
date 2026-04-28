package be.meetspace.web.dto;

import be.meetspace.entity.Espace;
import be.meetspace.entity.EspaceStatus;
import be.meetspace.entity.EspaceType;

public class EspaceResponseDto {

    private Long id;
    private String name;
    private EspaceType type;
    private Integer capacity;
    private Double basePrice;
    private EspaceStatus status;

    public static EspaceResponseDto fromEntity(Espace espace) {
        EspaceResponseDto dto = new EspaceResponseDto();
        dto.id = espace.getId();
        dto.name = espace.getName();
        dto.type = espace.getType();
        dto.capacity = espace.getCapacity();
        dto.basePrice = espace.getBasePrice();
        dto.status = espace.getStatus();
        return dto;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public EspaceType getType() { return type; }
    public Integer getCapacity() { return capacity; }
    public Double getBasePrice() { return basePrice; }
    public EspaceStatus getStatus() { return status; }
}

