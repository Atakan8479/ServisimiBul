package com.servisimibul.backend.demand.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = "app.demand.feedback.scheduler-enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class DemandFeedbackScheduler {

    private final DemandFeedbackService feedbackService;

    @Scheduled(
            initialDelayString = "${app.demand.feedback.scheduler-initial-delay:PT1M}",
            fixedDelayString = "${app.demand.feedback.scheduler-interval:PT15M}"
    )
    public void processDueFeedback() {
        for (UUID feedbackId : feedbackService.dueIds()) {
            feedbackService.processDue(feedbackId);
        }
    }
}
