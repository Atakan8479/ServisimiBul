package com.servisimibul.backend.auth;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
class AuthRateLimiter {

    private static final int MAX_KEYS = 10_000;
    private final Map<String, Deque<Instant>> attempts = new LinkedHashMap<>(128, 0.75f, true);

    synchronized void requireAllowance(String key, int limit, Duration window, Instant now) {
        if (!tryAcquire(key, limit, window, now)) {
            Deque<Instant> timestamps = attempts.get(key);
            long seconds = Duration.between(now, timestamps.getFirst().plus(window)).toSeconds();
            throw new RateLimitExceededException(Math.max(1, seconds));
        }
    }

    synchronized boolean tryAcquire(String key, int limit, Duration window, Instant now) {
        // shortcut: limits are per application instance, replace with shared storage before running multiple instances.
        Deque<Instant> timestamps = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        Instant cutoff = now.minus(window);
        while (!timestamps.isEmpty() && !timestamps.getFirst().isAfter(cutoff)) {
            timestamps.removeFirst();
        }
        if (timestamps.size() >= limit) {
            return false;
        }
        timestamps.addLast(now);
        if (attempts.size() > MAX_KEYS) {
            attempts.remove(attempts.keySet().iterator().next());
        }
        return true;
    }
}
