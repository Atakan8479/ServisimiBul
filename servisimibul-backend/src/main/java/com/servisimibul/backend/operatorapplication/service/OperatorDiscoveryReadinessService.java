package com.servisimibul.backend.operatorapplication.service;

import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.DiscoveryReadinessResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.SchoolReadinessResponse;
import com.servisimibul.backend.operatorapplication.exception.OperatorApplicationApiException;
import com.servisimibul.backend.operatorapproval.OperatorApprovalPolicy;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OperatorDiscoveryReadinessService {

    private final CurrentUser currentUser;
    private final OperatorProfileRepository profileRepository;
    private final OperatorSchoolRepository operatorSchoolRepository;
    private final OperatorSchoolCoverageRepository coverageRepository;
    private final OperatorApprovalPolicy approvalPolicy;

    @Transactional(readOnly = true)
    public DiscoveryReadinessResponse readiness() {
        OperatorProfile profile = profileRepository.findByUserId(currentUser.id())
                .orElseThrow(() -> OperatorApplicationApiException.notFound(
                        "operator_profile_not_found",
                        "Operator profile was not found"
                ));
        List<OperatorSchool> relationships = operatorSchoolRepository
                .findAllDetailedByOperatorId(profile.getId());
        Map<UUID, Integer> validCoverageCounts = validCoverageCounts(profile.getId());
        List<SchoolReadinessResponse> schools = relationships.stream()
                .map(relationship -> toSchoolReadiness(
                        relationship,
                        validCoverageCounts.getOrDefault(relationship.getId(), 0)
                ))
                .toList();

        boolean emailVerified = profile.getUser().isEmailVerified();
        boolean accountEnabled = profile.getUser().isEnabled();
        boolean profileActive = profile.isActive();
        boolean publiclyVisible = profile.isPubliclyVisible();
        boolean approvalRequired = approvalPolicy.isRequired();
        boolean approvalSatisfied = approvalPolicy.allowsPublicDiscovery(
                profile.getApprovalStatus()
        );
        boolean hasActiveSchoolRelationship = schools.stream().anyMatch(school ->
                school.relationshipActive() && school.schoolActive()
        );
        boolean hasEligibleSchoolCoverage = schools.stream()
                .anyMatch(SchoolReadinessResponse::contributesToDiscovery);
        boolean discoveryEligible = profile.getUser().getRole() == UserRole.OPERATOR
                && emailVerified
                && accountEnabled
                && profileActive
                && publiclyVisible
                && approvalSatisfied
                && hasEligibleSchoolCoverage;

        return new DiscoveryReadinessResponse(
                discoveryEligible,
                emailVerified,
                accountEnabled,
                profileActive,
                publiclyVisible,
                approvalRequired,
                approvalSatisfied,
                hasActiveSchoolRelationship,
                hasEligibleSchoolCoverage,
                schools
        );
    }

    private Map<UUID, Integer> validCoverageCounts(UUID operatorId) {
        Map<UUID, Integer> counts = new HashMap<>();
        coverageRepository.findAllDetailedByOperatorId(operatorId).stream()
                .filter(this::matchesSchoolProvince)
                .forEach(coverage -> counts.merge(
                        coverage.getOperatorSchool().getId(),
                        1,
                        Integer::sum
                ));
        return counts;
    }

    private boolean matchesSchoolProvince(OperatorSchoolCoverage coverage) {
        Long schoolProvinceId = coverage.getOperatorSchool()
                .getSchool()
                .getNeighborhood()
                .getDistrict()
                .getProvince()
                .getId();
        Long coverageProvinceId = coverage.getNeighborhood()
                .getDistrict()
                .getProvince()
                .getId();
        return schoolProvinceId.equals(coverageProvinceId);
    }

    private SchoolReadinessResponse toSchoolReadiness(
            OperatorSchool relationship,
            int validCoverageCount
    ) {
        boolean contributes = relationship.isActive()
                && relationship.getSchool().isActive()
                && validCoverageCount > 0;
        return new SchoolReadinessResponse(
                relationship.getId(),
                relationship.getSchool().getId(),
                relationship.getSchool().getName(),
                relationship.isActive(),
                relationship.getSchool().isActive(),
                validCoverageCount,
                contributes
        );
    }
}
