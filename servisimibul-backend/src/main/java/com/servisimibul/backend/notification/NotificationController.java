package com.servisimibul.backend.notification;

import com.servisimibul.backend.notification.NotificationDtos.NotificationResponse;
import com.servisimibul.backend.notification.NotificationDtos.PageResponse;
import com.servisimibul.backend.notification.NotificationDtos.UnreadCountResponse;
import com.servisimibul.backend.notification.NotificationPreferenceService.PreferenceResponse;
import com.servisimibul.backend.notification.NotificationPreferenceService.PreferenceUpdateRequest;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;
    private final NotificationPreferenceService preferenceService;
    private final CurrentUser currentUser;

    @GetMapping
    public PageResponse<NotificationResponse> list(
            @RequestParam(defaultValue = "ALL") String readState,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return service.list(
                currentUser.id(),
                NotificationReadState.parse(readState),
                page,
                size
        );
    }

    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount() {
        return service.unreadCount(currentUser.id());
    }

    @PutMapping("/read-all")
    public UnreadCountResponse markAllRead() {
        return service.markAllRead(currentUser.id());
    }

    @PutMapping("/{id}/read")
    public NotificationResponse markRead(@PathVariable UUID id) {
        return service.markRead(id, currentUser.id());
    }

    @GetMapping("/preferences")
    public List<PreferenceResponse> preferences(@AuthenticationPrincipal AuthenticatedUser user) {
        return preferenceService.list(user.id(), user.role());
    }

    @PutMapping("/preferences/{type}")
    public PreferenceResponse updatePreference(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String type,
            @Valid @RequestBody PreferenceUpdateRequest request
    ) {
        return preferenceService.update(user.id(), user.role(), type, request.enabled());
    }
}
