package com.servisimibul.backend.demand.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties("app.demand.feedback")
public record DemandFeedbackProperties(
        Duration reminderAfterOpen,
        Duration expiryAfterOpen,
        Duration expiryIfUnopened,
        int batchSize
) {
    public DemandFeedbackProperties {
        requirePositive(reminderAfterOpen, "reminder-after-open");
        requirePositive(expiryAfterOpen, "expiry-after-open");
        requirePositive(expiryIfUnopened, "expiry-if-unopened");
        if (reminderAfterOpen.compareTo(expiryAfterOpen) >= 0) {
            throw new IllegalArgumentException(
                    "app.demand.feedback.reminder-after-open must be shorter than expiry-after-open"
            );
        }
        if (batchSize < 1 || batchSize > 1000) {
            throw new IllegalArgumentException("app.demand.feedback.batch-size must be between 1 and 1000");
        }
    }

    private static void requirePositive(Duration value, String name) {
        if (value == null || value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException("app.demand.feedback." + name + " must be positive");
        }
    }
}
