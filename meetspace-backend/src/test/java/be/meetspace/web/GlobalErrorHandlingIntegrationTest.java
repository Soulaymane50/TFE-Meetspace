package be.meetspace.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GlobalErrorHandlingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void missingRequestParametersReturnBadRequest() throws Exception {
        mockMvc.perform(get("/api/public/reservations/check-availability"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("INVALID_REQUEST"));
    }

    @Test
    void unknownPublicResourcesReturnNotFound() throws Exception {
        mockMvc.perform(get("/swagger-ui/missing-resource"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("RESOURCE_NOT_FOUND"));
    }
}
