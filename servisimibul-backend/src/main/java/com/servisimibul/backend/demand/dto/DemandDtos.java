package com.servisimibul.backend.demand.dto;

import com.servisimibul.backend.demand.DemandStatus;
import com.servisimibul.backend.demand.DemandSupportStatus;
import com.servisimibul.backend.demand.SupportReason;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class DemandDtos {

    private DemandDtos() {
    }

    public record CreateRequest(
            @NotNull UUID schoolId,
            @NotNull Long neighborhoodId,
            @NotNull Boolean needsMorning,
            @NotNull Boolean needsAfternoon,
            @NotNull List<@NotNull SupportReason> reasons,
            String academicYear
    ) {
        public CreateRequest {
            if (reasons != null) {
                reasons = List.copyOf(reasons);
            }
        }
    }

    public record SupportRequest(
            @NotNull Boolean needsMorning,
            @NotNull Boolean needsAfternoon,
            @NotNull List<@NotNull SupportReason> reasons
    ) {
        public SupportRequest {
            if (reasons != null) {
                reasons = List.copyOf(reasons);
            }
        }
    }

    public record SchoolSummary(UUID id, String name) {
    }

    public record NeighborhoodSummary(
            Long id,
            String name,
            Long districtId,
            String districtName,
            Long provinceId,
            String provinceCode,
            String provinceName
    ) {
    }

    public record ReasonCount(SupportReason reason, long count) {
    }

    public record SupportResponse(
            UUID id,
            DemandSupportStatus status,
            boolean needsMorning,
            boolean needsAfternoon,
            List<SupportReason> reasons
    ) {
        public SupportResponse {
            reasons = List.copyOf(reasons);
        }
    }

    public record DemandResponse(
            UUID id,
            DemandStatus status,
            String academicYear,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            SchoolSummary school,
            NeighborhoodSummary neighborhood,
            long supporterCount,
            long morningCount,
            long afternoonCount,
            List<ReasonCount> reasonCounts,
            SupportResponse currentUserSupport
    ) {
        public DemandResponse {
            reasonCounts = List.copyOf(reasonCounts);
        }
    }

    public record CreateResponse(boolean created, DemandResponse demand) {
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
