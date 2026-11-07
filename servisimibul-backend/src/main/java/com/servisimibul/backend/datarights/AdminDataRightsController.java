package com.servisimibul.backend.datarights;

import com.servisimibul.backend.datarights.DataRightsDtos.AccessResponse;
import com.servisimibul.backend.datarights.DataRightsDtos.ActionRequest;
import com.servisimibul.backend.datarights.DataRightsDtos.HandlerDetail;
import com.servisimibul.backend.datarights.DataRightsDtos.HandlerSummary;
import com.servisimibul.backend.datarights.DataRightsDtos.ErasureSafetyPlan;
import com.servisimibul.backend.datarights.DataRightsDtos.PageResponse;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Handler endpoints: ADMIN role at the filter chain, plus designated-handler check in the service. */
@RestController
@RequestMapping("/api/v1/admin/data-rights-requests")
@RequiredArgsConstructor
public class AdminDataRightsController {

    private final DataRightsService service;
    private final CurrentUser currentUser;

    @GetMapping
    public PageResponse<HandlerSummary> queue(
            @RequestParam(required = false) DataRightsRequestStatus status,
            @RequestParam(required = false) Boolean overdue,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return service.queue(status, overdue, page, size, currentUser.id());
    }

    @GetMapping("/{requestId}")
    public HandlerDetail detail(@PathVariable UUID requestId) {
        return service.detail(requestId, currentUser.id());
    }

    @GetMapping("/{requestId}/access-response")
    public ResponseEntity<AccessResponse> accessResponse(@PathVariable UUID requestId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(service.accessResponse(requestId, currentUser.id()));
    }

    @GetMapping("/{requestId}/erasure-safety-plan")
    public ResponseEntity<ErasureSafetyPlan> erasureSafetyPlan(@PathVariable UUID requestId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(service.erasureSafetyPlan(requestId, currentUser.id()));
    }

    @PostMapping("/{requestId}/actions")
    public HandlerDetail act(@PathVariable UUID requestId, @Valid @RequestBody ActionRequest request) {
        return service.act(requestId, request, currentUser.id());
    }
}
