package com.servisimibul.backend;

import com.servisimibul.backend.support.IsolatedPostgresMigrationInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.sql.DriverManager;
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
        "servisimibul.tariff.storage-dir=${java.io.tmpdir}/servisimibul-prod-jdbc-health-test",
        "management.health.mail.enabled=false",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.datasource.hikari.minimum-idle=0",
        "spring.datasource.hikari.connection-timeout=1000",
        "spring.datasource.hikari.validation-timeout=500"
})
@AutoConfigureMockMvc
@ActiveProfiles("prod")
@ContextConfiguration(initializers = IsolatedPostgresMigrationInitializer.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProductionJdbcReadinessFailureTests {

    private static final Duration STATE_CHANGE_TIMEOUT = Duration.ofSeconds(10);

    private final MockMvc mockMvc;
    private final String migrationJdbcUrl;
    private final String migrationUser;
    private final String migrationPassword;
    private final String runtimeUser;

    @Autowired
    ProductionJdbcReadinessFailureTests(
            MockMvc mockMvc,
            @Value("${SB_DB_MIGRATION_JDBC_URL}") String migrationJdbcUrl,
            @Value("${SB_DB_MIGRATION_USER}") String migrationUser,
            @Value("${SB_DB_MIGRATION_PASSWORD}") String migrationPassword,
            @Value("${spring.datasource.username}") String runtimeUser
    ) {
        this.mockMvc = mockMvc;
        this.migrationJdbcUrl = migrationJdbcUrl;
        this.migrationUser = migrationUser;
        this.migrationPassword = migrationPassword;
        this.runtimeUser = runtimeUser;
    }

    @Test
    void jdbcFailureChangesOnlyReadinessAndRecovers() throws Exception {
        assertStatusOnly("/readyz", 200, "UP");
        assertStatusOnly("/livez", 200, "UP");

        setRuntimeLogin(false);
        try {
            terminateRuntimeConnections();
            awaitStatusOnly("/readyz", 503, "DOWN");
            assertStatusOnly("/livez", 200, "UP");
        } finally {
            setRuntimeLogin(true);
        }

        awaitStatusOnly("/readyz", 200, "UP");
    }

    private void setRuntimeLogin(boolean enabled) throws Exception {
        try (var connection = DriverManager.getConnection(
                migrationJdbcUrl,
                migrationUser,
                migrationPassword
        ); var statement = connection.createStatement()) {
            statement.execute("alter role " + quotedRuntimeUser() + (enabled ? " login" : " nologin"));
        }
    }

    private void terminateRuntimeConnections() throws Exception {
        try (var connection = DriverManager.getConnection(
                migrationJdbcUrl,
                migrationUser,
                migrationPassword
        ); var statement = connection.prepareStatement("""
                select pg_terminate_backend(pid)
                from pg_stat_activity
                where usename = ?
                  and pid <> pg_backend_pid()
                """)) {
            statement.setString(1, runtimeUser);
            statement.execute();
        }
    }

    private String quotedRuntimeUser() {
        if (!runtimeUser.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new IllegalStateException("Test runtime database role has an unsafe identifier");
        }
        return '"' + runtimeUser + '"';
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
