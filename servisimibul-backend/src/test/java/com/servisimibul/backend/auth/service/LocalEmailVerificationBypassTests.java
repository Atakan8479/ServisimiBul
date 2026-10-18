package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.EmailVerificationTokenRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.auth.email-verification.required=false",
        "servisimibul.email.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class LocalEmailVerificationBypassTests {

    private static final String EMAIL = "local-bypass@example.com";
    private static final String PASSWORD = "correct horse battery staple";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private EmailVerificationTokenRepository verificationTokenRepository;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Test
    void localRegistrationSkipsEmailAndCanAuthenticateImmediately() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s",
                                  "businessName": "Local Test Service",
                                  "contactPhone": "+905321234567"
                                }
                                """.formatted(EMAIL, PASSWORD)))
                .andExpect(status().isAccepted());

        AppUser user = userRepository.findByEmail(EMAIL).orElseThrow();
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(verificationTokenRepository.findLatestCreatedAtByUserId(user.getId())).isEmpty();

        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(EMAIL, PASSWORD)
        );
        assertThat(authentication.isAuthenticated()).isTrue();
    }
}
