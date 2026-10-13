package com.servisimibul.backend.auth;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthRateLimiterTests {

    @Test
    void enforcesRollingLimitAndAllowsRequestsAfterTheWindow() {
        AuthRateLimiter limiter = new AuthRateLimiter();
        Instant start = Instant.parse("2026-10-13T10:00:00Z");

        limiter.requireAllowance("resend:ip:test", 2, Duration.ofHours(1), start);
        limiter.requireAllowance("resend:ip:test", 2, Duration.ofHours(1), start.plusSeconds(1));
        assertThatThrownBy(() -> limiter.requireAllowance(
                "resend:ip:test",
                2,
                Duration.ofHours(1),
                start.plusSeconds(2)
        )).isInstanceOf(RateLimitExceededException.class);

        limiter.requireAllowance(
                "resend:ip:test",
                2,
                Duration.ofHours(1),
                start.plus(Duration.ofHours(1))
        );
    }
}
