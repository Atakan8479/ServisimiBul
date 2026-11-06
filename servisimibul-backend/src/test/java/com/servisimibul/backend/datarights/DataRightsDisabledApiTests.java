package com.servisimibul.backend.datarights;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Default configuration: intake is off, so nothing is stored and nothing claims receipt. */
@SpringBootTest
@AutoConfigureMockMvc
class DataRightsDisabledApiTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AppUserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void intakeAndHandlingAreUnavailableAndPersistNothing() throws Exception {
        AppUser parent = AppUser.newParent("data-rights-off-" + UUID.randomUUID() + "@example.com", "hash");
        parent.verifyEmail(OffsetDateTime.now());
        parent = userRepository.saveAndFlush(parent);
        try {
            var principal = user(new AuthenticatedUser(
                    parent.getId(), parent.getEmail(), "hash", parent.getRole(), true));

            mockMvc.perform(post("/api/v1/data-rights-requests").with(principal).with(csrf())
                            .contentType("application/json")
                            .content("{\"type\":\"ACCESS\",\"details\":\"Verilerim\"}"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("data_rights_unavailable"))
                    .andExpect(jsonPath("$.id").doesNotExist());
            mockMvc.perform(get("/api/v1/data-rights-requests").with(principal))
                    .andExpect(status().isServiceUnavailable());
            assertThat(jdbc.queryForObject(
                    "select count(*) from data_rights_request where requester_id = ?",
                    Integer.class, parent.getId())).isZero();

            jdbc.update("update app_user set role = 'ADMIN' where id = ?", parent.getId());
            jdbc.update("insert into data_rights_handler (user_id, designated_at) values (?, now())", parent.getId());
            var admin = user(new AuthenticatedUser(
                    parent.getId(), parent.getEmail(), "hash", com.servisimibul.backend.identity.UserRole.ADMIN, true));
            mockMvc.perform(get("/api/v1/admin/data-rights-requests").with(admin))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("data_rights_unavailable"));
            mockMvc.perform(get("/api/v1/admin/data-rights-requests/" + UUID.randomUUID()
                            + "/access-response").with(admin))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("data_rights_unavailable"));
        } finally {
            jdbc.update("delete from data_rights_handler where user_id = ?", parent.getId());
            userRepository.deleteById(parent.getId());
        }
    }
}
