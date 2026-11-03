package com.servisimibul.backend.identity;

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

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "pending_email_change")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PendingEmailChange {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Getter
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @Getter
    private AppUser user;

    @Column(name = "proposed_email", nullable = false, length = 254)
    @Getter
    private String proposedEmail;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "consumed_at")
    private OffsetDateTime consumedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public PendingEmailChange(
            AppUser user,
            String proposedEmail,
            String tokenHash,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt
    ) {
        this.user = Objects.requireNonNull(user);
        reissue(proposedEmail, tokenHash, createdAt, expiresAt);
    }

    public void reissue(
            String proposedEmail,
            String tokenHash,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt
    ) {
        this.proposedEmail = normalizeEmail(proposedEmail);
        this.tokenHash = Objects.requireNonNull(tokenHash);
        this.createdAt = Objects.requireNonNull(createdAt);
        this.expiresAt = Objects.requireNonNull(expiresAt);
        this.consumedAt = null;
    }

    public boolean consumeIfValid(OffsetDateTime now) {
        if (consumedAt != null || !expiresAt.isAfter(now)) {
            return false;
        }
        consumedAt = now;
        return true;
    }

    public void invalidate(OffsetDateTime now) {
        if (consumedAt == null) {
            consumedAt = now;
        }
    }

    private static String normalizeEmail(String email) {
        return Objects.requireNonNull(email).strip().toLowerCase(Locale.ROOT);
    }
}
