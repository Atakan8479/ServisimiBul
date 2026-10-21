package com.servisimibul.backend.demand;

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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.operator-approval.required=false")
@AutoConfigureMockMvc
@Transactional
class DemandServiceResponseApprovalDisabledTests {

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
    @Autowired
    private DemandRepository demandRepository;

    @Test
    void verifiedDraftOperatorPublishesWhenApprovalWaitingIsDisabled() throws Exception {
        Province province = provinceRepository.save(new Province("95", "Istanbul"));
        District district = districtRepository.save(new District(province, "Kadikoy"));
        Neighborhood neighborhood = neighborhoodRepository.saveAndFlush(
                new Neighborhood(district, "Moda")
        );
        School school = schoolRepository.saveAndFlush(
                new School(neighborhood, "Pilot Response School", null, null, null)
        );
        AppUser parent = AppUser.newParent("approval-disabled-parent@example.com", "hash");
        parent.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(parent);
        Demand demand = demandRepository.saveAndFlush(
                new Demand(school, neighborhood, "2026-2027", parent)
        );

        AppUser operator = AppUser.newOperator("approval-disabled-response@example.com", "hash");
        operator.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(operator);
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(operator, null, "+905551112233")
        );
        OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, school, true)
        );
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(relationship, neighborhood));

        mockMvc.perform(post("/api/v1/operator/demands/{id}/response", demand.getId())
                        .with(user(new AuthenticatedUser(
                                operator.getId(),
                                operator.getEmail(),
                                "hash",
                                operator.getRole(),
                                true
                        )))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"offersMorning\":true,\"offersAfternoon\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));
        mockMvc.perform(get("/api/v1/demands/{id}/responses", demand.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].businessName").isEmpty());

        assertThat(profileRepository.findById(profile.getId()).orElseThrow().getApprovalStatus())
                .isEqualTo(com.servisimibul.backend.identity.OperatorApprovalStatus.DRAFT);
    }
}
