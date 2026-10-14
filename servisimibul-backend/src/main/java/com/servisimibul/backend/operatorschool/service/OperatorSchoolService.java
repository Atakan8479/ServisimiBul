package com.servisimibul.backend.operatorschool.service;

import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.CoverageReplaceRequest;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.CoverageResponse;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.CreateRequest;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.OperatorSchoolResponse;
import com.servisimibul.backend.operatorschool.dto.OperatorSchoolDtos.PatchRequest;
import com.servisimibul.backend.operatorschool.exception.OperatorSchoolApiException;
import com.servisimibul.backend.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OperatorSchoolService {

    private final CurrentUser currentUser;
    private final OperatorProfileRepository operatorProfileRepository;
    private final SchoolRepository schoolRepository;
    private final NeighborhoodRepository neighborhoodRepository;
    private final OperatorSchoolRepository operatorSchoolRepository;
    private final OperatorSchoolCoverageRepository coverageRepository;

    @Transactional(readOnly = true)
    public List<OperatorSchoolResponse> list() {
        OperatorProfile operator = currentOperator();
        List<OperatorSchool> relationships = operatorSchoolRepository
                .findAllDetailedByOperatorId(operator.getId());
        Map<UUID, List<OperatorSchoolCoverage>> coverageByRelationship = new HashMap<>();
        coverageRepository.findAllDetailedByOperatorId(operator.getId()).forEach(coverage ->
                coverageByRelationship.computeIfAbsent(
                        coverage.getOperatorSchool().getId(),
                        ignored -> new ArrayList<>()
                ).add(coverage)
        );
        return relationships.stream()
                .map(relationship -> toResponse(
                        relationship,
                        coverageByRelationship.getOrDefault(relationship.getId(), List.of())
                ))
                .toList();
    }

    @Transactional
    public OperatorSchoolResponse create(CreateRequest request) {
        OperatorProfile operator = currentOperator();
        School school = detailedSchool(request.schoolId());
        if (!school.isActive()) {
            throw OperatorSchoolApiException.conflict(
                    "school_inactive",
                    "Only an active school can be attached"
            );
        }
        if (operatorSchoolRepository.existsByOperatorIdAndSchoolId(operator.getId(), school.getId())) {
            throw OperatorSchoolApiException.conflict(
                    "operator_school_duplicate",
                    "The operator is already attached to this school"
            );
        }

        OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(operator, school, request.activeOrDefault())
        );
        return toResponse(relationship, List.of());
    }

    @Transactional
    public OperatorSchoolResponse patch(UUID id, PatchRequest request) {
        OperatorSchool relationship = ownedForUpdate(id);
        if (request.active() && !relationship.getSchool().isActive()) {
            throw OperatorSchoolApiException.conflict(
                    "school_inactive",
                    "An operator-school relationship cannot be activated for an inactive school"
            );
        }
        relationship.setActive(request.active());
        operatorSchoolRepository.flush();
        return toResponse(
                relationship,
                coverageRepository.findAllDetailedByOperatorSchoolId(relationship.getId())
        );
    }

    @Transactional
    public void delete(UUID id) {
        OperatorSchool relationship = ownedForUpdate(id);
        coverageRepository.deleteAllByOperatorSchoolIdAndClear(relationship.getId());
        operatorSchoolRepository.delete(relationship);
        operatorSchoolRepository.flush();
    }

    @Transactional
    public OperatorSchoolResponse replaceCoverage(UUID id, CoverageReplaceRequest request) {
        OperatorSchool relationship = ownedForUpdate(id);
        List<Long> requestedIds = request.neighborhoodIds();
        Set<Long> distinctIds = new HashSet<>(requestedIds);
        if (distinctIds.size() != requestedIds.size()) {
            throw OperatorSchoolApiException.conflict(
                    "coverage_duplicate",
                    "Coverage cannot contain the same neighborhood more than once"
            );
        }

        List<Neighborhood> neighborhoods = distinctIds.isEmpty()
                ? List.of()
                : neighborhoodRepository.findAllById(distinctIds);
        if (neighborhoods.size() != distinctIds.size()) {
            throw OperatorSchoolApiException.notFound(
                    "neighborhood_not_found",
                    "One or more coverage neighborhoods were not found"
            );
        }

        Long schoolProvinceId = relationship.getSchool()
                .getNeighborhood()
                .getDistrict()
                .getProvince()
                .getId();
        boolean crossesProvince = neighborhoods.stream().anyMatch(neighborhood ->
                !schoolProvinceId.equals(neighborhood.getDistrict().getProvince().getId())
        );
        if (crossesProvince) {
            throw OperatorSchoolApiException.validation(
                    "coverage_province_mismatch",
                    "neighborhoodIds",
                    "must contain only neighborhoods in the school's province"
            );
        }

        coverageRepository.deleteAllByOperatorSchoolId(relationship.getId());
        List<OperatorSchoolCoverage> replacements = neighborhoods.stream()
                .map(neighborhood -> new OperatorSchoolCoverage(relationship, neighborhood))
                .toList();
        coverageRepository.saveAllAndFlush(replacements);
        return toResponse(
                relationship,
                coverageRepository.findAllDetailedByOperatorSchoolId(relationship.getId())
        );
    }

    private OperatorProfile currentOperator() {
        return operatorProfileRepository.findByUserId(currentUser.id())
                .orElseThrow(() -> OperatorSchoolApiException.notFound(
                        "operator_profile_not_found",
                        "Operator profile was not found"
                ));
    }

    private School detailedSchool(UUID id) {
        return schoolRepository.findDetailedById(id)
                .orElseThrow(() -> OperatorSchoolApiException.notFound(
                        "school_not_found",
                        "School was not found"
                ));
    }

    private OperatorSchool ownedForUpdate(UUID id) {
        OperatorProfile operator = currentOperator();
        return operatorSchoolRepository.findOwnedForUpdate(id, operator.getId())
                .orElseThrow(() -> OperatorSchoolApiException.notFound(
                        "operator_school_not_found",
                        "Operator school relationship was not found"
                ));
    }

    private OperatorSchoolResponse toResponse(
            OperatorSchool relationship,
            List<OperatorSchoolCoverage> coverage
    ) {
        School school = relationship.getSchool();
        Neighborhood schoolNeighborhood = school.getNeighborhood();
        District schoolDistrict = schoolNeighborhood.getDistrict();
        Province schoolProvince = schoolDistrict.getProvince();
        return new OperatorSchoolResponse(
                relationship.getId(),
                school.getId(),
                school.getName(),
                schoolNeighborhood.getId(),
                schoolDistrict.getId(),
                schoolProvince.getId(),
                schoolProvince.getCode(),
                schoolProvince.getName(),
                relationship.isActive(),
                coverage.stream().map(this::toCoverageResponse).toList()
        );
    }

    private CoverageResponse toCoverageResponse(OperatorSchoolCoverage coverage) {
        Neighborhood neighborhood = coverage.getNeighborhood();
        District district = neighborhood.getDistrict();
        Province province = district.getProvince();
        return new CoverageResponse(
                neighborhood.getId(),
                neighborhood.getName(),
                district.getId(),
                district.getName(),
                province.getId(),
                province.getCode(),
                province.getName()
        );
    }
}
