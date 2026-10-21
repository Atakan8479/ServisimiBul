package com.servisimibul.backend.demand.controller;

import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PageResponse;
import com.servisimibul.backend.demand.dto.DemandServiceResponseDtos.PublicResponse;
import com.servisimibul.backend.demand.service.DemandServiceResponseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/demands/{demandId}/responses")
@RequiredArgsConstructor
public class PublicDemandServiceResponseController {

    private final DemandServiceResponseService responseService;

    @GetMapping
    public PageResponse<PublicResponse> list(
            @PathVariable UUID demandId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return responseService.listPublic(demandId, page, size);
    }
}
