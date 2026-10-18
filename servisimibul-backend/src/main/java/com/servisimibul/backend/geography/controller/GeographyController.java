package com.servisimibul.backend.geography.controller;

import com.servisimibul.backend.geography.dto.GeographyDtos.DistrictResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.NeighborhoodResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.PageResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.ProvinceResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.SchoolResponse;
import com.servisimibul.backend.geography.service.GeographyCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class GeographyController {

    private final GeographyCatalogService catalogService;

    @GetMapping("/provinces")
    public List<ProvinceResponse> provinces() {
        return catalogService.provinces();
    }

    @GetMapping("/districts")
    public List<DistrictResponse> districts(@RequestParam Long provinceId) {
        return catalogService.districts(provinceId);
    }

    @GetMapping("/neighborhoods")
    public List<NeighborhoodResponse> neighborhoods(@RequestParam Long districtId) {
        return catalogService.neighborhoods(districtId);
    }

    @GetMapping("/schools")
    public PageResponse<SchoolResponse> schools(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long provinceId,
            @RequestParam(required = false) Long districtId,
            @RequestParam(defaultValue = "name-asc") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return catalogService.schools(query, provinceId, districtId, sort, page, size);
    }

    @GetMapping("/schools/{id}")
    public SchoolResponse school(@PathVariable UUID id) {
        return catalogService.school(id);
    }
}
