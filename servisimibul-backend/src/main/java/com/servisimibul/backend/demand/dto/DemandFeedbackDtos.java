package com.servisimibul.backend.demand.dto;

import com.servisimibul.backend.demand.DemandServiceFeedbackStatus;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class DemandFeedbackDtos {

    private DemandFeedbackDtos() {
    }

    public record FeedbackDecisionRequest(@NotNull Boolean satisfied) {
    }

    public record FeedbackResponse(
            UUID publicationEventId,
            UUID operatorId,
            String operatorBusinessName,
            boolean offersMorning,
            boolean offersAfternoon,
            OffsetDateTime publishedAt,
            DemandServiceFeedbackStatus status,
            OffsetDateTime openedAt,
            OffsetDateTime reminderDueAt,
            OffsetDateTime reminderTriggeredAt,
            OffsetDateTime expiresAt,
            OffsetDateTime evaluatedAt,
            boolean canEvaluate
    ) {
    }

    public record FeedbackListResponse(
            UUID demandId,
            List<FeedbackResponse> feedback,
            String disclaimer
    ) {
        public FeedbackListResponse {
            feedback = List.copyOf(feedback);
        }
    }
}
