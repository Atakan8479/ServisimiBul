package com.servisimibul.backend.operatorapproval;

import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfile;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OperatorApprovalPolicyTests {

    @Test
    void requiredModeEnforcesEveryLifecyclePermission() {
        OperatorApprovalPolicy policy = policy(true);
        OperatorProfile draft = profile(OperatorApprovalStatus.DRAFT);
        OperatorProfile pending = profile(OperatorApprovalStatus.PENDING);
        OperatorProfile changes = profile(OperatorApprovalStatus.CHANGES_REQUESTED);
        OperatorProfile approved = profile(OperatorApprovalStatus.APPROVED);

        assertThatCode(() -> policy.requireProfileEdit(draft)).doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.requireResourceManagement(draft))
                .isInstanceOf(OperatorAccessException.class)
                .extracting("code")
                .isEqualTo("operator_approval_required");
        assertThatThrownBy(() -> policy.requireProfileEdit(pending))
                .isInstanceOf(OperatorAccessException.class)
                .extracting("code")
                .isEqualTo("operator_application_read_only");
        assertThatCode(() -> policy.requireProfileRead(pending)).doesNotThrowAnyException();
        assertThatCode(() -> policy.requireProfileEdit(changes)).doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.requireResourceManagement(changes))
                .isInstanceOf(OperatorAccessException.class);
        assertThatCode(() -> policy.requireProfileEdit(approved)).doesNotThrowAnyException();
        assertThatCode(() -> policy.requireResourceManagement(approved)).doesNotThrowAnyException();
        assertThat(policy.allowsPublicDiscovery(OperatorApprovalStatus.DRAFT)).isFalse();
        assertThat(policy.allowsPublicDiscovery(OperatorApprovalStatus.APPROVED)).isTrue();
    }

    @Test
    void disabledModeBypassesStatusWithoutChangingIt() {
        OperatorApprovalPolicy policy = policy(false);

        for (OperatorApprovalStatus status : OperatorApprovalStatus.values()) {
            OperatorProfile profile = profile(status);
            assertThatCode(() -> policy.requireProfileEdit(profile)).doesNotThrowAnyException();
            assertThatCode(() -> policy.requireResourceManagement(profile)).doesNotThrowAnyException();
            assertThat(policy.allowsPublicDiscovery(status)).isTrue();
            assertThat(profile.getApprovalStatus()).isEqualTo(status);
        }

        assertThatThrownBy(policy::requireWorkflowEnabled)
                .isInstanceOf(OperatorAccessException.class)
                .extracting("status", "code")
                .containsExactly(
                        org.springframework.http.HttpStatus.CONFLICT,
                        "approval_workflow_disabled"
                );
    }

    @Test
    void independentEligibilityAlwaysWins() {
        for (boolean required : new boolean[]{true, false}) {
            OperatorApprovalPolicy policy = policy(required);
            OperatorProfile unverified = new OperatorProfile(
                    AppUser.newOperator("unverified@example.com", "hash"),
                    null,
                    "+905551112233"
            );
            OperatorProfile disabled = profile(OperatorApprovalStatus.APPROVED);
            disabled.getUser().disable();
            OperatorProfile suspended = profile(OperatorApprovalStatus.APPROVED);
            suspended.suspend();

            assertThatThrownBy(() -> policy.requireProfileRead(unverified))
                    .isInstanceOf(OperatorAccessException.class)
                    .extracting("code")
                    .isEqualTo("operator_email_unverified");
            assertThatThrownBy(() -> policy.requireResourceManagement(disabled))
                    .isInstanceOf(OperatorAccessException.class)
                    .extracting("code")
                    .isEqualTo("operator_account_disabled");
            assertThatThrownBy(() -> policy.requireResourceManagement(suspended))
                    .isInstanceOf(OperatorAccessException.class)
                    .extracting("code")
                    .isEqualTo("operator_suspended");
        }
    }

    private OperatorApprovalPolicy policy(boolean required) {
        return new OperatorApprovalPolicy(new OperatorApprovalProperties(required));
    }

    private OperatorProfile profile(OperatorApprovalStatus status) {
        AppUser user = AppUser.newOperator(status.name().toLowerCase() + "@example.com", "hash");
        user.verifyEmail(OffsetDateTime.now());
        OperatorProfile profile = new OperatorProfile(user, null, "+905551112233");
        if (status != OperatorApprovalStatus.DRAFT) {
            profile.submit();
        }
        if (status == OperatorApprovalStatus.CHANGES_REQUESTED) {
            profile.requestChanges();
        } else if (status == OperatorApprovalStatus.APPROVED) {
            profile.approve();
        }
        return profile;
    }
}
