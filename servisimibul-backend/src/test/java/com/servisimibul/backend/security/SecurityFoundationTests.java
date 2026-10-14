package com.servisimibul.backend.security;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(SecurityFoundationTests.TestEndpoints.class)
@Transactional
class SecurityFoundationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private CurrentUser currentUser;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void publicGetIsAllowedWithoutCreatingSession() throws Exception {
        var result = mockMvc.perform(get("/api/v1/provinces"))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void unknownAndRoleProtectedRoutesAreDeniedByDefault() throws Exception {
        mockMvc.perform(get("/internal-test"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/operator/test"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/test"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operatorRoleCanOnlyReachOperatorRoutes() throws Exception {
        mockMvc.perform(get("/api/v1/operator/test"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/test"))
                .andExpect(status().isForbidden());
    }

    @Test
    void publicStateChangingRouteStillRequiresCsrf() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType("application/problem+json"));
    }

    @Test
    void csrfEndpointSuppliesATokenForStateChangingRequests() throws Exception {
        var csrfResult = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.parameterName").value("_csrf"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();

        CsrfToken token = (CsrfToken) csrfResult.getRequest().getAttribute(CsrfToken.class.getName());
        var sessionCookie = csrfResult.getResponse().getCookie("SBSESSION");
        assertThat(token).isNotNull();
        assertThat(sessionCookie).isNotNull();

        mockMvc.perform(post("/api/v1/auth/register")
                        .cookie(sessionCookie)
                        .header(token.getHeaderName(), token.getToken())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType("application/problem+json"));
    }

    @Test
    void onlyVerifiedEnabledUserCanAuthenticateAndIdentityComesFromPrincipal() {
        String rawPassword = "correct horse battery staple";
        AppUser activeUser = AppUser.newOperator(
                "active@example.com",
                passwordEncoder.encode(rawPassword)
        );
        activeUser.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(activeUser);

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(activeUser.getEmail(), rawPassword)
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);

        assertThat(authentication.isAuthenticated()).isTrue();
        assertThat(authentication.getPrincipal()).isInstanceOf(AuthenticatedUser.class);
        assertThat(currentUser.id()).isEqualTo(activeUser.getId());
    }

    @Test
    void unverifiedAndDisabledUsersCannotAuthenticate() {
        String rawPassword = "correct horse battery staple";
        AppUser unverified = userRepository.saveAndFlush(
                AppUser.newOperator("unverified@example.com", passwordEncoder.encode(rawPassword))
        );
        AppUser disabled = AppUser.newOperator(
                "disabled@example.com",
                passwordEncoder.encode(rawPassword)
        );
        disabled.verifyEmail(OffsetDateTime.now());
        disabled.disable();
        userRepository.saveAndFlush(disabled);

        assertThatThrownBy(() -> authenticate(unverified.getEmail(), rawPassword))
                .isInstanceOf(DisabledException.class);
        assertThatThrownBy(() -> authenticate(disabled.getEmail(), rawPassword))
                .isInstanceOf(DisabledException.class);
    }

    @Test
    void currentUserRejectsNonDatabasePrincipal() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("client-supplied-id", "ignored", java.util.List.of())
        );

        assertThatThrownBy(currentUser::id).isInstanceOf(AccessDeniedException.class);
    }

    private Authentication authenticate(String email, String password) {
        return authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
    }

    @RestController
    static class TestEndpoints {

        @GetMapping({"/api/v1/operator/test", "/api/v1/admin/test", "/internal-test"})
        ResponseEntity<Void> getEndpoint() {
            return ResponseEntity.ok().build();
        }

    }
}
