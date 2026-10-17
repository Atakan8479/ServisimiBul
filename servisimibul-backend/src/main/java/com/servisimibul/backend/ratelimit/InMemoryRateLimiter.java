package com.servisimibul.backend.ratelimit;

import com.servisimibul.backend.auth.exception.RateLimitExceededException;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class InMemoryRateLimiter {

    private static final int SALT_BYTES = 32;

    private final RateLimitProperties properties;
    private final Clock clock;
    private final MeterRegistry meterRegistry;
    private final byte[] keySalt;
    private final Map<RateLimitRule, Map<String, AttemptWindow>> exactWindows =
            new EnumMap<>(RateLimitRule.class);
    private final Map<RateLimitRule, OverflowWindow[]> overflowWindows =
            new EnumMap<>(RateLimitRule.class);

    public InMemoryRateLimiter(
            RateLimitProperties properties,
            Clock clock,
            MeterRegistry meterRegistry
    ) {
        this(properties, clock, meterRegistry, randomSalt());
    }

    InMemoryRateLimiter(
            RateLimitProperties properties,
            Clock clock,
            MeterRegistry meterRegistry,
            byte[] keySalt
    ) {
        this.properties = properties;
        this.clock = clock;
        this.meterRegistry = meterRegistry;
        this.keySalt = keySalt.clone();
        for (RateLimitRule rule : RateLimitRule.values()) {
            exactWindows.put(rule, new LinkedHashMap<>(128, 0.75f, true));
            OverflowWindow[] buckets = new OverflowWindow[properties.capacity().overflowBuckets()];
            for (int index = 0; index < buckets.length; index++) {
                buckets[index] = new OverflowWindow();
            }
            overflowWindows.put(rule, buckets);
        }
        meterRegistry.gauge("servisimibul.rate_limit.active_keys", this, InMemoryRateLimiter::activeKeyCount);
    }

    public void requireAllowance(RateLimitRule rule, String identity) {
        requireAllowance(rule, identity, clock.instant());
    }

    public boolean tryAcquire(RateLimitRule rule, String identity) {
        return tryAcquire(rule, identity, clock.instant());
    }

    synchronized void requireAllowance(RateLimitRule rule, String identity, Instant now) {
        AttemptResult result = acquire(rule, identity, now);
        if (!result.allowed()) {
            throw new RateLimitExceededException(result.retryAfterSeconds());
        }
    }

    synchronized boolean tryAcquire(RateLimitRule rule, String identity, Instant now) {
        return acquire(rule, identity, now).allowed();
    }

    synchronized int activeKeyCount() {
        return exactWindows.values().stream().mapToInt(Map::size).sum();
    }

    private AttemptResult acquire(RateLimitRule rule, String identity, Instant now) {
        RateLimitProperties.Limit limit = limit(rule);
        HashedIdentity hashedIdentity = hash(rule, identity);
        Map<String, AttemptWindow> ruleWindows = exactWindows.get(rule);
        AttemptWindow exact = ruleWindows.get(hashedIdentity.digest());
        if (exact != null) {
            return exact.acquire(limit.requests(), limit.window(), now);
        }

        removeExpiredExactWindows(rule, limit.window(), now);
        int ruleCapacity = Math.max(
                1,
                properties.capacity().maxKeys() / RateLimitRule.values().length
        );
        if (ruleWindows.size() < ruleCapacity) {
            AttemptWindow created = new AttemptWindow();
            ruleWindows.put(hashedIdentity.digest(), created);
            return created.acquire(limit.requests(), limit.window(), now);
        }

        meterRegistry.counter(
                "servisimibul.rate_limit.saturation.total",
                "rule",
                rule.name().toLowerCase()
        ).increment();
        OverflowWindow[] buckets = overflowWindows.get(rule);
        OverflowWindow bucket = buckets[Math.floorMod(hashedIdentity.bucketHash(), buckets.length)];
        int overflowLimit = Math.multiplyExact(
                limit.requests(),
                properties.capacity().overflowMultiplier()
        );
        return bucket.acquire(overflowLimit, limit.window(), now);
    }

    private void removeExpiredExactWindows(
            RateLimitRule rule,
            Duration window,
            Instant now
    ) {
        exactWindows.get(rule).entrySet().removeIf(entry -> {
            entry.getValue().removeExpired(window, now);
            return entry.getValue().isEmpty();
        });
    }

    private RateLimitProperties.Limit limit(RateLimitRule rule) {
        return switch (rule) {
            case LOGIN_ACCOUNT -> properties.loginAccount();
            case LOGIN_IP -> properties.loginIp();
            case REGISTRATION_IP -> properties.registrationIp();
            case VERIFICATION_RESEND_IP -> properties.verificationResendIp();
            case VERIFICATION_RESEND_ACCOUNT -> properties.verificationResendAccount();
            case PASSWORD_RECOVERY_IP -> properties.passwordRecoveryIp();
            case PASSWORD_RECOVERY_ACCOUNT -> properties.passwordRecoveryAccount();
            case EMAIL_VERIFICATION_IP -> properties.emailVerificationIp();
            case EMAIL_VERIFICATION_TOKEN -> properties.emailVerificationToken();
            case PASSWORD_RESET_IP -> properties.passwordResetIp();
            case PASSWORD_RESET_TOKEN -> properties.passwordResetToken();
            case PUBLIC_SEARCH_IP -> properties.publicSearchIp();
        };
    }

    private HashedIdentity hash(RateLimitRule rule, String identity) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(keySalt);
            digest.update((byte) 0);
            digest.update(rule.name().getBytes(StandardCharsets.UTF_8));
            digest.update((byte) 0);
            digest.update(identity.getBytes(StandardCharsets.UTF_8));
            byte[] result = digest.digest();
            return new HashedIdentity(
                    HexFormat.of().formatHex(result),
                    ByteBuffer.wrap(result).getInt()
            );
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static byte[] randomSalt() {
        byte[] salt = new byte[SALT_BYTES];
        new SecureRandom().nextBytes(salt);
        return salt;
    }

    private record HashedIdentity(String digest, int bucketHash) {
    }

    private record AttemptResult(boolean allowed, long retryAfterSeconds) {
    }

    private static final class AttemptWindow {

        private final ArrayDeque<Instant> attempts = new ArrayDeque<>();

        private AttemptResult acquire(int limit, Duration window, Instant now) {
            removeExpired(window, now);
            if (attempts.size() >= limit) {
                long seconds = Duration.between(now, attempts.getFirst().plus(window)).toSeconds();
                return new AttemptResult(false, Math.max(1, seconds));
            }
            attempts.addLast(now);
            return new AttemptResult(true, 0);
        }

        private void removeExpired(Duration window, Instant now) {
            Instant cutoff = now.minus(window);
            while (!attempts.isEmpty() && !attempts.getFirst().isAfter(cutoff)) {
                attempts.removeFirst();
            }
        }

        private boolean isEmpty() {
            return attempts.isEmpty();
        }
    }

    /**
     * Saturated identities share a fixed-window counter so adversarial churn cannot grow
     * per-bucket event history. Exact identities retain rolling-window behavior.
     */
    private static final class OverflowWindow {

        private Instant startedAt;
        private int attempts;

        private AttemptResult acquire(int limit, Duration window, Instant now) {
            if (startedAt == null || !now.isBefore(startedAt.plus(window))) {
                startedAt = now;
                attempts = 0;
            }
            if (attempts >= limit) {
                long seconds = Duration.between(now, startedAt.plus(window)).toSeconds();
                return new AttemptResult(false, Math.max(1, seconds));
            }
            attempts++;
            return new AttemptResult(true, 0);
        }
    }
}
