package com.servisimibul.backend.operatorschool;

import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.identity.OperatorProfile;
import jakarta.persistence.Column;
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
        name = "operator_school",
        uniqueConstraints = @UniqueConstraint(
                name = "operator_school_operator_school_unique",
                columnNames = {"operator_id", "school_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OperatorSchool {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_id", nullable = false)
    private OperatorProfile operator;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public OperatorSchool(OperatorProfile operator, School school, boolean active) {
        this.operator = Objects.requireNonNull(operator);
        this.school = Objects.requireNonNull(school);
        this.active = active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
