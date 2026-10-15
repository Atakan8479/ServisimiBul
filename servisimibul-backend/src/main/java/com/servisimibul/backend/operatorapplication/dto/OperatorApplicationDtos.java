package com.servisimibul.backend.operatorapplication.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.ReviewDecision;
import jakarta.validation.constraints.NotBlank;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class OperatorApplicationDtos {

    private OperatorApplicationDtos() {
    }

    public static final class ProfilePatchRequest {

        private boolean businessNamePresent;
        private String businessName;
        private boolean contactPhonePresent;
        private String contactPhone;
        private boolean descriptionPresent;
        private String description;
        private boolean publiclyVisiblePresent;
        private Boolean publiclyVisible;

        @JsonSetter("businessName")
        public void setBusinessName(String businessName) {
            businessNamePresent = true;
            this.businessName = businessName;
        }

        @JsonSetter("contactPhone")
        public void setContactPhone(String contactPhone) {
            contactPhonePresent = true;
            this.contactPhone = contactPhone;
        }

        @JsonSetter("description")
        public void setDescription(String description) {
            descriptionPresent = true;
            this.description = description;
        }

        @JsonSetter("publiclyVisible")
        public void setPubliclyVisible(Boolean publiclyVisible) {
            publiclyVisiblePresent = true;
            this.publiclyVisible = publiclyVisible;
        }

        public boolean hasBusinessName() {
            return businessNamePresent;
        }

        public String businessName() {
            return businessName;
        }

        public boolean hasContactPhone() {
            return contactPhonePresent;
        }

        public String contactPhone() {
            return contactPhone;
        }

        public boolean hasDescription() {
            return descriptionPresent;
        }

        public String description() {
            return description;
        }

        public boolean hasPubliclyVisible() {
            return publiclyVisiblePresent;
        }

        public Boolean publiclyVisible() {
            return publiclyVisible;
        }

        public boolean hasAnyField() {
            return businessNamePresent
                    || contactPhonePresent
                    || descriptionPresent
                    || publiclyVisiblePresent;
        }
    }

    public record RevisionRequest(@NotBlank String reason) {
    }

    public record ProfileResponse(
            UUID id,
            String businessName,
            String contactPhone,
            String description,
            OperatorApprovalStatus approvalStatus,
            boolean active,
            boolean publiclyVisible,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
    }

    public record ReviewResponse(
            UUID id,
            UUID reviewedById,
            ReviewDecision decision,
            String reason,
            OffsetDateTime reviewedAt
    ) {
    }

    public record ApplicationDetailResponse(
            ProfileResponse profile,
            List<ReviewResponse> reviewHistory
    ) {
        public ApplicationDetailResponse {
            reviewHistory = List.copyOf(reviewHistory);
        }
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
