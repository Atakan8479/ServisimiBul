package com.servisimibul.backend.offering.controller;

import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.CreateRequest;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.PatchRequest;
import com.servisimibul.backend.offering.dto.ServiceOfferingDtos.ServiceOfferingResponse;
import com.servisimibul.backend.offering.service.OfferingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/operator/offerings")
@RequiredArgsConstructor
public class ServiceOfferingController {

    private final OfferingService offeringService;

    @GetMapping
    public List<ServiceOfferingResponse> list() {
        return offeringService.listOfferings();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceOfferingResponse create(@Valid @RequestBody CreateRequest request) {
        return offeringService.createOffering(request);
    }

    @GetMapping("/{id}")
    public ServiceOfferingResponse get(@PathVariable UUID id) {
        return offeringService.getOffering(id);
    }

    @PatchMapping("/{id}")
    public ServiceOfferingResponse patch(
            @PathVariable UUID id,
            @Valid @RequestBody PatchRequest request
    ) {
        return offeringService.patchOffering(id, request);
    }

    @PostMapping("/{id}/publish")
    public ServiceOfferingResponse publish(@PathVariable UUID id) {
        return offeringService.publishOffering(id);
    }

    @PostMapping("/{id}/unpublish")
    public ServiceOfferingResponse unpublish(@PathVariable UUID id) {
        return offeringService.unpublishOffering(id);
    }
}
