package com.servisimibul.backend.identity;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PendingEmailChangeRepository extends JpaRepository<PendingEmailChange, UUID> {

    Optional<PendingEmailChange> findByUserId(UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select change from PendingEmailChange change where change.tokenHash = :tokenHash")
    Optional<PendingEmailChange> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    boolean existsByTokenHash(String tokenHash);
}
