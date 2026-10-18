package com.servisimibul.backend.auth.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EmailVerificationConfigurationValidatorTests {

    @Test
    void acceptsRequiredVerificationWithoutAProfile() {
        var validator = validator(true, new MockEnvironment());

        assertThatCode(validator::validate).doesNotThrowAnyException();
    }

    @Test
    void acceptsDisabledVerificationOnlyForLocalDevelopment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("local");

        assertThatCode(() -> validator(false, environment).validate())
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsDisabledVerificationOutsideLocalDevelopment() {
        var validator = validator(false, new MockEnvironment());

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("only be disabled with the local profile");
    }

    private EmailVerificationConfigurationValidator validator(
            boolean required,
            MockEnvironment environment
    ) {
        return new EmailVerificationConfigurationValidator(
                new EmailVerificationProperties(required),
                environment
        );
    }
}
