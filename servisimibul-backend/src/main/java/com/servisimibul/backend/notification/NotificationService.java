package com.servisimibul.backend.notification;

import com.servisimibul.backend.notification.NotificationDtos.NotificationResponse;
import com.servisimibul.backend.notification.NotificationDtos.PageResponse;
import com.servisimibul.backend.notification.NotificationDtos.UnreadCountResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_PAGE_SIZE = 50;

    private final InAppNotificationRepository repository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> list(UUID recipientId, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid notification page");
        }
        Page<InAppNotification> notifications = repository
                .findByRecipientUserIdOrderByCreatedAtDescIdDesc(
                        recipientId,
                        PageRequest.of(page, size)
                );
        return new PageResponse<>(
                notifications.getContent().stream().map(this::response).toList(),
                notifications.getNumber(),
                notifications.getSize(),
                notifications.getTotalElements(),
                notifications.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse unreadCount(UUID recipientId) {
        return new UnreadCountResponse(repository.countByRecipientUserIdAndReadAtIsNull(recipientId));
    }

    @Transactional
    public NotificationResponse markRead(UUID id, UUID recipientId) {
        InAppNotification notification = repository.findByIdAndRecipientUserId(id, recipientId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Notification was not found"
                ));
        if (notification.getReadAt() == null) {
            repository.markRead(
                    id,
                    recipientId,
                    OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC)
            );
            notification = repository.findByIdAndRecipientUserId(id, recipientId).orElseThrow();
        }
        return response(notification);
    }

    private NotificationResponse response(InAppNotification notification) {
        NotificationCopy copy = copy(notification.getType());
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getDemandId(),
                notification.getServiceResponseId(),
                notification.getPublicationEventId(),
                notification.getFeedbackId(),
                notification.getModerationCaseId(),
                copy.title(),
                copy.message(),
                href(notification),
                notification.getCreatedAt(),
                notification.getReadAt()
        );
    }

    private NotificationCopy copy(NotificationType type) {
        return switch (type) {
            case DEMAND_CREATED -> new NotificationCopy(
                    "Yeni servis talebi",
                    "Hizmet verdiğiniz okulun mevcut kapsama alanında yeni bir talep oluşturuldu."
            );
            case SERVICE_PUBLISHED -> new NotificationCopy(
                    "Servis uygunluğu bildirildi",
                    "Bir işletmeci servis uygunluğu bildirdi. Bu beyan platform tarafından doğrulanmamıştır."
            );
            case FEEDBACK_REMINDER -> new NotificationCopy(
                    "Geri bildiriminizi bekliyoruz",
                    "İşletmecinin uygunluk beyanı için geri bildirim süreniz devam ediyor."
            );
            case SUPPORT_EXPIRED -> new NotificationCopy(
                    "Destek süresi sona erdi",
                    "Yanıtlanmayan servis uygunluğu bildirimi için desteğiniz pasif duruma alındı."
            );
            case SERVICE_WITHDRAWN -> new NotificationCopy(
                    "Servis uygunluğu geri çekildi",
                    "İşletmeci servis uygunluğu bildirimini geri çekti; talep desteğiniz yeniden etkinleştirildi."
            );
            case CONTENT_REPORTED -> new NotificationCopy(
                    "Yeni içerik bildirimi",
                    "İnceleme kuyruğuna yeni bir kullanıcı bildirimi eklendi."
            );
        };
    }

    private String href(InAppNotification notification) {
        return switch (notification.getType()) {
            case CONTENT_REPORTED -> "/admin/moderation?caseId=" + notification.getModerationCaseId();
            case SERVICE_PUBLISHED, FEEDBACK_REMINDER ->
                    "/demands/" + notification.getDemandId() + "?feedback=" + notification.getPublicationEventId();
            case DEMAND_CREATED, SUPPORT_EXPIRED, SERVICE_WITHDRAWN ->
                    "/demands/" + notification.getDemandId();
        };
    }

    private record NotificationCopy(String title, String message) {
    }
}
