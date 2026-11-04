package com.servisimibul.backend.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.auth.account-deactivation")
public record AccountDeactivationProperties(boolean enabled) {
}
