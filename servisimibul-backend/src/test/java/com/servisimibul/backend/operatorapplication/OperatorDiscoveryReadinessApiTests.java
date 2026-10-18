package com.servisimibul.backend.operatorapplication;

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
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OperatorDiscoveryReadinessApiTests {

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
    void anonymousIsRejectedAndAuthenticatedGetDoesNotRequireCsrf() throws Exception {
        mockMvc.perform(get("/api/v1/operator/discovery-readiness"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden());

        OperatorFixture operator = createOperator("readiness-no-school@example.com", true, true);
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(operator.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.discoveryEligible").value(false))
                .andExpect(jsonPath("$.hasActiveSchoolRelationship").value(false))
                .andExpect(jsonPath("$.hasEligibleSchoolCoverage").value(false))
                .andExpect(jsonPath("$.schools").isEmpty());
    }

    @Test
    void approvalAndProfileGatesAreReportedWithoutGrantingManagementAccess() throws Exception {
        Geography geography = createGeography();
        OperatorFixture draft = createOperator("readiness-draft@example.com", true, false);
        attachEligibleCoverage(draft, geography);

        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(draft.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalRequired").value(true))
                .andExpect(jsonPath("$.approvalSatisfied").value(false))
                .andExpect(jsonPath("$.hasEligibleSchoolCoverage").value(true))
                .andExpect(jsonPath("$.discoveryEligible").value(false));
        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", geography.firstSchool().getId().toString())
                        .param(
                                "neighborhoodId",
                                geography.crossDistrictNeighborhood().getId().toString()
                        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        OperatorFixture hidden = createOperator("readiness-hidden@example.com", true, true);
        attachEligibleCoverage(hidden, geography);
        hidden.profile().update(
                hidden.profile().getBusinessName(),
                hidden.profile().getContactPhone(),
                hidden.profile().getDescription(),
                false
        );
        profileRepository.flush();
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(hidden.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publiclyVisible").value(false))
                .andExpect(jsonPath("$.discoveryEligible").value(false));

        OperatorFixture suspended = createOperator("readiness-suspended@example.com", true, true);
        attachEligibleCoverage(suspended, geography);
        suspended.profile().suspend();
        profileRepository.flush();
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(suspended.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileActive").value(false))
                .andExpect(jsonPath("$.discoveryEligible").value(false));
    }

    @Test
    void disabledAndUnverifiedAccountsNeverQualify() throws Exception {
        Geography geography = createGeography();
        OperatorFixture disabled = createOperator("readiness-disabled@example.com", true, true);
        attachEligibleCoverage(disabled, geography);
        disabled.user().disable();
        userRepository.flush();
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(disabled.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountEnabled").value(false))
                .andExpect(jsonPath("$.discoveryEligible").value(false));

        OperatorFixture unverified = createOperator("readiness-unverified@example.com", false, true);
        attachEligibleCoverage(unverified, geography);
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(unverified.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.discoveryEligible").value(false));
    }

    @Test
    void schoolAndCoverageReadinessUsesOnlyActiveSameProvinceRelationships() throws Exception {
        Geography geography = createGeography();
        OperatorFixture operator = createOperator("readiness-schools@example.com", true, true);
        OperatorSchool noCoverage = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(operator.profile(), geography.firstSchool(), true)
        );

        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(operator.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasActiveSchoolRelationship").value(true))
                .andExpect(jsonPath("$.hasEligibleSchoolCoverage").value(false))
                .andExpect(jsonPath("$.schools[0].validCoverageCount").value(0))
                .andExpect(jsonPath("$.schools[0].contributesToDiscovery").value(false));

        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                noCoverage,
                geography.crossDistrictNeighborhood()
        ));
        noCoverage.setActive(false);
        operatorSchoolRepository.flush();
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(operator.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schools[0].relationshipActive").value(false))
                .andExpect(jsonPath("$.schools[0].validCoverageCount").value(1))
                .andExpect(jsonPath("$.schools[0].contributesToDiscovery").value(false));

        noCoverage.setActive(true);
        geography.firstSchool().deactivate();
        schoolRepository.flush();
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(operator.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schools[0].schoolActive").value(false))
                .andExpect(jsonPath("$.schools[0].contributesToDiscovery").value(false));
    }

    @Test
    void eligibleCrossDistrictCoverageAgreesWithPublicDiscoveryWithoutOptionalListings()
            throws Exception {
        Geography geography = createGeography();
        OperatorFixture operator = createOperator("readiness-eligible@example.com", true, true);
        OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(operator.profile(), geography.firstSchool(), true)
        );
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                relationship,
                geography.crossDistrictNeighborhood()
        ));

        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(operator.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.discoveryEligible").value(true))
                .andExpect(jsonPath("$.hasEligibleSchoolCoverage").value(true))
                .andExpect(jsonPath("$.schools[0].validCoverageCount").value(1))
                .andExpect(jsonPath("$.schools[0].contributesToDiscovery").value(true));

        mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", geography.firstSchool().getId().toString())
                        .param(
                                "neighborhoodId",
                                geography.crossDistrictNeighborhood().getId().toString()
                        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].operatorId")
                        .value(operator.profile().getId().toString()))
                .andExpect(jsonPath("$.content[0].publishedOfferings").isEmpty());
    }

    @Test
    void mismatchedCoverageDoesNotQualifyAndAnotherOperatorsSchoolsAreNotDisclosed()
            throws Exception {
        Geography geography = createGeography();
        Province foreignProvince = provinceRepository.save(new Province("06", "Ankara"));
        District foreignDistrict = districtRepository.save(
                new District(foreignProvince, "Cankaya")
        );
        Neighborhood foreignNeighborhood = neighborhoodRepository.saveAndFlush(
                new Neighborhood(foreignDistrict, "Kizilay")
        );
        OperatorFixture owner = createOperator("readiness-owner@example.com", true, true);
        OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(owner.profile(), geography.firstSchool(), true)
        );
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                relationship,
                foreignNeighborhood
        ));
        OperatorFixture other = createOperator("readiness-other@example.com", true, true);

        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(owner.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schools[0].validCoverageCount").value(0))
                .andExpect(jsonPath("$.discoveryEligible").value(false));
        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(other.user())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schools").isEmpty());
    }

    private OperatorFixture createOperator(String email, boolean verified, boolean approved) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        if (verified) {
            user.verifyEmail(OffsetDateTime.now());
        }
        userRepository.saveAndFlush(user);
        OperatorProfile profile = new OperatorProfile(user, "Readiness Service", "+905551112233");
        if (approved) {
            profile.submit();
            profile.approve();
        }
        profileRepository.saveAndFlush(profile);
        return new OperatorFixture(user, profile);
    }

    private Geography createGeography() {
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District schoolDistrict = districtRepository.save(new District(province, "Kadikoy"));
        District coverageDistrict = districtRepository.save(new District(province, "Uskudar"));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "Caferaga")
        );
        Neighborhood crossDistrictNeighborhood = neighborhoodRepository.save(
                new Neighborhood(coverageDistrict, "Acibadem")
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Readiness School", null, null, null)
        );
        return new Geography(school, crossDistrictNeighborhood);
    }

    private void attachEligibleCoverage(OperatorFixture operator, Geography geography) {
        OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(operator.profile(), geography.firstSchool(), true)
        );
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                relationship,
                geography.crossDistrictNeighborhood()
        ));
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

    private record OperatorFixture(AppUser user, OperatorProfile profile) {
    }

    private record Geography(
            School firstSchool,
            Neighborhood crossDistrictNeighborhood
    ) {
    }
}
