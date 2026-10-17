package com.servisimibul.backend.operatorschool;

import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.DistrictRepository;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.geography.ProvinceRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OperatorSchoolApiTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private OperatorProfileRepository profileRepository;

    @Autowired
    private ProvinceRepository provinceRepository;

    @Autowired
    private DistrictRepository districtRepository;

    @Autowired
    private NeighborhoodRepository neighborhoodRepository;

    @Autowired
    private SchoolRepository schoolRepository;

    @Autowired
    private OperatorSchoolRepository operatorSchoolRepository;

    @Autowired
    private OperatorSchoolCoverageRepository coverageRepository;

    @Test
    void operatorCanManageOwnedSchoolAndCrossDistrictCoverage() throws Exception {
        AppUser operator = createOperator("coverage-owner@example.com", "Coverage Owner");
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District schoolDistrict = districtRepository.save(new District(province, "Kadikoy"));
        District coverageDistrict = districtRepository.save(new District(province, "Uskudar"));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "Caferaga")
        );
        Neighborhood crossDistrict = neighborhoodRepository.save(
                new Neighborhood(coverageDistrict, "Acibadem")
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Pilot School", null, null, null)
        );

        mockMvc.perform(post("/api/v1/operator/schools")
                        .with(asOperator(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"schoolId":"%s"}
                                """.formatted(school.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.schoolId").value(school.getId().toString()))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.coverage").isEmpty());

        OperatorSchool relationship = operatorSchoolRepository.findAll().getFirst();
        mockMvc.perform(put("/api/v1/operator/schools/{id}/coverage", relationship.getId())
                        .with(asOperator(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"neighborhoodIds":[%d,%d]}
                                """.formatted(schoolNeighborhood.getId(), crossDistrict.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverage.length()").value(2))
                .andExpect(jsonPath("$.coverage[0].districtName").value("Kadikoy"))
                .andExpect(jsonPath("$.coverage[1].districtName").value("Uskudar"));

        mockMvc.perform(get("/api/v1/operator/schools")
                        .with(asOperator(operator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(relationship.getId().toString()))
                .andExpect(jsonPath("$[0].coverage.length()").value(2));

        mockMvc.perform(patch("/api/v1/operator/schools/{id}", relationship.getId())
                        .with(asOperator(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(delete("/api/v1/operator/schools/{id}", relationship.getId())
                        .with(asOperator(operator))
                        .with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(operatorSchoolRepository.findById(relationship.getId())).isEmpty();
        assertThat(coverageRepository.findAll()).isEmpty();
    }

    @Test
    void duplicateAndInactiveSchoolAttachmentsAreRejected() throws Exception {
        AppUser operator = createOperator("duplicate-owner@example.com", "Duplicate Owner");
        Neighborhood neighborhood = createNeighborhood("34", "Istanbul", "Besiktas", "Levent");
        School activeSchool = schoolRepository.saveAndFlush(
                new School(neighborhood, "Active School", null, null, null)
        );
        School inactiveSchool = new School(neighborhood, "Inactive School", null, null, null);
        inactiveSchool.deactivate();
        schoolRepository.saveAndFlush(inactiveSchool);

        createRelationship(operator, activeSchool);

        mockMvc.perform(post("/api/v1/operator/schools")
                        .with(asOperator(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schoolId\":\"%s\"}".formatted(activeSchool.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("operator_school_duplicate"));

        mockMvc.perform(post("/api/v1/operator/schools")
                        .with(asOperator(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schoolId\":\"%s\"}".formatted(inactiveSchool.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("school_inactive"));
    }

    @Test
    void coverageRejectsDuplicatesAndCrossProvinceWithoutChangingExistingSet() throws Exception {
        AppUser operator = createOperator("province-owner@example.com", "Province Owner");
        Neighborhood schoolNeighborhood = createNeighborhood("34", "Istanbul", "Sariyer", "Tarabya");
        Neighborhood foreignNeighborhood = createNeighborhood("06", "Ankara", "Cankaya", "Kizilay");
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Province School", null, null, null)
        );
        OperatorSchool relationship = createRelationship(operator, school);
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(relationship, schoolNeighborhood));

        mockMvc.perform(put("/api/v1/operator/schools/{id}/coverage", relationship.getId())
                        .with(asOperator(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"neighborhoodIds":[%d,%d]}
                                """.formatted(schoolNeighborhood.getId(), schoolNeighborhood.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("coverage_duplicate"));

        mockMvc.perform(put("/api/v1/operator/schools/{id}/coverage", relationship.getId())
                        .with(asOperator(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"neighborhoodIds":[%d]}
                                """.formatted(foreignNeighborhood.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("coverage_province_mismatch"))
                .andExpect(jsonPath("$.fieldErrors.neighborhoodIds").exists());

        assertThat(coverageRepository.findAllDetailedByOperatorSchoolId(relationship.getId()))
                .extracting(coverage -> coverage.getNeighborhood().getId())
                .containsExactly(schoolNeighborhood.getId());
    }

    @Test
    void anotherOperatorsRelationshipIsNotDisclosedOrMutable() throws Exception {
        AppUser owner = createOperator("private-owner@example.com", "Private Owner");
        AppUser other = createOperator("other-owner@example.com", "Other Owner");
        Neighborhood neighborhood = createNeighborhood("34", "Istanbul", "Bakirkoy", "Atakoy");
        School school = schoolRepository.saveAndFlush(
                new School(neighborhood, "Private School", null, null, null)
        );
        OperatorSchool relationship = createRelationship(owner, school);

        mockMvc.perform(get("/api/v1/operator/schools").with(asOperator(other)))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
        mockMvc.perform(patch("/api/v1/operator/schools/{id}", relationship.getId())
                        .with(asOperator(other))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("operator_school_not_found"));
        mockMvc.perform(put("/api/v1/operator/schools/{id}/coverage", relationship.getId())
                        .with(asOperator(other))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"neighborhoodIds\":[]}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/operator/schools/{id}", relationship.getId())
                        .with(asOperator(other))
                        .with(csrf()))
                .andExpect(status().isNotFound());
        assertThat(operatorSchoolRepository.findById(relationship.getId())).isPresent();
    }

    @Test
    void operatorMutationsRequireAuthenticationAndCsrf() throws Exception {
        mockMvc.perform(post("/api/v1/operator/schools")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());

        AppUser operator = createOperator("csrf-owner@example.com", "Csrf Owner");
        mockMvc.perform(post("/api/v1/operator/schools")
                        .with(asOperator(operator))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    private AppUser createOperator(String email, String businessName) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        user.verifyEmail(java.time.OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        OperatorProfile profile = new OperatorProfile(user, businessName, "+905551112233");
        profile.submit();
        profile.approve();
        profileRepository.saveAndFlush(profile);
        return user;
    }

    private Neighborhood createNeighborhood(
            String provinceCode,
            String provinceName,
            String districtName,
            String neighborhoodName
    ) {
        Province province = provinceRepository.save(new Province(provinceCode, provinceName));
        District district = districtRepository.save(new District(province, districtName));
        return neighborhoodRepository.saveAndFlush(new Neighborhood(district, neighborhoodName));
    }

    private OperatorSchool createRelationship(AppUser user, School school) {
        OperatorProfile profile = profileRepository.findByUserId(user.getId()).orElseThrow();
        return operatorSchoolRepository.saveAndFlush(new OperatorSchool(profile, school, true));
    }

    private RequestPostProcessor asOperator(AppUser user) {
        return user(new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                "test-password-hash",
                user.getRole(),
                true
        ));
    }
}
