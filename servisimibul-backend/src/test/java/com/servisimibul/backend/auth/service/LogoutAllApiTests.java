package com.servisimibul.backend.auth.service;

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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class LogoutAllApiTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FindByIndexNameSessionRepository<?> sessionRepository;

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"PARENT", "OPERATOR"})
    void revokesNormalAndRememberedSessionsIncludingTheCurrentOneForSupportedRoles(
            UserRole role
    ) throws Exception {
        AppUser account = createUser(role, uniqueEmail(role.name().toLowerCase()));
        Cookie normalSession = login(account.getEmail(), false);
        Cookie rememberedSession = login(account.getEmail(), true);

        mockMvc.perform(post("/api/v1/auth/logout-all")
                        .cookie(normalSession)
                        .with(csrf()))
                .andExpect(status().isNoContent());

        assertThat(sessionRepository.findByPrincipalName(account.getEmail())).isEmpty();
        mockMvc.perform(get("/api/v1/auth/me").cookie(normalSession))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/me").cookie(rememberedSession))
                .andExpect(status().isUnauthorized());
        login(account.getEmail(), false);
    }

    @Test
    void anotherAccountsSessionsRemainValid() throws Exception {
        AppUser actor = createUser(UserRole.PARENT, uniqueEmail("actor"));
        AppUser other = createUser(UserRole.OPERATOR, uniqueEmail("other"));
        Cookie actorSession = login(actor.getEmail(), false);
        Cookie otherSession = login(other.getEmail(), false);

        mockMvc.perform(post("/api/v1/auth/logout-all")
                        .cookie(actorSession)
                        .with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/auth/me").cookie(actorSession))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/me").cookie(otherSession))
                .andExpect(status().isOk());
    }

    @Test
    void requiresAuthenticationAndValidCsrf() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout-all").with(csrf()))
                .andExpect(status().isUnauthorized());

        AppUser account = createUser(UserRole.OPERATOR, uniqueEmail("csrf"));
        Cookie session = login(account.getEmail(), false);
        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk());
    }

    @Test
    void adminRoleRemainsExcluded() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout-all")
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
    void requestBodyCannotTargetAnotherAccount() throws Exception {
        AppUser actor = createUser(UserRole.PARENT, uniqueEmail("body-actor"));
        AppUser other = createUser(UserRole.OPERATOR, uniqueEmail("body-other"));
        Cookie actorSession = login(actor.getEmail(), false);
        Cookie otherSession = login(other.getEmail(), false);

        mockMvc.perform(post("/api/v1/auth/logout-all")
                        .cookie(actorSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"userId\":\"" + other.getId() + "\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/auth/me").cookie(actorSession))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/me").cookie(otherSession))
                .andExpect(status().isOk());
    }

    @Test
    void repeatedLogoutAllRequestsFailSafelyWithoutAffectingOtherAccounts() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("repeat"));
        AppUser bystander = createUser(UserRole.OPERATOR, uniqueEmail("repeat-bystander"));
        Cookie session = login(account.getEmail(), false);
        Cookie bystanderSession = login(bystander.getEmail(), false);

        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(session).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(session).with(csrf()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/auth/me").cookie(bystanderSession))
                .andExpect(status().isOk());
    }

    @Test
    void concurrentLogoutAllRequestsFromTwoOwnSessionsResolveSafely() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("concurrent"));
        AppUser bystander = createUser(UserRole.OPERATOR, uniqueEmail("concurrent-bystander"));
        Cookie normalSession = login(account.getEmail(), false);
        Cookie rememberedSession = login(account.getEmail(), true);
        Cookie bystanderSession = login(bystander.getEmail(), false);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> first = () -> callLogoutAll(start, normalSession);
            Callable<Integer> second = () -> callLogoutAll(start, rememberedSession);
            Future<Integer> firstResult = executor.submit(first);
            Future<Integer> secondResult = executor.submit(second);
            start.countDown();

            List<Integer> statuses = List.of(
                    firstResult.get(10, TimeUnit.SECONDS),
                    secondResult.get(10, TimeUnit.SECONDS)
            );
            assertThat(statuses).allMatch(status -> status == 204 || status == 401);
            assertThat(statuses).contains(204);
        }

        assertThat(sessionRepository.findByPrincipalName(account.getEmail())).isEmpty();
        mockMvc.perform(get("/api/v1/auth/me").cookie(bystanderSession))
                .andExpect(status().isOk());
    }

    private int callLogoutAll(CountDownLatch start, Cookie session) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        return mockMvc.perform(post("/api/v1/auth/logout-all").cookie(session).with(csrf()))
                .andReturn().getResponse().getStatus();
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
