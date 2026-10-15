package com.servisimibul.backend.identity;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface OperatorProfileRepository extends JpaRepository<OperatorProfile, UUID> {

    Optional<OperatorProfile> findByUserId(UUID userId);

    Page<OperatorProfile> findAllByApprovalStatus(
            OperatorApprovalStatus approvalStatus,
            Pageable pageable
    );

    @Query("select profile from OperatorProfile profile join fetch profile.user where profile.id = :id")
    Optional<OperatorProfile> findDetailedById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select profile from OperatorProfile profile join fetch profile.user where profile.id = :id")
    Optional<OperatorProfile> findDetailedByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select profile from OperatorProfile profile where profile.user.id = :userId")
    Optional<OperatorProfile> findByUserIdForUpdate(@Param("userId") UUID userId);
}
