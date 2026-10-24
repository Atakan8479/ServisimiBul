package com.servisimibul.backend.moderation.controller;

import com.servisimibul.backend.moderation.ModerationCaseStatus;
import com.servisimibul.backend.moderation.ModerationTargetType;
import com.servisimibul.backend.moderation.ReportReason;
import com.servisimibul.backend.moderation.dto.ModerationDtos.CaseDetail;
import com.servisimibul.backend.moderation.dto.ModerationDtos.CaseSummary;
import com.servisimibul.backend.moderation.dto.ModerationDtos.ModerationActionRequest;
import com.servisimibul.backend.moderation.dto.ModerationDtos.PageResponse;
import com.servisimibul.backend.moderation.service.ModerationService;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/moderation/cases")
@RequiredArgsConstructor
public class AdminModerationController {

    private final ModerationService moderationService;
    private final CurrentUser currentUser;

    @GetMapping
    public PageResponse<CaseSummary> queue(
            @RequestParam(required = false) ModerationCaseStatus status,
            @RequestParam(required = false) ModerationTargetType targetType,
            @RequestParam(required = false) ReportReason reason,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime reportedFrom,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime reportedTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return moderationService.queue(
                status,
                targetType,
                reason,
                reportedFrom,
                reportedTo,
                page,
                size,
                currentUser.id()
        );
    }

    @GetMapping("/{caseId}")
    public CaseDetail detail(@PathVariable UUID caseId) {
        return moderationService.detail(caseId, currentUser.id());
    }

    @PostMapping("/{caseId}/actions")
    public CaseDetail act(
            @PathVariable UUID caseId,
            @Valid @RequestBody ModerationActionRequest request
    ) {
        return moderationService.act(caseId, request, currentUser.id());
    }
}
