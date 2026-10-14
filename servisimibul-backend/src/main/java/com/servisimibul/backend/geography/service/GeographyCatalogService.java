package com.servisimibul.backend.geography.service;

import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.DistrictRepository;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.geography.ProvinceRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.geography.dto.GeographyDtos.DistrictResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.NeighborhoodResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.PageResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.ProvinceResponse;
import com.servisimibul.backend.geography.dto.GeographyDtos.SchoolResponse;
import com.servisimibul.backend.geography.dto.SchoolCreateRequest;
import com.servisimibul.backend.geography.dto.SchoolPatchRequest;
import com.servisimibul.backend.geography.exception.GeographyApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GeographyCatalogService {

    private static final int MAX_PAGE_SIZE = 50;

    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;
    private final NeighborhoodRepository neighborhoodRepository;
    private final SchoolRepository schoolRepository;

    @Transactional(readOnly = true)
    public List<ProvinceResponse> provinces() {
        return provinceRepository.findAllByOrderByNameAscIdAsc().stream()
                .map(province -> new ProvinceResponse(province.getId(), province.getCode(), province.getName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DistrictResponse> districts(Long provinceId) {
        requirePositive(provinceId, "provinceId");
        return districtRepository.findAllByProvinceIdOrderByNameAscIdAsc(provinceId).stream()
                .map(district -> new DistrictResponse(
                        district.getId(),
                        district.getProvince().getId(),
                        district.getName()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NeighborhoodResponse> neighborhoods(Long districtId) {
        requirePositive(districtId, "districtId");
        return neighborhoodRepository.findAllByDistrictIdOrderByNameAscIdAsc(districtId).stream()
                .map(neighborhood -> new NeighborhoodResponse(
                        neighborhood.getId(),
                        neighborhood.getDistrict().getId(),
                        neighborhood.getName()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<SchoolResponse> schools(
            String query,
            Long provinceId,
            Long districtId,
            int page,
            int size
    ) {
        validatePage(page, size);
        requirePositiveIfPresent(provinceId, "provinceId");
        requirePositiveIfPresent(districtId, "districtId");
        String normalizedQuery = normalizeQuery(query);

        Page<School> schools = schoolRepository.findPublicSchools(
                normalizedQuery,
                provinceId,
                districtId,
                PageRequest.of(page, size)
        );
        return new PageResponse<>(
                schools.getContent().stream().map(this::toResponse).toList(),
                schools.getNumber(),
                schools.getSize(),
                schools.getTotalElements(),
                schools.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public SchoolResponse school(UUID id) {
        School school = schoolRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> GeographyApiException.notFound(
                        "school_not_found",
                        "Active school was not found"
                ));
        return toResponse(school);
    }

    @Transactional
    public SchoolResponse createSchool(SchoolCreateRequest request) {
        Neighborhood neighborhood = neighborhood(request.neighborhoodId());
        String name = normalizeRequired(request.name(), "name", 255);
        String address = normalizeOptional(request.address(), null, "address");
        String sourceName = normalizeOptional(request.sourceName(), 100, "sourceName");
        String sourceCode = normalizeOptional(request.sourceCode(), 100, "sourceCode");
        validateSourceIdentity(sourceName, sourceCode, null);

        School school = new School(neighborhood, name, address, sourceName, sourceCode);
        if (!request.active()) {
            school.deactivate();
        }
        return toResponse(schoolRepository.saveAndFlush(school));
    }

    @Transactional
    public SchoolResponse patchSchool(UUID id, SchoolPatchRequest request) {
        if (!request.hasAnyField()) {
            throw GeographyApiException.validation("request", "must contain at least one mutable field");
        }

        School school = detailedSchool(id);
        Neighborhood neighborhood = request.hasNeighborhoodId()
                ? neighborhood(requiredValue(request.neighborhoodId(), "neighborhoodId"))
                : school.getNeighborhood();
        String name = request.hasName()
                ? normalizeRequired(request.name(), "name", 255)
                : school.getName();
        String address = request.hasAddress()
                ? normalizeOptional(request.address(), null, "address")
                : school.getAddress();
        String sourceName = request.hasSourceName()
                ? normalizeOptional(request.sourceName(), 100, "sourceName")
                : school.getSourceName();
        String sourceCode = request.hasSourceCode()
                ? normalizeOptional(request.sourceCode(), 100, "sourceCode")
                : school.getSourceCode();
        boolean active = request.hasActive()
                ? requiredValue(request.active(), "active")
                : school.isActive();

        validateSourceIdentity(sourceName, sourceCode, school.getId());
        school.update(neighborhood, name, address, sourceName, sourceCode, active);
        return toResponse(schoolRepository.saveAndFlush(school));
    }

    @Transactional
    public SchoolResponse activateSchool(UUID id) {
        School school = detailedSchool(id);
        school.activate();
        return toResponse(schoolRepository.saveAndFlush(school));
    }

    @Transactional
    public SchoolResponse deactivateSchool(UUID id) {
        School school = detailedSchool(id);
        school.deactivate();
        return toResponse(schoolRepository.saveAndFlush(school));
    }

    private Neighborhood neighborhood(Long id) {
        requirePositive(id, "neighborhoodId");
        return neighborhoodRepository.findById(id)
                .orElseThrow(() -> GeographyApiException.notFound(
                        "neighborhood_not_found",
                        "Neighborhood was not found"
                ));
    }

    private School detailedSchool(UUID id) {
        return schoolRepository.findDetailedById(id)
                .orElseThrow(() -> GeographyApiException.notFound(
                        "school_not_found",
                        "School was not found"
                ));
    }

    private void validateSourceIdentity(String sourceName, String sourceCode, UUID schoolId) {
        if (sourceCode != null && sourceName == null) {
            throw GeographyApiException.validation(
                    "sourceName",
                    "is required when sourceCode is provided"
            );
        }
        if (sourceName == null || sourceCode == null) {
            return;
        }

        boolean duplicate = schoolId == null
                ? schoolRepository.existsBySourceNameAndSourceCode(sourceName, sourceCode)
                : schoolRepository.existsBySourceNameAndSourceCodeAndIdNot(sourceName, sourceCode, schoolId);
        if (duplicate) {
            throw GeographyApiException.conflict(
                    "school_source_conflict",
                    "A school with the same source identity already exists"
            );
        }
    }

    private SchoolResponse toResponse(School school) {
        Neighborhood neighborhood = school.getNeighborhood();
        District district = neighborhood.getDistrict();
        Province province = district.getProvince();
        return new SchoolResponse(
                school.getId(),
                neighborhood.getId(),
                neighborhood.getName(),
                district.getId(),
                district.getName(),
                province.getId(),
                province.getCode(),
                province.getName(),
                school.getName(),
                school.getAddress(),
                school.getSourceName(),
                school.getSourceCode(),
                school.isActive()
        );
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw GeographyApiException.validation("page", "must be zero or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw GeographyApiException.validation("size", "must be between 1 and 50");
        }
    }

    private String normalizeQuery(String query) {
        String normalized = normalizeOptional(query, 255, "query");
        return normalized == null ? null : normalized;
    }

    private String normalizeRequired(String value, String field, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            throw GeographyApiException.validation(field, "must not be blank");
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw GeographyApiException.validation(field, "must be at most " + maxLength + " characters");
        }
        return normalized;
    }

    private String normalizeOptional(String value, Integer maxLength, String field) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (maxLength != null && normalized.length() > maxLength) {
            throw GeographyApiException.validation(field, "must be at most " + maxLength + " characters");
        }
        return normalized;
    }

    private void requirePositive(Long value, String field) {
        if (value == null || value < 1) {
            throw GeographyApiException.validation(field, "must be a positive number");
        }
    }

    private void requirePositiveIfPresent(Long value, String field) {
        if (value != null) {
            requirePositive(value, field);
        }
    }

    private <T> T requiredValue(T value, String field) {
        if (value == null) {
            throw GeographyApiException.validation(field, "must not be null");
        }
        return value;
    }
}
