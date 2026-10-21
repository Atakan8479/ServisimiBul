package com.servisimibul.backend.demand.controller;

import com.servisimibul.backend.demand.dto.DemandFeedbackDtos.FeedbackDecisionRequest;
import com.servisimibul.backend.demand.dto.DemandFeedbackDtos.FeedbackListResponse;
import com.servisimibul.backend.demand.service.DemandFeedbackService;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/demands/{demandId}/feedback")
@RequiredArgsConstructor
public class DemandFeedbackController {

    private final DemandFeedbackService feedbackService;
    private final CurrentUser currentUser;

    @GetMapping
    public FeedbackListResponse list(@PathVariable UUID demandId) {
        return feedbackService.list(demandId, currentUser.id());
    }

    @PostMapping("/open")
    public FeedbackListResponse open(@PathVariable UUID demandId) {
        return feedbackService.open(demandId, currentUser.id());
    }

    @PutMapping("/{publicationEventId}")
    public FeedbackListResponse decide(
            @PathVariable UUID demandId,
            @PathVariable UUID publicationEventId,
            @Valid @RequestBody FeedbackDecisionRequest request
    ) {
        return feedbackService.decide(
                demandId,
                publicationEventId,
                request.satisfied(),
                currentUser.id()
        );
    }
}
