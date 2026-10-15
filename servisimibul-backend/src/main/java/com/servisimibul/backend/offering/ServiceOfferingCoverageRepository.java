package com.servisimibul.backend.offering;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ServiceOfferingCoverageRepository
        extends JpaRepository<ServiceOfferingCoverage, UUID> {

    @Query("""
            select offeringCoverage
            from ServiceOfferingCoverage offeringCoverage
            join fetch offeringCoverage.operatorSchoolCoverage generalCoverage
            join fetch generalCoverage.neighborhood neighborhood
            join fetch neighborhood.district district
            join fetch district.province
            where offeringCoverage.serviceOffering.id in :offeringIds
            order by offeringCoverage.serviceOffering.id,
                     lower(district.name), lower(neighborhood.name), neighborhood.id
            """)
    List<ServiceOfferingCoverage> findAllDetailedByOfferingIds(
            @Param("offeringIds") Collection<UUID> offeringIds
    );

    @Modifying(flushAutomatically = true)
    @Query("""
            delete from ServiceOfferingCoverage offeringCoverage
            where offeringCoverage.serviceOffering.id = :offeringId
            """)
    int deleteAllByOfferingId(@Param("offeringId") UUID offeringId);

    @Modifying(flushAutomatically = true)
    @Query("""
            delete from ServiceOfferingCoverage offeringCoverage
            where offeringCoverage.operatorSchoolCoverage.id in :generalCoverageIds
            """)
    int deleteAllByGeneralCoverageIds(
            @Param("generalCoverageIds") Collection<UUID> generalCoverageIds
    );

    long countByServiceOfferingId(UUID offeringId);

    long countByServiceOfferingIdAndOperatorSchoolCoverageOperatorSchoolId(
            UUID offeringId,
            UUID operatorSchoolId
    );
}
