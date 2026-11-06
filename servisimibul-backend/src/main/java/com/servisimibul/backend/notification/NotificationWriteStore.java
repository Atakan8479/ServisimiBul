package com.servisimibul.backend.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class NotificationWriteStore {

    private final NamedParameterJdbcTemplate jdbc;

    public int insert(NotificationWrite notification) {
        return jdbc.update("""
                INSERT INTO in_app_notification (
                    id, recipient_user_id, type, event_key, demand_id, service_response_id,
                    publication_event_id, feedback_id, moderation_case_id, created_at
                )
                SELECT :id, :recipientUserId, :type, :eventKey, CAST(:demandId AS UUID),
                    CAST(:serviceResponseId AS UUID), CAST(:publicationEventId AS UUID),
                    CAST(:feedbackId AS UUID), CAST(:moderationCaseId AS UUID), :createdAt
                -- Opt-outs exist only for optional types (V20 type check), so essential notices always pass.
                WHERE NOT EXISTS (
                    SELECT 1 FROM notification_preference preference
                    WHERE preference.user_id = :recipientUserId
                      AND preference.type = :type
                      AND NOT preference.enabled
                )
                ON CONFLICT (event_key) DO NOTHING
                """, new MapSqlParameterSource()
                .addValue("id", UUID.randomUUID())
                .addValue("recipientUserId", notification.recipientUserId())
                .addValue("type", notification.type().name())
                .addValue("eventKey", notification.eventKey())
                .addValue("demandId", notification.demandId())
                .addValue("serviceResponseId", notification.serviceResponseId())
                .addValue("publicationEventId", notification.publicationEventId())
                .addValue("feedbackId", notification.feedbackId())
                .addValue("moderationCaseId", notification.moderationCaseId())
                .addValue("createdAt", notification.createdAt()));
    }

    public record NotificationWrite(
            UUID recipientUserId,
            NotificationType type,
            String eventKey,
            UUID demandId,
            UUID serviceResponseId,
            UUID publicationEventId,
            UUID feedbackId,
            UUID moderationCaseId,
            OffsetDateTime createdAt
    ) {
    }
}
