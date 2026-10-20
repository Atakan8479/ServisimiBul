package com.servisimibul.backend.demand.controller;

import com.servisimibul.backend.demand.dto.DemandDtos.CreateRequest;
import com.servisimibul.backend.demand.dto.DemandDtos.CreateResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.DemandResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.PageResponse;
import com.servisimibul.backend.demand.dto.DemandDtos.SupportRequest;
import com.servisimibul.backend.demand.service.DemandService;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/demands")
@RequiredArgsConstructor
public class DemandController {

    private final DemandService demandService;
    private final CurrentUser currentUser;

    @GetMapping
    public PageResponse<DemandResponse> list(
            @RequestParam(required = false) UUID schoolId,
            @RequestParam(required = false) Long neighborhoodId,
            @RequestParam(required = false) String academicYear,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return demandService.list(
                schoolId,
                neighborhoodId,
                academicYear,
                sort,
                page,
                size,
                parentId(user)
        );
    }

    @GetMapping("/{id}")
    public DemandResponse get(
            @PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return demandService.get(id, parentId(user));
    }

    @PostMapping
    public ResponseEntity<CreateResponse> create(@Valid @RequestBody CreateRequest request) {
        CreateResponse response = demandService.create(request, currentUser.id());
        return ResponseEntity.status(response.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(response);
    }

    @PostMapping("/{id}/support")
    public DemandResponse support(
            @PathVariable UUID id,
            @Valid @RequestBody SupportRequest request
    ) {
        return demandService.support(id, request, currentUser.id());
    }

    @PutMapping("/{id}/support")
    public DemandResponse updateSupport(
            @PathVariable UUID id,
            @Valid @RequestBody SupportRequest request
    ) {
        return demandService.updateSupport(id, request, currentUser.id());
    }

    @DeleteMapping("/{id}/support")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdrawSupport(@PathVariable UUID id) {
        demandService.withdrawSupport(id, currentUser.id());
    }

    private UUID parentId(AuthenticatedUser user) {
        return user != null && user.role() == UserRole.PARENT ? user.id() : null;
    }
}
