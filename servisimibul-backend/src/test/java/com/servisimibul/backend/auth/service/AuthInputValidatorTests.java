package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.exception.AuthValidationException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthInputValidatorTests {

    private final AuthInputValidator validator = new AuthInputValidator();

    @Test
    void normalizesSupportedTurkishPhoneForms() {
        assertThat(validator.phone("0532 123 45 67")).isEqualTo("+905321234567");
        assertThat(validator.phone("532-123-45-67")).isEqualTo("+905321234567");
        assertThat(validator.phone("0090 (532) 123 45 67")).isEqualTo("+905321234567");
    }

    @Test
    void rejectsMalformedPhoneAndBcryptTruncatingPassword() {
        assertThatThrownBy(() -> validator.phone("12345"))
                .isInstanceOf(AuthValidationException.class);
        assertThatThrownBy(() -> validator.password("ş".repeat(40), "password"))
                .isInstanceOf(AuthValidationException.class)
                .hasMessageContaining("72 UTF-8 bytes");
    }

    @Test
    void normalizesEmailAndRejectsWeakPassword() {
        assertThat(validator.email("  Operator@Example.COM ")).isEqualTo("operator@example.com");
        assertThatThrownBy(() -> validator.password("too-short", "password"))
                .isInstanceOf(AuthValidationException.class);
    }
}
