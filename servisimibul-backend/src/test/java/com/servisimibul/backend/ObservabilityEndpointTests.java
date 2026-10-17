package com.servisimibul.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = ObservabilityEndpointTests.TestApplication.class, properties = {
        "spring.autoconfigure.exclude="
                + "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                + "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,"
                + "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration",
        "spring.datasource.password=health-secret-that-must-not-leak",
        "spring.datasource.username=servisimibul_app",
        "spring.mail.host=localhost",
        "spring.mail.username=mail-test-user",
        "spring.mail.password=mail-secret-that-must-not-leak",
        "management.health.mail.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("prod")
@ExtendWith(OutputCaptureExtension.class)
class ObservabilityEndpointTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthAndProbeEndpointsExposeOnlyAggregateStatus() throws Exception {
        assertSafeContent("/actuator/health", "{\"groups\":[\"liveness\",\"readiness\"],\"status\":\"UP\"}");
        assertStatusOnly("/actuator/health/liveness");
        assertStatusOnly("/actuator/health/readiness");
        assertStatusOnly("/livez");
        assertStatusOnly("/readyz");
    }

    @Test
    @WithMockUser
    void sensitiveActuatorEndpointsAndDiscoveryPageAreUnavailable() throws Exception {
        mockMvc.perform(get("/actuator"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/actuator/env"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/actuator/configprops"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/actuator/flyway"))
                .andExpect(status().isNotFound());
    }

    @Test
    void actuatorCorsStaysDisabledForCrossOriginRequests() throws Exception {
        mockMvc.perform(get("/livez").header("Origin", "https://untrusted.example"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void productionLogsAreStructuredAndDoNotContainConfiguredSecrets(CapturedOutput output) {
        assertThat(output.getAll())
                .contains("\"ecs\":{\"version\"")
                .doesNotContain("health-secret-that-must-not-leak", "mail-secret-that-must-not-leak");
    }

    private void assertStatusOnly(String path) throws Exception {
        assertSafeContent(path, "{\"status\":\"UP\"}");
    }

    private void assertSafeContent(String path, String expectedContent) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().string(expectedContent))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("health-secret-that-must-not-leak"))))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("mail-secret-that-must-not-leak"))));
    }

    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration
    static class TestApplication {

        @Bean
        HealthIndicator dbHealthIndicator() {
            return () -> Health.up().build();
        }
    }
}
