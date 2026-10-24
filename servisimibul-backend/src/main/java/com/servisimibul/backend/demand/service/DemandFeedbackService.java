package com.servisimibul.backend.demand.service;

import com.servisimibul.backend.auth.config.ParentEmailVerificationProperties;
import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandClosureReason;
import com.servisimibul.backend.demand.DemandLifecycleEvent;
import com.servisimibul.backend.demand.DemandLifecycleEventRepository;
import com.servisimibul.backend.demand.DemandLifecycleEventType;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandServiceFeedback;
import com.servisimibul.backend.demand.DemandServiceFeedbackRepository;
import com.servisimibul.backend.demand.DemandServiceFeedbackStatus;
import com.servisimibul.backend.demand.DemandServicePublicationEvent;
import com.servisimibul.backend.demand.DemandServiceResponse;
import com.servisimibul.backend.demand.DemandSupport;
import com.servisimibul.backend.demand.DemandSupportRepository;
import com.servisimibul.backend.demand.DemandSupportStatus;
import com.servisimibul.backend.demand.config.DemandFeedbackProperties;
import com.servisimibul.backend.demand.dto.DemandFeedbackDtos.FeedbackListResponse;
import com.servisimibul.backend.demand.dto.DemandFeedbackDtos.FeedbackResponse;
import com.servisimibul.backend.demand.exception.DemandApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DemandFeedbackService {

    private static final String DISCLAIMER =
            "İşletmeci bildirimleri uygunluk beyanıdır; rezervasyon veya hizmet garantisi değildir.";

    private final DemandRepository demandRepository;
    private final DemandSupportRepository supportRepository;
    private final DemandServiceFeedbackRepository feedbackRepository;
    private final DemandLifecycleEventRepository lifecycleEventRepository;
    private final DemandFeedbackProperties properties;
    private final ParentEmailVerificationProperties parentEmailVerification;
    private final Clock clock;

    /** Called inside the demand-locked publication transaction. */
    public void publicationCreated(DemandServicePublicationEvent event) {
        DemandServiceResponse response = event.getResponse();
        List<DemandSupport> supports = supportRepository.findEligibleForPublication(
                response.getDemand().getId(),
                event.isOffersMorning(),
                event.isOffersAfternoon(),
                parentEmailVerification.required()
        );
        for (DemandSupport support : supports) {
            if (!feedbackRepository.existsBySupportIdAndPublicationEventId(
                    support.getId(),
                    event.getId()
            )) {
                feedbackRepository.save(new DemandServiceFeedback(
                        support,
                        event,
                        event.getPublishedAt().plus(properties.expiryIfUnopened())
                ));
                support.awaitFeedback();
            }
        }
        feedbackRepository.flush();
        supportRepository.flush();
    }

    /** Called inside the demand-locked operator-withdrawal transaction. */
    public void responseWithdrawn(DemandServiceResponse response) {
        Set<DemandSupport> affected = new LinkedHashSet<>();
        for (DemandServiceFeedback feedback
                : feedbackRepository.findAwaitingByResponseId(response.getId())) {
            feedback.supersede();
            affected.add(feedback.getSupport());
        }
        affected.forEach(this::restoreSupportAfterPendingFeedbackChange);
        feedbackRepository.flush();
        supportRepository.flush();
        closeIfExhausted(response.getDemand(), now());
    }

    /** Called inside the demand-locked parent-withdrawal transaction. */
    public void supportWithdrawn(DemandSupport support) {
        feedbackRepository.findAwaitingBySupportId(support.getId())
                .forEach(DemandServiceFeedback::supersede);
        feedbackRepository.flush();
        closeIfExhausted(support.getDemand(), now());
    }

    /** Called inside the demand-locked support-reactivation transaction. */
    public void supportReactivated(Demand demand, DemandSupport support) {
        feedbackRepository.findAwaitingBySupportId(support.getId())
                .forEach(DemandServiceFeedback::supersede);
        feedbackRepository.flush();
        if (!demand.isOpen()) {
            demand.reopen();
            lifecycleEventRepository.save(new DemandLifecycleEvent(
                    demand,
                    DemandLifecycleEventType.REOPENED,
                    now()
            ));
        }
    }

    @Transactional(readOnly = true)
    public FeedbackListResponse list(UUID demandId, UUID parentId) {
        DemandSupport support = ownedSupport(demandId, parentId, false);
        return response(demandId, feedbackRepository.findDetailedBySupportId(support.getId()));
    }

    @Transactional
    public FeedbackListResponse open(UUID demandId, UUID parentId) {
        demandForUpdate(demandId);
        DemandSupport support = ownedSupport(demandId, parentId, true);
        if (support.getStatus() != DemandSupportStatus.AWAITING_FEEDBACK) {
            return response(demandId, feedbackRepository.findDetailedBySupportId(support.getId()));
        }
        OffsetDateTime openedAt = now();
        feedbackRepository.findAwaitingBySupportId(support.getId()).forEach(feedback -> feedback.open(
                openedAt,
                properties.reminderAfterOpen(),
                properties.expiryAfterOpen()
        ));
        feedbackRepository.flush();
        return response(demandId, feedbackRepository.findDetailedBySupportId(support.getId()));
    }

    @Transactional
    public FeedbackListResponse decide(
            UUID demandId,
            UUID publicationEventId,
            boolean satisfied,
            UUID parentId
    ) {
        Demand demand = demandForUpdate(demandId);
        DemandSupport support = ownedSupport(demandId, parentId, true);
        DemandServiceFeedback feedback = feedbackRepository.findOwnedForUpdate(
                support.getId(),
                publicationEventId
        ).orElseThrow(() -> DemandApiException.notFound(
                "demand_feedback_not_found",
                "Feedback opportunity was not found"
        ));
        if (!feedback.isAwaiting()) {
            throw DemandApiException.conflict(
                    "demand_feedback_not_pending",
                    "Feedback has already been resolved"
            );
        }
        DemandServiceResponse serviceResponse = feedback.getPublicationEvent().getResponse();
        if (!serviceResponse.isActive()
                || serviceResponse.getPublicationVersion()
                != feedback.getPublicationEvent().getPublicationVersion()) {
            feedback.supersede();
            restoreSupportAfterPendingFeedbackChange(support);
            throw DemandApiException.conflict(
                    "demand_feedback_stale",
                    "This service publication is no longer current"
            );
        }

        OffsetDateTime evaluatedAt = now();
        if (satisfied) {
            feedback.satisfy(evaluatedAt);
            support.satisfy();
            feedbackRepository.findAwaitingBySupportId(support.getId()).stream()
                    .filter(other -> !other.getId().equals(feedback.getId()))
                    .forEach(DemandServiceFeedback::supersede);
        } else {
            feedback.reject(evaluatedAt);
            restoreSupportAfterPendingFeedbackChange(support);
        }
        feedbackRepository.flush();
        supportRepository.flush();
        closeIfExhausted(demand, evaluatedAt);
        return response(demandId, feedbackRepository.findDetailedBySupportId(support.getId()));
    }

    @Transactional(readOnly = true)
    public List<UUID> dueIds() {
        return feedbackRepository.findDueIds(now(), PageRequest.of(0, properties.batchSize()));
    }

    @Transactional
    public void processDue(UUID feedbackId) {
        UUID demandId = feedbackRepository.findDemandIdById(feedbackId).orElse(null);
        if (demandId == null) {
            return;
        }
        Demand demand = demandRepository.findForUpdateById(demandId).orElse(null);
        if (demand == null) {
            return;
        }
        DemandServiceFeedback feedback = feedbackRepository.findForUpdateById(feedbackId)
                .orElse(null);
        if (feedback == null || !feedback.isAwaiting()) {
            return;
        }
        OffsetDateTime now = now();
        if (!feedback.getExpiresAt().isAfter(now)) {
            feedback.expire();
            expireSupportAfterPendingFeedbackChange(feedback.getSupport());
            feedbackRepository.flush();
            supportRepository.flush();
            closeIfExhausted(demand, now);
        } else if (feedback.getOpenedAt() != null
                && feedback.getReminderTriggeredAt() == null
                && !feedback.getReminderDueAt().isAfter(now)) {
            feedback.remind(now);
            feedbackRepository.flush();
        }
    }

    private void restoreSupportAfterPendingFeedbackChange(DemandSupport support) {
        if (feedbackRepository.existsBySupportIdAndStatus(
                support.getId(),
                DemandServiceFeedbackStatus.AWAITING_FEEDBACK
        )) {
            support.awaitFeedback();
        } else {
            support.activate();
        }
    }

    private void expireSupportAfterPendingFeedbackChange(DemandSupport support) {
        if (feedbackRepository.existsBySupportIdAndStatus(
                support.getId(),
                DemandServiceFeedbackStatus.AWAITING_FEEDBACK
        )) {
            support.awaitFeedback();
        } else {
            support.expire();
        }
    }

    private void closeIfExhausted(Demand demand, OffsetDateTime at) {
        if (!demand.isOpen()
                || supportRepository.countEligibleByDemandId(
                        demand.getId(),
                        parentEmailVerification.required()
                ) > 0) {
            return;
        }
        DemandClosureReason reason = supportRepository.existsByDemandIdAndStatus(
                demand.getId(),
                DemandSupportStatus.SATISFIED
        ) ? DemandClosureReason.FULFILLED : DemandClosureReason.INACTIVE;
        demand.close(reason, at);
        lifecycleEventRepository.save(new DemandLifecycleEvent(
                demand,
                reason == DemandClosureReason.FULFILLED
                        ? DemandLifecycleEventType.CLOSED_FULFILLED
                        : DemandLifecycleEventType.CLOSED_INACTIVE,
                at
        ));
    }

    private Demand demandForUpdate(UUID demandId) {
        return demandRepository.findForUpdateById(demandId)
                .orElseThrow(() -> DemandApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
    }

    private DemandSupport ownedSupport(UUID demandId, UUID parentId, boolean forUpdate) {
        return (forUpdate
                ? supportRepository.findOwnedForUpdate(demandId, parentId)
                : supportRepository.findOwned(demandId, parentId))
                .orElseThrow(() -> DemandApiException.notFound(
                        "support_not_found",
                        "Support was not found"
                ));
    }

    private FeedbackListResponse response(UUID demandId, List<DemandServiceFeedback> feedback) {
        return new FeedbackListResponse(
                demandId,
                feedback.stream().map(this::toResponse).toList(),
                DISCLAIMER
        );
    }

    private FeedbackResponse toResponse(DemandServiceFeedback feedback) {
        DemandServicePublicationEvent event = feedback.getPublicationEvent();
        return new FeedbackResponse(
                event.getId(),
                event.getResponse().getOperator().getId(),
                event.getResponse().getOperator().getBusinessName(),
                event.isOffersMorning(),
                event.isOffersAfternoon(),
                event.getPublishedAt(),
                feedback.getStatus(),
                feedback.getOpenedAt(),
                feedback.getReminderDueAt(),
                feedback.getReminderTriggeredAt(),
                feedback.getExpiresAt(),
                feedback.getEvaluatedAt(),
                feedback.isAwaiting()
        );
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock);
    }
}
