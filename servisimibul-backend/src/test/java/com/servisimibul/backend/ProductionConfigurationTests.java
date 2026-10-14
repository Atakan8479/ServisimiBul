package com.servisimibul.backend;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionConfigurationTests {

    @Test
    void productionConfigurationKeepsSecretsExternalAndUsesStructuredLogging() throws IOException {
        Properties properties = load("application-prod.properties");

        assertThat(properties)
                .containsEntry("logging.structured.format.console", "ecs")
                .containsEntry("servisimibul.email.enabled", "${SB_MAIL_ENABLED}")
                .containsEntry("servisimibul.email.from", "${SB_MAIL_FROM}")
                .containsEntry("servisimibul.email.frontend-base-url", "${SB_FRONTEND_BASE_URL}")
                .containsEntry("spring.mail.password", "${SB_MAIL_PASSWORD}")
                .containsEntry("spring.mail.properties[mail.smtp.connectiontimeout]",
                        "${SB_MAIL_CONNECTION_TIMEOUT_MS:5000}")
                .containsEntry("server.servlet.session.cookie.secure", "true")
                .containsEntry("spring.autoconfigure.exclude",
                        "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration")
                .containsEntry("server.forward-headers-strategy", "${SB_FORWARD_HEADERS_STRATEGY:none}");
        assertThat(properties.getProperty("spring.mail.password"))
                .doesNotContain("replace-with", "secret", "password123");
    }

    @Test
    void defaultConfigurationExposesOnlyStatusOnlyHealthDiagnostics() throws IOException {
        Properties properties = load("application.properties");

        assertThat(properties)
                .containsEntry("management.endpoints.access.default", "none")
                .containsEntry("management.endpoint.health.access", "read-only")
                .containsEntry("management.endpoints.web.exposure.include", "health")
                .containsEntry("management.endpoint.health.show-details", "never")
                .containsEntry("management.endpoint.health.show-components", "never")
                .containsEntry("server.servlet.session.cookie.name", "SBSESSION")
                .containsEntry("server.servlet.session.cookie.secure", "${SB_COOKIE_SECURE:true}")
                .containsEntry("server.servlet.session.cookie.http-only", "true")
                .containsEntry("server.servlet.session.cookie.same-site", "lax")
                .containsEntry("spring.datasource.username", "${SB_DB_USER}")
                .containsEntry("spring.flyway.user", "${SB_DB_MIGRATION_USER:}");
    }

    @Test
    void migrationProfileIsNonWebAndDoesNotGenerateCredentials() throws IOException {
        Properties properties = load("application-migration.properties");

        assertThat(properties)
                .containsEntry("spring.main.web-application-type", "none")
                .containsEntry("spring.autoconfigure.exclude",
                        "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration")
                .containsEntry("logging.structured.format.console", "ecs");
    }

    private Properties load(String resourceName) throws IOException {
        Properties properties = new Properties();
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(resourceName)) {
            assertThat(input).as("classpath resource %s", resourceName).isNotNull();
            properties.load(input);
        }
        return properties;
    }
}
