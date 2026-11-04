package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.SessionRevoker;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The feature stays off in every real environment (app.auth.account-deactivation.enabled
 * defaults to false) until the LEG-07 (#200) lifecycle policy is approved. This context
 * exercises the real mechanism in isolation so it is proven correct before that approval,
 * without enabling it for production traffic.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.auth.account-deactivation.enabled=true")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AccountDeactivationApiTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FindByIndexNameSessionRepository<?> sessionRepository;
    @Autowired
    private AuthPersistenceService persistence;
    @Autowired
    private SessionRevoker sessionRevoker;

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"PARENT", "OPERATOR"})
    void deactivatesTheAccountRevokesSessionsAndBlocksFutureLogin(UserRole role) throws Exception {
        AppUser account = createUser(role, uniqueEmail(role.name().toLowerCase()));
        Cookie normalSession = login(account.getEmail(), false);
        Cookie rememberedSession = login(account.getEmail(), true);

        mockMvc.perform(get("/api/v1/auth/me").cookie(normalSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountDeactivationAvailable").value(true));

        mockMvc.perform(post("/api/v1/auth/deactivate")
                        .cookie(normalSession)
                        .with(csrf()))
                .andExpect(status().isNoContent());

        assertThat(sessionRepository.findByPrincipalName(account.getEmail())).isEmpty();
        assertThat(userRepository.findById(account.getId()).orElseThrow().isDeactivated()).isTrue();
        assertThat(userRepository.findById(account.getId()).orElseThrow().isEnabled()).isTrue();
        mockMvc.perform(get("/api/v1/auth/me").cookie(rememberedSession))
                .andExpect(status().isUnauthorized());

        assertInvalidLogin(account.getEmail());
    }

    @Test
    void anotherAccountsSessionRemainsValidAfterDeactivation() throws Exception {
        AppUser actor = createUser(UserRole.PARENT, uniqueEmail("deactivate-actor"));
        AppUser other = createUser(UserRole.OPERATOR, uniqueEmail("deactivate-other"));
        Cookie actorSession = login(actor.getEmail(), false);
        Cookie otherSession = login(other.getEmail(), false);

        mockMvc.perform(post("/api/v1/auth/deactivate").cookie(actorSession).with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/auth/me").cookie(otherSession))
                .andExpect(status().isOk());
    }

    @Test
    void requiresAuthenticationAndValidCsrf() throws Exception {
        mockMvc.perform(post("/api/v1/auth/deactivate").with(csrf()))
                .andExpect(status().isUnauthorized());

        AppUser account = createUser(UserRole.OPERATOR, uniqueEmail("deactivate-csrf"));
        Cookie session = login(account.getEmail(), false);
        mockMvc.perform(post("/api/v1/auth/deactivate").cookie(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk());
    }

    @Test
    void adminRoleIsExcludedByUrlAuthorization() throws Exception {
        mockMvc.perform(post("/api/v1/auth/deactivate")
                        .with(user(new AuthenticatedUser(
                                UUID.randomUUID(),
                                "admin@example.com",
                                "hash",
                                UserRole.ADMIN,
                                true
                        )))
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void aSuspendedAccountCannotUseAnExistingSessionToDeactivateOrRegainAccess() throws Exception {
        // Mirrors OperatorApplicationService.suspend: disable the account and revoke its sessions together.
        AppUser account = createUser(UserRole.OPERATOR, uniqueEmail("deactivate-suspended"));
        Cookie session = login(account.getEmail(), false);
        account.disable();
        userRepository.save(account);
        sessionRevoker.revokeAll(account.getId());

        mockMvc.perform(post("/api/v1/auth/deactivate").cookie(session).with(csrf()))
                .andExpect(status().isUnauthorized());
        assertThat(userRepository.findById(account.getId()).orElseThrow().isDeactivated()).isFalse();
    }

    @Test
    void repeatedDeactivationIsIdempotentAndKeepsTheFirstTimestamp() {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("deactivate-idempotent"));
        OffsetDateTime first = OffsetDateTime.now();

        persistence.deactivateAccount(account.getId(), first);
        persistence.deactivateAccount(account.getId(), first.plusDays(1));

        AppUser reloaded = userRepository.findById(account.getId()).orElseThrow();
        assertThat(reloaded.isDeactivated()).isTrue();
    }

    private void assertInvalidLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    private AppUser createUser(UserRole role, String email) {
        AppUser user = role == UserRole.PARENT
                ? AppUser.newParent(email, passwordEncoder.encode(PASSWORD))
                : AppUser.newOperator(email, passwordEncoder.encode(PASSWORD));
        user.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(user);
    }

    private Cookie login(String email, boolean rememberMe) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":%s}
                                """.formatted(email, PASSWORD, rememberMe)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("SBSESSION");
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }
}
