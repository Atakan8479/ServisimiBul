package com.servisimibul.backend.demand.comment.service;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandSupportRepository;
import com.servisimibul.backend.demand.DemandSupportStatus;
import com.servisimibul.backend.demand.comment.DemandComment;
import com.servisimibul.backend.demand.comment.DemandCommentRepository;
import com.servisimibul.backend.demand.comment.DemandCommentStatus;
import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.AuthorResponse;
import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.CommentResponse;
import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.CreateRequest;
import com.servisimibul.backend.demand.comment.dto.DemandCommentDtos.PageResponse;
import com.servisimibul.backend.demand.comment.exception.DemandCommentApiException;
import com.servisimibul.backend.discovery.PublicOperatorDiscoveryRepository;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.OperatorProfileRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.operatorapproval.OperatorApprovalPolicy;
import com.servisimibul.backend.ratelimit.InMemoryRateLimiter;
import com.servisimibul.backend.ratelimit.RateLimitRule;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DemandCommentService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final int MIN_BODY_LENGTH = 2;
    private static final int MAX_BODY_LENGTH = 1_000;
    private static final Duration DUPLICATE_WINDOW = Duration.ofMinutes(10);
    private static final Sort NEWEST_FIRST = Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.desc("id")
    );

    private final DemandCommentRepository commentRepository;
    private final DemandRepository demandRepository;
    private final DemandSupportRepository supportRepository;
    private final AppUserRepository userRepository;
    private final OperatorProfileRepository operatorProfileRepository;
    private final PublicOperatorDiscoveryRepository discoveryRepository;
    private final OperatorApprovalPolicy approvalPolicy;
    private final InMemoryRateLimiter rateLimiter;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<CommentResponse> list(UUID demandId, int page, int size) {
        validatePage(page, size);
        Demand demand = demand(demandId);
        Page<DemandComment> comments = commentRepository.findByDemandIdAndStatus(
                demandId,
                DemandCommentStatus.PUBLISHED,
                PageRequest.of(page, size, NEWEST_FIRST)
        );
        Map<UUID, OperatorProfile> publicOperators = publicOperators(demand, comments.getContent());
        return new PageResponse<>(
                comments.getContent().stream()
                        .map(comment -> response(comment, publicOperators))
                        .toList(),
                comments.getNumber(),
                comments.getSize(),
                comments.getTotalElements(),
                comments.getTotalPages()
        );
    }

    @Transactional
    public CommentResponse create(UUID demandId, CreateRequest request, UUID authorId) {
        String body = normalizeBody(request.body());
        Demand demand = demand(demandId);
        if (!demand.isOpen()) {
            throw DemandCommentApiException.conflict(
                    "demand_not_open",
                    "Comments can only be added to an open demand"
            );
        }
        AppUser author = eligibleAuthor(demandId, authorId);
        rateLimiter.requireAllowance(RateLimitRule.COMMENT_ACCOUNT, authorId.toString());
        OffsetDateTime cutoff = OffsetDateTime.ofInstant(
                clock.instant().minus(DUPLICATE_WINDOW),
                ZoneOffset.UTC
        );
        if (commentRepository.existsByDemandIdAndAuthorIdAndBodyAndCreatedAtAfter(
                demandId,
                authorId,
                body,
                cutoff
        )) {
            throw DemandCommentApiException.conflict(
                    "duplicate_comment",
                    "The same comment was already posted recently"
            );
        }

        DemandComment comment = commentRepository.saveAndFlush(new DemandComment(demand, author, body));
        return response(comment, publicOperators(demand, List.of(comment)));
    }

    @Transactional
    public void delete(UUID demandId, UUID commentId, UUID authorId) {
        DemandComment comment = commentRepository.findByIdAndDemandId(commentId, demandId)
                .orElseThrow(() -> DemandCommentApiException.notFound(
                        "comment_not_found",
                        "Comment was not found"
                ));
        if (!comment.getAuthor().getId().equals(authorId)) {
            throw DemandCommentApiException.notFound(
                    "comment_not_found",
                    "Comment was not found"
            );
        }
        commentRepository.delete(comment);
    }

    private Demand demand(UUID demandId) {
        return demandRepository.findById(demandId)
                .orElseThrow(() -> DemandCommentApiException.notFound(
                        "demand_not_found",
                        "Demand was not found"
                ));
    }

    private AppUser eligibleAuthor(UUID demandId, UUID authorId) {
        AppUser author = userRepository.findById(authorId)
                .orElseThrow(() -> DemandCommentApiException.notFound(
                        "comment_author_not_found",
                        "Comment author was not found"
                ));
        if (!author.isEnabled() || !author.isEmailVerified()) {
            throw DemandCommentApiException.forbidden(
                    "comment_author_ineligible",
                    "An enabled, verified account is required to comment"
            );
        }
        if (author.getRole() == UserRole.PARENT) {
            if (!supportRepository.existsByDemandIdAndParentIdAndStatus(
                    demandId,
                    authorId,
                    DemandSupportStatus.ACTIVE
            )) {
                throw DemandCommentApiException.forbidden(
                        "active_support_required",
                        "Active support for this demand is required to comment"
                );
            }
            return author;
        }
        if (author.getRole() == UserRole.OPERATOR) {
            OperatorProfile profile = operatorProfileRepository.findByUserId(authorId)
                    .orElseThrow(() -> DemandCommentApiException.forbidden(
                            "operator_profile_required",
                            "An active operator profile is required to comment"
                    ));
            if (!profile.isActive()) {
                throw DemandCommentApiException.forbidden(
                        "operator_suspended",
                        "A suspended operator cannot comment"
                );
            }
            if (!approvalPolicy.allowsPublicDiscovery(profile.getApprovalStatus())) {
                throw DemandCommentApiException.forbidden(
                        "operator_approval_required",
                        "Administrative approval is required to comment"
                );
            }
            return author;
        }
        throw DemandCommentApiException.forbidden(
                "comment_role_forbidden",
                "Only supporting parents and eligible operators can comment"
        );
    }

    private Map<UUID, OperatorProfile> publicOperators(
            Demand demand,
            Collection<DemandComment> comments
    ) {
        List<UUID> operatorUserIds = comments.stream()
                .filter(comment -> comment.getAuthorRole() == UserRole.OPERATOR)
                .map(comment -> comment.getAuthor().getId())
                .distinct()
                .toList();
        if (operatorUserIds.isEmpty()) {
            return Map.of();
        }
        return discoveryRepository.findPublishedOperatorsByUserIds(
                        operatorUserIds,
                        demand.getSchool().getId(),
                        demand.getNeighborhood().getId(),
                        UserRole.OPERATOR,
                        OperatorApprovalStatus.APPROVED,
                        approvalPolicy.isRequired()
                ).stream()
                .collect(Collectors.toMap(profile -> profile.getUser().getId(), Function.identity()));
    }

    private CommentResponse response(
            DemandComment comment,
            Map<UUID, OperatorProfile> publicOperators
    ) {
        AuthorResponse author;
        if (comment.getAuthorRole() == UserRole.PARENT) {
            author = new AuthorResponse(UserRole.PARENT, "Veli", null);
        } else {
            OperatorProfile profile = publicOperators.get(comment.getAuthor().getId());
            String displayName = profile == null || profile.getBusinessName() == null
                    ? "Servis işletmecisi"
                    : profile.getBusinessName();
            author = new AuthorResponse(
                    UserRole.OPERATOR,
                    displayName,
                    profile == null ? null : profile.getId()
            );
        }
        return new CommentResponse(
                comment.getId(),
                comment.getBody(),
                author,
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }

    private String normalizeBody(String value) {
        String body = value == null ? "" : value.strip();
        int length = body.codePointCount(0, body.length());
        if (length < MIN_BODY_LENGTH || length > MAX_BODY_LENGTH) {
            throw DemandCommentApiException.validation(
                    "body",
                    "must contain between 2 and 1000 characters"
            );
        }
        return body;
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw DemandCommentApiException.validation("page", "must be zero or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw DemandCommentApiException.validation("size", "must be between 1 and 50");
        }
    }
}
