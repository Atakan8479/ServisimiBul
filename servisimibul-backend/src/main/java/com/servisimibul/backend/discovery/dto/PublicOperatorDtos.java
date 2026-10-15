package com.servisimibul.backend.discovery.dto;

import java.util.List;
import java.util.UUID;

public final class PublicOperatorDtos {

    private PublicOperatorDtos() {
    }

    public record MatchingSchoolResponse(UUID id, String name) {
    }

    public record PublishedOfferingResponse(
            UUID offeringId,
            Integer availableSeats,
            int vehicleCapacity,
            String description
    ) {
    }

    public record OperatorResponse(
            UUID operatorId,
            String businessName,
            String contactPhone,
            String description,
            MatchingSchoolResponse matchingSchool,
            List<PublishedOfferingResponse> publishedOfferings
    ) {
        public OperatorResponse {
            publishedOfferings = List.copyOf(publishedOfferings);
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
