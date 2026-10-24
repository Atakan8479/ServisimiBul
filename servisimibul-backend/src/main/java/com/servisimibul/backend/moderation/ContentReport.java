package com.servisimibul.backend.moderation;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.UserRole;
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

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "content_report",
        uniqueConstraints = @UniqueConstraint(
                name = "content_report_unique_reporter_case",
                columnNames = {"moderation_case_id", "reporter_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ContentReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "moderation_case_id", nullable = false, updatable = false)
    private ModerationCase moderationCase;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false, updatable = false)
    private AppUser reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "reporter_role", nullable = false, length = 20, updatable = false)
    private UserRole reporterRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32, updatable = false)
    private ReportReason reason;

    @Column(length = 500, updatable = false)
    private String explanation;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public ContentReport(
            ModerationCase moderationCase,
            AppUser reporter,
            ReportReason reason,
            String explanation
    ) {
        UserRole role = Objects.requireNonNull(reporter).getRole();
        if (role != UserRole.PARENT && role != UserRole.OPERATOR) {
            throw new IllegalArgumentException("Only parents and operators can report content");
        }
        this.moderationCase = Objects.requireNonNull(moderationCase);
        this.reporter = reporter;
        this.reporterRole = role;
        this.reason = Objects.requireNonNull(reason);
        this.explanation = explanation;
    }
}
