package com.servisimibul.backend.demand;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "demand_service_feedback",
        uniqueConstraints = @UniqueConstraint(
                name = "demand_service_feedback_unique",
                columnNames = {"support_id", "publication_event_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DemandServiceFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "support_id", nullable = false)
    private DemandSupport support;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "publication_event_id", nullable = false)
    private DemandServicePublicationEvent publicationEvent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private DemandServiceFeedbackStatus status = DemandServiceFeedbackStatus.AWAITING_FEEDBACK;

    @Column(name = "opened_at")
    private OffsetDateTime openedAt;

    @Column(name = "reminder_due_at")
    private OffsetDateTime reminderDueAt;

    @Column(name = "reminder_triggered_at")
    private OffsetDateTime reminderTriggeredAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "evaluated_at")
    private OffsetDateTime evaluatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public DemandServiceFeedback(
            DemandSupport support,
            DemandServicePublicationEvent publicationEvent,
            OffsetDateTime expiresAt
    ) {
        this.support = Objects.requireNonNull(support);
        this.publicationEvent = Objects.requireNonNull(publicationEvent);
        this.expiresAt = Objects.requireNonNull(expiresAt);
    }

    public void open(OffsetDateTime openedAt, Duration reminderAfterOpen, Duration expiryAfterOpen) {
        if (!isAwaiting() || this.openedAt != null) {
            return;
        }
        this.openedAt = Objects.requireNonNull(openedAt);
        this.reminderDueAt = openedAt.plus(reminderAfterOpen);
        this.expiresAt = openedAt.plus(expiryAfterOpen);
    }

    public void remind(OffsetDateTime remindedAt) {
        if (isAwaiting() && reminderTriggeredAt == null) {
            reminderTriggeredAt = Objects.requireNonNull(remindedAt);
        }
    }

    public void satisfy(OffsetDateTime evaluatedAt) {
        evaluate(DemandServiceFeedbackStatus.SATISFIED, evaluatedAt);
    }

    public void reject(OffsetDateTime evaluatedAt) {
        evaluate(DemandServiceFeedbackStatus.NOT_SATISFIED, evaluatedAt);
    }

    public void expire() {
        if (isAwaiting()) {
            status = DemandServiceFeedbackStatus.INACTIVE_EXPIRED;
        }
    }

    public void supersede() {
        if (isAwaiting()) {
            status = DemandServiceFeedbackStatus.SUPERSEDED;
        }
    }

    public boolean isAwaiting() {
        return status == DemandServiceFeedbackStatus.AWAITING_FEEDBACK;
    }

    private void evaluate(DemandServiceFeedbackStatus newStatus, OffsetDateTime at) {
        if (!isAwaiting()) {
            throw new IllegalStateException("Only awaiting feedback can be evaluated");
        }
        status = newStatus;
        evaluatedAt = Objects.requireNonNull(at);
    }
}
