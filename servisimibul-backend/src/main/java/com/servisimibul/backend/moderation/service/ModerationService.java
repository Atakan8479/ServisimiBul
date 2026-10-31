package com.servisimibul.backend.moderation.service;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.demand.DemandClosureReason;
import com.servisimibul.backend.demand.DemandLifecycleEvent;
import com.servisimibul.backend.demand.DemandLifecycleEventRepository;
import com.servisimibul.backend.demand.DemandLifecycleEventType;
import com.servisimibul.backend.demand.DemandRepository;
import com.servisimibul.backend.demand.DemandServiceResponse;
import com.servisimibul.backend.demand.DemandServiceResponseRepository;
import com.servisimibul.backend.demand.comment.DemandComment;
import com.servisimibul.backend.demand.comment.DemandCommentRepository;
import com.servisimibul.backend.demand.comment.DemandCommentStatus;
import com.servisimibul.backend.demand.service.DemandFeedbackService;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.UserRole;
import com.servisimibul.backend.moderation.ContentReport;
import com.servisimibul.backend.moderation.ContentReportRepository;
import com.servisimibul.backend.moderation.ModerationAction;
import com.servisimibul.backend.moderation.ModerationAuditEvent;
import com.servisimibul.backend.moderation.ModerationAuditEventRepository;
import com.servisimibul.backend.moderation.ModerationCase;
import com.servisimibul.backend.moderation.ModerationCaseRepository;
import com.servisimibul.backend.moderation.ModerationCaseStatus;
import com.servisimibul.backend.moderation.ModerationTargetType;
import com.servisimibul.backend.moderation.ReportReason;
import com.servisimibul.backend.moderation.dto.ModerationDtos.AuditDetail;
import com.servisimibul.backend.moderation.dto.ModerationDtos.CaseDetail;
import com.servisimibul.backend.moderation.dto.ModerationDtos.CaseSummary;
import com.servisimibul.backend.moderation.dto.ModerationDtos.CreateReportRequest;
import com.servisimibul.backend.moderation.dto.ModerationDtos.ModerationActionRequest;
import com.servisimibul.backend.moderation.dto.ModerationDtos.PageResponse;
import com.servisimibul.backend.moderation.dto.ModerationDtos.ReportDetail;
import com.servisimibul.backend.moderation.dto.ModerationDtos.ReportReceipt;
import com.servisimibul.backend.moderation.dto.ModerationDtos.TargetContext;
import com.servisimibul.backend.moderation.exception.ModerationApiException;
import com.servisimibul.backend.ratelimit.InMemoryRateLimiter;
import com.servisimibul.backend.ratelimit.RateLimitRule;
import com.servisimibul.backend.operatorapplication.dto.OperatorApplicationDtos.SuspensionRequest;
import com.servisimibul.backend.operatorapplication.service.OperatorApplicationService;
import com.servisimibul.backend.notification.NotificationDeliveryService;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ModerationService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_EXPLANATION_LENGTH = 500;
    private static final Collection<ModerationCaseStatus> ACTIVE_STATUSES = List.of(
            ModerationCaseStatus.OPEN,
            ModerationCaseStatus.IN_REVIEW
    );
    private static final Sort QUEUE_ORDER = Sort.by(
            Sort.Order.desc("updatedAt"),
            Sort.Order.desc("id")
    );

    private final ModerationCaseRepository caseRepository;
    private final ContentReportRepository reportRepository;
    private final ModerationAuditEventRepository auditRepository;
    private final AppUserRepository userRepository;
    private final DemandRepository demandRepository;
    private final DemandCommentRepository commentRepository;
    private final DemandServiceResponseRepository responseRepository;
    private final DemandLifecycleEventRepository lifecycleEventRepository;
    private final DemandFeedbackService feedbackService;
    private final OperatorApplicationService operatorApplicationService;
    private final NotificationDeliveryService notificationDelivery;
    private final InMemoryRateLimiter rateLimiter;
    private final Clock clock;

    @Transactional
    public ReportReceipt report(CreateReportRequest request, UUID reporterId) {
        AppUser reporter = eligibleReporter(reporterId);
        LockedTarget target = lockReportableTarget(request.targetType(), request.targetId());
        ModerationCase moderationCase = caseRepository
                .findByTargetTypeAndTargetIdAndStatusIn(
                        request.targetType(),
                        request.targetId(),
                        ACTIVE_STATUSES
                )
                .orElseGet(() -> caseRepository.saveAndFlush(target.newCase()));

        if (reportRepository.existsByModerationCaseIdAndReporterId(
                moderationCase.getId(),
                reporterId
        )) {
            throw ModerationApiException.conflict(
                    "report_already_open",
                    "You already have an active report for this content"
            );
        }

        rateLimiter.requireAllowance(RateLimitRule.REPORT_ACCOUNT, reporterId.toString());
        ContentReport report = reportRepository.saveAndFlush(new ContentReport(
                moderationCase,
                reporter,
                request.reason(),
                normalizeOptional(request.explanation(), "explanation")
        ));
        notificationDelivery.contentReported(report);
        return new ReportReceipt(
                report.getId(),
                moderationCase.getId(),
                moderationCase.getTargetType(),
                moderationCase.getTargetId(),
                report.getReason(),
                moderationCase.getStatus(),
                report.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<CaseSummary> queue(
            ModerationCaseStatus status,
            ModerationTargetType targetType,
            ReportReason reason,
            OffsetDateTime reportedFrom,
            OffsetDateTime reportedTo,
            int page,
            int size,
            UUID administratorId
    ) {
        requireAdministrator(administratorId);
        validatePage(page, size);
        if (reportedFrom != null && reportedTo != null && !reportedFrom.isBefore(reportedTo)) {
            throw ModerationApiException.validation(
                    "reportedTo",
                    "must be later than reportedFrom"
            );
        }
        Page<ModerationCase> cases = caseRepository.findAll(
                queueSpecification(status, targetType, reason, reportedFrom, reportedTo),
                PageRequest.of(page, size, QUEUE_ORDER)
        );
        return new PageResponse<>(
                cases.getContent().stream().map(this::summary).toList(),
                cases.getNumber(),
                cases.getSize(),
                cases.getTotalElements(),
                cases.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public CaseDetail detail(UUID caseId, UUID administratorId) {
        requireAdministrator(administratorId);
        return detail(caseById(caseId));
    }

    @Transactional
    public CaseDetail act(
            UUID caseId,
            ModerationActionRequest request,
            UUID administratorId
    ) {
        AppUser administrator = requireAdministrator(administratorId);
        ModerationCase moderationCase = caseRepository.findForUpdateById(caseId)
                .orElseThrow(this::caseNotFound);
        String reason = normalizeRequired(request.reason(), "reason");
        OffsetDateTime now = now();

        switch (request.action()) {
            case MARK_IN_REVIEW -> moderationCase.markInReview(administrator, reason);
            case DISMISS -> moderationCase.dismiss(administrator, reason, now);
            case RESOLVE_NO_ACTION -> {
                requireActive(moderationCase);
                moderationCase.resolve(administrator, reason, now);
            }
            case HIDE_COMMENT -> {
                requireActive(moderationCase);
                requireTargetType(moderationCase, ModerationTargetType.COMMENT);
                DemandComment comment = commentForAction(moderationCase);
                if (comment.getStatus() == DemandCommentStatus.HIDDEN) {
                    throw ModerationApiException.conflict(
                            "comment_already_hidden",
                            "The comment is already hidden"
                    );
                }
                comment.hide();
                moderationCase.resolve(administrator, reason, now);
            }
            case RESTORE_COMMENT -> {
                requireTargetType(moderationCase, ModerationTargetType.COMMENT);
                DemandComment comment = commentForAction(moderationCase);
                if (comment.getStatus() == DemandCommentStatus.PUBLISHED) {
                    throw ModerationApiException.conflict(
                            "comment_already_visible",
                            "The comment is already visible"
                    );
                }
                comment.restore();
                moderationCase.resolve(administrator, reason, now);
            }
            case WITHDRAW_SERVICE_RESPONSE -> {
                requireActive(moderationCase);
                requireTargetType(moderationCase, ModerationTargetType.SERVICE_RESPONSE);
                DemandServiceResponse response = responseRepository
                        .findForUpdateById(moderationCase.getTargetId())
                        .orElseThrow(() -> targetNotFound("service response"));
                if (!response.isActive()) {
                    throw ModerationApiException.conflict(
                            "service_response_already_withdrawn",
                            "The service response is already withdrawn"
                    );
                }
                response.withdraw(now);
                feedbackService.responseWithdrawn(response);
                moderationCase.resolve(administrator, reason, now);
            }
            case SUSPEND_OPERATOR -> {
                requireActive(moderationCase);
                requireTargetType(moderationCase, ModerationTargetType.SERVICE_RESPONSE);
                DemandServiceResponse response = responseRepository
                        .findForUpdateById(moderationCase.getTargetId())
                        .orElseThrow(() -> targetNotFound("service response"));
                operatorApplicationService.suspend(
                        response.getOperator().getId(),
                        new SuspensionRequest(reason)
                );
                moderationCase.resolve(administrator, reason, now);
            }
            case CLOSE_DEMAND -> {
                requireActive(moderationCase);
                requireTargetType(moderationCase, ModerationTargetType.DEMAND);
                Demand demand = demandRepository.findForUpdateById(moderationCase.getTargetId())
                        .orElseThrow(() -> targetNotFound("demand"));
                if (!demand.isOpen()) {
                    throw ModerationApiException.conflict(
                            "demand_already_closed",
                            "The demand is already closed"
                    );
                }
                demand.close(DemandClosureReason.ADMIN, now);
                lifecycleEventRepository.save(new DemandLifecycleEvent(
                        demand,
                        DemandLifecycleEventType.CLOSED_ADMIN,
                        now
                ));
                feedbackService.demandClosedByAdmin(demand);
                moderationCase.resolve(administrator, reason, now);
            }
        }

        auditRepository.save(new ModerationAuditEvent(
                moderationCase,
                administrator,
                request.action(),
                reason,
                now
        ));
        caseRepository.flush();
        auditRepository.flush();
        return detail(moderationCase);
    }

    private LockedTarget lockReportableTarget(ModerationTargetType targetType, UUID targetId) {
        Objects.requireNonNull(targetType);
        Objects.requireNonNull(targetId);
        return switch (targetType) {
            case COMMENT -> {
                DemandComment comment = commentRepository.findForUpdateById(targetId)
                        .filter(value -> value.getStatus() == DemandCommentStatus.PUBLISHED)
                        .orElseThrow(() -> targetNotFound("comment"));
                yield new LockedTarget(
                        targetType,
                        comment,
                        null,
                        null,
                        "Comment on " + comment.getDemand().getSchool().getName(),
                        comment.getBody()
                );
            }
            case DEMAND -> {
                Demand demand = demandRepository.findForUpdateById(targetId)
                        .filter(Demand::isOpen)
                        .orElseThrow(() -> targetNotFound("demand"));
                String title = demand.getSchool().getName() + " transport demand";
                String snapshot = demand.getNeighborhood().getName()
                        + " · " + demand.getAcademicYear();
                yield new LockedTarget(targetType, null, demand, null, title, snapshot);
            }
            case SERVICE_RESPONSE -> {
                DemandServiceResponse response = responseRepository.findForUpdateById(targetId)
                        .filter(DemandServiceResponse::isActive)
                        .filter(value -> value.getDemand().isOpen())
                        .orElseThrow(() -> targetNotFound("service response"));
                String businessName = response.getOperator().getBusinessName() == null
                        ? "Service operator"
                        : response.getOperator().getBusinessName();
                String snapshot = directionSummary(
                        response.isOffersMorning(),
                        response.isOffersAfternoon()
                );
                yield new LockedTarget(
                        targetType,
                        null,
                        null,
                        response,
                        businessName + " service declaration",
                        snapshot
                );
            }
        };
    }

    private AppUser eligibleReporter(UUID reporterId) {
        AppUser reporter = userRepository.findById(reporterId)
                .orElseThrow(() -> ModerationApiException.forbidden(
                        "reporter_ineligible",
                        "An eligible account is required to report content"
                ));
        if (!reporter.isEnabled()
                || (reporter.getRole() != UserRole.PARENT
                    && reporter.getRole() != UserRole.OPERATOR)) {
            throw ModerationApiException.forbidden(
                    "reporter_ineligible",
                    "An eligible parent or operator account is required to report content"
            );
        }
        return reporter;
    }

    private AppUser requireAdministrator(UUID administratorId) {
        AppUser administrator = userRepository.findById(administratorId)
                .orElseThrow(() -> ModerationApiException.forbidden(
                        "administrator_required",
                        "Administrator access is required"
                ));
        if (!administrator.isEnabled() || administrator.getRole() != UserRole.ADMIN) {
            throw ModerationApiException.forbidden(
                    "administrator_required",
                    "Administrator access is required"
            );
        }
        return administrator;
    }

    private CaseSummary summary(ModerationCase moderationCase) {
        List<ContentReport> reports = reportRepository
                .findByModerationCaseIdOrderByCreatedAtDescIdDesc(moderationCase.getId());
        Map<ReportReason, Long> reasonCounts = new EnumMap<>(ReportReason.class);
        reports.forEach(report -> reasonCounts.merge(report.getReason(), 1L, Long::sum));
        return new CaseSummary(
                moderationCase.getId(),
                moderationCase.getTargetType(),
                moderationCase.getTargetId(),
                moderationCase.getStatus(),
                targetContext(moderationCase),
                reports.size(),
                Map.copyOf(reasonCounts),
                moderationCase.getCreatedAt(),
                moderationCase.getUpdatedAt(),
                moderationCase.getResolvedAt()
        );
    }

    private CaseDetail detail(ModerationCase moderationCase) {
        List<ContentReport> reports = reportRepository
                .findByModerationCaseIdOrderByCreatedAtDescIdDesc(moderationCase.getId());
        List<ModerationAuditEvent> audit = auditRepository
                .findByModerationCaseIdOrderByCreatedAtDescIdDesc(moderationCase.getId());
        return new CaseDetail(
                summary(moderationCase),
                moderationCase.getModeratedBy() == null
                        ? null
                        : moderationCase.getModeratedBy().getId(),
                moderationCase.getDecisionReason(),
                reports.stream()
                        .map(report -> new ReportDetail(
                                report.getId(),
                                report.getReason(),
                                report.getExplanation(),
                                report.getCreatedAt()
                        ))
                        .toList(),
                audit.stream()
                        .map(event -> new AuditDetail(
                                event.getId(),
                                event.getModerator().getId(),
                                event.getAction(),
                                event.getReason(),
                                event.getCreatedAt()
                        ))
                        .toList()
        );
    }

    private TargetContext targetContext(ModerationCase moderationCase) {
        boolean visible = switch (moderationCase.getTargetType()) {
            case COMMENT -> moderationCase.getComment() != null
                    && moderationCase.getComment().getStatus() == DemandCommentStatus.PUBLISHED;
            case DEMAND -> moderationCase.getDemand() != null
                    && moderationCase.getDemand().isOpen();
            case SERVICE_RESPONSE -> moderationCase.getServiceResponse() != null
                    && moderationCase.getServiceResponse().isActive()
                    && moderationCase.getServiceResponse().getDemand().isOpen();
        };
        UUID operatorProfileId = moderationCase.getServiceResponse() == null
                ? null
                : moderationCase.getServiceResponse().getOperator().getId();
        return new TargetContext(
                moderationCase.getTargetTitle(),
                moderationCase.getTargetSnapshot(),
                visible,
                operatorProfileId
        );
    }

    private DemandComment commentForAction(ModerationCase moderationCase) {
        if (moderationCase.getComment() == null) {
            throw targetNotFound("comment");
        }
        return commentRepository.findForUpdateById(moderationCase.getTargetId())
                .orElseThrow(() -> targetNotFound("comment"));
    }

    private ModerationCase caseById(UUID caseId) {
        return caseRepository.findById(caseId).orElseThrow(this::caseNotFound);
    }

    private void requireActive(ModerationCase moderationCase) {
        if (!moderationCase.isActive()) {
            throw ModerationApiException.conflict(
                    "moderation_case_closed",
                    "The moderation case is already closed"
            );
        }
    }

    private void requireTargetType(
            ModerationCase moderationCase,
            ModerationTargetType expected
    ) {
        if (moderationCase.getTargetType() != expected) {
            throw ModerationApiException.conflict(
                    "moderation_action_not_supported",
                    "The moderation action is not supported for this target"
            );
        }
    }

    private String normalizeOptional(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return normalize(value, field);
    }

    private String normalizeRequired(String value, String field) {
        if (value == null || value.isBlank()) {
            throw ModerationApiException.validation(field, "must contain between 2 and 500 characters");
        }
        return normalize(value, field);
    }

    private String normalize(String value, String field) {
        String normalized = value.strip();
        int length = normalized.codePointCount(0, normalized.length());
        if (length < 2 || length > MAX_EXPLANATION_LENGTH) {
            throw ModerationApiException.validation(field, "must contain between 2 and 500 characters");
        }
        return normalized;
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw ModerationApiException.validation("page", "must be zero or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw ModerationApiException.validation("size", "must be between 1 and 50");
        }
    }

    private Specification<ModerationCase> queueSpecification(
            ModerationCaseStatus status,
            ModerationTargetType targetType,
            ReportReason reason,
            OffsetDateTime reportedFrom,
            OffsetDateTime reportedTo
    ) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new java.util.ArrayList<>();
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (targetType != null) {
                predicates.add(builder.equal(root.get("targetType"), targetType));
            }
            if (reportedFrom != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("createdAt"), reportedFrom));
            }
            if (reportedTo != null) {
                predicates.add(builder.lessThan(root.get("createdAt"), reportedTo));
            }
            if (reason != null) {
                Subquery<UUID> reportExists = query.subquery(UUID.class);
                Root<ContentReport> report = reportExists.from(ContentReport.class);
                reportExists.select(report.get("id")).where(
                        builder.equal(report.get("moderationCase"), root),
                        builder.equal(report.get("reason"), reason)
                );
                predicates.add(builder.exists(reportExists));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private String directionSummary(boolean morning, boolean afternoon) {
        if (morning && afternoon) {
            return "Morning and afternoon service declared";
        }
        return morning ? "Morning service declared" : "Afternoon service declared";
    }

    private ModerationApiException caseNotFound() {
        return ModerationApiException.notFound(
                "moderation_case_not_found",
                "Moderation case was not found"
        );
    }

    private ModerationApiException targetNotFound(String target) {
        return ModerationApiException.notFound(
                "report_target_not_found",
                "Reportable content was not found"
        );
    }

    private record LockedTarget(
            ModerationTargetType type,
            DemandComment comment,
            Demand demand,
            DemandServiceResponse response,
            String title,
            String snapshot
    ) {

        ModerationCase newCase() {
            return switch (type) {
                case COMMENT -> ModerationCase.forComment(comment, title, snapshot);
                case DEMAND -> ModerationCase.forDemand(demand, title, snapshot);
                case SERVICE_RESPONSE -> ModerationCase.forServiceResponse(response, title, snapshot);
            };
        }
    }
}
