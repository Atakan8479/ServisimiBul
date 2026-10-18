package com.servisimibul.backend;

import com.servisimibul.backend.support.IsolatedPostgresMigrationInitializer;
import com.servisimibul.backend.support.IsolatedPostgresTestDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.env.Environment;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.sql.Connection;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest(properties = {
        "servisimibul.email.enabled=false",
        "servisimibul.email.from=test@example.com",
        "servisimibul.email.frontend-base-url=https://example.test",
        "spring.mail.host=localhost",
        "spring.mail.username=test",
        "spring.mail.password=test-only",
        "spring.flyway.enabled=false",
        "spring.flyway.url=",
        "spring.flyway.user=",
        "spring.flyway.password=",
        "servisimibul.tariff.storage-dir=${java.io.tmpdir}/servisimibul-prod-jdbc-health-test",
        "management.health.mail.enabled=false",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.datasource.hikari.minimum-idle=0",
        "spring.datasource.hikari.connection-timeout=1000",
        "spring.datasource.hikari.validation-timeout=500",
        "spring.datasource.hikari.data-source-properties.ApplicationName=servisimibul-readiness-failure"
})
@AutoConfigureMockMvc
@ActiveProfiles("prod")
@ContextConfiguration(initializers = IsolatedPostgresMigrationInitializer.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProductionJdbcReadinessFailureTests {

    private static final Duration STATE_CHANGE_TIMEOUT = Duration.ofSeconds(10);
    private static final String APPLICATION_NAME = "servisimibul-readiness-failure";

    private final MockMvc mockMvc;
    private final Environment environment;

    @Autowired
    ProductionJdbcReadinessFailureTests(
            MockMvc mockMvc,
            Environment environment
    ) {
        this.mockMvc = mockMvc;
        this.environment = environment;
    }

    @Test
    void jdbcFailureChangesOnlyReadinessAndRecovers() throws Exception {
        assertStatusOnly("/readyz", 200, "UP");
        assertStatusOnly("/livez", 200, "UP");

        setRuntimeConnect(false);
        try {
            assertThat(terminateReadinessPoolConnections()).isGreaterThan(0);
            awaitStatusOnly("/readyz", 503, "DOWN");
            assertStatusOnly("/livez", 200, "UP");
        } finally {
            setRuntimeConnect(true);
        }

        awaitStatusOnly("/readyz", 200, "UP");
    }

    private void setRuntimeConnect(boolean enabled) throws Exception {
        String database = IsolatedPostgresTestDatabase.requiredSafeIdentifier(
                environment,
                "SB_TEST_DATABASE_NAME"
        );
        String runtimeUser = IsolatedPostgresTestDatabase.requiredSafeIdentifier(
                environment,
                "SB_DB_USER"
        );
        try (Connection connection =
                     IsolatedPostgresTestDatabase.openVerifiedAdministratorConnection(environment);
             var statement = connection.createStatement()) {
            statement.execute((enabled ? "grant" : "revoke")
                    + " connect on database \"" + database + "\" "
                    + (enabled ? "to" : "from") + " \"" + runtimeUser + "\"");
        }
    }

    private int terminateReadinessPoolConnections() throws Exception {
        String database = IsolatedPostgresTestDatabase.requiredSafeIdentifier(
                environment,
                "SB_TEST_DATABASE_NAME"
        );
        String runtimeUser = IsolatedPostgresTestDatabase.requiredSafeIdentifier(
                environment,
                "SB_DB_USER"
        );
        try (Connection connection =
                     IsolatedPostgresTestDatabase.openVerifiedAdministratorConnection(environment);
             var statement = connection.prepareStatement("""
                select pg_terminate_backend(pid)
                from pg_stat_activity
                where datname = ?
                  and usename = ?
                  and application_name = ?
                  and pid <> pg_backend_pid()
                """)) {
            statement.setString(1, database);
            statement.setString(2, runtimeUser);
            statement.setString(3, APPLICATION_NAME);
            try (var result = statement.executeQuery()) {
                int terminated = 0;
                while (result.next()) {
                    if (result.getBoolean(1)) {
                        terminated++;
                    }
                }
                return terminated;
            }
        }
    }

    private void awaitStatusOnly(String path, int status, String health) throws Exception {
        Instant deadline = Instant.now().plus(STATE_CHANGE_TIMEOUT);
        AssertionError lastFailure = null;
        do {
            try {
                assertStatusOnly(path, status, health);
                return;
            } catch (AssertionError failure) {
                lastFailure = failure;
                Thread.sleep(100);
            }
        } while (Instant.now().isBefore(deadline));
        throw lastFailure;
    }

    private void assertStatusOnly(String path, int expectedStatus, String health) throws Exception {
        MvcResult result = mockMvc.perform(get(path)).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(expectedStatus);
        assertThat(result.getResponse().getContentAsString())
                .isEqualTo("{\"status\":\"" + health + "\"}");
    }
}
