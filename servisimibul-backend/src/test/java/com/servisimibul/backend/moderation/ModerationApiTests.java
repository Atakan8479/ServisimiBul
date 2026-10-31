package com.servisimibul.backend.moderation;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandSupport;
import com.servisimibul.backend.demand.DemandSupportRepository;
import com.servisimibul.backend.demand.SupportReason;
import com.servisimibul.backend.demand.comment.DemandComment;
import com.servisimibul.backend.demand.comment.DemandCommentRepository;
import com.servisimibul.backend.demand.comment.DemandCommentStatus;
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
import com.servisimibul.backend.identity.OperatorApplicationReviewRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.ReviewDecision;
import com.servisimibul.backend.demand.DemandServiceResponse;
import com.servisimibul.backend.demand.DemandServiceResponseRepository;
import com.servisimibul.backend.operatorschool.OperatorSchool;
import com.servisimibul.backend.operatorschool.OperatorSchoolRepository;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.notification.InAppNotificationRepository;
import com.servisimibul.backend.notification.NotificationType;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "servisimibul.admin-bootstrap.enabled=true",
        "servisimibul.admin-bootstrap.first-email=moderation-admin-one@example.com",
        "servisimibul.admin-bootstrap.first-password=moderation admin one password",
        "servisimibul.admin-bootstrap.second-email=moderation-admin-two@example.com",
        "servisimibul.admin-bootstrap.second-password=moderation admin two password"
})
@AutoConfigureMockMvc
@Transactional
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ModerationApiTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppUserRepository userRepository;
    @Autowired private ProvinceRepository provinceRepository;
    @Autowired private DistrictRepository districtRepository;
    @Autowired private NeighborhoodRepository neighborhoodRepository;
    @Autowired private SchoolRepository schoolRepository;
    @Autowired private DemandRepository demandRepository;
    @Autowired private DemandSupportRepository supportRepository;
    @Autowired private DemandCommentRepository commentRepository;
    @Autowired private ModerationCaseRepository caseRepository;
    @Autowired private ContentReportRepository reportRepository;
    @Autowired private ModerationAuditEventRepository auditRepository;
    @Autowired private InAppNotificationRepository notificationRepository;
    @Autowired private OperatorProfileRepository profileRepository;
    @Autowired private OperatorSchoolRepository operatorSchoolRepository;
    @Autowired private DemandServiceResponseRepository responseRepository;
    @Autowired private OperatorApplicationReviewRepository reviewRepository;

    @AfterAll
    void removeBootstrapAdmins() {
        userRepository.findByEmail("moderation-admin-one@example.com").ifPresent(userRepository::delete);
        userRepository.findByEmail("moderation-admin-two@example.com").ifPresent(userRepository::delete);
        userRepository.flush();
    }

    @Test
    void reportRequiresEligibleAccountAndCsrfWithoutChangingVisibility() throws Exception {
        Fixture fixture = fixture("eligibility");
        AppUser author = parent("moderation-author@example.com");
        AppUser reporter = parent("moderation-reporter@example.com");
        Demand demand = demand(fixture, author);
        DemandComment comment = commentRepository.saveAndFlush(
                new DemandComment(demand, author, "A legitimate critical comment")
        );

        mockMvc.perform(post("/api/v1/reports")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("COMMENT", comment.getId(), "ABUSE_HARASSMENT", null)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/reports")
                        .with(as(reporter))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("COMMENT", comment.getId(), "ABUSE_HARASSMENT", null)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/reports")
                        .with(as(reporter))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reportBody("COMMENT", comment.getId(), "ABUSE_HARASSMENT", "Repeated insults")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetType").value("COMMENT"))
                .andExpect(jsonPath("$.targetId").value(comment.getId().toString()))
                .andExpect(jsonPath("$.status").value("OPEN"));

        assertThat(commentRepository.findById(comment.getId()).orElseThrow().getStatus())
                .isEqualTo(DemandCommentStatus.PUBLISHED);
        mockMvc.perform(get("/api/v1/demands/{id}/comments", demand.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].body").value("A legitimate critical comment"));
    }

    @Test
    void duplicateReporterIsRejectedAndDifferentReportersAreGrouped() throws Exception {
        Fixture fixture = fixture("grouping");
        AppUser creator = parent("grouping-creator@example.com");
        AppUser first = parent("grouping-first@example.com");
        AppUser second = parent("grouping-second@example.com");
        Demand demand = demand(fixture, creator);

        MvcResult firstReport = report(first, "DEMAND", demand.getId(), "MISLEADING_SERVICE", "Incorrect details")
                .andExpect(status().isCreated())
                .andReturn();
        UUID caseId = UUID.fromString(json(firstReport).path("caseId").asText());
        report(first, "DEMAND", demand.getId(), "OTHER", "Same reporter")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("report_already_open"));
        report(second, "DEMAND", demand.getId(), "PERSONAL_DATA", "Personal information")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.caseId").value(caseId.toString()));

        assertThat(caseRepository.count()).isEqualTo(1);
        assertThat(reportRepository.count()).isEqualTo(2);
        AppUser admin = userRepository.findByEmail("moderation-admin-one@example.com").orElseThrow();
        assertThat(notificationRepository.countByRecipientUserIdAndType(
                admin.getId(), NotificationType.CONTENT_REPORTED
        )).isEqualTo(2);
    }

    @Test
    void enabledOperatorCanReportAndSuspendedReporterIsRejected() throws Exception {
        Fixture fixture = fixture("operator-reporter");
        AppUser creator = parent("operator-reporter-creator@example.com");
        AppUser operator = operator("active-operator-reporter@example.com");
        AppUser suspendedOperator = operator("suspended-operator-reporter@example.com");
        suspendedOperator.disable();
        userRepository.flush();
        Demand demand = demand(fixture, creator);

        report(operator, "DEMAND", demand.getId(), "OTHER", "Needs administrator review")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetType").value("DEMAND"));

        report(suspendedOperator, "DEMAND", demand.getId(), "OTHER", "Suspended account attempt")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("reporter_ineligible"));
    }

    @Test
    void adminQueueProtectsReporterIdentityAndHideRestoreAreAudited() throws Exception {
        Fixture fixture = fixture("admin");
        AppUser author = parent("admin-author@example.com");
        AppUser reporter = parent("private-reporter@example.com");
        AppUser admin = userRepository.findByEmail("moderation-admin-one@example.com").orElseThrow();
        Demand demand = demand(fixture, author);
        DemandComment comment = commentRepository.saveAndFlush(
                new DemandComment(demand, author, "Moderated content")
        );
        MvcResult report = report(reporter, "COMMENT", comment.getId(), "SPAM_ADVERTISING", "Repeated advertising")
                .andExpect(status().isCreated())
                .andReturn();
        UUID caseId = UUID.fromString(json(report).path("caseId").asText());

        mockMvc.perform(get("/api/v1/admin/moderation/cases").with(as(reporter)))
                .andExpect(status().isForbidden());
        MvcResult queue = mockMvc.perform(get("/api/v1/admin/moderation/cases")
                        .with(as(admin))
                        .param("status", "OPEN")
                        .param("targetType", "COMMENT")
                        .param("reason", "SPAM_ADVERTISING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].reporterCount").value(1))
                .andExpect(jsonPath("$.content[0].target.snapshot").value("Moderated content"))
                .andReturn();
        assertThat(queue.getResponse().getContentAsString())
                .doesNotContain(reporter.getEmail())
                .doesNotContain(reporter.getId().toString());

        mockMvc.perform(post("/api/v1/admin/moderation/cases/{id}/actions", caseId)
                        .with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(actionBody("HIDE_COMMENT", "Contains repeated advertising")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/moderation/cases/{id}/actions", caseId)
                        .with(as(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(actionBody("HIDE_COMMENT", "Contains repeated advertising")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.status").value("RESOLVED"))
                .andExpect(jsonPath("$.summary.target.currentlyVisible").value(false))
                .andExpect(jsonPath("$.audit[0].action").value("HIDE_COMMENT"));
        assertThat(commentRepository.findById(comment.getId()).orElseThrow().getStatus())
                .isEqualTo(DemandCommentStatus.HIDDEN);

        mockMvc.perform(post("/api/v1/admin/moderation/cases/{id}/actions", caseId)
                        .with(as(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(actionBody("RESTORE_COMMENT", "Review confirmed restoration")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.target.currentlyVisible").value(true))
                .andExpect(jsonPath("$.audit.length()").value(2));
        assertThat(auditRepository.count()).isEqualTo(2);
    }

    @Test
    void malformedOrNonReportableTargetsDoNotLeakTheirExistence() throws Exception {
        AppUser reporter = parent("forgery-reporter@example.com");
        report(reporter, "COMMENT", UUID.randomUUID(), "OTHER", "Unknown content")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("report_target_not_found"));
        mockMvc.perform(post("/api/v1/reports")
                        .with(as(reporter))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"COMMENT\",\"targetId\":\"not-a-uuid\",\"reason\":\"OTHER\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("malformed_request"));
    }

    private org.springframework.test.web.servlet.ResultActions report(
            AppUser reporter, String type, UUID targetId, String reason, String explanation
    ) throws Exception {
        return mockMvc.perform(post("/api/v1/reports")
                .with(as(reporter))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(reportBody(type, targetId, reason, explanation)));
    }

    private String reportBody(String type, UUID targetId, String reason, String explanation)
            throws Exception {
        java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("targetType", type);
        body.put("targetId", targetId);
        body.put("reason", reason);
        if (explanation != null) {
            body.put("explanation", explanation);
        }
        return objectMapper.writeValueAsString(body);
    }

    @Test
    void operatorSuspensionFromModerationStoresTheActionReason() throws Exception {
        Fixture fixture = fixture("suspension");
        AppUser author = parent("suspension-author@example.com");
        AppUser reporter = parent("suspension-reporter@example.com");
        AppUser admin = userRepository.findByEmail("moderation-admin-one@example.com").orElseThrow();
        AppUser operator = operator("suspension-operator@example.com");
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(operator, "Moderated Transport", "+905551112266")
        );
        OperatorSchool operatorSchool = operatorSchoolRepository.saveAndFlush(
                new OperatorSchool(profile, fixture.school(), true)
        );
        DemandServiceResponse response = responseRepository.saveAndFlush(new DemandServiceResponse(
                demand(fixture, author), profile, operatorSchool, true, false, OffsetDateTime.now()
        ));
        MvcResult report = report(
                reporter, "SERVICE_RESPONSE", response.getId(), "SPAM_ADVERTISING", "Repeated advertising"
        ).andExpect(status().isCreated()).andReturn();
        UUID caseId = UUID.fromString(json(report).path("caseId").asText());

        mockMvc.perform(post("/api/v1/admin/moderation/cases/{id}/actions", caseId)
                        .with(as(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(actionBody("SUSPEND_OPERATOR", "   ")))
                .andExpect(status().isBadRequest());
        assertThat(profile.isActive()).isTrue();
        assertThat(reviewRepository.findAllByOperatorIdOrderByReviewedAtAscIdAsc(profile.getId())).isEmpty();

        mockMvc.perform(post("/api/v1/admin/moderation/cases/{id}/actions", caseId)
                        .with(as(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(actionBody("SUSPEND_OPERATOR", "Repeated policy violation")))
                .andExpect(status().isOk());

        assertThat(profile.isActive()).isFalse();
        assertThat(operator.isEnabled()).isFalse();
        var history = reviewRepository.findAllByOperatorIdOrderByReviewedAtAscIdAsc(profile.getId());
        assertThat(history).hasSize(1);
        assertThat(history.getFirst().getDecision()).isEqualTo(ReviewDecision.SUSPENDED);
        assertThat(history.getFirst().getReason()).isEqualTo("Repeated policy violation");
        assertThat(history.getFirst().getReviewedById()).isEqualTo(admin.getId());
    }

    private String actionBody(String action, String reason) throws Exception {
        return objectMapper.writeValueAsString(java.util.Map.of("action", action, "reason", reason));
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private Fixture fixture(String suffix) {
        Province province = provinceRepository.save(new Province("34", "Province " + suffix));
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
                demand, creator, true, false, Set.of(SupportReason.NO_SUITABLE_SERVICE)
        ));
        return demand;
    }

    private AppUser parent(String email) {
        AppUser parent = AppUser.newParent(email, "test-password-hash");
        parent.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(parent);
    }

    private AppUser operator(String email) {
        AppUser operator = AppUser.newOperator(email, "test-password-hash");
        operator.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(operator);
    }

    private RequestPostProcessor as(AppUser value) {
        return user(new AuthenticatedUser(
                value.getId(), value.getEmail(), "test-password-hash", value.getRole(), true
        ));
    }

    private record Fixture(School school, Neighborhood pickup) {
    }
}
