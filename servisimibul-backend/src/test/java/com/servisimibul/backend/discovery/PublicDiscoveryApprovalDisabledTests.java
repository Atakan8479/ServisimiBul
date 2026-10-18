package com.servisimibul.backend.discovery;

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
import com.servisimibul.backend.identity.OperatorApprovalStatus;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.operator-approval.required=false")
@AutoConfigureMockMvc
@Transactional
class PublicDiscoveryApprovalDisabledTests {

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
    private AppUserRepository userRepository;
    @Autowired
    private OperatorProfileRepository profileRepository;
    @Autowired
    private OperatorSchoolRepository operatorSchoolRepository;
    @Autowired
    private OperatorSchoolCoverageRepository coverageRepository;

    @Test
    void verifiedDraftOperatorWithNoVehicleOrOfferingIsDiscoverableWithoutCreatingSession()
            throws Exception {
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District district = districtRepository.save(new District(province, "Kadikoy"));
        Neighborhood neighborhood = neighborhoodRepository.saveAndFlush(
                new Neighborhood(district, "Moda")
        );
        School school = schoolRepository.saveAndFlush(
                new School(neighborhood, "Pilot School", null, null, null)
        );
        AppUser user = AppUser.newOperator("pilot-discovery@example.com", "hash");
        user.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(user, "Pilot Service", "+905551112233")
        );
        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, school, true)
        );
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(operatorSchool, neighborhood));

        var result = mockMvc.perform(get("/api/v1/operators")
                        .param("schoolId", school.getId().toString())
                        .param("neighborhoodId", neighborhood.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].businessName").value("Pilot Service"))
                .andExpect(jsonPath("$.content[0].publishedOfferings").isEmpty())
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
        assertThat(profileRepository.findById(profile.getId()).orElseThrow().getApprovalStatus())
                .isEqualTo(OperatorApprovalStatus.DRAFT);

        mockMvc.perform(get("/api/v1/operator/discovery-readiness")
                        .with(asOperator(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalRequired").value(false))
                .andExpect(jsonPath("$.approvalSatisfied").value(true))
                .andExpect(jsonPath("$.discoveryEligible").value(true))
                .andExpect(jsonPath("$.schools[0].contributesToDiscovery").value(true));
    }

    private RequestPostProcessor asOperator(AppUser user) {
        return user(new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                "hash",
                user.getRole(),
                true
        ));
    }
}
