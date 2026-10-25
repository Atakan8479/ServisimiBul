package com.servisimibul.backend.notification;

import com.servisimibul.backend.notification.NotificationDtos.NotificationResponse;
import com.servisimibul.backend.notification.NotificationDtos.PageResponse;
import com.servisimibul.backend.notification.NotificationDtos.UnreadCountResponse;
import com.servisimibul.backend.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;
    private final CurrentUser currentUser;

    @GetMapping
    public PageResponse<NotificationResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return service.list(currentUser.id(), page, size);
    }

    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount() {
        return service.unreadCount(currentUser.id());
    }

    @PutMapping("/{id}/read")
    public NotificationResponse markRead(@PathVariable UUID id) {
        return service.markRead(id, currentUser.id());
    }
}
