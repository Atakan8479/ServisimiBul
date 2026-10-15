package com.servisimibul.backend.offering;

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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "vehicle",
        uniqueConstraints = @UniqueConstraint(name = "vehicle_plate_unique", columnNames = "plate")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_id", nullable = false)
    private OperatorProfile operator;

    @Column(nullable = false, columnDefinition = "text")
    private String plate;

    @Column(nullable = false)
    private int capacity;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Vehicle(OperatorProfile operator, String plate, int capacity) {
        this.operator = Objects.requireNonNull(operator);
        this.plate = Objects.requireNonNull(plate);
        this.capacity = capacity;
    }

    public void update(String plate, int capacity) {
        this.plate = Objects.requireNonNull(plate);
        this.capacity = capacity;
    }

    public void activate() {
        active = true;
    }

    public void deactivate() {
        active = false;
    }
}
