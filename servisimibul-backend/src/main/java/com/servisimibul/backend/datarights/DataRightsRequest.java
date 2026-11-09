package com.servisimibul.backend.datarights;

import com.servisimibul.backend.identity.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * A data-subject request that actually reached the platform. There is no draft state:
 * an instance exists only after intake commits, and {@code receivedAt} is server time.
 */
@Entity
@Table(name = "data_rights_request")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DataRightsRequest {

    /** Verified statutory general maximum (Law No. 6698 Art. 13). Never paused or extended here. */
    public static final Duration STATUTORY_RESPONSE_PERIOD = Duration.ofDays(30);

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false, updatable = false)
    private AppUser requester;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 32, updatable = false)
    private DataRightsRequestType type;

    @Getter(AccessLevel.NONE)
    @Column(nullable = false, length = 2000, updatable = false)
    private String details;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DataRightsRequestStatus status;

    @Column(name = "received_at", nullable = false, updatable = false)
    private OffsetDateTime receivedAt;

    @Column(name = "response_due_at", nullable = false, updatable = false)
    private OffsetDateTime responseDueAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_handler_id")
    private AppUser assignedHandler;

    @Column(name = "identity_verified_at")
    private OffsetDateTime identityVerifiedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "identity_verified_by")
    private AppUser identityVerifiedBy;

    @Getter(AccessLevel.NONE)
    @Column(name = "handler_note", length = 1000)
    private String handlerNote;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @Column(name = "response_delivered_at")
    private OffsetDateTime responseDeliveredAt;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public DataRightsRequest(
            AppUser requester,
            DataRightsRequestType type,
            String details,
            OffsetDateTime receivedAt
    ) {
        this.requester = Objects.requireNonNull(requester);
        this.type = Objects.requireNonNull(type);
        this.details = Objects.requireNonNull(details);
        this.status = DataRightsRequestStatus.RECEIVED;
        this.receivedAt = Objects.requireNonNull(receivedAt);
        this.responseDueAt = receivedAt.plus(STATUTORY_RESPONSE_PERIOD);
        this.updatedAt = receivedAt;
    }

    /** Request text; only for the authorized handler view. Deliberately excluded from getters. */
    public String detailsForHandler() {
        return details;
    }

    public String handlerNoteForHandler() {
        return handlerNote;
    }

    /**
     * The obligation is met only when a response actually reached the requester. A recorded
     * outcome without {@code responseDeliveredAt} still counts against the deadline.
     */
    public boolean isOverdue(OffsetDateTime now) {
        return responseDeliveredAt == null && now.isAfter(responseDueAt);
    }

    public boolean isAssignedTo(UUID handlerId) {
        return assignedHandler != null && Objects.equals(assignedHandler.getId(), handlerId);
    }

    /**
     * Handover stays possible after an outcome until delivery is recorded, so an undelivered
     * response is never stranded with an unavailable handler. Outcome, deadline and
     * verification state are untouched.
     */
    public void assign(AppUser handler, OffsetDateTime now) {
        if (responseDeliveredAt != null || isAssignedTo(handler.getId())) {
            throw new InvalidTransitionException();
        }
        assignedHandler = handler;
        updatedAt = now;
    }

    public void startReview(OffsetDateTime now) {
        requireStatus(DataRightsRequestStatus.RECEIVED);
        moveTo(DataRightsRequestStatus.UNDER_REVIEW, now);
    }

    public void requestVerification(String note, OffsetDateTime now) {
        if (status != DataRightsRequestStatus.RECEIVED && status != DataRightsRequestStatus.UNDER_REVIEW) {
            throw new InvalidTransitionException();
        }
        handlerNote = Objects.requireNonNull(note);
        moveTo(DataRightsRequestStatus.AWAITING_VERIFICATION, now);
    }

    public void recordIdentityVerified(AppUser handler, OffsetDateTime now) {
        requireOpen();
        if (identityVerifiedAt != null) {
            throw new InvalidTransitionException();
        }
        identityVerifiedAt = now;
        identityVerifiedBy = Objects.requireNonNull(handler);
        moveTo(DataRightsRequestStatus.UNDER_REVIEW, now);
    }

    public void respond(String note, OffsetDateTime now) {
        requireStatus(DataRightsRequestStatus.UNDER_REVIEW);
        close(DataRightsRequestStatus.RESPONDED, note, now);
    }

    public void respondPartially(String note, OffsetDateTime now) {
        requireStatus(DataRightsRequestStatus.UNDER_REVIEW);
        close(DataRightsRequestStatus.PARTIALLY_RESPONDED, Objects.requireNonNull(note), now);
    }

    public void reject(String note, OffsetDateTime now) {
        requireOpen();
        close(DataRightsRequestStatus.REJECTED, Objects.requireNonNull(note), now);
    }

    /** Records that the response actually reached the requester; never inferred automatically. */
    public void recordDelivery(OffsetDateTime now) {
        if (status.isOpen() || responseDeliveredAt != null) {
            throw new InvalidTransitionException();
        }
        responseDeliveredAt = now;
        updatedAt = now;
    }

    private void close(DataRightsRequestStatus outcome, String note, OffsetDateTime now) {
        if (note != null) {
            handlerNote = note;
        }
        closedAt = now;
        moveTo(outcome, now);
    }

    private void moveTo(DataRightsRequestStatus next, OffsetDateTime now) {
        status = next;
        updatedAt = now;
    }

    private void requireOpen() {
        if (!status.isOpen()) {
            throw new InvalidTransitionException();
        }
    }

    private void requireStatus(DataRightsRequestStatus expected) {
        if (status != expected) {
            throw new InvalidTransitionException();
        }
    }

    public static final class InvalidTransitionException extends RuntimeException {
        InvalidTransitionException() {
            super("Action is not allowed in the current request status", null, false, false);
        }
    }
}
