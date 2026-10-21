package com.servisimibul.backend.demand.comment;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandSupport;
import com.servisimibul.backend.demand.DemandSupportRepository;
import com.servisimibul.backend.demand.SupportReason;
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
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
import com.servisimibul.backend.operatorschool.OperatorSchoolCoverageRepository;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DemandCommentApiTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private ProvinceRepository provinceRepository;

    @Autowired
    private DistrictRepository districtRepository;

    @Autowired
    private NeighborhoodRepository neighborhoodRepository;

    @Autowired
    private SchoolRepository schoolRepository;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private DemandSupportRepository supportRepository;

    @Autowired
    private DemandCommentRepository commentRepository;

    @Autowired
    private OperatorProfileRepository operatorProfileRepository;

    @Autowired
    private OperatorSchoolRepository operatorSchoolRepository;

    @Autowired
    private OperatorSchoolCoverageRepository coverageRepository;

    @Test
    void anonymousListingShowsPublishedTextAndParentPseudonymWithoutIdentity() throws Exception {
        Fixture fixture = fixture("public");
        AppUser parent = parent("public-parent@example.com");
        Demand demand = demand(fixture, parent);
        String body = "<script>alert('x')</script> Güvenli metin";

        MvcResult created = mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(as(parent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.body").value(body))
                .andExpect(jsonPath("$.author.role").value("PARENT"))
                .andExpect(jsonPath("$.author.displayName").value("Veli"))
                .andExpect(jsonPath("$.author.operatorProfileId").doesNotExist())
                .andExpect(jsonPath("$.canDelete").value(true))
                .andReturn();
        assertThat(created.getResponse().getContentAsString()).doesNotContain(parent.getEmail());

        mockMvc.perform(get("/api/v1/demands/{id}/comments", demand.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].body").value(body))
                .andExpect(jsonPath("$.content[0].author.displayName").value("Veli"))
                .andExpect(jsonPath("$.content[0].canDelete").value(false));

        DemandComment comment = commentRepository.findAll().getFirst();
        comment.hide();
        commentRepository.saveAndFlush(comment);
        mockMvc.perform(get("/api/v1/demands/{id}/comments", demand.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void creationRequiresCsrfAndAnEligibleParentOrOperator() throws Exception {
        Fixture fixture = fixture("eligibility");
        AppUser supportingParent = parent("eligible-parent@example.com");
        Demand demand = demand(fixture, supportingParent);
        AppUser otherParent = parent("other-parent@example.com");

        mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody("Anonymous comment")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(as(supportingParent))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody("Missing CSRF")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(as(otherParent))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody("No active support")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("active_support_required"));
        mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(user(new AuthenticatedUser(
                                UUID.randomUUID(),
                                "admin@example.com",
                                "hash",
                                UserRole.ADMIN,
                                true
                        )))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody("Admin comment")))
                .andExpect(status().isForbidden());

        Operator operator = operator("eligible-operator@example.com", "Ulaşım AŞ", true);
        mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(as(operator.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody("Uygun güzergâhı değerlendirebiliriz.")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.author.role").value("OPERATOR"))
                .andExpect(jsonPath("$.author.displayName").value("Servis işletmecisi"))
                .andExpect(jsonPath("$.author.operatorProfileId").doesNotExist());

        operator.profile().suspend();
        operatorProfileRepository.saveAndFlush(operator.profile());
        mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(as(operator.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody("Suspended operator")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("operator_suspended"));
    }

    @Test
    void operatorIdentityLinksOnlyWhenTheExistingPublicationPredicateMatches() throws Exception {
        Fixture fixture = fixture("operator-link");
        AppUser parent = parent("link-parent@example.com");
        Demand demand = demand(fixture, parent);
        Operator operator = operator("public-operator@example.com", "Mavi Servis", true);
        OperatorSchool relationship = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(operator.profile(), fixture.school(), true)
        );
        coverageRepository.saveAndFlush(new OperatorSchoolCoverage(relationship, fixture.pickup()));

        mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                        .with(as(operator.user()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody("Bu bölgede hizmet veriyoruz.")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.author.displayName").value("Mavi Servis"))
                .andExpect(jsonPath("$.author.operatorProfileId")
                        .value(operator.profile().getId().toString()));

        operator.profile().update("Mavi Servis", "+905321234567", null, false);
        operatorProfileRepository.saveAndFlush(operator.profile());
        mockMvc.perform(get("/api/v1/demands/{id}/comments", demand.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].author.displayName")
                        .value("Servis işletmecisi"))
                .andExpect(jsonPath("$.content[0].author.operatorProfileId").doesNotExist());
    }

    @Test
    void duplicateAndAccountRateControlsRejectSpam() throws Exception {
        Fixture fixture = fixture("spam");
        AppUser parent = parent("spam-parent@example.com");
        Demand demand = demand(fixture, parent);

        postComment(demand, parent, "Aynı yorum").andExpect(status().isCreated());
        postComment(demand, parent, "Aynı yorum")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("duplicate_comment"));
        postComment(demand, parent, "İkinci yorum").andExpect(status().isCreated());
        postComment(demand, parent, "Üçüncü yorum").andExpect(status().isCreated());
        postComment(demand, parent, "Dördüncü yorum").andExpect(status().isCreated());
        postComment(demand, parent, "Limit üstü yorum")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void authorCanDeleteWhileOthersCannotAndPaginationIsServerSide() throws Exception {
        Fixture fixture = fixture("delete");
        AppUser author = parent("delete-author@example.com");
        AppUser other = parent("delete-other@example.com");
        Demand demand = demand(fixture, author);
        supportRepository.saveAndFlush(new DemandSupport(
                demand,
                other,
                true,
                false,
                Set.of(SupportReason.OTHER)
        ));

        UUID firstId = commentId(postComment(demand, author, "Birinci yorum")
                .andExpect(status().isCreated())
                .andReturn());
        postComment(demand, author, "İkinci yorum").andExpect(status().isCreated());
        mockMvc.perform(get("/api/v1/demands/{id}/comments", demand.getId())
                        .with(as(author))
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].canDelete").value(true))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(delete(
                        "/api/v1/demands/{demandId}/comments/{commentId}",
                        demand.getId(),
                        firstId
                ).with(as(other)).with(csrf()))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(
                        "/api/v1/demands/{demandId}/comments/{commentId}",
                        demand.getId(),
                        firstId
                ).with(as(author)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(commentRepository.findById(firstId)).isEmpty();

        mockMvc.perform(get("/api/v1/demands/{id}/comments", demand.getId()).param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.size").exists());
        postComment(demand, author, " ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.body").exists());
    }

    private org.springframework.test.web.servlet.ResultActions postComment(
            Demand demand,
            AppUser author,
            String body
    ) throws Exception {
        return mockMvc.perform(post("/api/v1/demands/{id}/comments", demand.getId())
                .with(as(author))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonBody(body)));
    }

    private UUID commentId(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        return UUID.fromString(body.path("id").asText());
    }

    private String jsonBody(String body) throws Exception {
        return objectMapper.writeValueAsString(java.util.Map.of("body", body));
    }

    private Fixture fixture(String suffix) {
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District schoolDistrict = districtRepository.save(new District(province, "School " + suffix));
        District pickupDistrict = districtRepository.save(new District(province, "Pickup " + suffix));
        Neighborhood schoolNeighborhood = neighborhoodRepository.save(
                new Neighborhood(schoolDistrict, "School neighborhood " + suffix)
        );
        Neighborhood pickup = neighborhoodRepository.saveAndFlush(
                new Neighborhood(pickupDistrict, "Pickup neighborhood " + suffix)
        );
        School school = schoolRepository.saveAndFlush(
                new School(schoolNeighborhood, "School " + suffix, null, null, null)
        );
        return new Fixture(school, pickup);
    }

    private Demand demand(Fixture fixture, AppUser creator) {
        Demand demand = demandRepository.saveAndFlush(
                new Demand(fixture.school(), fixture.pickup(), "2026-2027", creator)
        );
        supportRepository.saveAndFlush(new DemandSupport(
                demand,
                creator,
                true,
                false,
                Set.of(SupportReason.NO_SUITABLE_SERVICE)
        ));
        return demand;
    }

    private AppUser parent(String email) {
        AppUser parent = AppUser.newParent(email, "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private Operator operator(String email, String businessName, boolean visible) {
        AppUser user = AppUser.newOperator(email, "test-password-hash");
        user.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(user);
        OperatorProfile profile = new OperatorProfile(user, businessName, "+905321234567");
        profile.submit();
        profile.approve();
        profile.update(businessName, "+905321234567", null, visible);
        operatorProfileRepository.saveAndFlush(profile);
        return new Operator(user, profile);
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

    private record Fixture(School school, Neighborhood pickup) {
    }

    private record Operator(AppUser user, OperatorProfile profile) {
    }
}
