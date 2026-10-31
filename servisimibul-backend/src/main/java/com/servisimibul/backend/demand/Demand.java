package com.servisimibul.backend.demand;

import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.School;
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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "demand",
        uniqueConstraints = @UniqueConstraint(
                name = "demand_school_neighborhood_year_unique",
                columnNames = {"school_id", "neighborhood_id", "academic_year"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Demand {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "neighborhood_id", nullable = false)
    private Neighborhood neighborhood;

    @Column(name = "academic_year", nullable = false, length = 9)
    private String academicYear;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private AppUser createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DemandStatus status = DemandStatus.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(name = "closure_reason", length = 20)
    private DemandClosureReason closureReason;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Demand(School school, Neighborhood neighborhood, String academicYear, AppUser createdBy) {
        this.school = school;
        this.neighborhood = neighborhood;
        this.academicYear = academicYear;
        this.createdBy = createdBy;
    }

    public boolean isOpen() {
        return status == DemandStatus.OPEN;
    }

    public boolean isClosedInactive() {
        return status == DemandStatus.CLOSED && closureReason == DemandClosureReason.INACTIVE;
    }

    public void close(DemandClosureReason reason, OffsetDateTime at) {
        if (!isOpen()) {
            return;
        }
        status = DemandStatus.CLOSED;
        closureReason = reason;
        closedAt = at;
    }

    public void reopen() {
        if (!isClosedInactive()) {
            throw new IllegalStateException("Only an inactive demand can be reopened");
        }
        status = DemandStatus.OPEN;
        closureReason = null;
        closedAt = null;
    }
}
