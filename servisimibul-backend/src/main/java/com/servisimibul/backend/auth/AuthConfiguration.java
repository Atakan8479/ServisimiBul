package com.servisimibul.backend.auth;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
@EnableConfigurationProperties(AuthEmailProperties.class)
class AuthConfiguration {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}

@ConfigurationProperties("servisimibul.email")
record AuthEmailProperties(String from, String frontendBaseUrl) {
}
