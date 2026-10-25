package com.servisimibul.backend.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "in_app_notification")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InAppNotification {

    @Id
    private UUID id;

    @Column(name = "recipient_user_id", nullable = false, updatable = false)
    private UUID recipientUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32, updatable = false)
    private NotificationType type;

    @Column(name = "event_key", nullable = false, length = 255, updatable = false)
    private String eventKey;

    @Column(name = "demand_id", updatable = false)
    private UUID demandId;

    @Column(name = "service_response_id", updatable = false)
    private UUID serviceResponseId;

    @Column(name = "publication_event_id", updatable = false)
    private UUID publicationEventId;

    @Column(name = "feedback_id", updatable = false)
    private UUID feedbackId;

    @Column(name = "moderation_case_id", updatable = false)
    private UUID moderationCaseId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "read_at")
    private OffsetDateTime readAt;
}
