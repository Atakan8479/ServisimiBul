package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.config.ParentEmailVerificationProperties;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.EmailVerificationTokenRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.security.AuthenticatedUser;
import com.servisimibul.backend.security.ParentVerificationSessionFilter;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.auth.parent-registration.enabled=true",
        "app.auth.parent-email-verification.required=true"
})
@AutoConfigureMockMvc
@Import(ParentRegistrationVerificationRequiredTests.TestBeans.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class ParentRegistrationVerificationRequiredTests {

    private static final String EMAIL = "strict-parent@example.com";
    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private EmailVerificationTokenRepository verificationTokenRepository;
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private AuthWorkflowTests.CapturingAuthEmailSender emailSender;

    @BeforeEach
    void clearEmail() {
        emailSender.clear();
    }

    @Test
    void strictModeCreatesVerificationTokenAndRejectsLoginUntilVerified() throws Exception {
        mockMvc.perform(post("/api/v1/auth/parent/register")
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {
                                  "email":"strict-parent@example.com",
                                  "password":"correct horse battery staple"
                                }
                                """))
                .andExpect(status().isAccepted());

        AppUser parent = userRepository.findByEmail(EMAIL).orElseThrow();
        AuthWorkflowTests.SentEmail sent = emailSender.onlyMessage();
        assertThat(parent.isEmailVerified()).isFalse();
        assertThat(verificationTokenRepository.count()).isOne();
        assertThatThrownBy(this::authenticate).isInstanceOf(AuthenticationException.class);

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"token\":\"%s\"}".formatted(sent.token())))
                .andExpect(status().isNoContent());
        assertThat(authenticate().isAuthenticated()).isTrue();
    }

    @Test
    void strictModeInvalidatesAnExistingUnverifiedParentSession() throws Exception {
        AuthenticatedUser principal = new AuthenticatedUser(
                java.util.UUID.randomUUID(),
                "existing-unverified-parent@example.com",
                null,
                UserRole.PARENT,
                true,
                false
        );
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
                principal,
                null,
                principal.getAuthorities()
        );
        SecurityContextHolder.setContext(new SecurityContextImpl(authentication));
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpSession session = (MockHttpSession) request.getSession();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (ignoredRequest, ignoredResponse) ->
                assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();

        new ParentVerificationSessionFilter(new ParentEmailVerificationProperties(true))
                .doFilter(request, response, chain);

        assertThat(session.isInvalid()).isTrue();
    }

    private org.springframework.security.core.Authentication authenticate() {
        return authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(EMAIL, PASSWORD)
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
