package com.servisimibul.backend.moderation;

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

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "moderation_audit_event")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ModerationAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "moderation_case_id", nullable = false, updatable = false)
    private ModerationCase moderationCase;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "moderator_id", nullable = false, updatable = false)
    private AppUser moderator;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private ModerationAction action;

    @Column(nullable = false, length = 500, updatable = false)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public ModerationAuditEvent(
            ModerationCase moderationCase,
            AppUser moderator,
            ModerationAction action,
            String reason,
            OffsetDateTime createdAt
    ) {
        this.moderationCase = Objects.requireNonNull(moderationCase);
        this.moderator = Objects.requireNonNull(moderator);
        this.action = Objects.requireNonNull(action);
        this.reason = Objects.requireNonNull(reason);
        this.createdAt = Objects.requireNonNull(createdAt);
    }
}
