package com.servisimibul.backend.auth;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
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
