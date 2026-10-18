package com.servisimibul.backend.deployment;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Environment;

import java.util.Arrays;
import java.util.List;

public final class ProductionRuntimeSafetyValidator implements EnvironmentPostProcessor, Ordered {

    private static final String RUNTIME_DATABASE_USER = "servisimibul_app";
    private static final List<String> MIGRATION_SECRET_PROPERTIES = List.of(
            "SB_DB_MIGRATION_JDBC_URL",
            "SB_DB_MIGRATION_USER",
            "SB_DB_MIGRATION_PASSWORD"
    );

    @Override
    public int getOrder() {
        return ConfigDataEnvironmentPostProcessor.ORDER + 1;
    }

    @Override
    public void postProcessEnvironment(
            ConfigurableEnvironment environment,
            SpringApplication application
    ) {
        validate(environment);
    }

    void validate(Environment environment) {
        if (!hasActiveProfile(environment, "prod")) {
            return;
        }
        if (hasActiveProfile(environment, "migration")) {
            throw unsafe("The prod and migration profiles cannot be active together");
        }
        if (MIGRATION_SECRET_PROPERTIES.stream()
                .anyMatch(property -> hasText(environment.getProperty(property)))) {
            throw unsafe("Migration credentials must not be injected into the production web process");
        }
        if (environment.getProperty("spring.flyway.enabled", Boolean.class, false)) {
            throw unsafe("Flyway must be disabled in the production web process");
        }
        if (hasText(environment.getProperty("spring.flyway.url"))
                || hasText(environment.getProperty("spring.flyway.user"))
                || hasText(environment.getProperty("spring.flyway.password"))) {
            throw unsafe("Migration connection settings must not be available to the production web process");
        }
        if (!RUNTIME_DATABASE_USER.equals(environment.getProperty("spring.datasource.username"))) {
            throw unsafe("The production web process must use the restricted runtime database role");
        }
    }

    private boolean hasActiveProfile(Environment environment, String profile) {
        return Arrays.asList(environment.getActiveProfiles()).contains(profile);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private IllegalStateException unsafe(String message) {
        return new IllegalStateException("Unsafe production runtime configuration: " + message);
    }
}
