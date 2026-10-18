package com.servisimibul.backend.auth.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionEmailConfigurationValidatorTests {

    @Test
    void acceptsCompleteAuthenticatedStartTlsConfigurationWithoutConnecting() {
        var validator = validator(
                new AuthEmailProperties("no-reply@example.com", "https://servisimibul.example"),
                validEnvironment()
        );

        assertThatCode(validator::validate).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://servisimibul.example",
            "https://user@servisimibul.example",
            "https://servisimibul.example/app",
            "https://servisimibul.example?source=test",
            "not-a-url"
    })
    void rejectsFrontendValuesThatAreNotHttpsOrigins(String frontendBaseUrl) {
        var validator = validator(
                new AuthEmailProperties("no-reply@example.com", frontendBaseUrl),
                validEnvironment()
        );

        assertInvalid(validator, "valid HTTPS origin");
    }

    @Test
    void rejectsInvalidSenderWithoutEchoingIt() {
        String invalidSender = "not-an-email";
        var validator = validator(
                new AuthEmailProperties(invalidSender, "https://servisimibul.example"),
                validEnvironment()
        );

        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("sender address is invalid")
                .hasMessageNotContaining(invalidSender);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "spring.mail.host",
            "spring.mail.username",
            "spring.mail.password"
    })
    void rejectsBlankRequiredSmtpSettings(String property) {
        MockEnvironment environment = validEnvironment().withProperty(property, " ");

        assertInvalid(validator(validProperties(), environment), "required");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "spring.mail.properties[mail.smtp.auth]",
            "spring.mail.properties[mail.smtp.starttls.enable]",
            "spring.mail.properties[mail.smtp.starttls.required]"
    })
    void rejectsDisabledAuthenticationOrStartTlsRequirement(String property) {
        MockEnvironment environment = validEnvironment().withProperty(property, "false");

        assertInvalid(validator(validProperties(), environment), "must be");
    }

    @Test
    void rejectsImplicitTlsCombinedWithApprovedStartTlsConfiguration() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.mail.properties[mail.smtp.ssl.enable]", "true");

        assertInvalid(validator(validProperties(), environment), "cannot be combined");
    }

    @Test
    void rejectsInvalidSmtpPort() {
        MockEnvironment environment = validEnvironment().withProperty("spring.mail.port", "70000");

        assertInvalid(validator(validProperties(), environment), "between 1 and 65535");
    }

    private ProductionEmailConfigurationValidator validator(
            AuthEmailProperties properties,
            MockEnvironment environment
    ) {
        return new ProductionEmailConfigurationValidator(properties, environment);
    }

    private AuthEmailProperties validProperties() {
        return new AuthEmailProperties("no-reply@example.com", "https://servisimibul.example");
    }

    private MockEnvironment validEnvironment() {
        return new MockEnvironment()
                .withProperty("spring.mail.host", "smtp.example.com")
                .withProperty("spring.mail.port", "587")
                .withProperty("spring.mail.username", "smtp-user")
                .withProperty("spring.mail.password", "smtp-password")
                .withProperty("spring.mail.properties[mail.smtp.auth]", "true")
                .withProperty("spring.mail.properties[mail.smtp.starttls.enable]", "true")
                .withProperty("spring.mail.properties[mail.smtp.starttls.required]", "true")
                .withProperty("spring.mail.properties[mail.smtp.ssl.enable]", "false");
    }

    private void assertInvalid(ProductionEmailConfigurationValidator validator, String expectedMessage) {
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(expectedMessage)
                .hasMessageNotContaining("smtp-password");
    }
}
