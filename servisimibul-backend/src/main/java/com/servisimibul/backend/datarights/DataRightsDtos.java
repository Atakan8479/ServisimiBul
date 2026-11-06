package com.servisimibul.backend.datarights;

import com.servisimibul.backend.identity.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class DataRightsDtos {

    private DataRightsDtos() {
    }

    public record SubmitRequest(
            @NotNull DataRightsRequestType type,
            @NotBlank @Size(max = 2000) String details
    ) {
        @Override
        public String toString() {
            return "SubmitRequest[type=" + type + "]";
        }
    }

    /** Requester view: status only. No handler identity, internal note or deadline promise. */
    public record RequesterView(
            UUID id,
            DataRightsRequestType type,
            DataRightsRequestStatus status,
            OffsetDateTime receivedAt,
            OffsetDateTime closedAt,
            boolean responseDelivered
    ) {
    }

    public record HandlerSummary(
            UUID id,
            DataRightsRequestType type,
            DataRightsRequestStatus status,
            OffsetDateTime receivedAt,
            OffsetDateTime responseDueAt,
            boolean overdue,
            UUID assignedHandlerId,
            OffsetDateTime closedAt,
            long version
    ) {
    }

    public record HandlerDetail(
            UUID id,
            UUID requesterId,
            UserRole requesterRole,
            DataRightsRequestType type,
            String details,
            DataRightsRequestStatus status,
            OffsetDateTime receivedAt,
            OffsetDateTime responseDueAt,
            boolean overdue,
            UUID assignedHandlerId,
            OffsetDateTime identityVerifiedAt,
            String handlerNote,
            OffsetDateTime closedAt,
            OffsetDateTime responseDeliveredAt,
            long version,
            List<EventView> events
    ) {
        @Override
        public String toString() {
            return "HandlerDetail[id=" + id + ", status=" + status + "]";
        }
    }

    public record EventView(
            DataRightsAction action,
            DataRightsRequestStatus fromStatus,
            DataRightsRequestStatus toStatus,
            UUID actorId,
            UUID previousAssigneeId,
            UUID newAssigneeId,
            OffsetDateTime createdAt
    ) {
    }

    public record ActionRequest(
            @NotNull DataRightsAction action,
            @NotNull @PositiveOrZero Long expectedVersion,
            UUID assigneeId,
            @Size(max = 1000) String note
    ) {
        @Override
        public String toString() {
            return "ActionRequest[action=" + action + ", expectedVersion=" + expectedVersion + "]";
        }
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    }

    /** Handler-only worksheet for a verified manual ACCESS response; never a public download. */
    public record AccessResponse(
            UUID requestId,
            UUID subjectId,
            OffsetDateTime generatedAt,
            List<PersonalDataSection> sections,
            List<ExcludedDataCategory> exclusions
    ) {
        @Override
        public String toString() {
            return "AccessResponse[requestId=" + requestId + "]";
        }
    }

    public record PersonalDataSection(String category, List<Map<String, Object>> records) {
    }

    public record ExcludedDataCategory(String category, String reason) {
    }
}
