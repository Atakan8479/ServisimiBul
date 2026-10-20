package com.servisimibul.backend.auth;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.PasswordResetToken;
import com.servisimibul.backend.identity.PasswordResetTokenRepository;
import com.servisimibul.backend.security.SessionRevoker;
import com.servisimibul.backend.security.TokenHasher;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class SessionAuthenticationApiTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private OperatorProfileRepository profileRepository;

    @Autowired
    private PasswordResetTokenRepository resetTokenRepository;

    @Autowired
    private TokenHasher tokenHasher;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private FindByIndexNameSessionRepository<?> sessionRepository;

    @Autowired
    private SessionRevoker sessionRevoker;

    private String testedEmail;

    @AfterEach
    void removePersistedSessions() {
        if (testedEmail != null) {
            sessionRepository.findByPrincipalName(testedEmail).values()
                    .forEach(session -> sessionRepository.deleteById(session.getId()));
        }
    }

    @Test
    void verifiedUserCanLoginReadIdentityAndLogout() throws Exception {
        AppUser user = createVerifiedUser("session-user@example.com");

        LoginResult login = login(user.getEmail(), false);

        assertThat(login.setCookie()).contains("SBSESSION=")
                .contains("HttpOnly")
                .contains("SameSite=Lax")
                .contains("Path=/")
                .contains("Secure")
                .doesNotContain("Max-Age=");
        assertThat(sessionRepository.findByPrincipalName(user.getEmail()).values())
                .singleElement()
                .extracting(Session::getMaxInactiveInterval)
                .isEqualTo(Duration.ofMinutes(30));

        mockMvc.perform(get("/api/v1/auth/me").cookie(login.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.email").value(user.getEmail()))
                .andExpect(jsonPath("$.role").value("OPERATOR"));

        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(login.cookie())
                        .header(login.csrfHeader(), login.csrfToken()))
                .andExpect(status().isNoContent());

        assertThat(sessionRepository.findByPrincipalName(user.getEmail())).isEmpty();
    }

    @Test
    void verifiedParentCanLoginReadIdentityAndLogout() throws Exception {
        AppUser parent = AppUser.newParent(
                "parent-session@example.com",
                passwordEncoder.encode(PASSWORD)
        );
        parent.verifyEmail(OffsetDateTime.now());
        userRepository.saveAndFlush(parent);

        LoginResult login = login(parent.getEmail(), false);

        mockMvc.perform(get("/api/v1/auth/me").cookie(login.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("PARENT"))
                .andExpect(jsonPath("$.approvalStatus").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(login.cookie())
                        .header(login.csrfHeader(), login.csrfToken()))
                .andExpect(status().isNoContent());

        assertThat(sessionRepository.findByPrincipalName(parent.getEmail())).isEmpty();
    }

    @Test
    void successfulLoginRotatesThePreLoginSessionAndInvalidatesItsOldIdentifier()
            throws Exception {
        AppUser user = createVerifiedUser("rotation-user@example.com");
        CsrfSession csrf = csrfSession();

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.header(), csrf.token())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":false}
                                """.formatted(user.getEmail(), PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie rotated = result.getResponse().getCookie("SBSESSION");
        assertThat(rotated).isNotNull();
        assertThat(rotated.getValue()).isNotEqualTo(csrf.cookie().getValue());
        mockMvc.perform(get("/api/v1/auth/me").cookie(csrf.cookie()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/me").cookie(rotated))
                .andExpect(status().isOk());
    }

    @Test
    void rememberMeCreatesPersistentNinetyDaySession() throws Exception {
        AppUser user = createVerifiedUser("remembered-user@example.com");

        LoginResult login = login(user.getEmail(), true);

        assertThat(login.setCookie()).contains("Max-Age=");
        assertThat(login.cookie().getMaxAge()).isBetween(7_775_990, 7_776_000);
        assertThat(sessionRepository.findByPrincipalName(user.getEmail()).values())
                .singleElement()
                .satisfies(session -> {
                    assertThat(session.getMaxInactiveInterval()).isEqualTo(Duration.ofDays(90));
                    assertThat((Long) session.getAttribute("servisimibul.rememberUntil"))
                            .isGreaterThan(System.currentTimeMillis());
                });
    }

    @Test
    void thirdLoginRemovesOldestSessionAndRevokerRemovesTheRest() throws Exception {
        AppUser user = createVerifiedUser("limited-user@example.com");

        LoginResult first = login(user.getEmail(), false);
        Thread.sleep(5);
        login(user.getEmail(), false);
        Thread.sleep(5);
        login(user.getEmail(), false);

        assertThat(sessionRepository.findByPrincipalName(user.getEmail())).hasSize(2);
        mockMvc.perform(get("/api/v1/auth/me").cookie(first.cookie()))
                .andExpect(status().isUnauthorized());

        sessionRevoker.revokeAll(user.getId());
        assertThat(sessionRepository.findByPrincipalName(user.getEmail())).isEmpty();
    }

    @Test
    void invalidAndUnverifiedCredentialsReturnTheSameSafeError() throws Exception {
        AppUser unverified = userRepository.saveAndFlush(
                AppUser.newOperator("unverified-login@example.com", passwordEncoder.encode(PASSWORD))
        );
        testedEmail = unverified.getEmail();

        assertInvalidLogin(unverified.getEmail(), PASSWORD);
        assertInvalidLogin("missing@example.com", PASSWORD);
    }

    @Test
    void passwordResetRevokesJdbcSessionsAndTheOldCookieCannotAuthenticate() throws Exception {
        AppUser user = createVerifiedUser("jdbc-reset@example.com");
        LoginResult login = login(user.getEmail(), false);
        String rawToken = "reset-token-that-must-not-be-logged";
        resetTokenRepository.saveAndFlush(new PasswordResetToken(
                user,
                tokenHasher.hash(rawToken),
                OffsetDateTime.now().plusMinutes(30)
        ));
        CsrfSession csrf = csrfSession();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .cookie(csrf.cookie())
                        .header(csrf.header(), csrf.token())
                        .contentType("application/json")
                        .content("""
                                {"token":"%s","newPassword":"new correct horse battery staple"}
                                """.formatted(rawToken)))
                .andExpect(status().isNoContent());

        assertThat(sessionRepository.findByPrincipalName(user.getEmail())).isEmpty();
        mockMvc.perform(get("/api/v1/auth/me").cookie(login.cookie()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void disabledDatabaseUserCannotUseAnExistingSessionForOperatorData() throws Exception {
        AppUser user = createVerifiedUser("disabled-session@example.com");
        profileRepository.saveAndFlush(new OperatorProfile(user, null, "+905551112233"));
        LoginResult login = login(user.getEmail(), false);
        user.disable();
        userRepository.flush();

        mockMvc.perform(get("/api/v1/operator/profile").cookie(login.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("operator_account_disabled"));
    }

    @Test
    void authenticationSecretsNeverAppearInCapturedLogs(CapturedOutput output) throws Exception {
        String secretPassword = "log-sentinel-password-12345";
        CsrfSession csrf = csrfSession();

        mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.header(), csrf.token())
                        .contentType("application/json")
                        .content("""
                                {"email":"missing-log@example.com","password":"%s","rememberMe":false}
                                """.formatted(secretPassword)))
                .andExpect(status().isUnauthorized());

        assertThat(output.getAll())
                .doesNotContain(secretPassword)
                .doesNotContain(csrf.token())
                .doesNotContain(csrf.cookie().getValue());
    }

    private void assertInvalidLogin(String email, String password) throws Exception {
        CsrfSession csrf = csrfSession();
        mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.header(), csrf.token())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.detail").value("Email or password is incorrect"));
    }

    private AppUser createVerifiedUser(String email) {
        AppUser user = AppUser.newOperator(email, passwordEncoder.encode(PASSWORD));
        user.verifyEmail(OffsetDateTime.now());
        testedEmail = email;
        return userRepository.saveAndFlush(user);
    }

    private LoginResult login(String email, boolean rememberMe) throws Exception {
        CsrfSession csrf = csrfSession();
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.header(), csrf.token())
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","rememberMe":%s}
                                """.formatted(email, PASSWORD, rememberMe)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie cookie = result.getResponse().getCookie("SBSESSION");
        assertThat(cookie).isNotNull();
        return new LoginResult(
                cookie,
                result.getResponse().getHeader("Set-Cookie"),
                csrf.header(),
                csrf.token()
        );
    }

    private CsrfSession csrfSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        CsrfToken token = (CsrfToken) result.getRequest().getAttribute(CsrfToken.class.getName());
        Cookie cookie = result.getResponse().getCookie("SBSESSION");
        assertThat(cookie).isNotNull();
        return new CsrfSession(cookie, token.getHeaderName(), token.getToken());
    }

    private record CsrfSession(Cookie cookie, String header, String token) {
    }

    private record LoginResult(
            Cookie cookie,
            String setCookie,
            String csrfHeader,
            String csrfToken
    ) {
    }
}
