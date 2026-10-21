package com.servisimibul.backend.demand.service;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandServicePublicationEvent;
import com.servisimibul.backend.demand.DemandServicePublicationEventRepository;
import com.servisimibul.backend.demand.DemandServiceResponse;
import com.servisimibul.backend.demand.DemandServiceResponseRepository;
import com.servisimibul.backend.demand.DemandServiceResponseRepository.PublicResponseSummary;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.EligibilityBlocker;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.EligibilityResponse;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.OperatorResponse;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PageResponse;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublicResponse;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublishRequest;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublishResponse;
import com.servisimibul.backend.demand.exception.DemandApiException;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.operatorapproval.OperatorApprovalPolicy;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DemandServiceResponseService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final String EVENT_KEY_PREFIX = "servisimibul:demand-service-publication:";

    private final DemandRepository demandRepository;
    private final DemandServiceResponseRepository responseRepository;
    private final DemandServicePublicationEventRepository eventRepository;
    private final OperatorProfileRepository profileRepository;
    private final OperatorSchoolRepository operatorSchoolRepository;
    private final OperatorSchoolCoverageRepository coverageRepository;
    private final OperatorApprovalPolicy approvalPolicy;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<PublicResponse> listPublic(UUID demandId, int page, int size) {
        validatePage(page, size);
        if (!demandRepository.existsById(demandId)) {
            throw DemandApiException.notFound("demand_not_found", "Demand was not found");
        }
        Page<PublicResponseSummary> responses = responseRepository.findPublicResponses(
                demandId,
                approvalPolicy.isRequired(),
                PageRequest.of(page, size)
        );
        return new PageResponse<>(
                responses.getContent().stream().map(this::toPublicResponse).toList(),
                responses.getNumber(),
                responses.getSize(),
                responses.getTotalElements(),
                responses.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public EligibilityResponse eligibility(UUID demandId, UUID userId) {
        Demand demand = demandRepository.findById(demandId)
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
        OperatorProfile profile = profile(userId, false);
        OperatorSchool relationship = operatorSchoolRepository
                .findDetailedByOperatorIdAndSchoolId(profile.getId(), demand.getSchool().getId())
                .orElse(null);
        List<EligibilityBlocker> blockers = blockers(demand, profile, relationship);
        DemandServiceResponse response = responseRepository
                .findOwned(demandId, profile.getId())
                .orElse(null);
        return new EligibilityResponse(
                demandId,
                blockers.isEmpty(),
                blockers,
                response == null ? null : toOperatorResponse(
                        response,
                        response.isActive() && blockers.isEmpty()
                )
        );
    }

    @Transactional
    public PublishResponse publish(UUID demandId, PublishRequest request, UUID userId) {
        Direction direction = validateDirection(request.offersMorning(), request.offersAfternoon());
        Demand demand = demandRepository.findForUpdateById(demandId)
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
        OperatorProfile profile = profile(userId, true);
        OperatorSchool relationship = operatorSchoolRepository
                .findDetailedForUpdateByOperatorIdAndSchoolId(
                        profile.getId(),
                        demand.getSchool().getId()
                )
                .orElse(null);
        List<EligibilityBlocker> blockers = blockers(demand, profile, relationship);
        if (!blockers.isEmpty()) {
            throw blockerException(blockers.getFirst());
        }

        DemandServiceResponse response = responseRepository
                .findOwnedForUpdate(demandId, profile.getId())
                .orElse(null);
        if (response != null && response.isActive()) {
            return new PublishResponse(false, toOperatorResponse(response, true));
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        if (response == null) {
            response = responseRepository.saveAndFlush(new DemandServiceResponse(
                    demand,
                    profile,
                    relationship,
                    direction.offersMorning(),
                    direction.offersAfternoon(),
                    now
            ));
        } else {
            response.republish(
                    relationship,
                    direction.offersMorning(),
                    direction.offersAfternoon(),
                    now
            );
            response = responseRepository.saveAndFlush(response);
        }
        persistPublicationEvent(response);
        return new PublishResponse(true, toOperatorResponse(response, true));
    }

    @Transactional
    public OperatorResponse withdraw(UUID demandId, UUID userId) {
        demandRepository.findForUpdateById(demandId)
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
        OperatorProfile profile = profile(userId, true);
        DemandServiceResponse response = responseRepository
                .findOwnedForUpdate(demandId, profile.getId())
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_service_response_not_found",
                        "Demand service response was not found"
                ));
        response.withdraw(OffsetDateTime.now(clock));
        responseRepository.saveAndFlush(response);
        return toOperatorResponse(response, false);
    }

    private OperatorProfile profile(UUID userId, boolean forUpdate) {
        return (forUpdate
                ? profileRepository.findByUserIdForUpdate(userId)
                : profileRepository.findByUserId(userId))
                .orElseThrow(() -> DemandApiException.notFound(
                        "operator_profile_not_found",
                        "Operator profile was not found"
                ));
    }

    private List<EligibilityBlocker> blockers(
            Demand demand,
            OperatorProfile profile,
            OperatorSchool relationship
    ) {
        List<EligibilityBlocker> blockers = new ArrayList<>();
        if (!profile.getUser().isEmailVerified()) {
            blockers.add(EligibilityBlocker.ACCOUNT_EMAIL_UNVERIFIED);
        }
        if (!profile.getUser().isEnabled()) {
            blockers.add(EligibilityBlocker.ACCOUNT_DISABLED);
        }
        if (!profile.isActive()) {
            blockers.add(EligibilityBlocker.PROFILE_INACTIVE);
        }
        if (!profile.isPubliclyVisible()) {
            blockers.add(EligibilityBlocker.PROFILE_HIDDEN);
        }
        if (!approvalPolicy.allowsPublicDiscovery(profile.getApprovalStatus())) {
            blockers.add(EligibilityBlocker.APPROVAL_REQUIRED);
        }
        if (!demand.isOpen()) {
            blockers.add(EligibilityBlocker.DEMAND_NOT_OPEN);
        }
        if (!demand.getSchool().isActive()) {
            blockers.add(EligibilityBlocker.SCHOOL_INACTIVE);
        }
        if (relationship == null) {
            blockers.add(EligibilityBlocker.SCHOOL_NOT_LINKED);
        } else {
            if (!relationship.isActive()) {
                blockers.add(EligibilityBlocker.SCHOOL_RELATIONSHIP_INACTIVE);
            }
            if (coverageRepository.findValidCoverage(
                    relationship.getId(),
                    demand.getNeighborhood().getId()
            ).isEmpty()) {
                blockers.add(EligibilityBlocker.COVERAGE_MISSING);
            }
        }
        return List.copyOf(blockers);
    }

    private DemandApiException blockerException(EligibilityBlocker blocker) {
        return switch (blocker) {
            case ACCOUNT_EMAIL_UNVERIFIED -> DemandApiException.forbidden(
                    "operator_email_unverified",
                    "A verified operator email is required"
            );
            case ACCOUNT_DISABLED -> DemandApiException.forbidden(
                    "operator_account_disabled",
                    "The operator account is disabled"
            );
            case PROFILE_INACTIVE -> DemandApiException.forbidden(
                    "operator_suspended",
                    "The operator profile is suspended"
            );
            case APPROVAL_REQUIRED -> DemandApiException.forbidden(
                    "operator_approval_required",
                    "Administrative operator approval is required"
            );
            case PROFILE_HIDDEN -> DemandApiException.conflict(
                    "operator_profile_hidden",
                    "Make the operator profile public before publishing a response"
            );
            case DEMAND_NOT_OPEN -> DemandApiException.conflict(
                    "demand_not_open",
                    "Only an open demand can receive a service response"
            );
            case SCHOOL_INACTIVE -> DemandApiException.conflict(
                    "school_inactive",
                    "The demand school is not active"
            );
            case SCHOOL_NOT_LINKED -> DemandApiException.conflict(
                    "operator_school_required",
                    "Add this school to the operator profile before publishing a response"
            );
            case SCHOOL_RELATIONSHIP_INACTIVE -> DemandApiException.conflict(
                    "operator_school_inactive",
                    "Activate this operator school relationship before publishing a response"
            );
            case COVERAGE_MISSING -> DemandApiException.conflict(
                    "operator_coverage_required",
                    "Add the demand neighborhood to this school's coverage before publishing a response"
            );
        };
    }

    private Direction validateDirection(Boolean morning, Boolean afternoon) {
        if (!Boolean.TRUE.equals(morning) && !Boolean.TRUE.equals(afternoon)) {
            throw DemandApiException.validation(
                    "offersMorning",
                    "at least one offered direction must be selected"
            );
        }
        return new Direction(Boolean.TRUE.equals(morning), Boolean.TRUE.equals(afternoon));
    }

    private void persistPublicationEvent(DemandServiceResponse response) {
        eventRepository.saveAndFlush(new DemandServicePublicationEvent(
                publicationEventId(response.getId(), response.getPublicationVersion()),
                response,
                response.getPublicationVersion(),
                response.isOffersMorning(),
                response.isOffersAfternoon(),
                response.getPublishedAt()
        ));
    }

    private OperatorResponse toOperatorResponse(
            DemandServiceResponse response,
            boolean currentlyPublic
    ) {
        return new OperatorResponse(
                response.getId(),
                response.getStatus(),
                response.isOffersMorning(),
                response.isOffersAfternoon(),
                response.getPublicationVersion(),
                publicationEventId(response.getId(), response.getPublicationVersion()),
                response.getPublishedAt(),
                response.getWithdrawnAt(),
                currentlyPublic
        );
    }

    private PublicResponse toPublicResponse(PublicResponseSummary response) {
        return new PublicResponse(
                response.getId(),
                publicationEventId(response.getId(), response.getPublicationVersion()),
                response.getPublicationVersion(),
                response.getOperatorId(),
                response.getBusinessName(),
                response.getContactPhone(),
                response.getOffersMorning(),
                response.getOffersAfternoon(),
                response.getPublishedAt()
        );
    }

    static UUID publicationEventId(UUID responseId, int publicationVersion) {
        String key = EVENT_KEY_PREFIX + responseId + ":" + publicationVersion;
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw DemandApiException.validation("page", "must be zero or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw DemandApiException.validation("size", "must be between 1 and 50");
        }
    }

    private record Direction(boolean offersMorning, boolean offersAfternoon) {
    }
}
