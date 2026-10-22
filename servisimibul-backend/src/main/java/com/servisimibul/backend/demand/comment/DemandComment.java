package com.servisimibul.backend.demand.comment;

import com.servisimibul.backend.demand.Demand;
import com.servisimibul.backend.identity.AppUser;
import com.servisimibul.backend.identity.UserRole;
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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "demand_comment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DemandComment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "demand_id", nullable = false)
    private Demand demand;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private AppUser author;

    @Enumerated(EnumType.STRING)
    @Column(name = "author_role", nullable = false, length = 20, updatable = false)
    private UserRole authorRole;

    @Column(nullable = false, length = 1000)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DemandCommentStatus status = DemandCommentStatus.PUBLISHED;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public DemandComment(Demand demand, AppUser author, String body) {
        UserRole role = Objects.requireNonNull(author).getRole();
        if (role != UserRole.PARENT && role != UserRole.OPERATOR) {
            throw new IllegalArgumentException("Only parents and operators can author demand comments");
        }
        this.demand = Objects.requireNonNull(demand);
        this.author = author;
        this.authorRole = role;
        this.body = Objects.requireNonNull(body);
    }

    public void hide() {
        status = DemandCommentStatus.HIDDEN;
    }
}
