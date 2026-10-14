package com.servisimibul.backend.geography.dto;

import java.util.List;
import java.util.UUID;

public final class GeographyDtos {

    private GeographyDtos() {
    }

    public record ProvinceResponse(Long id, String code, String name) {
    }

    public record DistrictResponse(Long id, Long provinceId, String name) {
    }

    public record NeighborhoodResponse(Long id, Long districtId, String name) {
    }

    public record SchoolResponse(
            UUID id,
            Long neighborhoodId,
            String neighborhoodName,
            Long districtId,
            String districtName,
            Long provinceId,
            String provinceCode,
            String provinceName,
            String name,
            String address,
            String sourceName,
            String sourceCode,
            boolean active
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
