package com.servisimibul.backend.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("servisimibul.email")
public record AuthEmailProperties(String from, String frontendBaseUrl) {
}
