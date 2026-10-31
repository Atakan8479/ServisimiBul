package com.servisimibul.backend.identity;

import com.servisimibul.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
class OperatorSuspensionRollbackTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private OperatorProfileRepository profileRepository;

    @MockitoSpyBean
    private OperatorApplicationReviewRepository reviewRepository;

    @Test
    void rejectedReviewRowLeavesTheOperatorActiveAndEnabled() throws Exception {
        AppUser admin = userRepository.saveAndFlush(verified(
                AppUser.newAdmin("rollback-admin@example.com", "test-password-hash")
        ));
        AppUser operator = userRepository.saveAndFlush(verified(
                AppUser.newOperator("rollback-operator@example.com", "test-password-hash")
        ));
        OperatorProfile profile = profileRepository.saveAndFlush(
                new OperatorProfile(operator, "Rollback Transport", "+905551112277")
        );
        doThrow(new DataIntegrityViolationException("review row rejected"))
                .when(reviewRepository).saveAndFlush(any(OperatorApplicationReview.class));

        try {
            mockMvc.perform(post("/api/v1/admin/operators/{id}/suspend", profile.getId())
                    .with(as(admin))
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"reason\":\"Rollback check\"}"));
        } catch (Exception expectedWhenUnhandled) {
            assertThat(expectedWhenUnhandled).hasRootCauseInstanceOf(DataIntegrityViolationException.class);
        } finally {
            boolean profileActive = profileRepository.findById(profile.getId()).orElseThrow().isActive();
            boolean userEnabled = userRepository.findById(operator.getId()).orElseThrow().isEnabled();
            profileRepository.deleteById(profile.getId());
            userRepository.deleteById(operator.getId());
            userRepository.deleteById(admin.getId());
            assertThat(profileActive).isTrue();
            assertThat(userEnabled).isTrue();
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
