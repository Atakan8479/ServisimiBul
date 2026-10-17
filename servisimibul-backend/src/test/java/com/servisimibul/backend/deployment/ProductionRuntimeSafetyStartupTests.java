package com.servisimibul.backend.deployment;

import com.servisimibul.backend.ServisimibulBackendApplication;
import com.servisimibul.backend.support.IsolatedPostgresTestDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.core.env.Environment;
import org.springframework.core.env.StandardEnvironment;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

class ProductionRuntimeSafetyStartupTests {

    private static final String SENTINEL_TABLE = "test_harness.unsafe_migration_guard_probe";

    @Test
    void unsafeProductionFlywayConfigurationFailsBeforeMigrationCallbacksExecute()
            throws Exception {
        Environment environment = new StandardEnvironment();
        dropSentinel(environment);
        try {
            SpringApplication application = new SpringApplication(
                    ServisimibulBackendApplication.class
            );
            application.setWebApplicationType(WebApplicationType.NONE);
            application.setLogStartupInfo(false);

            Throwable startupFailure = catchThrowable(() -> {
                try (var ignored = application.run(
                        "--spring.profiles.active=prod",
                        "--spring.flyway.enabled=true",
                        "--spring.flyway.locations=classpath:db/migration,classpath:db/migration-safety",
                        propertyArgument(environment, "spring.flyway.url", "SB_TEST_DB_ADMIN_JDBC_URL"),
                        propertyArgument(environment, "spring.flyway.user", "SB_TEST_DB_ADMIN_USER"),
                        propertyArgument(environment, "spring.flyway.password", "SB_TEST_DB_ADMIN_PASSWORD"),
                        propertyArgument(environment, "spring.datasource.url", "SB_DB_JDBC_URL"),
                        propertyArgument(environment, "spring.datasource.username", "SB_DB_USER"),
                        propertyArgument(environment, "spring.datasource.password", "SB_DB_PASSWORD"),
                        "--servisimibul.email.enabled=false",
                        "--servisimibul.email.from=test@example.com",
                        "--servisimibul.email.frontend-base-url=https://example.test",
                        "--spring.mail.host=localhost",
                        "--spring.mail.username=test",
                        "--spring.mail.password=test-only",
                        "--servisimibul.tariff.storage-dir=" + Path.of(
                                System.getProperty("java.io.tmpdir"),
                                "servisimibul-prod-guard-test"
                        )
                )) {
                    // A context indicates the early production guard did not run.
                }
            });

            assertThat(startupFailure)
                    .isInstanceOf(IllegalStateException.class)
                    .hasRootCauseMessage(
                            "Unsafe production runtime configuration: "
                                    + "Flyway must be disabled in the production web process"
                    );
            assertThat(sentinelExists(environment)).isFalse();
        } finally {
            dropSentinel(environment);
        }
    }

    private String propertyArgument(
            Environment environment,
            String targetProperty,
            String sourceProperty
    ) {
        String value = environment.getRequiredProperty(sourceProperty);
        return "--" + targetProperty + "=" + value;
    }

    private boolean sentinelExists(Environment environment) throws Exception {
        try (var connection =
                     IsolatedPostgresTestDatabase.openVerifiedAdministratorConnection(environment);
             var statement = connection.prepareStatement("select to_regclass(?) is not null")) {
            statement.setString(1, SENTINEL_TABLE);
            try (var result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    private void dropSentinel(Environment environment) throws Exception {
        try (var connection =
                     IsolatedPostgresTestDatabase.openVerifiedAdministratorConnection(environment);
             var statement = connection.createStatement()) {
            statement.execute("drop table if exists " + SENTINEL_TABLE);
        }
    }
}
