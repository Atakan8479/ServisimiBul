package com.servisimibul.backend.ratelimit;

import com.servisimibul.backend.auth.exception.RateLimitExceededException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InMemoryRateLimiterTests {

    private static final Instant START = Instant.parse("2026-10-17T10:00:00Z");

    @Test
    void enforcesRollingLimitAndAllowsTheExactWindowBoundary() {
        InMemoryRateLimiter limiter = limiter(properties(120, 2, Duration.ofHours(1)));

        limiter.requireAllowance(RateLimitRule.VERIFICATION_RESEND_IP, "peer", START);
        limiter.requireAllowance(
                RateLimitRule.VERIFICATION_RESEND_IP,
                "peer",
                START.plusSeconds(1)
        );
        assertThatThrownBy(() -> limiter.requireAllowance(
                RateLimitRule.VERIFICATION_RESEND_IP,
                "peer",
                START.plusSeconds(2)
        )).isInstanceOf(RateLimitExceededException.class)
                .extracting("retryAfterSeconds")
                .isEqualTo(3_598L);

        limiter.requireAllowance(
                RateLimitRule.VERIFICATION_RESEND_IP,
                "peer",
                START.plus(Duration.ofHours(1))
        );
    }

    @Test
    void keepsRulesAndIdentitiesIsolated() {
        InMemoryRateLimiter limiter = limiter(properties(120, 1, Duration.ofMinutes(1)));

        assertThat(limiter.tryAcquire(RateLimitRule.LOGIN_ACCOUNT, "first", START)).isTrue();
        assertThat(limiter.tryAcquire(RateLimitRule.LOGIN_ACCOUNT, "first", START)).isFalse();
        assertThat(limiter.tryAcquire(RateLimitRule.LOGIN_ACCOUNT, "second", START)).isTrue();
        assertThat(limiter.tryAcquire(RateLimitRule.LOGIN_IP, "first", START)).isTrue();
    }

    @Test
    void legitimateAccountsSharingOneIpRemainIndependentlyProtected() {
        RateLimitProperties properties = productionLikeProperties();
        InMemoryRateLimiter limiter = limiter(properties);

        for (int index = 0; index < 50; index++) {
            assertThat(limiter.tryAcquire(RateLimitRule.LOGIN_IP, "shared-peer", START)).isTrue();
            assertThat(limiter.tryAcquire(
                    RateLimitRule.LOGIN_ACCOUNT,
                    "person-" + index + "@example.com",
                    START
            )).isTrue();
        }
    }

    @Test
    void saturationIsBoundedObservableAndCannotExhaustOtherRules() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        InMemoryRateLimiter limiter = limiter(
                properties(120, 1, Duration.ofMinutes(15)),
                registry
        );
        int perRuleCapacity = 120 / RateLimitRule.values().length;

        for (int index = 0; index < perRuleCapacity + 200; index++) {
            limiter.tryAcquire(RateLimitRule.LOGIN_ACCOUNT, "attacker-" + index, START);
        }

        assertThat(limiter.activeKeyCount()).isEqualTo(perRuleCapacity);
        assertThat(registry.get("servisimibul.rate_limit.saturation.total")
                .tag("rule", "login_account")
                .counter()
                .count()).isGreaterThan(0);
        assertThat(limiter.tryAcquire(RateLimitRule.LOGIN_IP, "legitimate-shared-ip", START))
                .isTrue();
        assertThat(limiter.tryAcquire(RateLimitRule.REGISTRATION_IP, "legitimate-shared-ip", START))
                .isTrue();
        assertThat(limiter.tryAcquire(RateLimitRule.PUBLIC_SEARCH_IP, "legitimate-shared-ip", START))
                .isTrue();
    }

    @Test
    void overflowRemainsBoundedDuringLargeAdversarialIdentityChurn() {
        InMemoryRateLimiter limiter = limiter(properties(120, 1, Duration.ofMinutes(15)));
        int perRuleCapacity = 120 / RateLimitRule.values().length;

        for (int index = 0; index < 100_000; index++) {
            limiter.tryAcquire(RateLimitRule.LOGIN_ACCOUNT, "churn-" + index, START);
        }

        assertThat(limiter.activeKeyCount()).isEqualTo(perRuleCapacity);
        assertThat(limiter.tryAcquire(RateLimitRule.LOGIN_IP, "legitimate-peer", START))
                .isTrue();
    }

    @Test
    void concurrentRequestsCannotExceedTheConfiguredLimit() throws Exception {
        InMemoryRateLimiter limiter = limiter(properties(120, 10, Duration.ofMinutes(1)));
        List<Callable<Boolean>> attempts = new ArrayList<>();
        for (int index = 0; index < 100; index++) {
            attempts.add(() -> limiter.tryAcquire(RateLimitRule.LOGIN_ACCOUNT, "same", START));
        }

        try (var executor = Executors.newFixedThreadPool(12)) {
            long allowed = executor.invokeAll(attempts).stream()
                    .filter(future -> {
                        try {
                            return future.get();
                        } catch (Exception failure) {
                            throw new AssertionError(failure);
                        }
                    })
                    .count();
            assertThat(allowed).isEqualTo(10);
        }
    }

    @Test
    void expiredKeysAreCleanedBeforeOverflowAdmission() {
        InMemoryRateLimiter limiter = limiter(properties(120, 1, Duration.ofSeconds(1)));
        int perRuleCapacity = 120 / RateLimitRule.values().length;
        for (int index = 0; index < perRuleCapacity; index++) {
            assertThat(limiter.tryAcquire(
                    RateLimitRule.LOGIN_ACCOUNT,
                    "expired-" + index,
                    START
            )).isTrue();
        }

        assertThat(limiter.tryAcquire(
                RateLimitRule.LOGIN_ACCOUNT,
                "fresh",
                START.plusSeconds(1)
        )).isTrue();
        assertThat(limiter.activeKeyCount()).isEqualTo(1);
    }

    private InMemoryRateLimiter limiter(RateLimitProperties properties) {
        return limiter(properties, new SimpleMeterRegistry());
    }

    private InMemoryRateLimiter limiter(
            RateLimitProperties properties,
            SimpleMeterRegistry registry
    ) {
        return new InMemoryRateLimiter(
                properties,
                Clock.fixed(START, ZoneOffset.UTC),
                registry,
                new byte[32]
        );
    }

    private RateLimitProperties properties(int maxKeys, int requests, Duration window) {
        RateLimitProperties.Limit limit = new RateLimitProperties.Limit(requests, window);
        return new RateLimitProperties(
                new RateLimitProperties.Capacity(maxKeys, 16, 4),
                limit,
                limit,
                limit,
                limit,
                limit,
                limit,
                limit,
                limit,
                limit,
                limit,
                limit,
                limit
        );
    }

    private RateLimitProperties productionLikeProperties() {
        RateLimitProperties.Limit account = new RateLimitProperties.Limit(
                10,
                Duration.ofMinutes(15)
        );
        RateLimitProperties.Limit ip = new RateLimitProperties.Limit(
                100,
                Duration.ofMinutes(15)
        );
        return new RateLimitProperties(
                new RateLimitProperties.Capacity(10_000, 1_024, 4),
                account,
                ip,
                ip,
                ip,
                account,
                ip,
                account,
                ip,
                account,
                ip,
                account,
                ip
        );
    }
}
