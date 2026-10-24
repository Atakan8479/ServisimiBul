package com.servisimibul.backend.moderation.dto;

import com.servisimibul.backend.moderation.ModerationAction;
import com.servisimibul.backend.moderation.ModerationCaseStatus;
import com.servisimibul.backend.moderation.ModerationTargetType;
import com.servisimibul.backend.moderation.ReportReason;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ModerationDtos {

    private ModerationDtos() {
    }

    public record CreateReportRequest(
            @NotNull ModerationTargetType targetType,
            @NotNull UUID targetId,
            @NotNull ReportReason reason,
            @Size(max = 500) String explanation
    ) {
    }

    public record ReportReceipt(
            UUID id,
            UUID caseId,
            ModerationTargetType targetType,
            UUID targetId,
            ReportReason reason,
            ModerationCaseStatus status,
            OffsetDateTime createdAt
    ) {
    }

    public record ModerationActionRequest(
            @NotNull ModerationAction action,
            @NotBlank @Size(min = 2, max = 500) String reason
    ) {
    }

    public record TargetContext(
            String title,
            String snapshot,
            boolean currentlyVisible,
            UUID operatorProfileId
    ) {
    }

    public record CaseSummary(
            UUID id,
            ModerationTargetType targetType,
            UUID targetId,
            ModerationCaseStatus status,
            TargetContext target,
            long reporterCount,
            Map<ReportReason, Long> reasonCounts,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            OffsetDateTime resolvedAt
    ) {
    }

    public record ReportDetail(
            UUID id,
            ReportReason reason,
            String explanation,
            OffsetDateTime createdAt
    ) {
    }

    public record AuditDetail(
            UUID id,
            UUID moderatorId,
            ModerationAction action,
            String reason,
            OffsetDateTime createdAt
    ) {
    }

    public record CaseDetail(
            CaseSummary summary,
            UUID moderatedById,
            String decisionReason,
            List<ReportDetail> reports,
            List<AuditDetail> audit
    ) {
    }

    public record PageResponse<T>(
            List<T> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
    }
}
