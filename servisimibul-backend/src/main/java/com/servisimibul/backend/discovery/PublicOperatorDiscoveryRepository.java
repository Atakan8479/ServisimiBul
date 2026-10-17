package com.servisimibul.backend.discovery;

import com.servisimibul.backend.identity.OperatorApprovalStatus;
import com.servisimibul.backend.identity.OperatorProfile;
import com.servisimibul.backend.identity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.UUID;
import java.util.Collection;
import java.util.List;

public interface PublicOperatorDiscoveryRepository extends Repository<OperatorProfile, UUID> {

    interface PublishedOfferingProjection {

        UUID getOperatorId();

        UUID getOfferingId();

        Integer getAvailableSeats();

        int getVehicleCapacity();

        String getDescription();
    }

    @Query(
            value = """
                    select distinct profile
                    from OperatorProfile profile
                    join fetch profile.user user
                    where user.emailVerifiedAt is not null
                      and user.enabled = true
                      and user.role = :userRole
                      and (:approvalRequired = false or profile.approvalStatus = :approvalStatus)
                      and profile.active = true
                      and profile.publiclyVisible = true
                      and exists (
                          select coverage.id
                          from OperatorSchoolCoverage coverage
                          join coverage.operatorSchool operatorSchool
                          join operatorSchool.school school
                          where operatorSchool.operator = profile
                            and operatorSchool.active = true
                            and school.active = true
                            and school.id = :schoolId
                            and coverage.neighborhood.id = :neighborhoodId
                      )
                    order by profile.businessName, profile.id
                    """,
            countQuery = """
                    select count(distinct profile.id)
                    from OperatorProfile profile
                    join profile.user user
                    where user.emailVerifiedAt is not null
                      and user.enabled = true
                      and user.role = :userRole
                      and (:approvalRequired = false or profile.approvalStatus = :approvalStatus)
                      and profile.active = true
                      and profile.publiclyVisible = true
                      and exists (
                          select coverage.id
                          from OperatorSchoolCoverage coverage
                          join coverage.operatorSchool operatorSchool
                          join operatorSchool.school school
                          where operatorSchool.operator = profile
                            and operatorSchool.active = true
                            and school.active = true
                            and school.id = :schoolId
                            and coverage.neighborhood.id = :neighborhoodId
                      )
                    """
    )
    Page<OperatorProfile> findPublishedOperators(
            @Param("schoolId") UUID schoolId,
            @Param("neighborhoodId") Long neighborhoodId,
            @Param("userRole") UserRole userRole,
            @Param("approvalStatus") OperatorApprovalStatus approvalStatus,
            @Param("approvalRequired") boolean approvalRequired,
            Pageable pageable
    );

    @Query("""
            select operatorSchool.operator.id as operatorId,
                   offering.id as offeringId,
                   offering.availableSeats as availableSeats,
                   vehicle.capacity as vehicleCapacity,
                   offering.description as description
            from ServiceOfferingCoverage offeringCoverage
            join offeringCoverage.serviceOffering offering
            join offering.operatorSchool operatorSchool
            join operatorSchool.school school
            join offering.vehicle vehicle
            join offeringCoverage.operatorSchoolCoverage generalCoverage
            where operatorSchool.operator.id in :operatorIds
              and offering.published = true
              and operatorSchool.active = true
              and school.active = true
              and school.id = :schoolId
              and vehicle.active = true
              and vehicle.operator = operatorSchool.operator
              and generalCoverage.operatorSchool = operatorSchool
              and generalCoverage.neighborhood.id = :neighborhoodId
            order by operatorSchool.operator.id, offering.createdAt, offering.id
            """)
    List<PublishedOfferingProjection> findMatchingPublishedOfferings(
            @Param("operatorIds") Collection<UUID> operatorIds,
            @Param("schoolId") UUID schoolId,
            @Param("neighborhoodId") Long neighborhoodId
    );
}
