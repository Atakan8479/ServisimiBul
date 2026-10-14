package com.servisimibul.backend.operatorschool;

import com.servisimibul.backend.geography.Neighborhood;
import jakarta.persistence.Entity;
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

import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "operator_school_coverage",
        uniqueConstraints = @UniqueConstraint(
                name = "operator_school_coverage_pair_unique",
                columnNames = {"operator_school_id", "neighborhood_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OperatorSchoolCoverage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_school_id", nullable = false)
    private OperatorSchool operatorSchool;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "neighborhood_id", nullable = false)
    private Neighborhood neighborhood;

    public OperatorSchoolCoverage(OperatorSchool operatorSchool, Neighborhood neighborhood) {
        this.operatorSchool = Objects.requireNonNull(operatorSchool);
        this.neighborhood = Objects.requireNonNull(neighborhood);
    }
}
