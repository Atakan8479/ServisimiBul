package com.servisimibul.backend.offering;

import com.servisimibul.backend.operatorschool.OperatorSchool;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "service_offering")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ServiceOffering {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_school_id", nullable = false)
    private OperatorSchool operatorSchool;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private Vehicle vehicle;

    @Column(name = "available_seats")
    private Integer availableSeats;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "is_published", nullable = false)
    private boolean published;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public ServiceOffering(
            OperatorSchool operatorSchool,
            Vehicle vehicle,
            Integer availableSeats,
            String description
    ) {
        this.operatorSchool = Objects.requireNonNull(operatorSchool);
        this.vehicle = Objects.requireNonNull(vehicle);
        this.availableSeats = availableSeats;
        this.description = description;
    }

    public void update(
            OperatorSchool operatorSchool,
            Vehicle vehicle,
            Integer availableSeats,
            String description,
            boolean relationshipChanged
    ) {
        this.operatorSchool = Objects.requireNonNull(operatorSchool);
        this.vehicle = Objects.requireNonNull(vehicle);
        this.availableSeats = availableSeats;
        this.description = description;
        if (relationshipChanged) {
            published = false;
        }
    }

    public void unpublish() {
        published = false;
    }

    public void publish() {
        published = true;
    }
}
