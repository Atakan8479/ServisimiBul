package com.servisimibul.backend.deployment;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
@Profile("prod")
@RequiredArgsConstructor
public class ProductionRuntimeSafetyValidator {

    private static final String RUNTIME_DATABASE_USER = "servisimibul_app";

    private final Environment environment;

    @PostConstruct
    void validate() {
        if (hasActiveProfile("migration")) {
            throw unsafe("The prod and migration profiles cannot be active together");
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

    private boolean hasActiveProfile(String profile) {
        return Arrays.asList(environment.getActiveProfiles()).contains(profile);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private IllegalStateException unsafe(String message) {
        return new IllegalStateException("Unsafe production runtime configuration: " + message);
    }
}
