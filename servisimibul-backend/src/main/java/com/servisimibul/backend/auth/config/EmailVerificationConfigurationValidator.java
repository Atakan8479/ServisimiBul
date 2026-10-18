package com.servisimibul.backend.auth.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class EmailVerificationConfigurationValidator {

    private final EmailVerificationProperties properties;
    private final Environment environment;

    @PostConstruct
    void validate() {
        if (!properties.required() && !environment.acceptsProfiles(Profiles.of("local"))) {
            throw new IllegalStateException(
                    "Email verification may only be disabled with the local profile"
            );
        }
    }
}
