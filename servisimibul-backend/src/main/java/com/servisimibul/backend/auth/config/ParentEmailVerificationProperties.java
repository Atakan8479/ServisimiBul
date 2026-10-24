package com.servisimibul.backend.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.auth.parent-email-verification")
public record ParentEmailVerificationProperties(boolean required) {
}
