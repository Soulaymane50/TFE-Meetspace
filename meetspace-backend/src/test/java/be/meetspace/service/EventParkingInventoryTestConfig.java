package be.meetspace.service;
import be.meetspace.entity.ParkingInventory;
import be.meetspace.repository.ParkingInventoryRepository;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
@TestConfiguration(proxyBeanMethods = false)
public class EventParkingInventoryTestConfig {
    @Bean Object eventParkingInventoryFixture(ParkingInventoryRepository inventory) {
        if (!inventory.existsById(1L)) {
            ParkingInventory physical = new ParkingInventory();
            physical.setId(1L); physical.setCapacity(150); inventory.saveAndFlush(physical);
        }
        return new Object();
    }
}