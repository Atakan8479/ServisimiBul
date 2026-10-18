package com.servisimibul.backend.auth.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

import java.time.Clock;

@Configuration
@EnableConfigurationProperties({AuthEmailProperties.class, EmailVerificationProperties.class})
@EnableAsync
class AuthConfiguration {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
