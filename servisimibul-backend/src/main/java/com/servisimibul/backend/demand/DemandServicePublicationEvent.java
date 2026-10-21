package com.servisimibul.backend.demand;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "demand_service_publication_event",
        uniqueConstraints = @UniqueConstraint(
                name = "demand_service_publication_event_version_unique",
                columnNames = {"response_id", "publication_version"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DemandServicePublicationEvent {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "response_id", nullable = false)
    private DemandServiceResponse response;

    @Column(name = "publication_version", nullable = false)
    private int publicationVersion;

    @Column(name = "offers_morning", nullable = false)
    private boolean offersMorning;

    @Column(name = "offers_afternoon", nullable = false)
    private boolean offersAfternoon;

    @Column(name = "published_at", nullable = false)
    private OffsetDateTime publishedAt;

    public DemandServicePublicationEvent(
            UUID id,
            DemandServiceResponse response,
            int publicationVersion,
            boolean offersMorning,
            boolean offersAfternoon,
            OffsetDateTime publishedAt
    ) {
        if (publicationVersion < 1) {
            throw new IllegalArgumentException("Publication version must be positive");
        }
        if (!offersMorning && !offersAfternoon) {
            throw new IllegalArgumentException("At least one offered direction is required");
        }
        this.id = Objects.requireNonNull(id);
        this.response = Objects.requireNonNull(response);
        this.publicationVersion = publicationVersion;
        this.offersMorning = offersMorning;
        this.offersAfternoon = offersAfternoon;
        this.publishedAt = Objects.requireNonNull(publishedAt);
    }
}
