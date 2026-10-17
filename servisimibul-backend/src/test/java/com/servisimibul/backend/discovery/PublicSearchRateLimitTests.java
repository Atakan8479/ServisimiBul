package com.servisimibul.backend.discovery;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.rate-limit.public-search-ip.requests=2",
        "app.rate-limit.public-search-ip.window=1m"
})
@AutoConfigureMockMvc
class PublicSearchRateLimitTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void searchUsesTheActualPeerIgnoresSpoofedForwardingAndDoesNotCreateASession()
            throws Exception {
        String schoolId = UUID.randomUUID().toString();

        search(schoolId, "203.0.113.1", "198.51.100.1")
                .andExpect(status().isNotFound());
        search(schoolId, "203.0.113.1", "198.51.100.2")
                .andExpect(status().isNotFound());
        var limited = search(schoolId, "203.0.113.1", "198.51.100.3")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(header().exists("Retry-After"))
                .andReturn();

        assertThat(limited.getRequest().getSession(false)).isNull();
        search(schoolId, "203.0.113.2", "198.51.100.3")
                .andExpect(status().isNotFound());
    }

    private org.springframework.test.web.servlet.ResultActions search(
            String schoolId,
            String peer,
            String forwardedFor
    ) throws Exception {
        return mockMvc.perform(get("/api/v1/operators")
                .param("schoolId", schoolId)
                .param("neighborhoodId", "1")
                .header("X-Forwarded-For", forwardedFor)
                .with(request -> {
                    request.setRemoteAddr(peer);
                    return request;
                }));
    }
}
