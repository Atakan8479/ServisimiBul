package com.servisimibul.backend.identity;

import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

// Deliberately not @Transactional: the service transaction must really commit or roll back.
@SpringBootTest
@AutoConfigureMockMvc
class OperatorSuspensionRollbackTests {

    // Passes @NotBlank, but PostgreSQL rejects a NUL byte when the review row is written.
    private static final String REASON_REJECTED_BY_DATABASE = "{\"reason\":\"Rollback\\u0000check\"}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private OperatorProfileRepository profileRepository;

    @Autowired
    private OperatorApplicationReviewRepository reviewRepository;

    @Test
    void rejectedReviewRowLeavesTheOperatorActiveAndEnabled() {
        AppUser admin = userRepository.saveAndFlush(verified(
                AppUser.newAdmin("rollback-admin@example.com", "test-password-hash")
        ));
        AppUser operator = userRepository.saveAndFlush(verified(
                AppUser.newOperator("rollback-operator@example.com", "test-password-hash")
        ));
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(operator, "Rollback Transport", "+905551112277")
        );

        int status = -1;
        try {
            status = mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                            .with(as(admin))
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(REASON_REJECTED_BY_DATABASE))
                    .andReturn().getResponse().getStatus();
        } catch (Exception unhandledByMockMvc) {
            status = 500;
        } finally {
            boolean profileActive = profileRepository.findById(profile.getId()).orElseThrow().isActive();
            boolean userEnabled = userRepository.findById(operator.getId()).orElseThrow().isEnabled();
            int reviewCount = reviewRepository.findAllByOperatorIdOrderByReviewedAtAscIdAsc(profile.getId()).size();
            profileRepository.deleteById(profile.getId());
            userRepository.deleteById(operator.getId());
            userRepository.deleteById(admin.getId());

            assertThat(status).isGreaterThanOrEqualTo(400);
            assertThat(profileActive).isTrue();
            assertThat(userEnabled).isTrue();
            assertThat(reviewCount).isZero();
        }
    }

    private AppUser verified(AppUser user) {
        user.verifyEmail(OffsetDateTime.now());
        return user;
    }

    private RequestPostProcessor as(AppUser value) {
        return user(new AuthenticatedUser(
                value.getId(), value.getEmail(), "test-password-hash", value.getRole(), true
        ));
    }
}
