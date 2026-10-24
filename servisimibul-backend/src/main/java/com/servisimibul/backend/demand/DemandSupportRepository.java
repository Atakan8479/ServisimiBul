package com.servisimibul.backend.demand;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

public interface DemandSupportRepository extends JpaRepository<DemandSupport, UUID> {

    boolean existsByDemandIdAndParentIdAndStatusIn(
            UUID demandId,
            UUID parentId,
            List<DemandSupportStatus> statuses
    );

    @EntityGraph(attributePaths = "reasons")
    @Query("""
            select distinct support
            from DemandSupport support
            where support.demand.id = :demandId
              and support.parent.id = :parentId
            """)
    Optional<DemandSupport> findOwned(
            @Param("demandId") UUID demandId,
            @Param("parentId") UUID parentId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "reasons")
    @Query("""
            select distinct support
            from DemandSupport support
            where support.demand.id = :demandId
              and support.parent.id = :parentId
            """)
    Optional<DemandSupport> findOwnedForUpdate(
            @Param("demandId") UUID demandId,
            @Param("parentId") UUID parentId
    );

    @Query("""
            select support
            from DemandSupport support
            where support.demand.id = :demandId
              and support.status in (
                com.servisimibul.backend.demand.DemandSupportStatus.ACTIVE,
                com.servisimibul.backend.demand.DemandSupportStatus.AWAITING_FEEDBACK
              )
              and support.parent.role = com.servisimibul.backend.identity.UserRole.PARENT
              and support.parent.enabled = true
              and (:parentVerificationRequired = false
                   or support.parent.emailVerifiedAt is not null)
              and ((:offersMorning = true and support.needsMorning = true)
                   or (:offersAfternoon = true and support.needsAfternoon = true))
            """)
    List<DemandSupport> findEligibleForPublication(
            @Param("demandId") UUID demandId,
            @Param("offersMorning") boolean offersMorning,
            @Param("offersAfternoon") boolean offersAfternoon,
            @Param("parentVerificationRequired") boolean parentVerificationRequired
    );

    @Query("""
            select count(support.id)
            from DemandSupport support
            where support.demand.id = :demandId
              and support.status in (
                com.servisimibul.backend.demand.DemandSupportStatus.ACTIVE,
                com.servisimibul.backend.demand.DemandSupportStatus.AWAITING_FEEDBACK
              )
              and support.parent.role = com.servisimibul.backend.identity.UserRole.PARENT
              and support.parent.enabled = true
              and (:parentVerificationRequired = false
                   or support.parent.emailVerifiedAt is not null)
            """)
    long countEligibleByDemandId(
            @Param("demandId") UUID demandId,
            @Param("parentVerificationRequired") boolean parentVerificationRequired
    );

    boolean existsByDemandIdAndStatus(UUID demandId, DemandSupportStatus status);

    @EntityGraph(attributePaths = "reasons")
    @Query("""
            select distinct support
            from DemandSupport support
            where support.demand.id in :demandIds
              and support.parent.id = :parentId
            """)
    List<DemandSupport> findOwnedForDemands(
            @Param("demandIds") List<UUID> demandIds,
            @Param("parentId") UUID parentId
    );
}
