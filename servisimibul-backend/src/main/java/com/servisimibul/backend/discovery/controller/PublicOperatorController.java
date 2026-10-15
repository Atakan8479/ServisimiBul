package com.servisimibul.backend.discovery.controller;

import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.OperatorResponse;
import com.servisimibul.backend.discovery.dto.PublicOperatorDtos.PageResponse;
import com.servisimibul.backend.discovery.service.PublicOperatorDiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/operators")
@RequiredArgsConstructor
public class PublicOperatorController {

    private final PublicOperatorDiscoveryService discoveryService;

    @GetMapping
    public PageResponse<OperatorResponse> search(
            @RequestParam UUID schoolId,
            @RequestParam Long neighborhoodId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return discoveryService.search(schoolId, neighborhoodId, page, size);
    }
}
