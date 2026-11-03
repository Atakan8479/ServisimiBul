package com.servisimibul.backend.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.auth.email-change")
public record EmailChangeProperties(boolean enabled) {
}
