package com.servisimibul.backend.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

    @Query("select max(token.createdAt) from PasswordResetToken token where token.user.id = :userId")
    Optional<OffsetDateTime> findLatestCreatedAtByUserId(@Param("userId") UUID userId);

    @Query("select token.user.id from PasswordResetToken token where token.tokenHash = :tokenHash")
    Optional<UUID> findUserIdByTokenHash(@Param("tokenHash") String tokenHash);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update PasswordResetToken token
            set token.consumedAt = :consumedAt
            where token.user.id = :userId
              and token.consumedAt is null
            """)
    int invalidateUnconsumedByUserId(
            @Param("userId") UUID userId,
            @Param("consumedAt") OffsetDateTime consumedAt
    );

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update PasswordResetToken token
            set token.consumedAt = :consumedAt
            where token.tokenHash = :tokenHash
              and token.consumedAt is null
              and token.expiresAt > :consumedAt
            """)
    int consumeIfValid(
            @Param("tokenHash") String tokenHash,
            @Param("consumedAt") OffsetDateTime consumedAt
    );
}
