package com.servisimibul.backend.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.auth.parent-registration")
public record ParentRegistrationProperties(boolean enabled) {
}
