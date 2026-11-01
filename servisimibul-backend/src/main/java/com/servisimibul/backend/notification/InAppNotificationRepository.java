package com.servisimibul.backend.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface InAppNotificationRepository extends JpaRepository<InAppNotification, UUID> {

    Page<InAppNotification> findByRecipientUserIdOrderByCreatedAtDescIdDesc(
            UUID recipientUserId,
            Pageable pageable
    );

    long countByRecipientUserIdAndReadAtIsNull(UUID recipientUserId);

    long countByRecipientUserIdAndType(UUID recipientUserId, NotificationType type);

    Optional<InAppNotification> findByIdAndRecipientUserId(UUID id, UUID recipientUserId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update InAppNotification notification
            set notification.readAt = :readAt
            where notification.id = :id
              and notification.recipientUserId = :recipientUserId
              and notification.readAt is null
            """)
    int markRead(
            @Param("id") UUID id,
            @Param("recipientUserId") UUID recipientUserId,
            @Param("readAt") OffsetDateTime readAt
    );

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update InAppNotification notification
            set notification.readAt = case
                when notification.createdAt > :readAt then notification.createdAt
                else :readAt
            end
            where notification.recipientUserId = :recipientUserId
              and notification.readAt is null
            """)
    int markAllRead(
            @Param("recipientUserId") UUID recipientUserId,
            @Param("readAt") OffsetDateTime readAt
    );
}
