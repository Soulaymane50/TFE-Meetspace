package be.meetspace.web;

import be.meetspace.entity.ParkingAccessPass;
import be.meetspace.entity.ParkingAccessPassStatus;
import be.meetspace.entity.ParkingReservation;
import be.meetspace.entity.ParkingReservationStatus;
import be.meetspace.entity.ParkingSlot;
import be.meetspace.entity.ParkingSlotStatus;
import be.meetspace.entity.Role;
import be.meetspace.entity.User;
import be.meetspace.entity.UserStatus;
import be.meetspace.repository.AuditLogRepository;
import be.meetspace.repository.ParkingAccessPassRepository;
import be.meetspace.repository.ParkingReservationRepository;
import be.meetspace.repository.ParkingSlotRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.web.controller.AdminParkingAccessController;
import be.meetspace.web.dto.ParkingAccessCheckInRequest;
import be.meetspace.web.dto.ParkingAccessCheckInResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class AdminParkingAccessControllerIntegrationTest {

    @Autowired private AdminParkingAccessController controller;
    @Autowired private ParkingAccessPassRepository passRepository;
    @Autowired private ParkingReservationRepository reservationRepository;
    @Autowired private ParkingSlotRepository slotRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private AuditLogRepository auditLogRepository;

    private User admin;
    private ParkingSlot slot;
    private ParkingAccessPass pass;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
        passRepository.deleteAll();
        reservationRepository.deleteAll();
        slotRepository.deleteAll();
        userRepository.deleteAll();

        admin = userRepository.save(user("admin.parking@meetspace.test", Role.ADMIN));
        User customer = userRepository.save(user("customer.parking@meetspace.test", Role.MEMBER));

        slot = new ParkingSlot();
        slot.setTitle("Parking test");
        slot.setDescription("Contrôle d'accès parking");
        slot.setSessionDate(LocalDate.now().plusDays(7));
        slot.setStartTime(LocalTime.of(9, 0));
        slot.setEndTime(LocalTime.of(12, 0));
        slot.setCapacity(100);
        slot.setParkingRate(8D);
        slot.setStatus(ParkingSlotStatus.OPEN);
        slot = slotRepository.save(slot);

        ParkingReservation reservation = new ParkingReservation();
        reservation.setUser(customer);
        reservation.setParkingSlot(slot);
        reservation.setReservedSpaces(1);
        reservation.setTotalPrice(8D);
        reservation.setStatus(ParkingReservationStatus.CONFIRMED);
        reservation = reservationRepository.save(reservation);

        pass = new ParkingAccessPass();
        pass.setParkingReservation(reservation);
        pass.setToken("0123456789abcdef0123456789abcdef");
        pass.setStatus(ParkingAccessPassStatus.ACTIVE);
        pass = passRepository.save(pass);
    }

    @Test
    void adminCanCheckInAValidVehiclePassOnlyOnce() {
        ParkingAccessCheckInRequest request = new ParkingAccessCheckInRequest();
        request.setPass("MS-PARKING:" + pass.getToken());

        ParkingAccessCheckInResponse first = controller.checkIn(
                request, authentication(admin), new MockHttpServletRequest());
        ParkingAccessCheckInResponse second = controller.checkIn(
                request, authentication(admin), new MockHttpServletRequest());

        assertFalse(first.isAlreadyUsed());
        assertTrue(second.isAlreadyUsed());
        ParkingAccessPass checked = passRepository.findById(pass.getId()).orElseThrow();
        assertEquals(ParkingAccessPassStatus.USED, checked.getStatus());
        assertNotNull(checked.getCheckedInAt());
        assertEquals(1, auditLogRepository.count());
    }

    @Test
    void aPassForAClosedParkingSlotIsRejected() {
        slot.setStatus(ParkingSlotStatus.CANCELLED);
        slotRepository.save(slot);
        ParkingAccessCheckInRequest request = new ParkingAccessCheckInRequest();
        request.setPass(pass.getToken());

        assertThrows(ResponseStatusException.class,
                () -> controller.checkIn(request, authentication(admin), new MockHttpServletRequest()));
    }

    private static User user(String email, Role role) {
        User user = new User();
        user.setFirstName(role == Role.ADMIN ? "Administration" : "Client");
        user.setLastName("MeetSpace");
        user.setEmail(email);
        user.setPasswordHash("not-used-by-this-test");
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private static UsernamePasswordAuthenticationToken authentication(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null);
    }
}
