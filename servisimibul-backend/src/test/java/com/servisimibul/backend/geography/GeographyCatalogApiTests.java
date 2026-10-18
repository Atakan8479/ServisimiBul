package com.servisimibul.backend.geography;

import com.servisimibul.backend.geography.dto.GeographyDtos.SchoolResponse;
import com.servisimibul.backend.geography.service.GeographyCatalogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GeographyCatalogApiTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProvinceRepository provinceRepository;

    @Autowired
    private DistrictRepository districtRepository;

    @Autowired
    private NeighborhoodRepository neighborhoodRepository;

    @Autowired
    private SchoolRepository schoolRepository;

    @Autowired
    private GeographyCatalogService catalogService;

    @Test
    void anonymousReferenceReadsAreStableFilteredAndSessionless() throws Exception {
        Province istanbul = provinceRepository.save(new Province("34", "Istanbul"));
        Province ankara = provinceRepository.save(new Province("06", "Ankara"));
        District kadikoy = districtRepository.save(new District(istanbul, "Kadikoy"));
        District cankaya = districtRepository.save(new District(ankara, "Cankaya"));
        Neighborhood caferaga = neighborhoodRepository.save(new Neighborhood(kadikoy, "Caferaga"));
        neighborhoodRepository.save(new Neighborhood(cankaya, "Kizilay"));

        School active = schoolRepository.saveAndFlush(
                new School(caferaga, "Pilot Academy", "Public address", "MEB", "A-1")
        );
        School inactive = new School(caferaga, "Pilot Academy Inactive", null, "MEB", "A-2");
        inactive.deactivate();
        schoolRepository.saveAndFlush(inactive);

        var provincesResult = mockMvc.perform(get("/api/v1/provinces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Ankara"))
                .andExpect(jsonPath("$[1].name").value("Istanbul"))
                .andReturn();
        assertThat(provincesResult.getRequest().getSession(false)).isNull();

        mockMvc.perform(get("/api/v1/districts").param("provinceId", istanbul.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Kadikoy"))
                .andExpect(jsonPath("$[0].provinceId").value(istanbul.getId().intValue()));

        mockMvc.perform(get("/api/v1/neighborhoods").param("districtId", kadikoy.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Caferaga"))
                .andExpect(jsonPath("$[0].districtId").value(kadikoy.getId().intValue()));

        mockMvc.perform(get("/api/v1/schools")
                        .param("query", "academy")
                        .param("provinceId", istanbul.getId().toString())
                        .param("districtId", kadikoy.getId().toString())
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(active.getId().toString()))
                .andExpect(jsonPath("$.content[0].provinceCode").value("34"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1));

        mockMvc.perform(get("/api/v1/schools")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(active.getId().toString()));

        mockMvc.perform(get("/api/v1/schools/{id}", active.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Pilot Academy"));
        mockMvc.perform(get("/api/v1/schools/{id}", inactive.getId()))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("school_not_found"))
                .andExpect(jsonPath("$.instance").value("/api/v1/schools/" + inactive.getId()));
    }

    @Test
    void publicSchoolSearchUsesTurkishNormalizationAndValidatedSorts() throws Exception {
        Neighborhood neighborhood = createNeighborhood();
        School istiklal = schoolRepository.saveAndFlush(
                new School(neighborhood, "İSTANBUL IŞIK OKULU", null, null, null)
        );
        School cinar = schoolRepository.saveAndFlush(
                new School(neighborhood, "Çınar İlkokulu", null, null, null)
        );

        mockMvc.perform(get("/api/v1/schools")
                        .param("query", "istanbul isik")
                        .param("provinceId", neighborhood.getDistrict().getProvince().getId().toString())
                        .param("sort", "name-asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(istiklal.getId().toString()));

        mockMvc.perform(get("/api/v1/schools")
                        .param("query", "cinar")
                        .param("provinceId", neighborhood.getDistrict().getProvince().getId().toString())
                        .param("sort", "name-desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(cinar.getId().toString()));

        mockMvc.perform(get("/api/v1/schools").param("sort", "recent"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("validation_error"))
                .andExpect(jsonPath("$.fieldErrors.sort").exists());
    }

    @Test
    void publicSchoolSearchTreatsSqlWildcardsAsLiteralCharacters() throws Exception {
        Neighborhood neighborhood = createNeighborhood();
        School percent = schoolRepository.saveAndFlush(
                new School(neighborhood, "Yüzde % Okulu", null, null, null)
        );
        School underscore = schoolRepository.saveAndFlush(
                new School(neighborhood, "Alt_Çizgi Okulu", null, null, null)
        );
        School exclamation = schoolRepository.saveAndFlush(
                new School(neighborhood, "Dikkat! Okulu", null, null, null)
        );
        schoolRepository.saveAndFlush(
                new School(neighborhood, "Yüzde ve Alt Çizgi Okulu", null, null, null)
        );

        mockMvc.perform(get("/api/v1/schools").param("query", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(percent.getId().toString()));
        mockMvc.perform(get("/api/v1/schools").param("query", "_"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(underscore.getId().toString()));
        mockMvc.perform(get("/api/v1/schools").param("query", "!"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(exclamation.getId().toString()));
        mockMvc.perform(get("/api/v1/schools").param("query", "alt_cizgi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(underscore.getId().toString()));
    }

    @Test
    void publicSchoolPagingIsStableAndCanReachEveryMatchInBothDirections() throws Exception {
        Neighborhood neighborhood = createNeighborhood();
        Long provinceId = neighborhood.getDistrict().getProvince().getId();
        IntStream.range(0, 25)
                .mapToObj(index -> new School(
                        neighborhood,
                        "Okul %02d".formatted(index),
                        null,
                        null,
                        null
                ))
                .forEach(schoolRepository::save);
        schoolRepository.flush();

        mockMvc.perform(get("/api/v1/schools")
                        .param("provinceId", provinceId.toString())
                        .param("sort", "name-asc")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Okul 00"))
                .andExpect(jsonPath("$.content[9].name").value("Okul 09"))
                .andExpect(jsonPath("$.totalElements").value(25))
                .andExpect(jsonPath("$.totalPages").value(3));

        mockMvc.perform(get("/api/v1/schools")
                        .param("provinceId", provinceId.toString())
                        .param("sort", "name-asc")
                        .param("page", "2")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(5))
                .andExpect(jsonPath("$.content[0].name").value("Okul 20"))
                .andExpect(jsonPath("$.content[4].name").value("Okul 24"));

        mockMvc.perform(get("/api/v1/schools")
                        .param("provinceId", provinceId.toString())
                        .param("sort", "name-desc")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Okul 24"))
                .andExpect(jsonPath("$.content[9].name").value("Okul 15"));
    }

    @Test
    void equalNormalizedSchoolNamesUseUuidTieBreakerWithoutPagingGaps() {
        Neighborhood neighborhood = createNeighborhood();
        Long provinceId = neighborhood.getDistrict().getProvince().getId();
        List<UUID> expectedIds = IntStream.range(0, 23)
                .mapToObj(index -> schoolRepository.saveAndFlush(
                        new School(neighborhood, "Aynı Okul", null, null, null)
                ).getId())
                .toList();

        List<UUID> firstPass = equalNameSchoolPages(provinceId);
        List<UUID> secondPass = equalNameSchoolPages(provinceId);

        assertThat(firstPass).containsExactlyInAnyOrderElementsOf(expectedIds);
        assertThat(firstPass).doesNotHaveDuplicates();
        assertThat(secondPass).containsExactlyElementsOf(firstPass);
    }

    private List<UUID> equalNameSchoolPages(Long provinceId) {
        return IntStream.range(0, 3)
                .mapToObj(page -> catalogService.schools(
                        null,
                        provinceId,
                        null,
                        "name-asc",
                        page,
                        10
                ))
                .flatMap(result -> result.content().stream())
                .map(SchoolResponse::id)
                .toList();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanCreatePatchAndControlPublicVisibility() throws Exception {
        Neighborhood neighborhood = createNeighborhood();

        mockMvc.perform(post("/api/v1/admin/schools")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "neighborhoodId": %d,
                                  "name": "  Pilot School  ",
                                  "address": " Initial address ",
                                  "sourceName": " MEB ",
                                  "sourceCode": " 34-001 ",
                                  "active": true
                                }
                                """.formatted(neighborhood.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Pilot School"))
                .andExpect(jsonPath("$.address").value("Initial address"))
                .andExpect(jsonPath("$.sourceName").value("MEB"))
                .andExpect(jsonPath("$.sourceCode").value("34-001"))
                .andExpect(jsonPath("$.active").value(true));

        School school = schoolRepository.findAll().getFirst();
        UUID schoolId = school.getId();

        mockMvc.perform(patch("/api/v1/admin/schools/{id}", schoolId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Updated Pilot School",
                                  "address": null,
                                  "sourceName": null,
                                  "sourceCode": null
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Pilot School"))
                .andExpect(jsonPath("$.address").doesNotExist())
                .andExpect(jsonPath("$.sourceName").doesNotExist())
                .andExpect(jsonPath("$.sourceCode").doesNotExist());

        mockMvc.perform(post("/api/v1/admin/schools/{id}/deactivate", schoolId).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        mockMvc.perform(get("/api/v1/schools/{id}", schoolId))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/admin/schools").param("query", "updated"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(schoolId.toString()))
                .andExpect(jsonPath("$.content[0].active").value(false));

        mockMvc.perform(get("/api/v1/admin/schools"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(schoolId.toString()));

        mockMvc.perform(post("/api/v1/admin/schools/{id}/activate", schoolId).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        mockMvc.perform(get("/api/v1/schools/{id}", schoolId))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void sourceIdentityAndRequestBoundsReturnProblemDetails() throws Exception {
        Neighborhood neighborhood = createNeighborhood();
        schoolRepository.saveAndFlush(
                new School(neighborhood, "Existing School", null, "MEB", "DUPLICATE")
        );

        mockMvc.perform(post("/api/v1/admin/schools")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "neighborhoodId": %d,
                                  "name": "Duplicate School",
                                  "sourceName": "MEB",
                                  "sourceCode": "DUPLICATE",
                                  "active": true
                                }
                                """.formatted(neighborhood.getId())))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("school_source_conflict"));

        mockMvc.perform(post("/api/v1/admin/schools")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "neighborhoodId": %d,
                                  "name": "Missing Source Name",
                                  "sourceCode": "ONLY-CODE",
                                  "active": true
                                }
                                """.formatted(neighborhood.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"))
                .andExpect(jsonPath("$.fieldErrors.sourceName").exists());

        mockMvc.perform(post("/api/v1/admin/schools")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "neighborhoodId": 999999999,
                                  "name": "Unknown Geography School",
                                  "active": true
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("neighborhood_not_found"));

        mockMvc.perform(get("/api/v1/schools").param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_error"))
                .andExpect(jsonPath("$.fieldErrors.size").exists());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operatorCannotManagePilotSchoolCatalog() throws Exception {
        mockMvc.perform(get("/api/v1/admin/schools"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/admin/schools")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void anonymousUserCannotManagePilotSchoolCatalog() throws Exception {
        mockMvc.perform(get("/api/v1/admin/schools"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/admin/schools")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    private Neighborhood createNeighborhood() {
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District district = districtRepository.save(new District(province, "Kadikoy"));
        return neighborhoodRepository.saveAndFlush(new Neighborhood(district, "Caferaga"));
    }
}
