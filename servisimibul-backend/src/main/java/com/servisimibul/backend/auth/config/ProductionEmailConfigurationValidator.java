package com.servisimibul.backend.auth.config;

import jakarta.annotation.PostConstruct;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
@Profile("prod")
@ConditionalOnProperty(name = "servisimibul.email.enabled", havingValue = "true")
@RequiredArgsConstructor
public class ProductionEmailConfigurationValidator {

    private final AuthEmailProperties emailProperties;
    private final Environment environment;

    @PostConstruct
    void validate() {
        validateSender();
        validateFrontendOrigin();
        requireText("spring.mail.host", "SMTP host");
        requireText("spring.mail.username", "SMTP username");
        requireText("spring.mail.password", "SMTP password");

        int port = environment.getProperty("spring.mail.port", Integer.class, -1);
        if (port < 1 || port > 65_535) {
            throw invalid("SMTP port must be between 1 and 65535");
        }
        requireTrue("spring.mail.properties[mail.smtp.auth]", "SMTP authentication must be enabled");
        requireTrue("spring.mail.properties[mail.smtp.starttls.enable]", "SMTP STARTTLS must be enabled");
        requireTrue("spring.mail.properties[mail.smtp.starttls.required]", "SMTP STARTTLS must be required");
        if (environment.getProperty(
                "spring.mail.properties[mail.smtp.ssl.enable]",
                Boolean.class,
                false
        )) {
            throw invalid("Implicit SMTP TLS cannot be combined with the approved STARTTLS configuration");
        }
    }

    private void validateSender() {
        if (!hasText(emailProperties.from())) {
            throw invalid("sender address is required");
        }
        try {
            InternetAddress address = new InternetAddress(emailProperties.from().strip(), true);
            address.validate();
        } catch (AddressException invalidAddress) {
            throw invalid("sender address is invalid");
        }
    }

    private void validateFrontendOrigin() {
        URI frontendOrigin;
        try {
            frontendOrigin = URI.create(emailProperties.frontendBaseUrl());
        } catch (RuntimeException invalidUri) {
            throw invalid("frontend base URL must be a valid HTTPS origin");
        }

        String path = frontendOrigin.getPath();
        boolean rootPath = path == null || path.isEmpty() || "/".equals(path);
        if (!"https".equalsIgnoreCase(frontendOrigin.getScheme())
                || !hasText(frontendOrigin.getHost())
                || frontendOrigin.getUserInfo() != null
                || frontendOrigin.getQuery() != null
                || frontendOrigin.getFragment() != null
                || !rootPath
                || frontendOrigin.getPort() > 65_535) {
            throw invalid("frontend base URL must be a valid HTTPS origin");
        }
    }

    private void requireText(String property, String description) {
        if (!hasText(environment.getProperty(property))) {
            throw invalid(description + " is required");
        }
    }

    private void requireTrue(String property, String message) {
        if (!environment.getProperty(property, Boolean.class, false)) {
            throw invalid(message);
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private IllegalStateException invalid(String message) {
        return new IllegalStateException("Invalid production email configuration: " + message);
    }
}
