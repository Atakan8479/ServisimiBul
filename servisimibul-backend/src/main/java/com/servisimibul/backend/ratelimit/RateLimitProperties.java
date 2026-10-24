package com.servisimibul.backend.ratelimit;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties("app.rate-limit")
public record RateLimitProperties(
        @Valid @NotNull Capacity capacity,
        @Valid @NotNull Limit loginAccount,
        @Valid @NotNull Limit loginIp,
        @Valid @NotNull Limit registrationIp,
        @Valid @NotNull Limit verificationResendIp,
        @Valid @NotNull Limit verificationResendAccount,
        @Valid @NotNull Limit passwordRecoveryIp,
        @Valid @NotNull Limit passwordRecoveryAccount,
        @Valid @NotNull Limit emailVerificationIp,
        @Valid @NotNull Limit emailVerificationToken,
        @Valid @NotNull Limit passwordResetIp,
        @Valid @NotNull Limit passwordResetToken,
        @Valid @NotNull Limit publicSearchIp,
        @Valid @NotNull Limit commentAccount,
        @Valid @NotNull Limit reportAccount
) {

    public record Capacity(
            @Min(100) @Max(1_000_000) int maxKeys,
            @Min(16) @Max(65_536) int overflowBuckets,
            @Min(2) @Max(100) int overflowMultiplier
    ) {
    }

    public record Limit(@Min(1) @Max(1_000_000) int requests, @NotNull Duration window) {

        @AssertTrue(message = "rate-limit window must be positive")
        public boolean isWindowPositive() {
            return window != null && !window.isZero() && !window.isNegative();
        }
    }
}
