package com.servisimibul.backend.ratelimit;

import com.servisimibul.backend.auth.exception.RateLimitExceededException;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.Locale;
import java.util.Map;

@Component
public class InMemoryRateLimiter {

    private static final int SALT_BYTES = 32;
    private static final int PROBATION_DIVISOR = 4;

    private final RateLimitProperties properties;
    private final Clock clock;
    private final MeterRegistry meterRegistry;
    private final byte[] keySalt;
    private final Map<RateLimitRule, Map<String, AttemptWindow>> protectedWindows =
            new EnumMap<>(RateLimitRule.class);
    private final Map<RateLimitRule, Map<String, AttemptWindow>> probationWindows =
            new EnumMap<>(RateLimitRule.class);
    private final Map<RateLimitRule, OverflowWindow[]> overflowWindows =
            new EnumMap<>(RateLimitRule.class);

    @Autowired
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
            protectedWindows.put(rule, new LinkedHashMap<>(128, 0.75f, true));
            probationWindows.put(rule, new LinkedHashMap<>(32, 0.75f, true));
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
        return protectedWindows.values().stream().mapToInt(Map::size).sum()
                + probationWindows.values().stream().mapToInt(Map::size).sum();
    }

    private AttemptResult acquire(RateLimitRule rule, String identity, Instant now) {
        RateLimitProperties.Limit limit = limit(rule);
        HashedIdentity hashedIdentity = hash(rule, identity);
        Map<String, AttemptWindow> protectedRuleWindows = protectedWindows.get(rule);
        AttemptWindow protectedWindow = protectedRuleWindows.get(hashedIdentity.digest());
        if (protectedWindow != null) {
            return protectedWindow.acquire(limit.requests(), limit.window(), now);
        }

        Map<String, AttemptWindow> probationRuleWindows = probationWindows.get(rule);
        AttemptWindow probationWindow = probationRuleWindows.get(hashedIdentity.digest());
        if (probationWindow != null) {
            probationWindow.removeExpired(limit.window(), now);
            if (probationWindow.isEmpty()) {
                return probationWindow.acquire(limit.requests(), limit.window(), now);
            }
            removeExpiredWindows(protectedRuleWindows, limit.window(), now);
            if (!probationWindow.hasOverflowHistory()
                    && protectedRuleWindows.size() < protectedCapacity()) {
                probationRuleWindows.remove(hashedIdentity.digest());
                protectedRuleWindows.put(hashedIdentity.digest(), probationWindow);
                return probationWindow.acquire(limit.requests(), limit.window(), now);
            }

            incrementSaturation(rule);
            OverflowWindow bucket = overflowBucket(rule, hashedIdentity);
            int overflowLimit = overflowLimit(limit);
            if (!probationWindow.hasOverflowHistory()) {
                AttemptResult recordedFirstAttempt = bucket.acquire(
                        overflowLimit,
                        limit.window(),
                        now
                );
                probationWindow.markOverflowHistory();
                if (!recordedFirstAttempt.allowed()) {
                    return recordedFirstAttempt;
                }
            }
            return bucket.acquire(overflowLimit, limit.window(), now);
        }

        removeExpiredWindows(protectedRuleWindows, limit.window(), now);
        removeExpiredWindows(probationRuleWindows, limit.window(), now);
        admitFirstAttempt(rule, hashedIdentity.digest(), limit, now);
        return new AttemptResult(true, 0);
    }

    private void admitFirstAttempt(
            RateLimitRule rule,
            String digest,
            RateLimitProperties.Limit limit,
            Instant now
    ) {
        Map<String, AttemptWindow> probationRuleWindows = probationWindows.get(rule);
        if (probationRuleWindows.size() >= probationCapacity()) {
            String eldestDigest = probationRuleWindows.keySet().iterator().next();
            probationRuleWindows.remove(eldestDigest);
            meterRegistry.counter(
                    "servisimibul.rate_limit.probation_evictions.total",
                    "rule",
                    rule.name().toLowerCase(Locale.ROOT)
            ).increment();
        }
        AttemptWindow created = new AttemptWindow();
        AttemptResult firstAttempt = created.acquire(limit.requests(), limit.window(), now);
        if (!firstAttempt.allowed()) {
            throw new IllegalStateException("A positive rate limit rejected its first attempt");
        }
        probationRuleWindows.put(digest, created);
    }

    private void removeExpiredWindows(
            Map<String, AttemptWindow> windows,
            Duration window,
            Instant now
    ) {
        windows.entrySet().removeIf(entry -> {
            entry.getValue().removeExpired(window, now);
            return entry.getValue().isEmpty();
        });
    }

    private int protectedCapacity() {
        return ruleCapacity() - probationCapacity();
    }

    private int probationCapacity() {
        return Math.max(1, ruleCapacity() / PROBATION_DIVISOR);
    }

    private int ruleCapacity() {
        return Math.max(2, properties.capacity().maxKeys() / RateLimitRule.values().length);
    }

    private void incrementSaturation(RateLimitRule rule) {
        meterRegistry.counter(
                "servisimibul.rate_limit.saturation.total",
                "rule",
                rule.name().toLowerCase(Locale.ROOT)
        ).increment();
    }

    private OverflowWindow overflowBucket(RateLimitRule rule, HashedIdentity hashedIdentity) {
        OverflowWindow[] buckets = overflowWindows.get(rule);
        return buckets[Math.floorMod(hashedIdentity.bucketHash(), buckets.length)];
    }

    private int overflowLimit(RateLimitProperties.Limit limit) {
        return Math.multiplyExact(
                limit.requests(),
                properties.capacity().overflowMultiplier()
        );
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
            case COMMENT_ACCOUNT -> properties.commentAccount();
            case REPORT_ACCOUNT -> properties.reportAccount();
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

    private static long retryAfterSeconds(Instant now, Instant deadline) {
        Duration remaining = Duration.between(now, deadline);
        if (remaining.isNegative() || remaining.isZero()) {
            return 1;
        }
        long wholeSeconds = remaining.getSeconds();
        return remaining.getNano() == 0 ? Math.max(1, wholeSeconds) : wholeSeconds + 1;
    }

    private static final class AttemptWindow {

        private final ArrayDeque<Instant> attempts = new ArrayDeque<>();
        private boolean overflowHistory;

        private AttemptResult acquire(int limit, Duration window, Instant now) {
            removeExpired(window, now);
            if (attempts.size() >= limit) {
                return new AttemptResult(
                        false,
                        retryAfterSeconds(now, attempts.getFirst().plus(window))
                );
            }
            attempts.addLast(now);
            return new AttemptResult(true, 0);
        }

        private void removeExpired(Duration window, Instant now) {
            Instant cutoff = now.minus(window);
            while (!attempts.isEmpty() && !attempts.getFirst().isAfter(cutoff)) {
                attempts.removeFirst();
            }
            if (attempts.isEmpty()) {
                overflowHistory = false;
            }
        }

        private boolean isEmpty() {
            return attempts.isEmpty();
        }

        private boolean hasOverflowHistory() {
            return overflowHistory;
        }

        private void markOverflowHistory() {
            overflowHistory = true;
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
                return new AttemptResult(
                        false,
                        retryAfterSeconds(now, startedAt.plus(window))
                );
            }
            attempts++;
            return new AttemptResult(true, 0);
        }
    }
}
