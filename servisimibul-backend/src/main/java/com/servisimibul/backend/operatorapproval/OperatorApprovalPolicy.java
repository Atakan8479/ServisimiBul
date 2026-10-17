package com.servisimibul.backend.operatorapproval;

import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OperatorApprovalPolicy {

    private final OperatorApprovalProperties properties;

    public boolean isRequired() {
        return properties.required();
    }

    public void requireWorkflowEnabled() {
        if (!isRequired()) {
            throw OperatorAccessException.conflict(
                    "approval_workflow_disabled",
                    "Operator approval workflow is disabled"
            );
        }
    }

    public void requireProfileRead(OperatorProfile profile) {
        requireIndependentEligibility(profile);
    }

    public void requireProfileEdit(OperatorProfile profile) {
        requireIndependentEligibility(profile);
        if (isRequired() && profile.getApprovalStatus() == OperatorApprovalStatus.PENDING) {
            throw OperatorAccessException.forbidden(
                    "operator_application_read_only",
                    "A pending operator application is read-only"
            );
        }
    }

    public void requireResourceManagement(OperatorProfile profile) {
        requireIndependentEligibility(profile);
        if (isRequired() && profile.getApprovalStatus() != OperatorApprovalStatus.APPROVED) {
            throw OperatorAccessException.forbidden(
                    "operator_approval_required",
                    "Administrative approval is required for operator resource management"
            );
        }
    }

    public boolean allowsPublicDiscovery(OperatorApprovalStatus status) {
        return !isRequired() || status == OperatorApprovalStatus.APPROVED;
    }

    private void requireIndependentEligibility(OperatorProfile profile) {
        if (!profile.getUser().isEmailVerified()) {
            throw OperatorAccessException.forbidden(
                    "operator_email_unverified",
                    "A verified email address is required"
            );
        }
        if (!profile.getUser().isEnabled()) {
            throw OperatorAccessException.forbidden(
                    "operator_account_disabled",
                    "The operator account is disabled"
            );
        }
        if (!profile.isActive()) {
            throw OperatorAccessException.forbidden(
                    "operator_suspended",
                    "The operator account is suspended"
            );
        }
    }
}
