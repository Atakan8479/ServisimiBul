package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.EmailVerificationTokenRepository;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.UserRole;
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
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.auth.parent-registration.enabled=true",
        "app.rate-limit.registration-ip.requests=2"
})
@AutoConfigureMockMvc
@Import(ParentRegistrationSecurityTests.TestBeans.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class ParentRegistrationSecurityTests {

    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private OperatorProfileRepository profileRepository;
    @Autowired
    private EmailVerificationTokenRepository verificationTokenRepository;
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private TokenHasher tokenHasher;
    @Autowired
    private AuthWorkflowTests.CapturingAuthEmailSender emailSender;

    @BeforeEach
    void clearEmail() {
        emailSender.clear();
    }

    @Test
    void registrationFixesTheRoleAndRequiresEmailVerificationBeforeLogin() throws Exception {
        postJson(
                "/api/v1/auth/parent/register",
                """
                        {
                          "email":"  Parent@Example.COM ",
                          "password":"correct horse battery staple",
                          "role":"ADMIN",
                          "businessName":"Ignored",
                          "contactPhone":"+905321234567"
                        }
                        """,
                "10.10.0.1"
        ).andExpect(status().isAccepted());

        AppUser parent = userRepository.findByEmail("parent@example.com").orElseThrow();
        AuthWorkflowTests.SentEmail sent = emailSender.onlyMessage();
        assertThat(parent.getRole()).isEqualTo(UserRole.PARENT);
        assertThat(parent.isEmailVerified()).isFalse();
        assertThat(profileRepository.findByUserId(parent.getId())).isEmpty();
        assertThat(verificationTokenRepository.findUserIdByTokenHash(tokenHasher.hash(sent.token())))
                .contains(parent.getId());
        assertThatThrownBy(() -> authenticate(parent.getEmail()))
                .isInstanceOf(AuthenticationException.class);

        postJson(
                "/api/v1/auth/verify-email",
                "{\"token\":\"" + sent.token() + "\"}",
                "10.10.0.1"
        ).andExpect(status().isNoContent());
        assertThat(authenticate(parent.getEmail()).isAuthenticated()).isTrue();
    }

    @Test
    void duplicateRegistrationReturnsTheSameResponseWithoutAnotherEmail() throws Exception {
        register("duplicate-parent@example.com", "10.10.0.2")
                .andExpect(status().isAccepted());
        register("DUPLICATE-PARENT@example.com", "10.10.0.2")
                .andExpect(status().isAccepted());

        assertThat(userRepository.findAll().stream()
                .filter(user -> user.getEmail().equals("duplicate-parent@example.com")))
                .hasSize(1);
        emailSender.onlyMessage();
    }

    @Test
    void registrationRequiresCsrfAndValidCredentials() throws Exception {
        mockMvc.perform(post("/api/v1/auth/parent/register")
                        .contentType("application/json")
                        .content(parentJson("csrf-parent@example.com", PASSWORD)))
                .andExpect(status().isForbidden());

        postJson(
                "/api/v1/auth/parent/register",
                parentJson("weak-parent@example.com", "too-short"),
                "10.10.0.3"
        ).andExpect(status().isBadRequest());
        assertThat(userRepository.findByEmail("weak-parent@example.com")).isEmpty();
    }

    @Test
    void registrationUsesTheExistingIpRateLimit() throws Exception {
        register("limited-parent-1@example.com", "10.10.0.4")
                .andExpect(status().isAccepted());
        register("limited-parent-2@example.com", "10.10.0.4")
                .andExpect(status().isAccepted());
        register("limited-parent-3@example.com", "10.10.0.4")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    private org.springframework.test.web.servlet.ResultActions register(
            String email,
            String remoteAddress
    ) throws Exception {
        return postJson(
                "/api/v1/auth/parent/register",
                parentJson(email, PASSWORD),
                remoteAddress
        );
    }

    private String parentJson(String email, String password) {
        return "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password);
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

    private org.springframework.security.core.Authentication authenticate(String email) {
        return authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, PASSWORD)
        );
    }

    @TestConfiguration
    static class TestBeans {

        @Bean
        @Primary
        AuthWorkflowTests.CapturingAuthEmailSender capturingAuthEmailSender() {
            return new AuthWorkflowTests.CapturingAuthEmailSender();
        }
    }
}
