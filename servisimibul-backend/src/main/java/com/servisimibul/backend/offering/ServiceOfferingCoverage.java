package com.servisimibul.backend.offering;

import com.servisimibul.backend.operatorschool.OperatorSchoolCoverage;
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
        name = "service_offering_coverage",
        uniqueConstraints = @UniqueConstraint(
                name = "service_offering_coverage_pair_unique",
                columnNames = {"service_offering_id", "operator_school_coverage_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ServiceOfferingCoverage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_offering_id", nullable = false)
    private ServiceOffering serviceOffering;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_school_coverage_id", nullable = false)
    private OperatorSchoolCoverage operatorSchoolCoverage;

    public ServiceOfferingCoverage(
            ServiceOffering serviceOffering,
            OperatorSchoolCoverage operatorSchoolCoverage
    ) {
        this.serviceOffering = Objects.requireNonNull(serviceOffering);
        this.operatorSchoolCoverage = Objects.requireNonNull(operatorSchoolCoverage);
    }
}
