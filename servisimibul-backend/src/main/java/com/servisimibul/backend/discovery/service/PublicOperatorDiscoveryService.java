package com.servisimibul.backend.discovery.service;

import com.servisimibul.backend.discovery.PublicOperatorDiscoveryRepository;
import com.servisimibul.backend.discovery.PublicOperatorDiscoveryRepository.PublishedOfferingProjection;
import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.MatchingSchoolResponse;
import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.OperatorResponse;
import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.PageResponse;
import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.PublishedOfferingResponse;
import com.servisimibul.backend.discovery.exception.PublicOperatorDiscoveryApiException;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorapproval.OperatorApprovalPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PublicOperatorDiscoveryService {

    private static final int MAX_PAGE_SIZE = 50;

    private final PublicOperatorDiscoveryRepository discoveryRepository;
    private final SchoolRepository schoolRepository;
    private final NeighborhoodRepository neighborhoodRepository;
    private final OperatorApprovalPolicy approvalPolicy;

    @Transactional(readOnly = true)
    public PageResponse<OperatorResponse> search(
            UUID schoolId,
            Long neighborhoodId,
            int page,
            int size
    ) {
        validatePage(page, size);
        requirePositive(neighborhoodId, "neighborhoodId");
        School school = schoolRepository.findByIdAndActiveTrue(schoolId)
                .orElseThrow(() -> PublicOperatorDiscoveryApiException.notFound(
                        "school_not_found",
                        "Active school was not found"
                ));
        Neighborhood neighborhood = neighborhoodRepository.findDetailedById(neighborhoodId)
                .orElseThrow(() -> PublicOperatorDiscoveryApiException.notFound(
                        "neighborhood_not_found",
                        "Neighborhood was not found"
                ));
        if (!school.getNeighborhood().getDistrict().getProvince().getId().equals(
                neighborhood.getDistrict().getProvince().getId()
        )) {
            return emptyPage(page, size);
        }

        Page<OperatorProfile> operators = discoveryRepository.findPublishedOperators(
                school.getId(),
                neighborhoodId,
                UserRole.OPERATOR,
                OperatorApprovalStatus.APPROVED,
                approvalPolicy.isRequired(),
                PageRequest.of(page, size)
        );
        MatchingSchoolResponse matchingSchool = new MatchingSchoolResponse(
                school.getId(),
                school.getName()
        );
        Map<UUID, List<PublishedOfferingResponse>> offeringsByOperator = offeringsByOperator(
                operators.getContent(),
                school.getId(),
                neighborhoodId
        );
        return new PageResponse<>(
                operators.getContent().stream()
                        .map(operator -> toResponse(
                                operator,
                                matchingSchool,
                                offeringsByOperator.getOrDefault(operator.getId(), List.of())
                        ))
                        .toList(),
                operators.getNumber(),
                operators.getSize(),
                operators.getTotalElements(),
                operators.getTotalPages()
        );
    }

    private PageResponse<OperatorResponse> emptyPage(int page, int size) {
        return new PageResponse<>(List.of(), page, size, 0, 0);
    }

    private OperatorResponse toResponse(
            OperatorProfile operator,
            MatchingSchoolResponse matchingSchool,
            List<PublishedOfferingResponse> publishedOfferings
    ) {
        return new OperatorResponse(
                operator.getId(),
                operator.getBusinessName(),
                operator.getContactPhone(),
                operator.getDescription(),
                matchingSchool,
                publishedOfferings
        );
    }

    private Map<UUID, List<PublishedOfferingResponse>> offeringsByOperator(
            List<OperatorProfile> operators,
            UUID schoolId,
            Long neighborhoodId
    ) {
        if (operators.isEmpty()) {
            return Map.of();
        }
        List<PublishedOfferingProjection> matches = discoveryRepository
                .findMatchingPublishedOfferings(
                        operators.stream().map(OperatorProfile::getId).toList(),
                        schoolId,
                        neighborhoodId
                );
        Map<UUID, List<PublishedOfferingResponse>> offeringsByOperator = new HashMap<>();
        matches.forEach(match -> offeringsByOperator.computeIfAbsent(
                match.getOperatorId(),
                ignored -> new ArrayList<>()
        ).add(new PublishedOfferingResponse(
                match.getOfferingId(),
                match.getAvailableSeats(),
                match.getVehicleCapacity(),
                match.getDescription()
        )));
        return offeringsByOperator;
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw PublicOperatorDiscoveryApiException.validation(
                    "page",
                    "must be zero or greater"
            );
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw PublicOperatorDiscoveryApiException.validation(
                    "size",
                    "must be between 1 and 50"
            );
        }
    }

    private void requirePositive(Long value, String field) {
        if (value == null || value < 1) {
            throw PublicOperatorDiscoveryApiException.validation(
                    field,
                    "must be a positive number"
            );
        }
    }
}
