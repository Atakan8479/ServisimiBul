package com.servisimibul.backend.moderation;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandServiceResponse;
import com.servisimibul.backend.demand.comment.DemandComment;
import com.servisimibul.backend.identity.AppUser;
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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "moderation_case")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ModerationCase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 24, updatable = false)
    private ModerationTargetType targetType;

    @Column(name = "target_id", nullable = false, updatable = false)
    private UUID targetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "demand_id", updatable = false)
    private Demand demand;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "comment_id", updatable = false)
    private DemandComment comment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_response_id", updatable = false)
    private DemandServiceResponse serviceResponse;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ModerationCaseStatus status = ModerationCaseStatus.OPEN;

    @Column(name = "target_title", nullable = false, length = 255, updatable = false)
    private String targetTitle;

    @Column(name = "target_snapshot", nullable = false, length = 2000, updatable = false)
    private String targetSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "moderated_by")
    private AppUser moderatedBy;

    @Column(name = "decision_reason", length = 500)
    private String decisionReason;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static ModerationCase forComment(DemandComment comment, String title, String snapshot) {
        ModerationCase moderationCase = base(
                ModerationTargetType.COMMENT,
                comment.getId(),
                title,
                snapshot
        );
        moderationCase.comment = Objects.requireNonNull(comment);
        return moderationCase;
    }

    public static ModerationCase forDemand(Demand demand, String title, String snapshot) {
        ModerationCase moderationCase = base(
                ModerationTargetType.DEMAND,
                demand.getId(),
                title,
                snapshot
        );
        moderationCase.demand = Objects.requireNonNull(demand);
        return moderationCase;
    }

    public static ModerationCase forServiceResponse(
            DemandServiceResponse response,
            String title,
            String snapshot
    ) {
        ModerationCase moderationCase = base(
                ModerationTargetType.SERVICE_RESPONSE,
                response.getId(),
                title,
                snapshot
        );
        moderationCase.serviceResponse = Objects.requireNonNull(response);
        return moderationCase;
    }

    public boolean isActive() {
        return status == ModerationCaseStatus.OPEN || status == ModerationCaseStatus.IN_REVIEW;
    }

    public void markInReview(AppUser moderator, String reason) {
        requireActive();
        status = ModerationCaseStatus.IN_REVIEW;
        moderatedBy = Objects.requireNonNull(moderator);
        decisionReason = Objects.requireNonNull(reason);
    }

    public void resolve(AppUser moderator, String reason, OffsetDateTime at) {
        status = ModerationCaseStatus.RESOLVED;
        moderatedBy = Objects.requireNonNull(moderator);
        decisionReason = Objects.requireNonNull(reason);
        resolvedAt = Objects.requireNonNull(at);
    }

    public void dismiss(AppUser moderator, String reason, OffsetDateTime at) {
        requireActive();
        status = ModerationCaseStatus.DISMISSED;
        moderatedBy = Objects.requireNonNull(moderator);
        decisionReason = Objects.requireNonNull(reason);
        resolvedAt = Objects.requireNonNull(at);
    }

    private void requireActive() {
        if (!isActive()) {
            throw new IllegalStateException("Moderation case is already closed");
        }
    }

    private static ModerationCase base(
            ModerationTargetType targetType,
            UUID targetId,
            String title,
            String snapshot
    ) {
        ModerationCase moderationCase = new ModerationCase();
        moderationCase.targetType = Objects.requireNonNull(targetType);
        moderationCase.targetId = Objects.requireNonNull(targetId);
        moderationCase.targetTitle = Objects.requireNonNull(title);
        moderationCase.targetSnapshot = Objects.requireNonNull(snapshot);
        return moderationCase;
    }
}
