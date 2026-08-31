package be.meetspace.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "parking_inventory")
public class ParkingInventory {
    @Id
    private Long id;
    @Column(nullable = false)
    private Integer capacity;
    @Version
    private Long version;
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }
}
