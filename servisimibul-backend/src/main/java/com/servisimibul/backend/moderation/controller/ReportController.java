package com.servisimibul.backend.moderation.controller;

import com.servisimibul.backend.moderation.dto.ModerationDtos.CreateReportRequest;
import com.servisimibul.backend.moderation.dto.ModerationDtos.ReportReceipt;
import com.servisimibul.backend.moderation.service.ModerationService;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ModerationService moderationService;
    private final CurrentUser currentUser;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReportReceipt create(@Valid @RequestBody CreateReportRequest request) {
        return moderationService.report(request, currentUser.id());
    }
}
