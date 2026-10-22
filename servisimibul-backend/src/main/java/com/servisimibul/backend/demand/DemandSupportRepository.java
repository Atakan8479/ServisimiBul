package com.servisimibul.backend.demand;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DemandSupportRepository extends JpaRepository<DemandSupport, UUID> {

    boolean existsByDemandIdAndParentIdAndStatus(
            UUID demandId,
            UUID parentId,
            DemandSupportStatus status
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
