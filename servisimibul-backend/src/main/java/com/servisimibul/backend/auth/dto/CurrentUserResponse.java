package com.servisimibul.backend.auth.dto;

import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.identity.OperatorApprovalStatus;

import java.util.UUID;

public record CurrentUserResponse(
        UUID id,
        String email,
        UserRole role,
        boolean operatorApprovalRequired,
        OperatorApprovalStatus approvalStatus
) {
}
