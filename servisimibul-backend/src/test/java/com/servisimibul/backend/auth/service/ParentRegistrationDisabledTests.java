package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.identity.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class ParentRegistrationDisabledTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AppUserRepository userRepository;

    @Test
    void registrationIsClosedByDefaultWithoutWritingAnAccount() throws Exception {
        mockMvc.perform(post("/api/v1/auth/parent/register")
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {
                                  "email":"closed-parent@example.com",
                                  "password":"correct horse battery staple"
                                }
                                """))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PARENT_REGISTRATION_UNAVAILABLE"));

        assertThat(userRepository.findByEmail("closed-parent@example.com")).isEmpty();
    }
}
