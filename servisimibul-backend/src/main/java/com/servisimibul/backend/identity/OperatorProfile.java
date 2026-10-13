package com.servisimibul.backend.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "operator_profile")
public class OperatorProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private AppUser user;

    @Column(name = "business_name", nullable = false, length = 120)
    private String businessName;

    @Column(name = "contact_phone", nullable = false, length = 16)
    private String contactPhone;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, length = 30)
    private OperatorApprovalStatus approvalStatus = OperatorApprovalStatus.DRAFT;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "is_publicly_visible", nullable = false)
    private boolean publiclyVisible = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected OperatorProfile() {
    }

    public OperatorProfile(AppUser user, String businessName, String contactPhone) {
        if (Objects.requireNonNull(user).getRole() != UserRole.OPERATOR) {
            throw new IllegalArgumentException("Only an operator can own an operator profile");
        }
        this.user = user;
        this.businessName = Objects.requireNonNull(businessName).strip();
        this.contactPhone = Objects.requireNonNull(contactPhone).strip();
    }

    public UUID getId() {
        return id;
    }

    public AppUser getUser() {
        return user;
    }

    public String getBusinessName() {
        return businessName;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public String getDescription() {
        return description;
    }

    public OperatorApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isPubliclyVisible() {
        return publiclyVisible;
    }
}
