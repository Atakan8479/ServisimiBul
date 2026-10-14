package com.servisimibul.backend.operatorschool.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.UUID;

public final class OperatorSchoolDtos {

    private OperatorSchoolDtos() {
    }

    public record CreateRequest(@NotNull UUID schoolId, Boolean active) {

        public boolean activeOrDefault() {
            return active == null || active;
        }
    }

    public record PatchRequest(@NotNull Boolean active) {
    }

    public record CoverageReplaceRequest(
            @NotNull List<@NotNull @Positive Long> neighborhoodIds
    ) {
        public CoverageReplaceRequest {
            if (neighborhoodIds != null) {
                neighborhoodIds = List.copyOf(neighborhoodIds);
            }
        }
    }

    public record CoverageResponse(
            Long neighborhoodId,
            String neighborhoodName,
            Long districtId,
            String districtName,
            Long provinceId,
            String provinceCode,
            String provinceName
    ) {
    }

    public record OperatorSchoolResponse(
            UUID id,
            UUID schoolId,
            String schoolName,
            Long schoolNeighborhoodId,
            Long schoolDistrictId,
            Long schoolProvinceId,
            String schoolProvinceCode,
            String schoolProvinceName,
            boolean active,
            @Valid List<CoverageResponse> coverage
    ) {
        public OperatorSchoolResponse {
            coverage = List.copyOf(coverage);
        }
    }
}
