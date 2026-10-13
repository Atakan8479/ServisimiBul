package com.servisimibul.backend.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "app_user")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Getter
    private UUID id;

    @Column(nullable = false, unique = true, length = 254)
    @Getter
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Getter
    private UserRole role;

    @Column(name = "is_enabled", nullable = false)
    @Getter
    private boolean enabled = true;

    @Column(name = "email_verified_at")
    private OffsetDateTime emailVerifiedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    private AppUser(String email, String passwordHash, UserRole role) {
        this.email = normalizeEmail(email);
        this.passwordHash = Objects.requireNonNull(passwordHash);
        this.role = role;
    }

    public static AppUser newOperator(String email, String passwordHash) {
        return new AppUser(email, passwordHash, UserRole.OPERATOR);
    }

    static AppUser newAdmin(String email, String passwordHash) {
        return new AppUser(email, passwordHash, UserRole.ADMIN);
    }

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }

    String passwordHash() {
        return passwordHash;
    }

    public void verifyEmail(OffsetDateTime verifiedAt) {
        emailVerifiedAt = Objects.requireNonNull(verifiedAt);
    }

    public void disable() {
        enabled = false;
    }

    private static String normalizeEmail(String email) {
        return Objects.requireNonNull(email).strip().toLowerCase(Locale.ROOT);
    }
}
