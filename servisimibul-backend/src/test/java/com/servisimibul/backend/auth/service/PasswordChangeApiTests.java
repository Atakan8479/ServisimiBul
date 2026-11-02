package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.exception.InvalidCurrentPasswordException;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.security.AuthenticatedUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.rate-limit.password-change-account.requests=3",
        "app.rate-limit.password-change-ip.requests=100"
})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PasswordChangeApiTests {

    private static final String CURRENT_PASSWORD = "correct horse battery staple";
    private static final String NEW_PASSWORD = "new correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private FindByIndexNameSessionRepository<?> sessionRepository;
    @Autowired
    private AuthPersistenceService persistence;

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"PARENT", "OPERATOR"})
    void changesPasswordForSupportedRolesAndRevokesNormalAndRememberedSessions(
            UserRole role
    ) throws Exception {
        AppUser account = createUser(role, uniqueEmail(role.name().toLowerCase()));
        Cookie normalSession = login(account.getEmail(), CURRENT_PASSWORD, false);
        Cookie rememberedSession = login(account.getEmail(), CURRENT_PASSWORD, true);

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .cookie(normalSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson(CURRENT_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isNoContent());

        assertThat(sessionRepository.findByPrincipalName(account.getEmail())).isEmpty();
        mockMvc.perform(get("/api/v1/auth/me").cookie(normalSession))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/me").cookie(rememberedSession))
                .andExpect(status().isUnauthorized());
        assertRejectedLogin(account.getEmail(), CURRENT_PASSWORD);
        login(account.getEmail(), NEW_PASSWORD, false);
    }

    @Test
    void rejectsIncorrectCurrentPasswordWithoutChangingCredentials() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("wrong-current"));
        Cookie session = login(account.getEmail(), CURRENT_PASSWORD, false);

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .cookie(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson("incorrect password value", NEW_PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INVALID"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("currentPassword"));

        login(account.getEmail(), CURRENT_PASSWORD, false);
        assertRejectedLogin(account.getEmail(), NEW_PASSWORD);
    }

    @Test
    void requiresAuthenticationAndValidCsrf() throws Exception {
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson(CURRENT_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isUnauthorized());

        AppUser account = createUser(UserRole.OPERATOR, uniqueEmail("csrf"));
        Cookie session = login(account.getEmail(), CURRENT_PASSWORD, false);
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .cookie(session)
                        .contentType("application/json")
                        .content(changeJson(CURRENT_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void rejectsWeakAndReusedPasswords() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("policy"));
        Cookie session = login(account.getEmail(), CURRENT_PASSWORD, false);

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .cookie(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson(CURRENT_PASSWORD, "too short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("newPassword"));

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .cookie(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson(CURRENT_PASSWORD, CURRENT_PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("newPassword"));
    }

    @Test
    void rateLimitsRepeatedPasswordGuessingForTheAuthenticatedAccount() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("limited"));
        Cookie session = login(account.getEmail(), CURRENT_PASSWORD, false);

        for (int attempt = 0; attempt < 3; attempt++) {
            mockMvc.perform(post("/api/v1/auth/change-password")
                            .cookie(session)
                            .with(csrf())
                            .contentType("application/json")
                            .content(changeJson("incorrect password value", NEW_PASSWORD)))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .cookie(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson("incorrect password value", NEW_PASSWORD)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void cannotSelectAnotherUsersCredentialsAndAdminRemainsExcluded() throws Exception {
        AppUser actor = createUser(UserRole.PARENT, uniqueEmail("actor"));
        AppUser other = createUser(UserRole.OPERATOR, uniqueEmail("other"));
        Cookie actorSession = login(actor.getEmail(), CURRENT_PASSWORD, false);

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .cookie(actorSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson(CURRENT_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isNoContent());
        login(other.getEmail(), CURRENT_PASSWORD, false);

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(user(new AuthenticatedUser(
                                UUID.randomUUID(),
                                "admin@example.com",
                                "hash",
                                UserRole.ADMIN,
                                true
                        )))
                        .with(csrf())
                        .contentType("application/json")
                        .content(changeJson(CURRENT_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isForbidden());
    }

    @Test
    void serializesConcurrentStalePasswordUpdates() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("concurrent"));
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> changeAfter(start, account.getId(), "first replacement password"));
            var second = executor.submit(() -> changeAfter(start, account.getId(), "second replacement password"));
            start.countDown();

            List<Throwable> failures = new ArrayList<>();
            failures.add(first.get(10, TimeUnit.SECONDS));
            failures.add(second.get(10, TimeUnit.SECONDS));
            assertThat(failures).filteredOn(failure -> failure == null).hasSize(1);
            assertThat(failures).filteredOn(InvalidCurrentPasswordException.class::isInstance).hasSize(1);
        }
    }

    private Throwable changeAfter(CountDownLatch start, UUID userId, String password) {
        try {
            start.await(5, TimeUnit.SECONDS);
            persistence.changePassword(userId, CURRENT_PASSWORD, password);
            return null;
        } catch (Throwable failure) {
            return failure;
        }
    }

    private AppUser createUser(UserRole role, String email) {
        AppUser user = role == UserRole.PARENT
                ? AppUser.newParent(email, passwordEncoder.encode(CURRENT_PASSWORD))
                : AppUser.newOperator(email, passwordEncoder.encode(CURRENT_PASSWORD));
        user.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(user);
    }

    private Cookie login(String email, String password, boolean rememberMe) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":%s}
                                """.formatted(email, password, rememberMe)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("SBSESSION");
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private void assertRejectedLogin(String email, String password) {
        assertThatThrownBy(() -> authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, password)
        )).isInstanceOf(RuntimeException.class);
    }

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    private String changeJson(String currentPassword, String newPassword) {
        return """
                {"currentPassword":"%s","newPassword":"%s"}
                """.formatted(currentPassword, newPassword);
    }
}
