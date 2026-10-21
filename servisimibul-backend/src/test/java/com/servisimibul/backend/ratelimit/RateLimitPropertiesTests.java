package com.servisimibul.backend.ratelimit;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitPropertiesTests {

    @Test
    void rejectsNonPositiveWindowsAndUnsafeCapacityValues() {
        RateLimitProperties.Limit invalid = new RateLimitProperties.Limit(0, Duration.ZERO);
        RateLimitProperties properties = new RateLimitProperties(
                new RateLimitProperties.Capacity(10, 1, 1),
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid,
                invalid
        );

        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            assertThat(validatorFactory.getValidator().validate(properties))
                    .extracting(violation -> violation.getPropertyPath().toString())
                    .contains(
                            "capacity.maxKeys",
                            "capacity.overflowBuckets",
                            "capacity.overflowMultiplier",
                            "loginAccount.requests",
                            "loginAccount.windowPositive"
                    );
        }
    }
}
