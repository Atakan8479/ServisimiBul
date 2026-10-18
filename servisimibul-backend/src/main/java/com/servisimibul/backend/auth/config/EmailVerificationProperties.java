package com.servisimibul.backend.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.auth.email-verification")
public record EmailVerificationProperties(boolean required) {
}
