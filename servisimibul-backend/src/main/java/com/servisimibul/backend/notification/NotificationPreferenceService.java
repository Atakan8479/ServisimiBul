package com.servisimibul.backend.notification;

import com.servisimibul.backend.identity.UserRole;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Only types listed here are user-controllable. Every other type is essential
 * (security, transactional, moderation) and is always delivered.
 */
@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    static final Map<UserRole, List<NotificationType>> OPTIONAL_TYPES = Map.of(
            UserRole.OPERATOR, List.of(NotificationType.DEMAND_CREATED)
    );

    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<PreferenceResponse> list(UUID userId, UserRole role) {
        List<NotificationType> optional = OPTIONAL_TYPES.getOrDefault(role, List.of());
        if (optional.isEmpty()) {
            return List.of();
        }
        Set<String> disabled = Set.copyOf(jdbc.queryForList(
                "SELECT type FROM notification_preference WHERE user_id = :userId AND NOT enabled",
                new MapSqlParameterSource("userId", userId),
                String.class
        ));
        return optional.stream()
                .map(type -> new PreferenceResponse(type, !disabled.contains(type.name())))
                .toList();
    }

    @Transactional
    public PreferenceResponse update(UUID userId, UserRole role, String rawType, boolean enabled) {
        NotificationType type = OPTIONAL_TYPES.getOrDefault(role, List.of()).stream()
                .filter(candidate -> candidate.name().equals(rawType))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Notification preference was not found"
                ));
        jdbc.update("""
                INSERT INTO notification_preference (user_id, type, enabled, updated_at)
                VALUES (:userId, :type, :enabled, :updatedAt)
                ON CONFLICT (user_id, type)
                DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at
                """, new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("type", type.name())
                .addValue("enabled", enabled)
                .addValue("updatedAt", OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC)));
        return new PreferenceResponse(type, enabled);
    }

    public record PreferenceResponse(NotificationType type, boolean enabled) {
    }

    public record PreferenceUpdateRequest(@NotNull Boolean enabled) {
    }
}
