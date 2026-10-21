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
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DemandServiceResponseApiTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private EntityManager entityManager;
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
    @Autowired
    private DemandServiceResponseRepository responseRepository;
    @Autowired
    private DemandServicePublicationEventRepository eventRepository;

    @Test
    void eligibleOperatorPublishesImmediatelyAndLifecycleIsIdempotent() throws Exception {
        Fixture fixture = fixture("response-owner@example.com", true);

        MvcResult first = mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.response.status").value("ACTIVE"))
                .andExpect(jsonPath("$.response.publicationVersion").value(1))
                .andExpect(jsonPath("$.response.currentlyPublic").value(true))
                .andReturn();
        JsonNode firstResponse = body(first).path("response");
        UUID responseId = UUID.fromString(firstResponse.path("id").asText());
        UUID firstEventId = UUID.fromString(firstResponse.path("publicationEventId").asText());

        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(responseId.toString()))
                .andExpect(jsonPath("$.content[0].publicationEventId").value(firstEventId.toString()))
                .andExpect(jsonPath("$.content[0].businessName").value("Response Operator"))
                .andExpect(jsonPath("$.content[0].contactPhone").value("+905551112233"))
                .andExpect(jsonPath("$.content[0].offersMorning").value(true))
                .andExpect(jsonPath("$.content[0].offersAfternoon").value(false));

        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(false, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.response.id").value(responseId.toString()))
                .andExpect(jsonPath("$.response.publicationEventId").value(firstEventId.toString()))
                .andExpect(jsonPath("$.response.offersMorning").value(true))
                .andExpect(jsonPath("$.response.offersAfternoon").value(false));
        assertThat(responseRepository.count()).isOne();
        assertThat(eventRepository.countByResponseId(responseId)).isOne();

        mockMvc.perform(delete(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.currentlyPublic").value(false));
        mockMvc.perform(delete(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        MvcResult republished = mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(false, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.response.id").value(responseId.toString()))
                .andExpect(jsonPath("$.response.publicationVersion").value(2))
                .andExpect(jsonPath("$.response.offersMorning").value(false))
                .andExpect(jsonPath("$.response.offersAfternoon").value(true))
                .andReturn();
        UUID secondEventId = UUID.fromString(
                body(republished).path("response").path("publicationEventId").asText()
        );
        assertThat(secondEventId).isNotEqualTo(firstEventId);
        assertThat(eventRepository.countByResponseId(responseId)).isEqualTo(2);
    }

    @Test
    void currentEligibilityInvalidatesPublicDisplayWithoutChangingResponseHistory() throws Exception {
        Fixture fixture = fixture("response-invalidation@example.com", true);
        publish(fixture);

        fixture.profile().update(
                fixture.profile().getBusinessName(),
                fixture.profile().getContactPhone(),
                fixture.profile().getDescription(),
                false
        );
        profileRepository.flush();
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligible").value(false))
                .andExpect(jsonPath("$.blockers[0]").value("PROFILE_HIDDEN"))
                .andExpect(jsonPath("$.response.currentlyPublic").value(false));

        fixture.profile().update(
                fixture.profile().getBusinessName(),
                fixture.profile().getContactPhone(),
                fixture.profile().getDescription(),
                true
        );
        coverageRepository.deleteAllByOperatorSchoolId(fixture.operatorSchool().getId());
        coverageRepository.flush();
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockers[0]").value("COVERAGE_MISSING"));

        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(
                fixture.operatorSchool(),
                fixture.pickup()
        ));
        mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        assertThat(responseRepository.count()).isOne();
        assertThat(eventRepository.count()).isOne();
    }

    @Test
    void missingCoverageClosedDemandAndCrossOwnerMutationFailClosed() throws Exception {
        Fixture owner = fixture("response-scope-owner@example.com", false);
        Fixture other = operatorForExistingDemand(
                "response-scope-other@example.com",
                owner,
                true
        );

        mockMvc.perform(post(operatorPath(owner.demand()))
                        .with(as(owner.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("operator_coverage_required"));

        publish(other);
        mockMvc.perform(delete(operatorPath(owner.demand()))
                        .with(as(owner.operatorUser()))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("demand_service_response_not_found"));
        mockMvc.perform(get(publicPath(owner.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        jdbcTemplate.update("update demand set status = 'CLOSED' where id = ?", owner.demand().getId());
        entityManager.clear();
        mockMvc.perform(get(publicPath(owner.demand())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(post(operatorPath(owner.demand()))
                        .with(as(other.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, true)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("demand_not_open"));
    }

    @Test
    void operatorMutationRequiresRoleAndCsrfAndDirections() throws Exception {
        Fixture fixture = fixture("response-security@example.com", true);
        AppUser parent = verifiedParent("response-parent-role@example.com");

        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(false, false)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.offersMorning").exists());

        MvcResult result = mockMvc.perform(get(publicPath(fixture.demand())))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void safeDefaultRequiresApprovedOperator() throws Exception {
        Fixture draft = fixture("response-draft@example.com", true, false);

        mockMvc.perform(get(operatorPath(draft.demand()))
                        .with(as(draft.operatorUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligible").value(false))
                .andExpect(jsonPath("$.blockers[0]").value("APPROVAL_REQUIRED"));
        mockMvc.perform(post(operatorPath(draft.demand()))
                        .with(as(draft.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("operator_approval_required"));
    }

    private void publish(Fixture fixture) throws Exception {
        mockMvc.perform(post(operatorPath(fixture.demand()))
                        .with(as(fixture.operatorUser()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(directionBody(true, false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true));
    }

    private Fixture fixture(String email, boolean withCoverage) {
        return fixture(email, withCoverage, true);
    }

    private Fixture fixture(String email, boolean withCoverage, boolean approved) {
        Province province = provinceRepository.save(new Province(uniqueCode(), "Istanbul"));
        District schoolDistrict = districtRepository.save(new District(province, "Kadikoy"));
        District pickupDistrict = districtRepository.save(new District(province, "Uskudar"));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "Caferaga")
        );
        Neighborhood pickup = neighborhoodRepository.saveAndFlush(
                new Neighborhood(pickupDistrict, "Acibadem")
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "Response School", null, null, null)
        );
        Demand demand = demandRepository.saveAndFlush(new Demand(
                school,
                pickup,
                "2026-2027",
                verifiedParent("creator-" + email)
        ));
        OperatorFixture operator = createOperator(email, school, pickup, withCoverage, approved);
        return new Fixture(
                demand,
                pickup,
                operator.user(),
                operator.profile(),
                operator.operatorSchool()
        );
    }

    private Fixture operatorForExistingDemand(
            String email,
            Fixture existing,
            boolean withCoverage
    ) {
        OperatorFixture operator = createOperator(
                email,
                existing.demand().getSchool(),
                existing.pickup(),
                withCoverage,
                true
        );
        return new Fixture(
                existing.demand(),
                existing.pickup(),
                operator.user(),
                operator.profile(),
                operator.operatorSchool()
        );
    }

    private OperatorFixture createOperator(
            String email,
            School school,
            Neighborhood pickup,
            boolean withCoverage,
            boolean approved
    ) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        user.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        OperatorProfile profile = new OperatorProfile(
                user,
                "Response Operator",
                "+905551112233"
        );
        if (approved) {
            profile.submit();
            profile.approve();
        }
        profileRepository.saveAndFlush(profile);
        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, school, true)
        );
        if (withCoverage) {
            coverageRepository.saveAndFlush(new OperatorSchoolCoverage(operatorSchool, pickup));
        }
        return new OperatorFixture(user, profile, operatorSchool);
    }

    private AppUser verifiedParent(String email) {
        AppUser parent = AppUser.newParent(email, "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String operatorPath(Demand demand) {
        return "/api/v1/operator/demands/%s/response".formatted(demand.getId());
    }

    private String publicPath(Demand demand) {
        return "/api/v1/demands/%s/responses".formatted(demand.getId());
    }

    private String directionBody(boolean morning, boolean afternoon) {
        return """
                {"offersMorning":%s,"offersAfternoon":%s}
                """.formatted(morning, afternoon);
    }

    private RequestPostProcessor as(AppUser user) {
        return user(new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                "test-password-hash",
                user.getRole(),
                true
        ));
    }

    private String uniqueCode() {
        return UUID.randomUUID().toString().substring(0, 2);
    }

    private record OperatorFixture(
            AppUser user,
            OperatorProfile profile,
            OperatorSchool operatorSchool
    ) {
    }

    private record Fixture(
            Demand demand,
            Neighborhood pickup,
            AppUser operatorUser,
            OperatorProfile profile,
            OperatorSchool operatorSchool
    ) {
    }
}
