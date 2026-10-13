package com.servisimibul.backend.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("servisimibul.email")
record AuthEmailProperties(String from, String frontendBaseUrl) {
}
