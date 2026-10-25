package com.servisimibul.backend.notification;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record NotificationResponse(
            UUID id,
            NotificationType type,
            UUID demandId,
            UUID serviceResponseId,
            UUID publicationEventId,
            UUID feedbackId,
            UUID moderationCaseId,
            String title,
            String message,
            String href,
            OffsetDateTime createdAt,
            OffsetDateTime readAt
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

    public record UnreadCountResponse(long unreadCount) {
    }
}
