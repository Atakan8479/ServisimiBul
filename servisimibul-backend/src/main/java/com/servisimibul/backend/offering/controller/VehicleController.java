package com.servisimibul.backend.offering.controller;

import com.servisimibul.backend.offering.dto.VehicleDtos.CreateRequest;
import com.servisimibul.backend.offering.dto.VehicleDtos.PatchRequest;
import com.servisimibul.backend.offering.dto.VehicleDtos.VehicleResponse;
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
@RequestMapping("/api/v1/operator/vehicles")
@RequiredArgsConstructor
public class VehicleController {

    private final OfferingService offeringService;

    @GetMapping
    public List<VehicleResponse> list() {
        return offeringService.listVehicles();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VehicleResponse create(@Valid @RequestBody CreateRequest request) {
        return offeringService.createVehicle(request);
    }

    @GetMapping("/{id}")
    public VehicleResponse get(@PathVariable UUID id) {
        return offeringService.getVehicle(id);
    }

    @PatchMapping("/{id}")
    public VehicleResponse patch(
            @PathVariable UUID id,
            @Valid @RequestBody PatchRequest request
    ) {
        return offeringService.patchVehicle(id, request);
    }

    @PostMapping("/{id}/deactivate")
    public VehicleResponse deactivate(@PathVariable UUID id) {
        return offeringService.deactivateVehicle(id);
    }
}
