package com.servisimibul.backend.geography.controller;

import com.servisimibul.backend.geography.dto.GeographyDtos.PageResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.SchoolResponse;
import com.servisimibul.backend.geography.dto.SchoolCreateRequest;
import com.servisimibul.backend.geography.dto.SchoolPatchRequest;
import com.servisimibul.backend.geography.service.GeographyCatalogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/schools")
@RequiredArgsConstructor
public class AdminSchoolController {

    private final GeographyCatalogService catalogService;

    @GetMapping
    public PageResponse<SchoolResponse> schools(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long provinceId,
            @RequestParam(required = false) Long districtId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return catalogService.adminSchools(query, provinceId, districtId, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SchoolResponse create(@Valid @RequestBody SchoolCreateRequest request) {
        return catalogService.createSchool(request);
    }

    @PatchMapping("/{id}")
    public SchoolResponse patch(
            @PathVariable UUID id,
            @Valid @RequestBody SchoolPatchRequest request
    ) {
        return catalogService.patchSchool(id, request);
    }

    @PostMapping("/{id}/activate")
    public SchoolResponse activate(@PathVariable UUID id) {
        return catalogService.activateSchool(id);
    }

    @PostMapping("/{id}/deactivate")
    public SchoolResponse deactivate(@PathVariable UUID id) {
        return catalogService.deactivateSchool(id);
    }
}
