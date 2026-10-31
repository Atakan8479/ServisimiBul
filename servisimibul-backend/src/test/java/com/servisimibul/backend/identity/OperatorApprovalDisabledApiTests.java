package com.servisimibul.backend.identity;

import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.DistrictRepository;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.geography.ProvinceRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import com.servisimibul.backend.offering.ServiceOffering;
import com.servisimibul.backend.offering.ServiceOfferingCoverage;
import com.servisimibul.backend.offering.ServiceOfferingCoverageRepository;
import com.servisimibul.backend.offering.ServiceOfferingRepository;
import com.servisimibul.backend.offering.Vehicle;
import com.servisimibul.backend.offering.VehicleRepository;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.operator-approval.required=false")
@AutoConfigureMockMvc
@Transactional
class OperatorApprovalDisabledApiTests {

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
    private OperatorSchoolCoverageRepository generalCoverageRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private ServiceOfferingRepository offeringRepository;

    @Autowired
    private ServiceOfferingCoverageRepository offeringCoverageRepository;

    @Test
    void draftOperatorCanManageProfileAndOwnedResourceAreaWithoutStatusMutation() throws Exception {
        AppUser operator = createOperator("pilot-draft@example.com");

        mockMvc.perform(get("/api/v1/auth/me").with(asUser(operator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.operatorApprovalRequired").value(false))
                .andExpect(jsonPath("$.approvalStatus").value("DRAFT"));
        mockMvc.perform(patch("/api/v1/operator/profile")
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"businessName\":\"Pilot Operator\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalStatus").value("DRAFT"));
        mockMvc.perform(get("/api/v1/operator/schools").with(asUser(operator)))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        mockMvc.perform(post("/api/v1/operator/application/submit")
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("approval_workflow_disabled"));
        mockMvc.perform(post("/api/v1/operator/application/resubmit")
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("approval_workflow_disabled"));
    }

    @Test
    void adminWorkflowWritesAreDisabledButAllOperatorListingAndSuspensionRemain() throws Exception {
        AppUser operator = createOperator("pilot-moderation@example.com");
        AppUser admin = createAdmin("pilot-admin@example.com");
        OperatorProfile profile = profileRepository.findByUserId(operator.getId()).orElseThrow();

        mockMvc.perform(get("/api/v1/admin/operators").with(asUser(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].approvalStatus").value("DRAFT"));
        mockMvc.perform(post("/api/v1/admin/operators/{id}/approve", profile.getId())
                        .with(asUser(admin))
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("approval_workflow_disabled"));
        mockMvc.perform(post("/api/v1/admin/operators/{id}/request-revision", profile.getId())
                        .with(asUser(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"not used\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("approval_workflow_disabled"));
        mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                        .with(asUser(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Pilot suspension\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.active").value(false))
                .andExpect(jsonPath("$.profile.approvalStatus").value("DRAFT"));
    }

    @Test
    void draftOperatorCanPublishEligibleOfferingWithoutApprovalStatusMutation() throws Exception {
        AppUser operator = createOperator("pilot-publish@example.com");
        OperatorProfile profile = profileRepository.findByUserId(operator.getId()).orElseThrow();
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District district = districtRepository.save(new District(province, "Kadikoy"));
        Neighborhood neighborhood = neighborhoodRepository.saveAndFlush(
                new Neighborhood(district, "Kozyatagi")
        );
        School school = schoolRepository.saveAndFlush(
                new School(neighborhood, "Pilot School", null, null, null)
        );
        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, school, true)
        );
        OperatorSchoolCoverage generalCoverage = generalCoverageRepository.saveAndFlush(
                new OperatorSchoolCoverage(operatorSchool, neighborhood)
        );
        Vehicle vehicle = vehicleRepository.saveAndFlush(new Vehicle(profile, "34PILOT01", 12));
        ServiceOffering offering = offeringRepository.saveAndFlush(
                new ServiceOffering(operatorSchool, vehicle, 8, "Pilot service")
        );
        offeringCoverageRepository.saveAndFlush(
                new ServiceOfferingCoverage(offering, generalCoverage)
        );

        mockMvc.perform(post("/api/v1/operator/offerings/{id}/publish", offering.getId())
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));

        OperatorProfile unchanged = profileRepository.findById(profile.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(unchanged.getApprovalStatus())
                .isEqualTo(OperatorApprovalStatus.DRAFT);
    }

    private AppUser createOperator(String email) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        user.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        profileRepository.saveAndFlush(new OperatorProfile(user, null, "+905551112233"));
        return user;
    }

    private AppUser createAdmin(String email) {
        AppUser user = AppUser.newAdmin(email, "test-password-hash");
        user.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(user);
    }

    private RequestPostProcessor asUser(AppUser user) {
        return SecurityMockMvcRequestPostProcessors.user(new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                "test-password-hash",
                user.getRole(),
                true
        ));
    }
}
