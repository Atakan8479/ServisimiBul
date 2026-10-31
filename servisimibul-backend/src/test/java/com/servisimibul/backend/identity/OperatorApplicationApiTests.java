package com.servisimibul.backend.identity;

import com.servisimibul.backend.security.AuthenticatedUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OperatorApplicationApiTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private OperatorProfileRepository profileRepository;

    @Autowired
    private OperatorApplicationReviewRepository reviewRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private FindByIndexNameSessionRepository<?> sessionRepository;

    private final Set<String> testedEmails = new HashSet<>();

    @AfterEach
    void removePersistedSessions() {
        testedEmails.forEach(email -> sessionRepository.findByPrincipalName(email).values()
                .forEach(session -> sessionRepository.deleteById(session.getId())));
    }

    @Test
    void operatorCanReadPatchAndSubmitOwnProfileWithoutChangingProtectedState() throws Exception {
        AppUser operator = createOperator("profile-owner@example.com", "Profile Owner", true);

        mockMvc.perform(get("/api/v1/operator/profile").with(asUser(operator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessName").value("Profile Owner"))
                .andExpect(jsonPath("$.approvalStatus").value("DRAFT"))
                .andExpect(jsonPath("$.publiclyVisible").value(true));

        mockMvc.perform(patch("/api/v1/operator/profile")
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "businessName":"  Updated Transport  ",
                                  "contactPhone":"0555 111 22 33",
                                  "description":"  Pilot operator  ",
                                  "publiclyVisible":false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessName").value("Updated Transport"))
                .andExpect(jsonPath("$.contactPhone").value("+905551112233"))
                .andExpect(jsonPath("$.description").value("Pilot operator"))
                .andExpect(jsonPath("$.publiclyVisible").value(false))
                .andExpect(jsonPath("$.approvalStatus").value("DRAFT"))
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(patch("/api/v1/operator/profile")
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"businessName\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessName").doesNotExist())
                .andExpect(jsonPath("$.contactPhone").value("+905551112233"));

        assertThat(profileRepository.findByUserId(operator.getId()).orElseThrow().getBusinessName())
                .isNull();

        mockMvc.perform(patch("/api/v1/operator/profile")
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"approvalStatus\":\"APPROVED\",\"active\":false}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/operator/application/submit")
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalStatus").value("PENDING"));

        mockMvc.perform(post("/api/v1/operator/application/submit")
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("application_not_submittable"));
    }

    @Test
    void revisionHistoryIsAppendedAndOperatorCanEditThenResubmit() throws Exception {
        AppUser operator = createOperator("revision-owner@example.com", "Revision Owner", true);
        AppUser admin = createAdmin("revision-admin@example.com");
        OperatorProfile profile = submit(operator);

        mockMvc.perform(post("/api/v1/admin/operators/{id}/request-revision", profile.getId())
                        .with(asUser(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Please clarify the business name\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.approvalStatus").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.reviewHistory.length()").value(1))
                .andExpect(jsonPath("$.reviewHistory[0].decision").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.reviewHistory[0].reason")
                        .value("Please clarify the business name"))
                .andExpect(jsonPath("$.reviewHistory[0].reviewedById")
                        .value(admin.getId().toString()));

        mockMvc.perform(patch("/api/v1/operator/profile")
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"businessName\":\"Revised Transport\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalStatus").value("CHANGES_REQUESTED"));

        mockMvc.perform(post("/api/v1/operator/application/resubmit")
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalStatus").value("PENDING"));

        assertThat(reviewRepository.findAllByOperatorIdOrderByReviewedAtAscIdAsc(profile.getId()))
                .hasSize(1);
    }

    @Test
    void approvedProfileEditsApplyWithoutRenewedReview() throws Exception {
        AppUser operator = createOperator("approved-owner@example.com", "Approved Owner", true);
        AppUser admin = createAdmin("approval-admin@example.com");
        OperatorProfile profile = submit(operator);

        mockMvc.perform(post("/api/v1/admin/operators/{id}/approve", profile.getId())
                        .with(asUser(admin))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.approvalStatus").value("APPROVED"))
                .andExpect(jsonPath("$.reviewHistory[0].decision").value("APPROVED"));

        mockMvc.perform(patch("/api/v1/operator/profile")
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"businessName\":\"Approved Updated\",\"publiclyVisible\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.businessName").value("Approved Updated"))
                .andExpect(jsonPath("$.approvalStatus").value("APPROVED"))
                .andExpect(jsonPath("$.publiclyVisible").value(false));
    }

    @Test
    void pendingApplicationIsReadableButCannotBeEditedOrManageResources() throws Exception {
        AppUser operator = createOperator("pending-read-only@example.com", "Pending Owner", true);
        submit(operator);

        mockMvc.perform(get("/api/v1/operator/profile").with(asUser(operator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalStatus").value("PENDING"));
        mockMvc.perform(patch("/api/v1/operator/profile")
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"businessName\":\"Must Not Change\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("operator_application_read_only"));
        mockMvc.perform(get("/api/v1/operator/schools").with(asUser(operator)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("operator_approval_required"));
    }

    @Test
    void adminQueueIsFilteredPaginatedAndDetailed() throws Exception {
        AppUser first = createOperator("queue-one@example.com", "Queue One", true);
        AppUser second = createOperator("queue-two@example.com", "Queue Two", true);
        createOperator("queue-draft@example.com", "Queue Draft", true);
        AppUser admin = createAdmin("queue-admin@example.com");
        OperatorProfile firstProfile = submit(first);
        submit(second);

        mockMvc.perform(get("/api/v1/admin/operators")
                        .with(asUser(admin))
                        .param("status", "PENDING")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/api/v1/admin/operators/{id}", firstProfile.getId())
                        .with(asUser(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.id").value(firstProfile.getId().toString()))
                .andExpect(jsonPath("$.profile.approvalStatus").value("PENDING"))
                .andExpect(jsonPath("$.reviewHistory").isEmpty());

        mockMvc.perform(get("/api/v1/admin/operators")
                        .with(asUser(admin))
                        .param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.page").exists());
    }

    @Test
    void roleCsrfReasonAndSelfReviewBoundariesAreEnforced() throws Exception {
        AppUser operator = createOperator("boundary-owner@example.com", "Boundary Owner", true);
        AppUser admin = createAdmin("boundary-admin@example.com");
        OperatorProfile profile = submit(operator);

        mockMvc.perform(post("/api/v1/admin/operators/{id}/approve", profile.getId())
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/admin/operators/{id}/approve", profile.getId())
                        .with(asUser(admin)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/admin/operators/{id}/request-revision", profile.getId())
                        .with(asUser(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.reason").exists());

        String suspension = "{\"reason\":\"Boundary check\"}";
        mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                        .with(asUser(operator))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(suspension))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                        .with(asUser(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(suspension))
                .andExpect(status().isForbidden());
        assertThat(profileRepository.findById(profile.getId()).orElseThrow().isActive()).isTrue();

        mockMvc.perform(post("/api/v1/admin/operators/{id}/approve", profile.getId())
                        .with(asRole(operator, UserRole.ADMIN))
                        .with(csrf()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("self_review_forbidden"));
    }

    @Test
    void suspensionDisablesAccountDeactivatesProfileAndRevokesSessions() throws Exception {
        AppUser operator = createOperator("suspended-owner@example.com", "Suspended Owner", true);
        AppUser admin = createAdmin("suspension-admin@example.com");
        Cookie sessionCookie = login(operator.getEmail());
        OperatorProfile profile = profileRepository.findByUserId(operator.getId()).orElseThrow();

        assertThat(sessionRepository.findByPrincipalName(operator.getEmail())).hasSize(1);

        for (String body : new String[] {"{}", "{\"reason\":\"   \"}"}) {
            mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                            .with(asUser(admin))
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                        .with(asUser(admin))
                        .with(csrf()))
                .andExpect(status().isBadRequest());
        assertThat(profileRepository.findById(profile.getId()).orElseThrow().isActive()).isTrue();
        assertThat(userRepository.findById(operator.getId()).orElseThrow().isEnabled()).isTrue();
        assertThat(sessionRepository.findByPrincipalName(operator.getEmail())).hasSize(1);

        mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                        .with(asUser(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"  Şikayet incelemesi  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.active").value(false))
                .andExpect(jsonPath("$.reviewHistory[0].decision").value("SUSPENDED"))
                .andExpect(jsonPath("$.reviewHistory[0].reason").value("Şikayet incelemesi"))
                .andExpect(jsonPath("$.reviewHistory[0].reviewedById").value(admin.getId().toString()));
        mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                        .with(asUser(admin))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Repeated\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("operator_already_suspended"));

        assertThat(profileRepository.findById(profile.getId()).orElseThrow().isActive()).isFalse();
        assertThat(userRepository.findById(operator.getId()).orElseThrow().isEnabled()).isFalse();
        assertThat(sessionRepository.findByPrincipalName(operator.getEmail())).isEmpty();
        mockMvc.perform(get("/api/v1/auth/me").cookie(sessionCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
        mockMvc.perform(get("/api/v1/operator/profile").with(asUser(operator)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("operator_suspended"));
    }

    private OperatorProfile submit(AppUser operator) throws Exception {
        mockMvc.perform(post("/api/v1/operator/application/submit")
                        .with(asUser(operator))
                        .with(csrf()))
                .andExpect(status().isOk());
        return profileRepository.findByUserId(operator.getId()).orElseThrow();
    }

    private AppUser createOperator(String email, String businessName, boolean verified) {
        AppUser user = AppUser.newOperator(email, passwordEncoder.encode(PASSWORD));
        if (verified) {
            user.verifyEmail(OffsetDateTime.now());
        }
        userRepository.saveAndFlush(user);
        profileRepository.saveAndFlush(new OperatorProfile(user, businessName, "+905551112233"));
        testedEmails.add(user.getEmail());
        return user;
    }

    private AppUser createAdmin(String email) {
        AppUser admin = AppUser.newAdmin(email, passwordEncoder.encode(PASSWORD));
        admin.verifyEmail(OffsetDateTime.now());
        testedEmails.add(admin.getEmail());
        return userRepository.saveAndFlush(admin);
    }

    private Cookie login(String email) throws Exception {
        CsrfSession csrfSession = csrfSession();
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrfSession.cookie())
                        .header(csrfSession.header(), csrfSession.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getCookie("SBSESSION");
    }

    private CsrfSession csrfSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        CsrfToken token = (CsrfToken) result.getRequest().getAttribute(CsrfToken.class.getName());
        return new CsrfSession(
                result.getResponse().getCookie("SBSESSION"),
                token.getHeaderName(),
                token.getToken()
        );
    }

    private RequestPostProcessor asUser(AppUser user) {
        return asRole(user, user.getRole());
    }

    private RequestPostProcessor asRole(AppUser user, UserRole role) {
        return user(new AuthenticatedUser(
                user.getId(),
                user.getEmail(),
                "test-password-hash",
                role,
                true
        ));
    }

    private record CsrfSession(Cookie cookie, String header, String token) {
    }
}
