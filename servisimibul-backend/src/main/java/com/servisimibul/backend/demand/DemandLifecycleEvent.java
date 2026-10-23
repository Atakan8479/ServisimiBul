package com.servisimibul.backend.demand;

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

@Entity
@Table(name = "demand_lifecycle_event")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DemandLifecycleEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "demand_id", nullable = false)
    private Demand demand;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 24)
    private DemandLifecycleEventType eventType;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    public DemandLifecycleEvent(
            Demand demand,
            DemandLifecycleEventType eventType,
            OffsetDateTime occurredAt
    ) {
        this.demand = Objects.requireNonNull(demand);
        this.eventType = Objects.requireNonNull(eventType);
        this.occurredAt = Objects.requireNonNull(occurredAt);
    }
}
