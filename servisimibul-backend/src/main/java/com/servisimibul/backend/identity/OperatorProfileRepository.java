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

    @Query("select profile from OperatorProfile profile join fetch profile.user where profile.user.id = :userId")
    Optional<OperatorProfile> findByUserId(@Param("userId") UUID userId);

    Page<OperatorProfile> findAllByApprovalStatus(
            OperatorApprovalStatus approvalStatus,
            Pageable pageable
    );

    @Query("select profile from OperatorProfile profile join fetch profile.user where profile.id = :id")
    Optional<OperatorProfile> findDetailedById(@Param("id") UUID id);

    interface StatusCounts {

        long getTotal();

        long getChangesRequested();

        long getSuspended();
    }

    @Query("""
            select count(profile.id) as total,
                   coalesce(sum(case when profile.approvalStatus =
                       com.servisimibul.backend.identity.OperatorApprovalStatus.CHANGES_REQUESTED
                       then 1 else 0 end), 0) as changesRequested,
                   coalesce(sum(case when profile.active = false then 1 else 0 end), 0) as suspended
            from OperatorProfile profile
            """)
    StatusCounts countByStatus();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select profile from OperatorProfile profile join fetch profile.user where profile.id = :id")
    Optional<OperatorProfile> findDetailedByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select profile from OperatorProfile profile join fetch profile.user where profile.user.id = :userId")
    Optional<OperatorProfile> findByUserIdForUpdate(@Param("userId") UUID userId);
}
