package com.servisimibul.backend.geography;

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

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "school",
        uniqueConstraints = @UniqueConstraint(
                name = "school_source_name_code_unique",
                columnNames = {"source_name", "source_code"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class School {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "neighborhood_id", nullable = false)
    private Neighborhood neighborhood;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "text")
    private String address;

    @Column(name = "source_name", length = 100)
    private String sourceName;

    @Column(name = "source_code", length = 100)
    private String sourceCode;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    public School(
            Neighborhood neighborhood,
            String name,
            String address,
            String sourceName,
            String sourceCode
    ) {
        this.neighborhood = neighborhood;
        this.name = name;
        this.address = address;
        this.sourceName = sourceName;
        this.sourceCode = sourceCode;
    }
}
