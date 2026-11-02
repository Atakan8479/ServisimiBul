package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.security.SessionRevoker;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reproduces the APP-04 review concern for APP-05: a session-store failure during global
 * revocation must never be reported as success, and must leave authentication in a safe,
 * predictable state (the caller's existing session keeps working) rather than a half-revoked
 * limbo.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(LogoutAllSessionRevocationFailureTests.TestBeans.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class LogoutAllSessionRevocationFailureTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FailingSessionRevoker sessionRevoker;

    @BeforeEach
    void resetRecorder() {
        sessionRevoker.clear();
    }

    @Test
    void failedRevocationNeverReturns204AndLeavesTheExistingSessionUsable() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("revocation-failure"));
        Cookie session = login(account.getEmail());
        sessionRevoker.failNextCall(true);

        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(session).with(csrf()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AUTH_SERVICE_UNAVAILABLE"));

        assertThat(sessionRevoker.attemptedUserIds()).containsExactly(account.getId());
        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk());
    }

    @Test
    void retryingAfterAFailureSucceedsOnceTheStoreRecovers() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("revocation-retry"));
        Cookie session = login(account.getEmail());
        sessionRevoker.failNextCall(true);

        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(session).with(csrf()))
                .andExpect(status().isServiceUnavailable());
        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isOk());

        sessionRevoker.failNextCall(false);
        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(session).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/auth/me").cookie(session))
                .andExpect(status().isUnauthorized());
        assertThat(sessionRevoker.attemptedUserIds()).containsExactly(account.getId(), account.getId());
    }

    private AppUser createUser(UserRole role, String email) {
        AppUser user = AppUser.newParent(email, passwordEncoder.encode(PASSWORD));
        user.verifyEmail(OffsetDateTime.now());
        return userRepository.saveAndFlush(user);
    }

    private Cookie login(String email) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie("SBSESSION");
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    @TestConfiguration
    static class TestBeans {

        @Bean
        @Primary
        FailingSessionRevoker failingSessionRevoker() {
            return new FailingSessionRevoker();
        }
    }

    static final class FailingSessionRevoker implements SessionRevoker {

        private final List<UUID> attempted = new ArrayList<>();
        private volatile boolean failNextCall;

        @Override
        public void revokeAll(UUID userId) {
            attempted.add(userId);
            if (failNextCall) {
                throw new DataAccessResourceFailureException("Simulated session store outage");
            }
        }

        void failNextCall(boolean fail) {
            this.failNextCall = fail;
        }

        List<UUID> attemptedUserIds() {
            return attempted;
        }

        void clear() {
            attempted.clear();
            failNextCall = false;
        }
    }
}
