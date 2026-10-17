package com.servisimibul.backend.operatorapplication.controller;

import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ApplicationDetailResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.PageResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ProfileResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.RevisionRequest;
import com.servisimibul.backend.operatorapplication.service.OperatorApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/operators")
@RequiredArgsConstructor
public class AdminOperatorApplicationController {

    private final OperatorApplicationService operatorApplicationService;

    @GetMapping
    public PageResponse<ProfileResponse> queue(
            @RequestParam(required = false) OperatorApprovalStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return operatorApplicationService.queue(status, page, size);
    }

    @GetMapping("/{id}")
    public ApplicationDetailResponse detail(@PathVariable UUID id) {
        return operatorApplicationService.detail(id);
    }

    @PostMapping("/{id}/approve")
    public ApplicationDetailResponse approve(@PathVariable UUID id) {
        return operatorApplicationService.approve(id);
    }

    @PostMapping("/{id}/request-revision")
    public ApplicationDetailResponse requestRevision(
            @PathVariable UUID id,
            @Valid @RequestBody RevisionRequest request
    ) {
        return operatorApplicationService.requestRevision(id, request);
    }

    @PostMapping("/{id}/suspend")
    public ApplicationDetailResponse suspend(@PathVariable UUID id) {
        return operatorApplicationService.suspend(id);
    }
}
