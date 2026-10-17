package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.dto.CurrentUserResponse;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorapproval.OperatorApprovalPolicy;
import com.servisimibul.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CurrentUserResponseFactory {

    private final OperatorApprovalPolicy approvalPolicy;
    private final OperatorProfileRepository profileRepository;

    public CurrentUserResponse create(AuthenticatedUser user) {
        OperatorApprovalStatus approvalStatus = user.role() == UserRole.OPERATOR
                ? profileRepository.findByUserId(user.id())
                        .map(profile -> profile.getApprovalStatus())
                        .orElse(null)
                : null;
        return new CurrentUserResponse(
                user.id(),
                user.getUsername(),
                user.role(),
                approvalPolicy.isRequired(),
                approvalStatus
        );
    }
}
