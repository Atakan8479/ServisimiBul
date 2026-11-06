package com.servisimibul.backend.datarights;

import com.servisimibul.backend.datarights.DataRightsDtos.ActionRequest;
import com.servisimibul.backend.datarights.DataRightsDtos.EventView;
import com.servisimibul.backend.datarights.DataRightsDtos.HandlerDetail;
import com.servisimibul.backend.datarights.DataRightsDtos.HandlerSummary;
import com.servisimibul.backend.datarights.DataRightsDtos.PageResponse;
import com.servisimibul.backend.datarights.DataRightsDtos.RequesterView;
import com.servisimibul.backend.datarights.DataRightsDtos.SubmitRequest;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.AppUserRepository;
import com.servisimibul.backend.identity.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Tracks data-subject requests. Deliberately logs nothing: request text and notes are
 * personal data and must not reach application logs.
 */
@Service
@RequiredArgsConstructor
public class DataRightsService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final Sort QUEUE_ORDER = Sort.by("responseDueAt").ascending().and(Sort.by("id"));
    /** An 11-digit number starting 1-9 has the shape of a T.C. identity number; never collect one here. */
    private static final Pattern NATIONAL_ID_SHAPE = Pattern.compile("(?<!\\d)[1-9]\\d{10}(?!\\d)");
    private static final Set<DataRightsAction> NOTE_ACTIONS = Set.of(
            DataRightsAction.REQUEST_VERIFICATION,
            DataRightsAction.RESPOND,
            DataRightsAction.RESPOND_PARTIALLY,
            DataRightsAction.REJECT
    );
    private static final Set<DataRightsAction> NOTE_REQUIRED = Set.of(
            DataRightsAction.REQUEST_VERIFICATION,
            DataRightsAction.RESPOND_PARTIALLY,
            DataRightsAction.REJECT
    );

    private final DataRightsProperties properties;
    private final DataRightsRequestRepository requestRepository;
    private final DataRightsRequestEventRepository eventRepository;
    private final AppUserRepository userRepository;
    private final Clock clock;

    @Transactional
    public RequesterView submit(SubmitRequest submission, UUID requesterId) {
        requireEnabled();
        AppUser requester = eligibleRequester(requesterId);
        String details = submission.details().strip();
        if (NATIONAL_ID_SHAPE.matcher(details).find()) {
            throw DataRightsApiException.validation("details", "must not contain an identity number");
        }
        if (requestRepository.existsByRequesterIdAndTypeAndStatusIn(
                requesterId, submission.type(), DataRightsRequestStatus.OPEN)) {
            throw duplicate();
        }
        OffsetDateTime now = now();
        DataRightsRequest request = new DataRightsRequest(requester, submission.type(), details, now);
        try {
            requestRepository.saveAndFlush(request);
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            throw duplicate();
        }
        eventRepository.save(new DataRightsRequestEvent(request, requester, DataRightsAction.RECEIVE, null, now));
        return requesterView(request);
    }

    @Transactional(readOnly = true)
    public List<RequesterView> ownRequests(UUID requesterId) {
        requireEnabled();
        eligibleRequester(requesterId);
        return requestRepository.findTop50ByRequesterIdOrderByReceivedAtDescIdDesc(requesterId).stream()
                .map(DataRightsService::requesterView)
                .toList();
    }

    @Transactional(readOnly = true)
    public RequesterView ownRequest(UUID requestId, UUID requesterId) {
        requireEnabled();
        eligibleRequester(requesterId);
        return requestRepository.findByIdAndRequesterId(requestId, requesterId)
                .map(DataRightsService::requesterView)
                .orElseThrow(DataRightsApiException::notFound);
    }

    @Transactional(readOnly = true)
    public PageResponse<HandlerSummary> queue(
            DataRightsRequestStatus status,
            Boolean overdue,
            int page,
            int size,
            UUID handlerId
    ) {
        requireEnabled();
        requireHandler(handlerId);
        if (page < 0) {
            throw DataRightsApiException.validation("page", "must be zero or greater");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw DataRightsApiException.validation("size", "must be between 1 and " + MAX_PAGE_SIZE);
        }
        OffsetDateTime now = now();
        Page<DataRightsRequest> requests = requestRepository.findAll(
                queueSpecification(status, overdue, now),
                PageRequest.of(page, size, QUEUE_ORDER)
        );
        return new PageResponse<>(
                requests.getContent().stream().map(request -> summary(request, now)).toList(),
                requests.getNumber(),
                requests.getSize(),
                requests.getTotalElements(),
                requests.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public HandlerDetail detail(UUID requestId, UUID handlerId) {
        requireEnabled();
        requireHandler(handlerId);
        return handlerDetail(requestRepository.findById(requestId).orElseThrow(DataRightsApiException::notFound));
    }

    @Transactional
    public HandlerDetail act(UUID requestId, ActionRequest action, UUID handlerId) {
        requireEnabled();
        AppUser handler = requireHandler(handlerId);
        String note = normalizedNote(action);
        if (action.action() == DataRightsAction.RECEIVE) {
            throw DataRightsApiException.validation("action", "is not a handling action");
        }
        DataRightsRequest request = requestRepository.findForUpdateById(requestId)
                .orElseThrow(DataRightsApiException::notFound);
        if (request.getVersion() != action.expectedVersion()) {
            throw DataRightsApiException.conflict(
                    "stale_request_version",
                    "Request changed since it was loaded; reload and retry"
            );
        }
        if (action.action() != DataRightsAction.ASSIGN && !request.isAssignedTo(handlerId)) {
            throw DataRightsApiException.forbidden(
                    "handler_not_assigned",
                    "Only the assigned handler may change this request"
            );
        }
        DataRightsRequestStatus fromStatus = request.getStatus();
        OffsetDateTime now = now();
        try {
            switch (action.action()) {
                case ASSIGN -> request.assign(assignee(action.assigneeId()), now);
                case START_REVIEW -> request.startReview(now);
                case REQUEST_VERIFICATION -> request.requestVerification(note, now);
                case RECORD_IDENTITY_VERIFIED -> request.recordIdentityVerified(handler, now);
                case RESPOND -> request.respond(note, now);
                case RESPOND_PARTIALLY -> request.respondPartially(note, now);
                case REJECT -> request.reject(note, now);
                case RECORD_DELIVERY -> request.recordDelivery(now);
                case RECEIVE -> throw new IllegalStateException("unreachable");
            }
        } catch (DataRightsRequest.InvalidTransitionException invalid) {
            throw DataRightsApiException.conflict("invalid_transition", invalid.getMessage());
        }
        requestRepository.saveAndFlush(request);
        eventRepository.save(new DataRightsRequestEvent(request, handler, action.action(), fromStatus, now));
        return handlerDetail(request);
    }

    private String normalizedNote(ActionRequest action) {
        String note = action.note() == null || action.note().isBlank() ? null : action.note().strip();
        if (note != null && !NOTE_ACTIONS.contains(action.action())) {
            throw DataRightsApiException.validation("note", "is not accepted for this action");
        }
        if (note == null && NOTE_REQUIRED.contains(action.action())) {
            throw DataRightsApiException.validation("note", "is required for this action");
        }
        if (note != null && NATIONAL_ID_SHAPE.matcher(note).find()) {
            throw DataRightsApiException.validation("note", "must not contain an identity number");
        }
        if (action.assigneeId() != null && action.action() != DataRightsAction.ASSIGN) {
            throw DataRightsApiException.validation("assigneeId", "is only accepted for ASSIGN");
        }
        return note;
    }

    private AppUser assignee(UUID assigneeId) {
        if (assigneeId == null) {
            throw DataRightsApiException.validation("assigneeId", "is required for ASSIGN");
        }
        return userRepository.findById(assigneeId)
                .filter(this::isAuthorizedHandler)
                .orElseThrow(() -> DataRightsApiException.validation(
                        "assigneeId", "must be an authorized data rights handler"));
    }

    private AppUser eligibleRequester(UUID requesterId) {
        return userRepository.findById(requesterId)
                .filter(user -> user.isEnabled() && !user.isDeactivated())
                .filter(user -> user.getRole() == UserRole.PARENT || user.getRole() == UserRole.OPERATOR)
                .orElseThrow(() -> DataRightsApiException.forbidden(
                        "requester_ineligible", "An active parent or operator account is required"));
    }

    private AppUser requireHandler(UUID handlerId) {
        return userRepository.findById(handlerId)
                .filter(this::isAuthorizedHandler)
                .orElseThrow(() -> DataRightsApiException.forbidden(
                        "handler_required", "Authorized data rights handler access is required"));
    }

    /** Least privilege: ADMIN role alone is not enough; the account must also be designated. */
    private boolean isAuthorizedHandler(AppUser user) {
        return user.getRole() == UserRole.ADMIN
                && user.isEnabled()
                && !user.isDeactivated()
                && requestRepository.isDesignatedHandler(user.getId());
    }

    private void requireEnabled() {
        if (!properties.enabled()) {
            throw DataRightsApiException.unavailable();
        }
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    private static DataRightsApiException duplicate() {
        return DataRightsApiException.conflict(
                "duplicate_open_request",
                "An open request of this type already exists"
        );
    }

    private static Specification<DataRightsRequest> queueSpecification(
            DataRightsRequestStatus status,
            Boolean overdue,
            OffsetDateTime now
    ) {
        return (root, query, builder) -> {
            var predicates = new ArrayList<Predicate>();
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (overdue != null) {
                var open = root.get("status").in(DataRightsRequestStatus.OPEN);
                var late = builder.lessThan(root.<OffsetDateTime>get("responseDueAt"), now);
                predicates.add(overdue ? builder.and(open, late) : builder.not(builder.and(open, late)));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static RequesterView requesterView(DataRightsRequest request) {
        return new RequesterView(
                request.getId(),
                request.getType(),
                request.getStatus(),
                request.getReceivedAt(),
                request.getClosedAt()
        );
    }

    private static HandlerSummary summary(DataRightsRequest request, OffsetDateTime now) {
        return new HandlerSummary(
                request.getId(),
                request.getType(),
                request.getStatus(),
                request.getReceivedAt(),
                request.getResponseDueAt(),
                request.isOverdue(now),
                request.getAssignedHandler() == null ? null : request.getAssignedHandler().getId(),
                request.getClosedAt(),
                request.getVersion()
        );
    }

    private HandlerDetail handlerDetail(DataRightsRequest request) {
        List<EventView> events = eventRepository.findByRequestIdOrderByCreatedAtAscIdAsc(request.getId()).stream()
                .map(event -> new EventView(
                        event.getAction(),
                        event.getFromStatus(),
                        event.getToStatus(),
                        event.getActor().getId(),
                        event.getCreatedAt()
                ))
                .toList();
        return new HandlerDetail(
                request.getId(),
                request.getRequester().getId(),
                request.getRequester().getRole(),
                request.getType(),
                request.detailsForHandler(),
                request.getStatus(),
                request.getReceivedAt(),
                request.getResponseDueAt(),
                request.isOverdue(now()),
                request.getAssignedHandler() == null ? null : request.getAssignedHandler().getId(),
                request.getIdentityVerifiedAt(),
                request.handlerNoteForHandler(),
                request.getClosedAt(),
                request.getResponseDeliveredAt(),
                request.getVersion(),
                events
        );
    }
}
