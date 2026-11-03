package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EmailChangeDisabledApiTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void advertisesAndEnforcesTheSmtpDisabledUnavailableState() throws Exception {
        AppUser account = AppUser.newParent(
                "disabled-" + UUID.randomUUID() + "@example.com",
                passwordEncoder.encode("correct horse battery staple")
        );
        account.verifyEmail(OffsetDateTime.now());
        account = userRepository.saveAndFlush(account);
        AuthenticatedUser principal = new AuthenticatedUser(
                account.getId(),
                account.getEmail(),
                "hash",
                account.getRole(),
                true
        );

        mockMvc.perform(get("/api/v1/auth/me").with(user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailChangeAvailable").value(false));
        mockMvc.perform(post("/api/v1/auth/email-change")
                        .with(user(principal))
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"email\":\"new@example.com\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("EMAIL_UNAVAILABLE"));
        mockMvc.perform(post("/api/v1/auth/email-change/confirm")
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"token\":\"unused-token\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("EMAIL_UNAVAILABLE"));
    }
}
