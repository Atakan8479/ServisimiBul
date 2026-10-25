package com.servisimibul.backend.notification;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandServiceFeedback;
import com.servisimibul.backend.demand.DemandServicePublicationEvent;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.moderation.ContentReport;
import com.servisimibul.backend.operatorapproval.OperatorApprovalPolicy;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static com.servisimibul.backend.notification.NotificationWriteStore.NotificationWrite;

@Service
@RequiredArgsConstructor
public class NotificationDeliveryService {

    private final NotificationWriteStore writeStore;
    private final OperatorSchoolCoverageRepository coverageRepository;
    private final AppUserRepository userRepository;
    private final OperatorApprovalPolicy approvalPolicy;
    private final Clock clock;

    public void demandCreated(Demand demand) {
        coverageRepository.findEligibleNotificationRecipientIds(
                demand.getSchool().getId(),
                demand.getNeighborhood().getId(),
                demand.getNeighborhood().getDistrict().getId(),
                approvalPolicy.isRequired()
        ).forEach(recipientId -> write(
                recipientId,
                NotificationType.DEMAND_CREATED,
                "DEMAND_CREATED:" + demand.getId() + ":" + recipientId,
                demand.getId(), null, null, null, null
        ));
    }

    public void servicePublished(DemandServiceFeedback feedback) {
        writeForFeedback(NotificationType.SERVICE_PUBLISHED, feedback);
    }

    public void feedbackReminder(DemandServiceFeedback feedback) {
        writeForFeedback(NotificationType.FEEDBACK_REMINDER, feedback);
    }

    public void supportExpired(DemandServiceFeedback feedback) {
        writeForFeedback(NotificationType.SUPPORT_EXPIRED, feedback);
    }

    public void serviceWithdrawn(DemandServiceFeedback feedback) {
        writeForFeedback(NotificationType.SERVICE_WITHDRAWN, feedback);
    }

    public void contentReported(ContentReport report) {
        userRepository.findEnabledVerifiedAdminIds().forEach(recipientId -> write(
                recipientId,
                NotificationType.CONTENT_REPORTED,
                "CONTENT_REPORTED:" + report.getId() + ":" + recipientId,
                null, null, null, null, report.getModerationCase().getId()
        ));
    }

    private void writeForFeedback(NotificationType type, DemandServiceFeedback feedback) {
        DemandServicePublicationEvent publication = feedback.getPublicationEvent();
        write(
                feedback.getSupport().getParent().getId(),
                type,
                type + ":" + feedback.getId() + ":" + feedback.getSupport().getParent().getId(),
                feedback.getSupport().getDemand().getId(),
                publication.getResponse().getId(),
                publication.getId(),
                feedback.getId(),
                null
        );
    }

    private void write(
            UUID recipientId,
            NotificationType type,
            String eventKey,
            UUID demandId,
            UUID responseId,
            UUID publicationId,
            UUID feedbackId,
            UUID moderationCaseId
    ) {
        writeStore.insert(new NotificationWrite(
                recipientId,
                type,
                eventKey,
                demandId,
                responseId,
                publicationId,
                feedbackId,
                moderationCaseId,
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC)
        ));
    }
}
