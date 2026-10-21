package com.servisimibul.backend.demand;

import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.operatorschool.OperatorSchool;
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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "demand_service_response",
        uniqueConstraints = @UniqueConstraint(
                name = "demand_service_response_demand_operator_unique",
                columnNames = {"demand_id", "operator_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DemandServiceResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "demand_id", nullable = false)
    private Demand demand;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_id", nullable = false)
    private OperatorProfile operator;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operator_school_id")
    private OperatorSchool operatorSchool;

    @Column(name = "offers_morning", nullable = false)
    private boolean offersMorning;

    @Column(name = "offers_afternoon", nullable = false)
    private boolean offersAfternoon;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DemandServiceResponseStatus status = DemandServiceResponseStatus.ACTIVE;

    @Column(name = "publication_version", nullable = false)
    private int publicationVersion = 1;

    @Column(name = "published_at", nullable = false)
    private OffsetDateTime publishedAt;

    @Column(name = "withdrawn_at")
    private OffsetDateTime withdrawnAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public DemandServiceResponse(
            Demand demand,
            OperatorProfile operator,
            OperatorSchool operatorSchool,
            boolean offersMorning,
            boolean offersAfternoon,
            OffsetDateTime publishedAt
    ) {
        requireDirection(offersMorning, offersAfternoon);
        this.demand = Objects.requireNonNull(demand);
        this.operator = Objects.requireNonNull(operator);
        this.operatorSchool = Objects.requireNonNull(operatorSchool);
        this.offersMorning = offersMorning;
        this.offersAfternoon = offersAfternoon;
        this.publishedAt = Objects.requireNonNull(publishedAt);
    }

    public void republish(
            OperatorSchool operatorSchool,
            boolean offersMorning,
            boolean offersAfternoon,
            OffsetDateTime publishedAt
    ) {
        requireDirection(offersMorning, offersAfternoon);
        if (status != DemandServiceResponseStatus.WITHDRAWN) {
            throw new IllegalStateException("Only a withdrawn response can be republished");
        }
        this.operatorSchool = Objects.requireNonNull(operatorSchool);
        this.offersMorning = offersMorning;
        this.offersAfternoon = offersAfternoon;
        this.status = DemandServiceResponseStatus.ACTIVE;
        this.publicationVersion += 1;
        this.publishedAt = Objects.requireNonNull(publishedAt);
        this.withdrawnAt = null;
    }

    public void withdraw(OffsetDateTime withdrawnAt) {
        if (status == DemandServiceResponseStatus.ACTIVE) {
            status = DemandServiceResponseStatus.WITHDRAWN;
            this.withdrawnAt = Objects.requireNonNull(withdrawnAt);
        }
    }

    public boolean isActive() {
        return status == DemandServiceResponseStatus.ACTIVE;
    }

    private static void requireDirection(boolean offersMorning, boolean offersAfternoon) {
        if (!offersMorning && !offersAfternoon) {
            throw new IllegalArgumentException("At least one offered direction is required");
        }
    }
}
