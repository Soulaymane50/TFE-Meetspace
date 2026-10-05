package be.meetspace.web;

import be.meetspace.config.JwtService;
import be.meetspace.entity.*;
import be.meetspace.repository.EspaceRepository;
import be.meetspace.repository.UserRepository;
import be.meetspace.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:meetspace-account-audit;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountAndAvailabilityAuditIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired EspaceRepository spaces;
    @Autowired JwtService jwt;
    @Autowired UserService service;
    @Autowired be.meetspace.repository.ReservationRepository reservations;
    @Autowired be.meetspace.repository.ParkingInventoryRepository inventory;
    @Autowired be.meetspace.repository.BookingHoldRepository holds;
    @Autowired org.springframework.security.core.userdetails.UserDetailsService details;
    User member;
    String token;
    String adminToken;
    Espace space;

    @BeforeEach void prepare() {
        member = user(Role.MEMBER);
        token = token(member);
        adminToken = token(user(Role.ADMIN));
        space = new Espace();
        space.setName("Audit " + UUID.randomUUID());
        space.setType(EspaceType.SALLE);
        space.setCapacity(10);
        space.setBasePrice(10D);
        space.setStatus(EspaceStatus.AVAILABLE);
        space = spaces.save(space);
    }

    User user(Role role) {
        User user = new User();
        user.setEmail(UUID.randomUUID() + "@example.invalid");
        user.setFirstName("Audit"); user.setLastName("Local");
        user.setPasswordHash("unused-in-isolated-test");
        user.setRole(role); user.setStatus(UserStatus.ACTIVE);
        return users.save(user);
    }

    String token(User user) {
        return jwt.generateToken(details.loadUserByUsername(user.getEmail()), user.getTokenVersion() == null ? 0 : user.getTokenVersion());
    }

    @Test void reactivationDoesNotRestoreAnOldSession() throws Exception {
        service.banUser(member, "127.0.0.1");
        mvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        service.reactivateUser(member, "127.0.0.1");
        mvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token(users.findById(member.getId()).orElseThrow())))
                .andExpect(status().isOk());
    }

    @Test void deletionAndReactivationDoNotRestoreAnOldSession() throws Exception {
        service.deactivateAccount(member, "127.0.0.1", true);
        service.reactivateUser(member, "127.0.0.1");
        mvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void roleChangeRevokesExistingSessions() throws Exception {
        mvc.perform(put("/api/admin/users/" + member.getId() + "/role")
                .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ORGANIZER\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void directStatusChangesAlsoRevokeOldSessions() throws Exception {
        for (String state : new String[]{"BANNED", "ACTIVE"}) {
            mvc.perform(put("/api/admin/users/" + member.getId() + "/status")
                    .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + state + "\"}"))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void missingRoleAndStatusDoNotBecomeServerErrors() throws Exception {
        for (String field : new String[]{"role", "status"}) {
            mvc.perform(put("/api/admin/users/" + member.getId() + "/" + field)
                    .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
        User unchanged = users.findById(member.getId()).orElseThrow();
        assertEquals(Role.MEMBER, unchanged.getRole());
        assertEquals(UserStatus.ACTIVE, unchanged.getStatus());
    }

    @Test void invalidAvailabilityWindowsDoNotAppearAvailable() throws Exception {
        for (String[] window : new String[][]{{"not-a-date", "2026-11-20T10:00:00"},
                {"2026-11-20T10:00:00", "2026-11-20T09:00:00"},
                {"2026-11-20T10:00:00", "2026-11-20T10:00:00"}}) {
            mvc.perform(get("/api/public/reservations/check-availability").param("espaceId", space.getId().toString())
                    .param("startDateTime", window[0]).param("endDateTime", window[1])).andExpect(status().isBadRequest());
        }
    }

    @Test void nonexistentSpaceDoesNotAppearAvailable() throws Exception {
        mvc.perform(get("/api/public/reservations/check-availability").param("espaceId", "9223372036854775807")
                .param("startDateTime", "2026-11-20T10:00:00").param("endDateTime", "2026-11-20T11:00:00"))
                .andExpect(status().isNotFound());
    }

    @Test void invalidCalendarMonthIsABadRequest() throws Exception {
        mvc.perform(get("/api/public/reservations/espace/" + space.getId() + "/calendar").param("year", "2026").param("month", "13"))
                .andExpect(status().isBadRequest());
    }

    Reservation pastBooking() {
        Reservation booking = new Reservation();
        booking.setUser(member); booking.setEspace(space);
        booking.setStartDateTime(java.time.LocalDateTime.now().minusDays(3));
        booking.setEndDateTime(java.time.LocalDateTime.now().minusDays(3).plusHours(1));
        booking.setTotalPrice(10D); booking.setStatus(ReservationStatus.CONFIRMED);
        return reservations.save(booking);
    }

    @Test void deletingASpaceDoesNotEraseBookingHistory() throws Exception {
        Reservation booking = pastBooking();
        mvc.perform(delete("/api/admin/espaces/" + space.getId()).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
        assertEquals(true, reservations.existsById(booking.getId()));
        assertEquals(true, spaces.existsById(space.getId()));
    }

    @Test void banningAnAccountPreservesPastBookings() {
        ParkingInventory stock = new ParkingInventory(); stock.setId(1L); stock.setCapacity(150); inventory.save(stock);
        Reservation booking = pastBooking();
        service.banUser(member, "127.0.0.1");
        assertEquals(ReservationStatus.CONFIRMED, reservations.findById(booking.getId()).orElseThrow().getStatus());
    }

    @Test void adminSpaceInputsCannotCreateInvalidOrOverwriteExistingRooms() throws Exception {
        for (String body : new String[]{"{\"name\":\"Salle\",\"capacity\":-1,\"basePrice\":10}",
                "{\"name\":\"Salle\",\"capacity\":10,\"basePrice\":-1}",
                "{\"name\":\" \",\"capacity\":10,\"basePrice\":10}",
                "{\"id\":" + space.getId() + ",\"name\":\"Écrasée\",\"capacity\":10,\"basePrice\":10}"}) {
            mvc.perform(post("/api/admin/espaces").header("Authorization", "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        assertEquals(space.getName(), spaces.findById(space.getId()).orElseThrow().getName());
    }

    @Test void missingAdminSpaceIsNotAServerError() throws Exception {
        mvc.perform(get("/api/admin/espaces/9223372036854775807").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    @Test void invalidAuditPaginationIsABadRequest() throws Exception {
        for (String query : new String[]{"?page=-1", "?size=0", "?size=100001"}) {
            mvc.perform(get("/api/admin/audit" + query).header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isBadRequest());
        }
    }

    BookingHold roomHold(BookingHoldStatus state, java.time.LocalDateTime expiry) {
        BookingHold hold = new BookingHold(); hold.setToken(UUID.randomUUID().toString()); hold.setUser(member);
        hold.setType(PaymentType.SPACE); hold.setResourceId(space.getId()); hold.setAmountCents(1000L);
        hold.setStartAt(java.time.LocalDateTime.now().plusDays(2).withHour(10).withMinute(0).withSecond(0).withNano(0));
        hold.setEndAt(hold.getStartAt().plusHours(1)); hold.setStatus(state); hold.setExpiresAt(expiry);
        return holds.save(hold);
    }

    @Test void activePaymentHoldIsVisibleAndDoesNotBlockAdjacentTimes() throws Exception {
        BookingHold hold = roomHold(BookingHoldStatus.ACTIVE, java.time.LocalDateTime.now().plusMinutes(10));
        mvc.perform(get("/api/public/reservations/check-availability").param("espaceId", space.getId().toString())
                .param("startDateTime", hold.getStartAt().toString()).param("endDateTime", hold.getEndAt().toString()))
                .andExpect(status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string("false"));
        mvc.perform(get("/api/public/reservations/check-availability").param("espaceId", space.getId().toString())
                .param("startDateTime", hold.getEndAt().toString()).param("endDateTime", hold.getEndAt().plusHours(1).toString()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string("true"));
        mvc.perform(get("/api/public/reservations/espace/" + space.getId() + "/calendar")
                .param("year", "" + hold.getStartAt().getYear()).param("month", "" + hold.getStartAt().getMonthValue()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].blockType").value("PAYMENT_HOLD"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].token").doesNotExist())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$[0].user").doesNotExist());
    }

    @Test void expiredAndCancelledPaymentHoldsDoNotAppearInCalendar() throws Exception {
        BookingHold hold = roomHold(BookingHoldStatus.ACTIVE, java.time.LocalDateTime.now().minusMinutes(1));
        roomHold(BookingHoldStatus.CANCELLED, java.time.LocalDateTime.now().plusMinutes(10));
        mvc.perform(get("/api/public/reservations/espace/" + space.getId() + "/calendar")
                .param("year", "" + hold.getStartAt().getYear()).param("month", "" + hold.getStartAt().getMonthValue()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().json("[]"));
    }
}
