package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the real, unmodified {@code JdbcSessionRevoker} (not a fake {@code SessionRevoker})
 * through a session store that deletes the account's first real session successfully and then
 * fails on the next one, reproducing a failure that happens mid-revocation rather than before it
 * starts. This is an accepted limitation of per-row revocation across multiple session records,
 * not a redesign of the session architecture: a client that receives the resulting 503 can only
 * assume that revocation did not fully succeed, never that every session is gone. The session
 * processed before the failure is actually revoked; the session not yet reached remains valid
 * until the client retries and the retry succeeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(LogoutAllPartialSessionRevocationFailureTests.TestBeans.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class LogoutAllPartialSessionRevocationFailureTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FindByIndexNameSessionRepository<?> sessionRepository;

    private PartiallyFailingSessionRepository failureControl() {
        return (PartiallyFailingSessionRepository) sessionRepository;
    }

    @Test
    void failsClosedWhenTheStoreFailsAfterRevokingOnlySomeOfTheAccountsSessions() throws Exception {
        AppUser account = createUser(uniqueEmail("partial-revocation"));
        Cookie first = login(account.getEmail(), false);
        Cookie second = login(account.getEmail(), true);
        failureControl().failAfterSuccessfulDeletes(1);

        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(first).with(csrf()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AUTH_SERVICE_UNAVAILABLE"));

        // The revoker attempted both of the account's sessions; only the first succeeded before
        // the simulated outage, so exactly one real session row was actually deleted.
        assertThat(failureControl().deleteAttempts()).isEqualTo(2);
        assertThat(failureControl().successfulDeletes()).isEqualTo(1);

        Cookie stillValidSession = null;
        int stillAuthenticated = 0;
        for (Cookie session : List.of(first, second)) {
            int responseStatus = mockMvc.perform(get("/api/v1/auth/me").cookie(session))
                    .andReturn().getResponse().getStatus();
            if (responseStatus == 200) {
                stillAuthenticated++;
                stillValidSession = session;
            } else {
                assertThat(responseStatus).isEqualTo(401);
            }
        }
        // Exactly one session was deleted before the failure; the other was never reached and
        // remains usable. The 503 above must not be read as "every session is gone".
        assertThat(stillAuthenticated).isEqualTo(1);

        failureControl().failAfterSuccessfulDeletes(Integer.MAX_VALUE);
        mockMvc.perform(post("/api/v1/auth/logout-all").cookie(stillValidSession).with(csrf()))
                .andExpect(status().isNoContent());
        for (Cookie session : List.of(first, second)) {
            mockMvc.perform(get("/api/v1/auth/me").cookie(session))
                    .andExpect(status().isUnauthorized());
        }
    }

    private AppUser createUser(String email) {
        AppUser user = AppUser.newParent(email, passwordEncoder.encode(PASSWORD));
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

    @TestConfiguration
    static class TestBeans {

        // A BeanPostProcessor wraps the real auto-configured session repository bean in place,
        // whatever its bean name, instead of guessing a name or fighting Spring's self-reference
        // detection with a @Primary replacement bean of the same type.
        @Bean
        @SuppressWarnings({"rawtypes", "unchecked"})
        static BeanPostProcessor partiallyFailingSessionRepositoryPostProcessor() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String beanName) {
                    if (bean instanceof FindByIndexNameSessionRepository
                            && !(bean instanceof PartiallyFailingSessionRepository)) {
                        return new PartiallyFailingSessionRepository((FindByIndexNameSessionRepository) bean);
                    }
                    return bean;
                }
            };
        }
    }

    /**
     * Delegates every call to the real session repository except {@code deleteById}, which fails
     * from a configured call onward so a real multi-session revocation can be interrupted exactly
     * between two real deletions, instead of failing before any row is touched.
     */
    @SuppressWarnings({"rawtypes", "unchecked"})
    static final class PartiallyFailingSessionRepository implements FindByIndexNameSessionRepository {

        private final FindByIndexNameSessionRepository delegate;
        private final AtomicInteger deleteAttempts = new AtomicInteger();
        private final AtomicInteger successfulDeletes = new AtomicInteger();
        private volatile int failAfterSuccessfulDeletes = Integer.MAX_VALUE;

        PartiallyFailingSessionRepository(FindByIndexNameSessionRepository delegate) {
            this.delegate = delegate;
        }

        @Override
        public Session createSession() {
            return delegate.createSession();
        }

        @Override
        public void save(Session session) {
            delegate.save(session);
        }

        @Override
        public Session findById(String id) {
            return delegate.findById(id);
        }

        @Override
        public void deleteById(String id) {
            deleteAttempts.incrementAndGet();
            if (successfulDeletes.get() >= failAfterSuccessfulDeletes) {
                throw new DataAccessResourceFailureException("Simulated session store outage");
            }
            delegate.deleteById(id);
            successfulDeletes.incrementAndGet();
        }

        @Override
        public Map<String, Session> findByIndexNameAndIndexValue(String indexName, String indexValue) {
            return delegate.findByIndexNameAndIndexValue(indexName, indexValue);
        }

        void failAfterSuccessfulDeletes(int allowedSuccesses) {
            this.failAfterSuccessfulDeletes = allowedSuccesses;
        }

        int deleteAttempts() {
            return deleteAttempts.get();
        }

        int successfulDeletes() {
            return successfulDeletes.get();
        }
    }
}
