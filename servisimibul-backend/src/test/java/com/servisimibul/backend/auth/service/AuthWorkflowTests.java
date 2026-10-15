package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.EmailVerificationTokenRepository;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.security.SessionRevoker;
import com.servisimibul.backend.security.TokenHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.OffsetDateTime;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(AuthWorkflowTests.TestBeans.class)
@Transactional
class AuthWorkflowTests {

    private static final String INITIAL_PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private OperatorProfileRepository profileRepository;
    @Autowired
    private EmailVerificationTokenRepository verificationTokenRepository;
    @Autowired
    private TokenHasher tokenHasher;
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private CapturingAuthEmailSender emailSender;
    @Autowired
    private RecordingSessionRevoker sessionRevoker;
    @Autowired
    private MutableClock clock;
    @Autowired
    private AuthPersistenceService persistence;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetTestState() {
        emailSender.clear();
        sessionRevoker.clear();
        clock.set(Instant.now().plusSeconds(5));
    }

    @Test
    void registrationCreatesNormalizedOperatorAndHashedVerificationToken() throws Exception {
        register("  Operator@Example.COM ", INITIAL_PASSWORD, " Test Service ", "0532 123 45 67", "10.0.0.1")
                .andExpect(status().isAccepted());

        AppUser user = userRepository.findByEmail("operator@example.com").orElseThrow();
        var profile = profileRepository.findByUserId(user.getId()).orElseThrow();
        SentEmail sent = emailSender.onlyMessage();

        assertThat(user.isEmailVerified()).isFalse();
        assertThat(profile.getBusinessName()).isEqualTo("Test Service");
        assertThat(profile.getContactPhone()).isEqualTo("+905321234567");
        assertThat(profile.getApprovalStatus()).isEqualTo(OperatorApprovalStatus.DRAFT);
        assertThat(profile.isPubliclyVisible()).isTrue();
        assertThat(sent.type()).isEqualTo(EmailType.VERIFICATION);
        assertThat(sent.email()).isEqualTo("operator@example.com");
        assertThat(verificationTokenRepository.findUserIdByTokenHash(tokenHasher.hash(sent.token())))
                .contains(user.getId());
        assertThat(verificationTokenRepository.findUserIdByTokenHash(sent.token())).isEmpty();
    }

    @Test
    void registrationAllowsBusinessNameToBeOmitted() throws Exception {
        postJson(
                "/api/v1/auth/register",
                """
                        {
                          "email":"optional-name@example.com",
                          "password":"correct horse battery staple",
                          "contactPhone":"0532 123 45 67"
                        }
                        """,
                "10.0.0.21"
        ).andExpect(status().isAccepted());

        AppUser user = userRepository.findByEmail("optional-name@example.com").orElseThrow();
        OperatorProfile profile = profileRepository.findByUserId(user.getId()).orElseThrow();
        assertThat(profile.getBusinessName()).isNull();
        assertThat(profile.getContactPhone()).isEqualTo("+905321234567");
    }

    @Test
    void duplicateRegistrationHasTheSameResponseAndSendsNoSecondEmail() throws Exception {
        register("duplicate@example.com", INITIAL_PASSWORD, "First Service", "+905321234567", "10.0.0.2")
                .andExpect(status().isAccepted());
        register("DUPLICATE@example.com", INITIAL_PASSWORD, "Other Service", "+905551234567", "10.0.0.2")
                .andExpect(status().isAccepted());

        assertThat(userRepository.findAll().stream()
                .filter(user -> user.getEmail().equals("duplicate@example.com"))
                .toList())
                .hasSize(1);
        assertThat(emailSender.messages).hasSize(1);
    }

    @Test
    void weakPasswordAndMalformedPhoneReturnValidationProblems() throws Exception {
        register("weak@example.com", "too-short", "Test Service", "+905321234567", "10.0.0.3")
                .andExpect(status().isBadRequest());
        register("phone@example.com", INITIAL_PASSWORD, "Test Service", "12345", "10.0.0.3")
                .andExpect(status().isBadRequest());

        assertThat(userRepository.findByEmail("weak@example.com")).isEmpty();
        assertThat(userRepository.findByEmail("phone@example.com")).isEmpty();
    }

    @Test
    void malformedJsonReturnsStableProblemDetails() throws Exception {
        postJson("/api/v1/auth/register", "{", "10.0.0.3")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType("application/problem+json"))
                .andExpect(jsonPath("$.code").value("MALFORMED_JSON"));
    }

    @Test
    void verificationIsSingleUseAndDoesNotApproveTheProfile() throws Exception {
        register("verify@example.com", INITIAL_PASSWORD, "Test Service", "+905321234567", "10.0.0.4")
                .andExpect(status().isAccepted());
        String token = emailSender.onlyMessage().token();

        postJson("/api/v1/auth/verify-email", "{\"token\":\"" + token + "\"}", "10.0.0.4")
                .andExpect(status().isNoContent());
        postJson("/api/v1/auth/verify-email", "{\"token\":\"" + token + "\"}", "10.0.0.4")
                .andExpect(status().isBadRequest());

        AppUser user = userRepository.findByEmail("verify@example.com").orElseThrow();
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(profileRepository.findByUserId(user.getId()).orElseThrow().getApprovalStatus())
                .isEqualTo(OperatorApprovalStatus.DRAFT);
    }

    @Test
    void expiredVerificationTokenIsRejected() throws Exception {
        register("expired@example.com", INITIAL_PASSWORD, "Test Service", "+905321234567", "10.0.0.5")
                .andExpect(status().isAccepted());
        String token = emailSender.onlyMessage().token();
        clock.advance(Duration.ofHours(25));

        postJson("/api/v1/auth/verify-email", "{\"token\":\"" + token + "\"}", "10.0.0.5")
                .andExpect(status().isBadRequest());
        assertThat(userRepository.findByEmail("expired@example.com").orElseThrow().isEmailVerified())
                .isFalse();
    }

    @Test
    void resendHonorsCooldownAndInvalidatesTheEarlierToken() throws Exception {
        register("resend@example.com", INITIAL_PASSWORD, "Test Service", "+905321234567", "10.0.0.6")
                .andExpect(status().isAccepted());
        String originalToken = emailSender.onlyMessage().token();

        postJson("/api/v1/auth/resend-verification", "{\"email\":\"resend@example.com\"}", "10.0.0.6")
                .andExpect(status().isAccepted());
        assertThat(emailSender.messages).hasSize(1);

        clock.advance(Duration.ofSeconds(61));
        postJson("/api/v1/auth/resend-verification", "{\"email\":\"resend@example.com\"}", "10.0.0.6")
                .andExpect(status().isAccepted());
        assertThat(emailSender.messages).hasSize(2);

        postJson("/api/v1/auth/verify-email", "{\"token\":\"" + originalToken + "\"}", "10.0.0.6")
                .andExpect(status().isBadRequest());
    }

    @Test
    void forgotPasswordDoesNotRevealWhetherAnAccountExists() throws Exception {
        postJson("/api/v1/auth/forgot-password", "{\"email\":\"missing@example.com\"}", "10.0.0.7")
                .andExpect(status().isAccepted());
        assertThat(emailSender.messages).isEmpty();

        registerAndVerify("reset@example.com", "10.0.0.7");
        emailSender.clear();
        postJson("/api/v1/auth/forgot-password", "{\"email\":\"reset@example.com\"}", "10.0.0.7")
                .andExpect(status().isAccepted());
        assertThat(emailSender.onlyMessage().type()).isEqualTo(EmailType.PASSWORD_RESET);
    }

    @Test
    void passwordResetIsSingleUseAndRequestsSessionRevocation() throws Exception {
        registerAndVerify("password@example.com", "10.0.0.8");
        emailSender.clear();
        postJson("/api/v1/auth/forgot-password", "{\"email\":\"password@example.com\"}", "10.0.0.8")
                .andExpect(status().isAccepted());
        String resetToken = emailSender.onlyMessage().token();
        String newPassword = "a different secure password";

        postJson(
                "/api/v1/auth/reset-password",
                "{\"token\":\"" + resetToken + "\",\"newPassword\":\"" + newPassword + "\"}",
                "10.0.0.8"
        ).andExpect(status().isNoContent());
        postJson(
                "/api/v1/auth/reset-password",
                "{\"token\":\"" + resetToken + "\",\"newPassword\":\"" + newPassword + "\"}",
                "10.0.0.8"
        ).andExpect(status().isBadRequest());

        AppUser user = userRepository.findByEmail("password@example.com").orElseThrow();
        assertThat(sessionRevoker.userIds).containsExactly(user.getId());
        assertThatThrownBy(() -> authenticate("password@example.com", INITIAL_PASSWORD))
                .isInstanceOf(BadCredentialsException.class);
        assertThat(authenticate("password@example.com", newPassword)).isNotNull();
    }

    @Test
    void perIpLimitReturnsRetryAfterWithoutRevealingAccounts() throws Exception {
        for (int attempt = 0; attempt < 20; attempt++) {
            postJson(
                    "/api/v1/auth/forgot-password",
                    "{\"email\":\"missing" + attempt + "@example.com\"}",
                    "10.0.0.9"
            ).andExpect(status().isAccepted());
        }

        postJson("/api/v1/auth/forgot-password", "{\"email\":\"last@example.com\"}", "10.0.0.9")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentVerificationRequestsIssueOnlyOneReplacementToken() throws Exception {
        String email = "concurrent-" + UUID.randomUUID() + "@example.com";
        AppUser user = userRepository.saveAndFlush(AppUser.newOperator(email, "test-only-hash"));
        profileRepository.saveAndFlush(new OperatorProfile(user, "Concurrent Service", "+905321234567"));
        UUID userId = user.getId();

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            OffsetDateTime replacementTime = OffsetDateTime.now(ZoneOffset.UTC);
            Future<Optional<String>> first = executor.submit(() -> {
                start.await();
                return persistence.issueVerificationToken(
                        email,
                        tokenHasher.hash("first-replacement"),
                        replacementTime
                );
            });
            Future<Optional<String>> second = executor.submit(() -> {
                start.await();
                return persistence.issueVerificationToken(
                        email,
                        tokenHasher.hash("second-replacement"),
                        replacementTime
                );
            });

            start.countDown();
            long issued = List.of(
                            first.get(10, TimeUnit.SECONDS),
                            second.get(10, TimeUnit.SECONDS)
                    ).stream()
                    .filter(Optional::isPresent)
                    .count();

            assertThat(issued).isEqualTo(1);
        } finally {
            executor.shutdownNow();
            jdbcTemplate.update("delete from email_verification_token where user_id = ?", userId);
            jdbcTemplate.update("delete from operator_profile where user_id = ?", userId);
            jdbcTemplate.update("delete from app_user where id = ?", userId);
        }
    }

    private org.springframework.test.web.servlet.ResultActions register(
            String email,
            String password,
            String businessName,
            String phone,
            String remoteAddress
    ) throws Exception {
        String json = """
                {"email":"%s","password":"%s","businessName":"%s","contactPhone":"%s"}
                """.formatted(email, password, businessName, phone);
        return postJson("/api/v1/auth/register", json, remoteAddress);
    }

    private void registerAndVerify(String email, String remoteAddress) throws Exception {
        register(email, INITIAL_PASSWORD, "Test Service", "+905321234567", remoteAddress)
                .andExpect(status().isAccepted());
        String token = emailSender.onlyMessage().token();
        postJson("/api/v1/auth/verify-email", "{\"token\":\"" + token + "\"}", remoteAddress)
                .andExpect(status().isNoContent());
    }

    private org.springframework.test.web.servlet.ResultActions postJson(
            String path,
            String json,
            String remoteAddress
    ) throws Exception {
        return mockMvc.perform(post(path)
                .with(csrf())
                .with(request -> {
                    request.setRemoteAddr(remoteAddress);
                    return request;
                })
                .contentType("application/json")
                .content(json));
    }

    private Object authenticate(String email, String password) {
        return authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
    }

    @TestConfiguration
    static class TestBeans {

        @Bean
        @Primary
        CapturingAuthEmailSender capturingAuthEmailSender() {
            return new CapturingAuthEmailSender();
        }

        @Bean
        @Primary
        RecordingSessionRevoker recordingSessionRevoker() {
            return new RecordingSessionRevoker();
        }

        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock();
        }
    }

    static final class CapturingAuthEmailSender implements AuthEmailSender {

        private final List<SentEmail> messages = new ArrayList<>();

        @Override
        public boolean isAvailable() {
            return true;
        }

        @Override
        public void sendVerification(String email, String rawToken) {
            messages.add(new SentEmail(EmailType.VERIFICATION, email, rawToken));
        }

        @Override
        public void sendPasswordReset(String email, String rawToken) {
            messages.add(new SentEmail(EmailType.PASSWORD_RESET, email, rawToken));
        }

        SentEmail onlyMessage() {
            assertThat(messages).hasSize(1);
            return messages.getFirst();
        }

        void clear() {
            messages.clear();
        }
    }

    static final class RecordingSessionRevoker implements SessionRevoker {

        private final List<UUID> userIds = new ArrayList<>();

        @Override
        public void revokeAll(UUID userId) {
            userIds.add(userId);
        }

        void clear() {
            userIds.clear();
        }
    }

    static final class MutableClock extends Clock {

        private Instant instant = Instant.now();

        void set(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }

    enum EmailType {
        VERIFICATION,
        PASSWORD_RESET
    }

    record SentEmail(EmailType type, String email, String token) {
    }
}
