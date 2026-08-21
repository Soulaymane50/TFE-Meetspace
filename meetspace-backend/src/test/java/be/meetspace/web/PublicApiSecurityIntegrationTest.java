package be.meetspace.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicApiSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void anonymousVisitorsCanReadThePublicCatalog() throws Exception {
        mockMvc.perform(get("/api/public/events"))
                .andExpect(status().isOk());
    }

    @Test
    void anonymousVisitorsCannotCreateReservations() throws Exception {
        mockMvc.perform(post("/api/public/reservations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousVisitorsCannotReadPersonalWaitlist() throws Exception {
        mockMvc.perform(get("/api/public/events/waitlist/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void publicAvailabilityEndpointRemainsReachable() throws Exception {
        mockMvc.perform(get("/api/public/reservations/check-availability"))
                .andExpect(status().isBadRequest());
    }
}
