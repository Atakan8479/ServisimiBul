package com.servisimibul.backend.operatorapplication.service;

import com.servisimibul.backend.auth.exception.AuthValidationException;
import com.servisimibul.backend.auth.service.AuthInputValidator;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.OperatorApplicationReview;
import com.servisimibul.backend.identity.OperatorApplicationReviewRepository;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.ReviewDecision;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ApplicationDetailResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.PageResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ProfilePatchRequest;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ProfileResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.ReviewResponse;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.SuspensionRequest;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.RevisionRequest;
import com.servisimibul.backend.operatorapplication.exception.OperatorApplicationApiException;
import com.servisimibul.backend.operatorapproval.OperatorApprovalPolicy;
import com.servisimibul.backend.security.CurrentUser;
import com.servisimibul.backend.security.SessionRevoker;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class OperatorApplicationService {

    private final CurrentUser currentUser;
    private final AppUserRepository userRepository;
    private final OperatorProfileRepository profileRepository;
    private final OperatorApplicationReviewRepository reviewRepository;
    private final AuthInputValidator inputValidator;
    private final SessionRevoker sessionRevoker;
    private final OperatorApprovalPolicy approvalPolicy;

    @Transactional(readOnly = true)
    public ProfileResponse profile() {
        return toProfileResponse(currentProfile());
    }

    @Transactional
    public ProfileResponse patchProfile(ProfilePatchRequest request) {
        if (!request.hasAnyField()) {
            throw OperatorApplicationApiException.validation(
                    "request",
                    "must contain at least one mutable field"
            );
        }

        OperatorProfile profile = currentProfileForUpdate();
        approvalPolicy.requireProfileEdit(profile);
        String businessName = request.hasBusinessName()
                ? validated(() -> inputValidator.businessName(request.businessName()))
                : profile.getBusinessName();
        String contactPhone = request.hasContactPhone()
                ? validated(() -> inputValidator.phone(request.contactPhone()))
                : profile.getContactPhone();
        String description = request.hasDescription()
                ? normalizeOptionalText(request.description())
                : profile.getDescription();
        boolean publiclyVisible = request.hasPubliclyVisible()
                ? required(request.publiclyVisible(), "publiclyVisible")
                : profile.isPubliclyVisible();

        profile.update(businessName, contactPhone, description, publiclyVisible);
        profileRepository.flush();
        return toProfileResponse(profile);
    }

    @Transactional
    public ProfileResponse submit() {
        approvalPolicy.requireWorkflowEnabled();
        OperatorProfile profile = currentProfileForUpdate();
        requireStatus(
                profile,
                OperatorApprovalStatus.DRAFT,
                "application_not_submittable",
                "Only a draft application can be submitted"
        );
        profile.submit();
        profileRepository.flush();
        return toProfileResponse(profile);
    }

    @Transactional
    public ProfileResponse resubmit() {
        approvalPolicy.requireWorkflowEnabled();
        OperatorProfile profile = currentProfileForUpdate();
        requireStatus(
                profile,
                OperatorApprovalStatus.CHANGES_REQUESTED,
                "application_not_resubmittable",
                "Only an application with requested changes can be resubmitted"
        );
        profile.resubmit();
        profileRepository.flush();
        return toProfileResponse(profile);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProfileResponse> queue(
            OperatorApprovalStatus status,
            int page,
            int size
    ) {
        validatePage(page, size);
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by("createdAt").ascending().and(Sort.by("id").ascending())
        );
        var result = status == null
                ? profileRepository.findAll(pageRequest)
                : profileRepository.findAllByApprovalStatus(status, pageRequest);
        return new PageResponse<>(
                result.getContent().stream().map(this::toProfileResponse).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public ApplicationDetailResponse detail(UUID id) {
        return toDetail(detailedProfile(id));
    }

    @Transactional
    public ApplicationDetailResponse approve(UUID id) {
        approvalPolicy.requireWorkflowEnabled();
        OperatorProfile profile = detailedProfileForUpdate(id);
        AppUser reviewer = reviewerFor(profile);
        requireActive(profile);
        requireStatus(
                profile,
                OperatorApprovalStatus.PENDING,
                "application_not_pending",
                "Only a pending application can be approved"
        );

        profile.approve();
        reviewRepository.saveAndFlush(new OperatorApplicationReview(
                profile,
                reviewer,
                ReviewDecision.APPROVED,
                null
        ));
        profileRepository.flush();
        return toDetail(profile);
    }

    @Transactional
    public ApplicationDetailResponse requestRevision(UUID id, RevisionRequest request) {
        approvalPolicy.requireWorkflowEnabled();
        OperatorProfile profile = detailedProfileForUpdate(id);
        AppUser reviewer = reviewerFor(profile);
        requireActive(profile);
        requireStatus(
                profile,
                OperatorApprovalStatus.PENDING,
                "application_not_pending",
                "Only a pending application can have changes requested"
        );

        String reason = request.reason().strip();
        profile.requestChanges();
        reviewRepository.saveAndFlush(new OperatorApplicationReview(
                profile,
                reviewer,
                ReviewDecision.CHANGES_REQUESTED,
                reason
        ));
        profileRepository.flush();
        return toDetail(profile);
    }

    @Transactional
    public ApplicationDetailResponse suspend(UUID id, SuspensionRequest request) {
        OperatorProfile profile = detailedProfileForUpdate(id);
        AppUser reviewer = reviewerFor(profile);
        if (!profile.isActive()) {
            throw OperatorApplicationApiException.conflict(
                    "operator_already_suspended",
                    "The operator is already suspended"
            );
        }

        profile.suspend();
        profile.getUser().disable();
        reviewRepository.saveAndFlush(new OperatorApplicationReview(
                profile,
                reviewer,
                ReviewDecision.SUSPENDED,
                request.reason().strip()
        ));
        profileRepository.flush();
        userRepository.flush();
        sessionRevoker.revokeAll(profile.getUser().getId());
        return toDetail(profile);
    }

    private OperatorProfile currentProfile() {
        OperatorProfile profile = profileRepository.findByUserId(currentUser.id())
                .orElseThrow(this::profileNotFound);
        approvalPolicy.requireProfileRead(profile);
        return profile;
    }

    private OperatorProfile currentProfileForUpdate() {
        OperatorProfile profile = profileRepository.findByUserIdForUpdate(currentUser.id())
                .orElseThrow(this::profileNotFound);
        approvalPolicy.requireProfileRead(profile);
        return profile;
    }

    private OperatorProfile detailedProfile(UUID id) {
        return profileRepository.findDetailedById(id)
                .orElseThrow(this::applicationNotFound);
    }

    private OperatorProfile detailedProfileForUpdate(UUID id) {
        return profileRepository.findDetailedByIdForUpdate(id)
                .orElseThrow(this::applicationNotFound);
    }

    private AppUser reviewerFor(OperatorProfile profile) {
        UUID reviewerId = currentUser.id();
        if (reviewerId.equals(profile.getUser().getId())) {
            throw OperatorApplicationApiException.forbidden(
                    "self_review_forbidden",
                    "Operators cannot review their own application"
            );
        }
        return userRepository.findById(reviewerId)
                .filter(user -> user.getRole() == UserRole.ADMIN && user.isEnabled())
                .orElseThrow(() -> OperatorApplicationApiException.forbidden(
                        "admin_identity_required",
                        "An active admin identity is required"
                ));
    }

    private void requireActive(OperatorProfile profile) {
        if (!profile.isActive() || !profile.getUser().isEnabled()) {
            throw OperatorApplicationApiException.forbidden(
                    "operator_suspended",
                    "The operator account is suspended"
            );
        }
    }

    private void requireStatus(
            OperatorProfile profile,
            OperatorApprovalStatus expected,
            String code,
            String detail
    ) {
        if (profile.getApprovalStatus() != expected) {
            throw OperatorApplicationApiException.conflict(code, detail);
        }
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw OperatorApplicationApiException.validation("page", "must be zero or greater");
        }
        if (size < 1 || size > 50) {
            throw OperatorApplicationApiException.validation("size", "must be between 1 and 50");
        }
    }

    private <T> T required(T value, String field) {
        if (value == null) {
            throw OperatorApplicationApiException.validation(field, "must not be null");
        }
        return value;
    }

    private String validated(Supplier<String> validation) {
        try {
            return validation.get();
        } catch (AuthValidationException exception) {
            throw OperatorApplicationApiException.validation(exception.field(), exception.getMessage());
        }
    }

    private String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.strip();
    }

    private ApplicationDetailResponse toDetail(OperatorProfile profile) {
        return new ApplicationDetailResponse(
                toProfileResponse(profile),
                reviewRepository.findAllByOperatorIdOrderByReviewedAtAscIdAsc(profile.getId())
                        .stream()
                        .map(this::toReviewResponse)
                        .toList()
        );
    }

    private ProfileResponse toProfileResponse(OperatorProfile profile) {
        return new ProfileResponse(
                profile.getId(),
                profile.getBusinessName(),
                profile.getContactPhone(),
                profile.getDescription(),
                profile.getApprovalStatus(),
                profile.isActive(),
                profile.isPubliclyVisible(),
                profile.getCreatedAt(),
                profile.getUpdatedAt()
        );
    }

    private ReviewResponse toReviewResponse(OperatorApplicationReview review) {
        return new ReviewResponse(
                review.getId(),
                review.getReviewedById(),
                review.getDecision(),
                review.getReason(),
                review.getReviewedAt()
        );
    }

    private OperatorApplicationApiException profileNotFound() {
        return OperatorApplicationApiException.notFound(
                "operator_profile_not_found",
                "Operator profile was not found"
        );
    }

    private OperatorApplicationApiException applicationNotFound() {
        return OperatorApplicationApiException.notFound(
                "operator_application_not_found",
                "Operator application was not found"
        );
    }
}
