package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.PendingEmailChangeRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.TokenHasher;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.auth.email-change.enabled=true",
        "app.rate-limit.email-change-account.requests=3",
        "app.rate-limit.email-change-ip.requests=100",
        "app.rate-limit.email-change-confirm-ip.requests=100"
})
@AutoConfigureMockMvc
@Import(EmailChangeApiTests.EmailTestConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class EmailChangeApiTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private PendingEmailChangeRepository pendingRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private FindByIndexNameSessionRepository<?> sessionRepository;
    @Autowired
    private AuthPersistenceService persistence;
    @Autowired
    private TokenHasher tokenHasher;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private TestEmailSender emailSender;

    @BeforeEach
    void resetSender() {
        emailSender.reset();
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"PARENT", "OPERATOR"})
    void verifiesTheNewAddressThenRevokesEveryOldPrincipalSession(UserRole role) throws Exception {
        AppUser account = createUser(role, uniqueEmail(role.name().toLowerCase()));
        Cookie normalSession = login(account.getEmail(), false);
        Cookie rememberedSession = login(account.getEmail(), true);
        String oldEmail = account.getEmail();
        String newEmail = uniqueEmail("changed");

        requestChange(normalSession, newEmail).andExpect(status().isAccepted());

        assertThat(userRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(oldEmail);
        String rawToken = emailSender.tokenFor(newEmail);
        assertThat(rawToken).isNotBlank();
        assertThat(pendingRepository.existsByTokenHash(rawToken)).isFalse();
        assertThat(pendingRepository.existsByTokenHash(tokenHasher.hash(rawToken))).isTrue();

        confirm(rawToken).andExpect(status().isNoContent());

        assertThat(userRepository.findById(account.getId()).orElseThrow().getEmail()).isEqualTo(newEmail);
        assertThat(sessionRepository.findByPrincipalName(oldEmail)).isEmpty();
        mockMvc.perform(get("/api/v1/auth/me").cookie(normalSession))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/me").cookie(rememberedSession))
                .andExpect(status().isUnauthorized());
        assertRejectedLogin(oldEmail);
        login(newEmail, false);
    }

    @Test
    void requiresOwnerAuthenticationAndCsrfWithoutAcceptingAnAccountId() throws Exception {
        AppUser actor = createUser(UserRole.PARENT, uniqueEmail("actor"));
        AppUser other = createUser(UserRole.OPERATOR, uniqueEmail("other"));
        Cookie actorSession = login(actor.getEmail(), false);
        String proposedEmail = uniqueEmail("owned");

        mockMvc.perform(post("/api/v1/auth/email-change")
                        .with(csrf())
                        .contentType("application/json")
                        .content(emailJson(proposedEmail)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/email-change")
                        .cookie(actorSession)
                        .contentType("application/json")
                        .content(emailJson(proposedEmail)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        mockMvc.perform(post("/api/v1/auth/email-change")
                        .cookie(actorSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","accountId":"%s"}
                                """.formatted(proposedEmail, other.getId())))
                .andExpect(status().isAccepted());
        confirm(emailSender.tokenFor(proposedEmail)).andExpect(status().isNoContent());

        assertThat(userRepository.findById(actor.getId()).orElseThrow().getEmail())
                .isEqualTo(proposedEmail);
        assertThat(userRepository.findById(other.getId()).orElseThrow().getEmail())
                .isEqualTo(other.getEmail());

        mockMvc.perform(post("/api/v1/auth/email-change")
                        .with(user(new AuthenticatedUser(
                                UUID.randomUUID(),
                                "admin@example.com",
                                "hash",
                                UserRole.ADMIN,
                                true
                        )))
                        .with(csrf())
                        .contentType("application/json")
                        .content(emailJson(uniqueEmail("admin"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void keepsEmailAvailabilityPrivateAndNeverSendsForAnOccupiedAddress() throws Exception {
        AppUser actor = createUser(UserRole.PARENT, uniqueEmail("private"));
        AppUser occupied = createUser(UserRole.OPERATOR, uniqueEmail("occupied"));
        Cookie session = login(actor.getEmail(), false);

        requestChange(session, occupied.getEmail())
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));

        assertThat(emailSender.tokenFor(occupied.getEmail())).isNull();
        assertThat(userRepository.findById(actor.getId()).orElseThrow().getEmail())
                .isEqualTo(actor.getEmail());
    }

    @Test
    void rejectsStaleExpiredInvalidAndReplayedTokens() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("tokens"));
        Cookie session = login(account.getEmail(), false);
        String firstEmail = uniqueEmail("first");
        String secondEmail = uniqueEmail("second");

        requestChange(session, firstEmail).andExpect(status().isAccepted());
        String staleToken = emailSender.tokenFor(firstEmail);
        requestChange(session, secondEmail).andExpect(status().isAccepted());
        String currentToken = emailSender.tokenFor(secondEmail);

        confirm(staleToken).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALID_OR_EXPIRED"));
        confirm("not-a-real-token").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALID_OR_EXPIRED"));

        jdbcTemplate.update("""
                update pending_email_change
                set created_at = now() - interval '2 days',
                    expires_at = now() - interval '1 day'
                where token_hash = ?
                """, tokenHasher.hash(currentToken));
        confirm(currentToken).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALID_OR_EXPIRED"));

        String finalEmail = uniqueEmail("final");
        requestChange(session, finalEmail).andExpect(status().isAccepted());
        String finalToken = emailSender.tokenFor(finalEmail);
        confirm(finalToken).andExpect(status().isNoContent());
        confirm(finalToken).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALID_OR_EXPIRED"));
    }

    @Test
    void releasesAnExpiredPendingAddressForAnotherAccount() throws Exception {
        AppUser first = createUser(UserRole.PARENT, uniqueEmail("expired-first"));
        AppUser second = createUser(UserRole.OPERATOR, uniqueEmail("expired-second"));
        Cookie firstSession = login(first.getEmail(), false);
        Cookie secondSession = login(second.getEmail(), false);
        String proposedEmail = uniqueEmail("expired-target");

        requestChange(firstSession, proposedEmail).andExpect(status().isAccepted());
        jdbcTemplate.update("""
                update pending_email_change
                set created_at = now() - interval '2 days',
                    expires_at = now() - interval '1 day'
                where user_id = ?
                """, first.getId());

        requestChange(secondSession, proposedEmail).andExpect(status().isAccepted());

        assertThat(jdbcTemplate.queryForObject("""
                select user_id
                from pending_email_change
                where proposed_email = ? and consumed_at is null
                """, UUID.class, proposedEmail)).isEqualTo(second.getId());
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pending_email_change
                where user_id = ? and consumed_at is not null
                """, Integer.class, first.getId())).isOne();
        assertThat(userRepository.findById(first.getId()).orElseThrow().getEmail())
                .isEqualTo(first.getEmail());
        assertThat(userRepository.findById(second.getId()).orElseThrow().getEmail())
                .isEqualTo(second.getEmail());
    }

    @Test
    void serializesConflictingPendingAddressesAcrossAccounts() throws Exception {
        AppUser first = createUser(UserRole.PARENT, uniqueEmail("concurrent-first"));
        AppUser second = createUser(UserRole.OPERATOR, uniqueEmail("concurrent-second"));
        String proposedEmail = uniqueEmail("concurrent-target");
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var firstResult = executor.submit(() -> issueAfter(start, first.getId(), proposedEmail, "first"));
            var secondResult = executor.submit(() -> issueAfter(start, second.getId(), proposedEmail, "second"));
            start.countDown();

            List<Throwable> failures = Arrays.asList(
                    firstResult.get(10, TimeUnit.SECONDS),
                    secondResult.get(10, TimeUnit.SECONDS)
            );
            assertThat(failures).filteredOn(result -> result == null).hasSize(1);
            assertThat(failures).filteredOn(DataIntegrityViolationException.class::isInstance).hasSize(1);
        }

        Integer active = jdbcTemplate.queryForObject(
                "select count(*) from pending_email_change where proposed_email = ? and consumed_at is null",
                Integer.class,
                proposedEmail
        );
        assertThat(active).isEqualTo(1);
    }

    @Test
    void rateLimitsRepeatedRequestsPerAuthenticatedAccount() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("limited"));
        Cookie session = login(account.getEmail(), false);

        for (int attempt = 0; attempt < 3; attempt++) {
            requestChange(session, uniqueEmail("limited-" + attempt))
                    .andExpect(status().isAccepted());
        }
        requestChange(session, uniqueEmail("limited-blocked"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void invalidatesThePendingTokenWhenDeliveryFailsWithoutDisclosingTheFailure() throws Exception {
        AppUser account = createUser(UserRole.PARENT, uniqueEmail("delivery"));
        Cookie session = login(account.getEmail(), false);
        String proposedEmail = uniqueEmail("delivery-target");
        emailSender.failNext();

        requestChange(session, proposedEmail)
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));

        String rawToken = emailSender.tokenFor(proposedEmail);
        assertThat(rawToken).isNotBlank();
        confirm(rawToken).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOKEN_INVALID_OR_EXPIRED"));
        assertThat(userRepository.findById(account.getId()).orElseThrow().getEmail())
                .isEqualTo(account.getEmail());
    }

    private Throwable issueAfter(
            CountDownLatch start,
            UUID userId,
            String proposedEmail,
            String token
    ) {
        try {
            start.await(5, TimeUnit.SECONDS);
            persistence.issueEmailChange(
                    userId,
                    proposedEmail,
                    tokenHasher.hash(token),
                    OffsetDateTime.now()
            );
            return null;
        } catch (Throwable failure) {
            return failure;
        }
    }

    private org.springframework.test.web.servlet.ResultActions requestChange(
            Cookie session,
            String email
    ) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/email-change")
                .cookie(session)
                .with(csrf())
                .contentType("application/json")
                .content(emailJson(email)));
    }

    private org.springframework.test.web.servlet.ResultActions confirm(String token) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/email-change/confirm")
                .with(csrf())
                .contentType("application/json")
                .content("""
                        {"token":"%s"}
                        """.formatted(token)));
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

    private void assertRejectedLogin(String email) {
        assertThatThrownBy(() -> authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, PASSWORD)
        )).isInstanceOf(RuntimeException.class);
    }

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    private String emailJson(String email) {
        return """
                {"email":"%s"}
                """.formatted(email);
    }

    @TestConfiguration
    static class EmailTestConfiguration {

        @Bean
        @Primary
        TestEmailSender testEmailSender() {
            return new TestEmailSender();
        }
    }

    static final class TestEmailSender implements AuthEmailSender {

        private final ConcurrentHashMap<String, String> tokens = new ConcurrentHashMap<>();
        private final AtomicBoolean failNext = new AtomicBoolean();

        @Override
        public boolean isAvailable() {
            return true;
        }

        @Override
        public void sendVerification(String email, String rawToken) {
        }

        @Override
        public void sendPasswordReset(String email, String rawToken) {
        }

        @Override
        public void sendEmailChangeVerification(String email, String rawToken) {
            tokens.put(email, rawToken);
            if (failNext.getAndSet(false)) {
                throw new IllegalStateException("test delivery failure");
            }
        }

        String tokenFor(String email) {
            return tokens.get(email);
        }

        void failNext() {
            failNext.set(true);
        }

        void reset() {
            tokens.clear();
            failNext.set(false);
        }
    }
}
