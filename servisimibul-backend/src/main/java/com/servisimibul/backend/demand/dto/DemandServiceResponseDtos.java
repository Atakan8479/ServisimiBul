package com.servisimibul.backend.demand.dto;

import com.servisimibul.backend.demand.DemandServiceResponseStatus;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class DemandServiceResponseDtos {

    private DemandServiceResponseDtos() {
    }

    public enum EligibilityBlocker {
        ACCOUNT_EMAIL_UNVERIFIED,
        ACCOUNT_DISABLED,
        PROFILE_INACTIVE,
        PROFILE_HIDDEN,
        APPROVAL_REQUIRED,
        DEMAND_NOT_OPEN,
        SCHOOL_INACTIVE,
        SCHOOL_NOT_LINKED,
        SCHOOL_RELATIONSHIP_INACTIVE,
        COVERAGE_MISSING
    }

    public record PublishRequest(
            @NotNull Boolean offersMorning,
            @NotNull Boolean offersAfternoon
    ) {
    }

    public record OperatorResponse(
            UUID id,
            DemandServiceResponseStatus status,
            boolean offersMorning,
            boolean offersAfternoon,
            int publicationVersion,
            UUID publicationEventId,
            OffsetDateTime publishedAt,
            OffsetDateTime withdrawnAt,
            boolean currentlyPublic
    ) {
    }

    public record EligibilityResponse(
            UUID demandId,
            boolean eligible,
            List<EligibilityBlocker> blockers,
            OperatorResponse response
    ) {
        public EligibilityResponse {
            blockers = List.copyOf(blockers);
        }
    }

    public record PublishResponse(boolean published, OperatorResponse response) {
    }

    public record PublicResponse(
            UUID id,
            UUID publicationEventId,
            int publicationVersion,
            UUID operatorId,
            String businessName,
            String contactPhone,
            boolean offersMorning,
            boolean offersAfternoon,
            OffsetDateTime publishedAt
    ) {
    }

    public record PageResponse<T>(
            List<T> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        public PageResponse {
            content = List.copyOf(content);
        }
    }
}
