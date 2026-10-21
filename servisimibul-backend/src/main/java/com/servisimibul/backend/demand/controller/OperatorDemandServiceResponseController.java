package com.servisimibul.backend.demand.controller;

import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.EligibilityResponse;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.OperatorResponse;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublishRequest;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublishResponse;
import com.servisimibul.backend.demand.service.DemandServiceResponseService;
import com.servisimibul.backend.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/operator/demands/{demandId}/response")
@RequiredArgsConstructor
public class OperatorDemandServiceResponseController {

    private final DemandServiceResponseService responseService;
    private final CurrentUser currentUser;

    @GetMapping
    public EligibilityResponse eligibility(@PathVariable UUID demandId) {
        return responseService.eligibility(demandId, currentUser.id());
    }

    @PostMapping
    public PublishResponse publish(
            @PathVariable UUID demandId,
            @Valid @RequestBody PublishRequest request
    ) {
        return responseService.publish(demandId, request, currentUser.id());
    }

    @DeleteMapping
    public OperatorResponse withdraw(@PathVariable UUID demandId) {
        return responseService.withdraw(demandId, currentUser.id());
    }
}
