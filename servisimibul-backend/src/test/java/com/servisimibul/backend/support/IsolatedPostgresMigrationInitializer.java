package com.servisimibul.backend.support;

import org.flywaydb.core.Flyway;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

import java.net.URI;
import java.util.Set;

public final class IsolatedPostgresMigrationInitializer
        implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "[::1]", "::1");

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        Environment environment = applicationContext.getEnvironment();
        String jdbcUrl = required(environment, "SB_DB_MIGRATION_JDBC_URL");
        requireLoopbackPostgres(jdbcUrl);

        Flyway.configure()
                .dataSource(
                        jdbcUrl,
                        required(environment, "SB_DB_MIGRATION_USER"),
                        required(environment, "SB_DB_MIGRATION_PASSWORD")
                )
                .load()
                .migrate();
    }

    private String required(Environment environment, String property) {
        String value = environment.getProperty(property);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(property + " is required for isolated PostgreSQL tests");
        }
        return value;
    }

    private void requireLoopbackPostgres(String jdbcUrl) {
        if (!jdbcUrl.startsWith("jdbc:postgresql://")) {
            throw new IllegalStateException("Isolated PostgreSQL tests require a PostgreSQL JDBC URL");
        }
        URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
        if (!LOOPBACK_HOSTS.contains(uri.getHost())) {
            throw new IllegalStateException("Isolated PostgreSQL tests may connect only to loopback");
        }
    }
}
