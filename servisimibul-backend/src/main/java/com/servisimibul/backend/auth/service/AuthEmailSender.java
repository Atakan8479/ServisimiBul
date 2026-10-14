package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.config.AuthEmailProperties;
import com.servisimibul.backend.auth.exception.EmailUnavailableException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

interface AuthEmailSender {

    boolean isAvailable();

    void sendVerification(String email, String rawToken);

    void sendPasswordReset(String email, String rawToken);
}

@Component
@ConditionalOnProperty(name = "servisimibul.email.enabled", havingValue = "false", matchIfMissing = true)
class DisabledAuthEmailSender implements AuthEmailSender {

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public void sendVerification(String email, String rawToken) {
        throw new EmailUnavailableException();
    }

    @Override
    public void sendPasswordReset(String email, String rawToken) {
        throw new EmailUnavailableException();
    }
}

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "servisimibul.email.enabled", havingValue = "true")
class SmtpAuthEmailSender implements AuthEmailSender {

    private final JavaMailSender mailSender;
    private final AuthEmailProperties properties;

    @PostConstruct
    void validateConfiguration() {
        if (properties.from() == null || properties.from().isBlank()) {
            throw new IllegalStateException("servisimibul.email.from is required when email is enabled");
        }
        URI frontend = URI.create(properties.frontendBaseUrl());
        if (!("http".equals(frontend.getScheme()) || "https".equals(frontend.getScheme()))) {
            throw new IllegalStateException("servisimibul.email.frontend-base-url must use HTTP or HTTPS");
        }
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    @Async
    public void sendVerification(String email, String rawToken) {
        safelySend(
                email,
                "Verify your ServisimiBul email",
                "Verify your email: " + link("verify-email", rawToken)
        );
    }

    @Override
    @Async
    public void sendPasswordReset(String email, String rawToken) {
        safelySend(
                email,
                "Reset your ServisimiBul password",
                "Reset your password: " + link("reset-password", rawToken)
        );
    }

    private void safelySend(String recipient, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(properties.from());
            message.setTo(recipient);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (RuntimeException deliveryFailure) {
            log.error("Authentication email delivery failed: {}", deliveryFailure.getClass().getSimpleName());
        }
    }

    private String link(String path, String rawToken) {
        String baseUrl = properties.frontendBaseUrl().replaceAll("/+$", "");
        return baseUrl + "/" + path + "?token="
                + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
    }
}
