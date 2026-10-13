package com.servisimibul.backend.identity;

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
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "operator_application_review")
public class OperatorApplicationReview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_id", nullable = false)
    private OperatorProfile operator;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reviewed_by", nullable = false)
    private AppUser reviewedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReviewDecision decision;

    @Column(columnDefinition = "text")
    private String reason;

    @CreationTimestamp
    @Column(name = "reviewed_at", nullable = false, updatable = false)
    private OffsetDateTime reviewedAt;

    protected OperatorApplicationReview() {
    }

    public OperatorApplicationReview(
            OperatorProfile operator,
            AppUser reviewedBy,
            ReviewDecision decision,
            String reason
    ) {
        this.operator = Objects.requireNonNull(operator);
        if (Objects.requireNonNull(reviewedBy).getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only an admin can review an operator application");
        }
        this.reviewedBy = reviewedBy;
        this.decision = Objects.requireNonNull(decision);
        this.reason = reason == null ? null : reason.strip();
    }

    public UUID getId() {
        return id;
    }

    public ReviewDecision getDecision() {
        return decision;
    }

    public String getReason() {
        return reason;
    }
}
