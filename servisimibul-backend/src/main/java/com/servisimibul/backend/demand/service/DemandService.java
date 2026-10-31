package com.servisimibul.backend.demand.service;

import com.servisimibul.backend.auth.config.ParentEmailVerificationProperties;
import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandRepository.DemandReasonCount;
import com.servisimibul.backend.demand.DemandRepository.DemandSummary;
import com.servisimibul.backend.demand.DemandSupport;
import com.servisimibul.backend.demand.DemandSupportRepository;
import com.servisimibul.backend.demand.SupportReason;
import com.servisimibul.backend.demand.config.DemandProperties;
import com.servisimibul.backend.demand.dto.DemandDtos.CreateRequest;
import com.servisimibul.backend.demand.dto.DemandDtos.CreateResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.DemandResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.NeighborhoodSummary;
import com.servisimibul.backend.demand.dto.DemandDtos.PageResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.ReasonCount;
import com.servisimibul.backend.demand.dto.DemandDtos.SchoolSummary;
import com.servisimibul.backend.demand.dto.DemandDtos.SupportRequest;
import com.servisimibul.backend.demand.dto.DemandDtos.SupportResponse;
import com.servisimibul.backend.demand.exception.DemandApiException;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.notification.NotificationDeliveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DemandService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final Pattern ACADEMIC_YEAR = Pattern.compile("[0-9]{4}-[0-9]{4}");

    private final DemandRepository demandRepository;
    private final DemandSupportRepository supportRepository;
    private final SchoolRepository schoolRepository;
    private final NeighborhoodRepository neighborhoodRepository;
    private final AppUserRepository userRepository;
    private final DemandProperties properties;
    private final ParentEmailVerificationProperties parentEmailVerification;
    private final DemandFeedbackService feedbackService;
    private final NotificationDeliveryService notificationDelivery;

    @Transactional(readOnly = true)
    public PageResponse<DemandResponse> list(
            UUID schoolId,
            Long neighborhoodId,
            String academicYear,
            String sort,
            int page,
            int size,
            UUID currentParentId
    ) {
        validatePage(page, size);
        requirePositiveIfPresent(neighborhoodId, "neighborhoodId");
        String selectedYear = academicYear == null || academicYear.isBlank()
                ? properties.academicYear()
                : validateAcademicYear(academicYear.strip());
        boolean mostSupported = switch (sort) {
            case "newest" -> false;
            case "most-supported" -> true;
            default -> throw DemandApiException.validation(
                    "sort",
                    "must be one of newest or most-supported"
            );
        };

        Page<DemandSummary> summaries = demandRepository.findOpenDemandSummaries(
                schoolId,
                neighborhoodId,
                selectedYear,
                mostSupported,
                parentEmailVerification.required(),
                PageRequest.of(page, size)
        );
        List<UUID> ids = summaries.getContent().stream().map(DemandSummary::getId).toList();
        Map<UUID, Map<SupportReason, Long>> reasonCounts = reasonCounts(ids);
        Map<UUID, DemandSupport> ownedSupports = ownedSupports(ids, currentParentId);
        List<DemandResponse> content = summaries.getContent().stream()
                .map(summary -> toResponse(
                        summary,
                        reasonCounts.get(summary.getId()),
                        ownedSupports.get(summary.getId())
                ))
                .toList();
        return new PageResponse<>(
                content,
                summaries.getNumber(),
                summaries.getSize(),
                summaries.getTotalElements(),
                summaries.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public DemandResponse get(UUID id, UUID currentParentId) {
        return response(id, currentParentId);
    }

    @Transactional
    public CreateResponse create(CreateRequest request, UUID parentId) {
        // The server remains the source of truth for the writable academic year.
        // A frontend filter for a historical/future year must never silently create
        // a demand in the configured current year.
        if (request.academicYear() != null && !request.academicYear().isBlank()
                && !properties.academicYear().equals(validateAcademicYear(request.academicYear().strip()))) {
            throw DemandApiException.validation(
                    "academicYear",
                    "demand creation is only available for the current academic year"
            );
        }
        SupportValues values = validateSupport(
                request.needsMorning(),
                request.needsAfternoon(),
                request.reasons()
        );
        School school = schoolRepository.findDetailedForUpdateById(request.schoolId())
                .orElseThrow(() -> DemandApiException.notFound(
                        "school_not_found",
                        "School was not found"
                ));
        if (!school.isActive()) {
            throw DemandApiException.conflict("school_inactive", "School is not active");
        }
        Neighborhood neighborhood = neighborhoodRepository.findDetailedById(request.neighborhoodId())
                .orElseThrow(() -> DemandApiException.notFound(
                        "neighborhood_not_found",
                        "Neighborhood was not found"
                ));
        if (!school.getNeighborhood().getDistrict().getProvince().getId()
                .equals(neighborhood.getDistrict().getProvince().getId())) {
            throw DemandApiException.validation(
                    "neighborhoodId",
                    "must belong to the same province as the school"
            );
        }

        String academicYear = properties.academicYear();
        Demand existing = demandRepository.findBySchoolIdAndNeighborhoodIdAndAcademicYear(
                school.getId(),
                neighborhood.getId(),
                academicYear
        ).orElse(null);
        if (existing != null) {
            return new CreateResponse(false, response(existing.getId(), parentId));
        }

        AppUser parent = parent(parentId);
        Demand demand = demandRepository.saveAndFlush(
                new Demand(school, neighborhood, academicYear, parent)
        );
        supportRepository.saveAndFlush(new DemandSupport(
                demand,
                parent,
                values.needsMorning(),
                values.needsAfternoon(),
                values.reasons()
        ));
        notificationDelivery.demandCreated(demand);
        return new CreateResponse(true, response(demand.getId(), parentId));
    }

    @Transactional
    public DemandResponse support(UUID demandId, SupportRequest request, UUID parentId) {
        SupportValues values = validateSupport(
                request.needsMorning(),
                request.needsAfternoon(),
                request.reasons()
        );
        Demand demand = demandRepository.findForUpdateById(demandId)
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
        DemandSupport support = supportRepository.findOwnedForUpdate(demandId, parentId).orElse(null);
        if (support == null) {
            if (!demand.isOpen()) {
                requireReopenableByNewParent(demand);
                feedbackService.reopenInactive(demand);
            }
            supportRepository.saveAndFlush(new DemandSupport(
                    demand,
                    parent(parentId),
                    values.needsMorning(),
                    values.needsAfternoon(),
                    values.reasons()
            ));
        } else if (!support.isEligibleForDemand()) {
            if (!demand.isOpen() && demand.getClosureReason()
                    != com.servisimibul.backend.demand.DemandClosureReason.INACTIVE) {
                throw DemandApiException.conflict("demand_not_reopenable", "Demand cannot be reopened");
            }
            support.reactivate(values.needsMorning(), values.needsAfternoon(), values.reasons());
            feedbackService.supportReactivated(demand, support);
            supportRepository.saveAndFlush(support);
        }
        return response(demandId, parentId);
    }

    @Transactional
    public DemandResponse updateSupport(UUID demandId, SupportRequest request, UUID parentId) {
        SupportValues values = validateSupport(
                request.needsMorning(),
                request.needsAfternoon(),
                request.reasons()
        );
        openDemandForUpdate(demandId);
        DemandSupport support = ownedSupport(demandId, parentId);
        if (!support.isEligibleForDemand()) {
            throw DemandApiException.conflict(
                    "support_withdrawn",
                    "Withdrawn support must be reactivated before editing"
            );
        }
        support.replace(values.needsMorning(), values.needsAfternoon(), values.reasons());
        supportRepository.saveAndFlush(support);
        return response(demandId, parentId);
    }

    @Transactional
    public void withdrawSupport(UUID demandId, UUID parentId) {
        openDemandForUpdate(demandId);
        DemandSupport support = ownedSupport(demandId, parentId);
        if (support.isEligibleForDemand()) {
            support.withdraw();
            supportRepository.saveAndFlush(support);
            feedbackService.supportWithdrawn(support);
        }
    }

    private void requireReopenableByNewParent(Demand demand) {
        if (!demand.isClosedInactive()) {
            throw DemandApiException.conflict("demand_not_open", "Demand is not open for support");
        }
        if (!properties.academicYear().equals(demand.getAcademicYear())) {
            throw DemandApiException.conflict(
                    "demand_not_reopenable",
                    "Only a demand from the current academic year can be reopened"
            );
        }
        if (!demand.getSchool().isActive()) {
            throw DemandApiException.conflict("school_inactive", "School is not active");
        }
    }

    private Demand openDemandForUpdate(UUID id) {
        Demand demand = demandRepository.findForUpdateById(id)
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
        if (!demand.isOpen()) {
            throw DemandApiException.conflict("demand_not_open", "Demand is not open for support");
        }
        return demand;
    }

    private DemandSupport ownedSupport(UUID demandId, UUID parentId) {
        return supportRepository.findOwned(demandId, parentId)
                .orElseThrow(() -> DemandApiException.notFound(
                        "support_not_found",
                        "Support was not found"
                ));
    }

    private AppUser parent(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> DemandApiException.notFound(
                        "parent_not_found",
                        "Parent account was not found"
                ));
    }

    private DemandResponse response(UUID id, UUID currentParentId) {
        DemandSummary summary = demandRepository.findSummaryById(
                        id,
                        parentEmailVerification.required()
                )
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
        Map<SupportReason, Long> counts = reasonCounts(List.of(id)).get(id);
        DemandSupport support = currentParentId == null
                ? null
                : supportRepository.findOwned(id, currentParentId).orElse(null);
        return toResponse(summary, counts, support);
    }

    private DemandResponse toResponse(
            DemandSummary summary,
            Map<SupportReason, Long> counts,
            DemandSupport support
    ) {
        Map<SupportReason, Long> safeCounts = counts == null ? Map.of() : counts;
        return new DemandResponse(
                summary.getId(),
                summary.getStatus(),
                summary.getClosureReason(),
                summary.getClosedAt(),
                summary.getAcademicYear(),
                summary.getCreatedAt(),
                summary.getUpdatedAt(),
                new SchoolSummary(summary.getSchoolId(), summary.getSchoolName()),
                new NeighborhoodSummary(
                        summary.getNeighborhoodId(),
                        summary.getNeighborhoodName(),
                        summary.getDistrictId(),
                        summary.getDistrictName(),
                        summary.getProvinceId(),
                        summary.getProvinceCode(),
                        summary.getProvinceName()
                ),
                summary.getSupporterCount(),
                summary.getMorningCount(),
                summary.getAfternoonCount(),
                java.util.Arrays.stream(SupportReason.values())
                        .map(reason -> new ReasonCount(reason, safeCounts.getOrDefault(reason, 0L)))
                        .toList(),
                support == null ? null : new SupportResponse(
                        support.getId(),
                        support.getStatus(),
                        support.isNeedsMorning(),
                        support.isNeedsAfternoon(),
                        support.getReasons().stream().sorted().toList()
                )
        );
    }

    private Map<UUID, Map<SupportReason, Long>> reasonCounts(List<UUID> demandIds) {
        if (demandIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Map<SupportReason, Long>> result = new java.util.HashMap<>();
        for (DemandReasonCount count : demandRepository.countReasons(
                demandIds,
                parentEmailVerification.required()
        )) {
            result.computeIfAbsent(count.getDemandId(), ignored -> new EnumMap<>(SupportReason.class))
                    .put(count.getReason(), count.getTotal());
        }
        return result;
    }

    private Map<UUID, DemandSupport> ownedSupports(List<UUID> demandIds, UUID currentParentId) {
        if (demandIds.isEmpty() || currentParentId == null) {
            return Map.of();
        }
        return supportRepository.findOwnedForDemands(demandIds, currentParentId).stream()
                .collect(Collectors.toMap(support -> support.getDemand().getId(), Function.identity()));
    }

    private SupportValues validateSupport(
            Boolean needsMorning,
            Boolean needsAfternoon,
            List<SupportReason> reasons
    ) {
        if (!Boolean.TRUE.equals(needsMorning) && !Boolean.TRUE.equals(needsAfternoon)) {
            throw DemandApiException.validation(
                    "needsMorning",
                    "at least one direction must be selected"
            );
        }
        if (reasons == null || reasons.isEmpty()) {
            throw DemandApiException.validation("reasons", "must contain at least one reason");
        }
        LinkedHashSet<SupportReason> uniqueReasons = new LinkedHashSet<>(reasons);
        if (uniqueReasons.size() != reasons.size()) {
            throw DemandApiException.validation("reasons", "must not contain duplicates");
        }
        return new SupportValues(
                Boolean.TRUE.equals(needsMorning),
                Boolean.TRUE.equals(needsAfternoon),
                uniqueReasons
        );
    }

    private String validateAcademicYear(String academicYear) {
        if (!ACADEMIC_YEAR.matcher(academicYear).matches()) {
            throw DemandApiException.validation("academicYear", "must use YYYY-YYYY format");
        }
        int start = Integer.parseInt(academicYear.substring(0, 4));
        int end = Integer.parseInt(academicYear.substring(5));
        if (end != start + 1) {
            throw DemandApiException.validation("academicYear", "must contain consecutive years");
        }
        return academicYear;
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw DemandApiException.validation("page", "must be zero or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw DemandApiException.validation("size", "must be between 1 and 50");
        }
    }

    private void requirePositiveIfPresent(Long value, String field) {
        if (value != null && value < 1) {
            throw DemandApiException.validation(field, "must be a positive number");
        }
    }

    private record SupportValues(
            boolean needsMorning,
            boolean needsAfternoon,
            LinkedHashSet<SupportReason> reasons
    ) {
    }
}
