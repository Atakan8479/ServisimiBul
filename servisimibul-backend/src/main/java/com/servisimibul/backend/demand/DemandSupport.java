package com.servisimibul.backend.demand;

import com.servisimibul.backend.identity.AppUser;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(
        name = "demand_support",
        uniqueConstraints = @UniqueConstraint(
                name = "demand_support_demand_parent_unique",
                columnNames = {"demand_id", "parent_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DemandSupport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "demand_id", nullable = false)
    private Demand demand;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "parent_id", nullable = false)
    private AppUser parent;

    @Column(name = "needs_morning", nullable = false)
    private boolean needsMorning;

    @Column(name = "needs_afternoon", nullable = false)
    private boolean needsAfternoon;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DemandSupportStatus status = DemandSupportStatus.ACTIVE;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "demand_support_reason",
            joinColumns = @JoinColumn(name = "support_id")
    )
    @Enumerated(EnumType.STRING)
    @Column(name = "reason_code", nullable = false, length = 40)
    private Set<SupportReason> reasons = new LinkedHashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public DemandSupport(
            Demand demand,
            AppUser parent,
            boolean needsMorning,
            boolean needsAfternoon,
            Set<SupportReason> reasons
    ) {
        this.demand = demand;
        this.parent = parent;
        replace(needsMorning, needsAfternoon, reasons);
    }

    public void replace(boolean needsMorning, boolean needsAfternoon, Set<SupportReason> reasons) {
        this.needsMorning = needsMorning;
        this.needsAfternoon = needsAfternoon;
        this.reasons.clear();
        this.reasons.addAll(reasons);
    }

    public void reactivate(boolean needsMorning, boolean needsAfternoon, Set<SupportReason> reasons) {
        replace(needsMorning, needsAfternoon, reasons);
        status = DemandSupportStatus.ACTIVE;
    }

    public void withdraw() {
        status = DemandSupportStatus.WITHDRAWN;
    }

    public boolean isActive() {
        return status == DemandSupportStatus.ACTIVE;
    }

    public void awaitFeedback() {
        if (status == DemandSupportStatus.ACTIVE || status == DemandSupportStatus.AWAITING_FEEDBACK) {
            status = DemandSupportStatus.AWAITING_FEEDBACK;
        }
    }

    public void satisfy() {
        if (status != DemandSupportStatus.AWAITING_FEEDBACK) {
            throw new IllegalStateException("Only awaiting support can be satisfied");
        }
        status = DemandSupportStatus.SATISFIED;
    }

    public void activate() {
        if (status != DemandSupportStatus.SATISFIED && status != DemandSupportStatus.WITHDRAWN) {
            status = DemandSupportStatus.ACTIVE;
        }
    }

    public void expire() {
        if (status == DemandSupportStatus.ACTIVE || status == DemandSupportStatus.AWAITING_FEEDBACK) {
            status = DemandSupportStatus.INACTIVE_EXPIRED;
        }
    }

    public boolean isEligibleForDemand() {
        return status == DemandSupportStatus.ACTIVE
                || status == DemandSupportStatus.AWAITING_FEEDBACK;
    }
}
