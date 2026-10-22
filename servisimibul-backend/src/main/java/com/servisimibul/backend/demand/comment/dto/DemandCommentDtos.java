package com.servisimibul.backend.demand.comment.dto;

import com.servisimibul.backend.identity.UserRole;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class DemandCommentDtos {

    private DemandCommentDtos() {
    }

    public record CreateRequest(@NotNull String body) {
    }

    public record AuthorResponse(
            UserRole role,
            String displayName,
            UUID operatorProfileId
    ) {
    }

    public record CommentResponse(
            UUID id,
            String body,
            AuthorResponse author,
            boolean canDelete,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
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
