package com.servisimibul.backend;

import com.servisimibul.backend.support.IsolatedPostgresMigrationInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
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
        "servisimibul.tariff.storage-dir=${java.io.tmpdir}/servisimibul-prod-health-test",
        "management.health.mail.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("prod")
@ContextConfiguration(initializers = IsolatedPostgresMigrationInitializer.class)
class ProductionHealthSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private Environment environment;

    @Test
    void anonymousProductionProbesUseTheCompleteSecurityChainAndExposeOnlyStatus()
            throws Exception {
        mockMvc.perform(get("/livez"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}", true));
        mockMvc.perform(get("/readyz"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}", true));
    }

    @Test
    void readinessUsesTheRuntimeDatabaseWhileLivenessExcludesIt() throws Exception {
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement("select 1");
             var result = statement.executeQuery()) {
            assertThat(result.next()).isTrue();
            assertThat(result.getInt(1)).isEqualTo(1);
        }

        assertThat(environment.getProperty("management.endpoint.health.group.liveness.include"))
                .isEqualTo("livenessState");
        assertThat(environment.getProperty("management.endpoint.health.group.readiness.include"))
                .isEqualTo("readinessState,db");
    }
}
