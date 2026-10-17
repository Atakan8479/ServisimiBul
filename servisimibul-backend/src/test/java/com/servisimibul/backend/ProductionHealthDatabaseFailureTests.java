package com.servisimibul.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "servisimibul.email.enabled=false",
        "servisimibul.email.from=test@example.com",
        "servisimibul.email.frontend-base-url=https://example.test",
        "spring.mail.host=localhost",
        "spring.mail.username=test",
        "spring.mail.password=test-only",
        "servisimibul.tariff.storage-dir=${java.io.tmpdir}/servisimibul-prod-health-db-failure-test",
        "management.health.mail.enabled=false",
        "management.health.db.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("prod")
@Import(ProductionHealthDatabaseFailureTests.DatabaseFailureConfiguration.class)
class ProductionHealthDatabaseFailureTests {

    private final MockMvc mockMvc;

    @Autowired
    ProductionHealthDatabaseFailureTests(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void databaseFailureMakesReadinessUnavailableWithoutAffectingLiveness() throws Exception {
        mockMvc.perform(get("/readyz"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().json("{\"status\":\"DOWN\"}", true));

        mockMvc.perform(get("/livez"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}", true));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class DatabaseFailureConfiguration {

        @Bean("dbHealthIndicator")
        HealthIndicator dbHealthIndicator() {
            return () -> Health.down().build();
        }
    }
}
