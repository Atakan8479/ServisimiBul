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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/** Minimal audit entry: actor, action and status change. Never copies request text. */
@Entity
@Table(name = "data_rights_request_event")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DataRightsRequestEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false, updatable = false)
    private DataRightsRequest request;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false, updatable = false)
    private AppUser actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32, updatable = false)
    private DataRightsAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 32, updatable = false)
    private DataRightsRequestStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 32, updatable = false)
    private DataRightsRequestStatus toStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public DataRightsRequestEvent(
            DataRightsRequest request,
            AppUser actor,
            DataRightsAction action,
            DataRightsRequestStatus fromStatus,
            OffsetDateTime createdAt
    ) {
        this.request = Objects.requireNonNull(request);
        this.actor = Objects.requireNonNull(actor);
        this.action = Objects.requireNonNull(action);
        this.fromStatus = fromStatus;
        this.toStatus = request.getStatus();
        this.createdAt = Objects.requireNonNull(createdAt);
    }
}
