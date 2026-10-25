package com.servisimibul.backend.operatorschool;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Collection;
import java.util.UUID;
import java.util.Optional;

public interface OperatorSchoolCoverageRepository extends JpaRepository<OperatorSchoolCoverage, UUID> {

    @Query("""
            select distinct profile.user.id
            from OperatorSchoolCoverage coverage
            join coverage.operatorSchool operatorSchool
            join operatorSchool.operator profile
            join profile.user user
            join operatorSchool.school school
            join coverage.neighborhood neighborhood
            join neighborhood.district district
            where school.id = :schoolId
              and school.active = true
              and operatorSchool.active = true
              and profile.active = true
              and profile.publiclyVisible = true
              and user.enabled = true
              and user.emailVerifiedAt is not null
              and user.role = com.servisimibul.backend.identity.UserRole.OPERATOR
              and (:approvalRequired = false
                   or profile.approvalStatus = com.servisimibul.backend.identity.OperatorApprovalStatus.APPROVED)
              and (neighborhood.id = :neighborhoodId or district.id = :districtId)
            order by profile.user.id
            """)
    List<UUID> findEligibleNotificationRecipientIds(
            @Param("schoolId") UUID schoolId,
            @Param("neighborhoodId") Long neighborhoodId,
            @Param("districtId") Long districtId,
            @Param("approvalRequired") boolean approvalRequired
    );

    @Query("""
            select coverage
            from OperatorSchoolCoverage coverage
            join fetch coverage.operatorSchool operatorSchool
            join fetch operatorSchool.school school
            join fetch school.neighborhood schoolNeighborhood
            join fetch schoolNeighborhood.district schoolDistrict
            join fetch schoolDistrict.province
            join fetch coverage.neighborhood neighborhood
            join fetch neighborhood.district district
            join fetch district.province
            where operatorSchool.operator.id = :operatorId
            order by lower(district.name), lower(neighborhood.name), neighborhood.id
            """)
    List<OperatorSchoolCoverage> findAllDetailedByOperatorId(@Param("operatorId") UUID operatorId);

    @Query("""
            select coverage
            from OperatorSchoolCoverage coverage
            join fetch coverage.neighborhood neighborhood
            join fetch neighborhood.district district
            join fetch district.province
            where coverage.operatorSchool.id = :operatorSchoolId
            order by lower(district.name), lower(neighborhood.name), neighborhood.id
            """)
    List<OperatorSchoolCoverage> findAllDetailedByOperatorSchoolId(
            @Param("operatorSchoolId") UUID operatorSchoolId
    );

    @Query("""
            select coverage
            from OperatorSchoolCoverage coverage
            join fetch coverage.neighborhood neighborhood
            join fetch neighborhood.district district
            join fetch district.province coverageProvince
            join fetch coverage.operatorSchool operatorSchool
            join fetch operatorSchool.school school
            join fetch school.neighborhood schoolNeighborhood
            join fetch schoolNeighborhood.district schoolDistrict
            join fetch schoolDistrict.province schoolProvince
            where operatorSchool.id = :operatorSchoolId
              and neighborhood.id = :neighborhoodId
              and coverageProvince.id = schoolProvince.id
            """)
    Optional<OperatorSchoolCoverage> findValidCoverage(
            @Param("operatorSchoolId") UUID operatorSchoolId,
            @Param("neighborhoodId") Long neighborhoodId
    );

    @Modifying
    @Query("delete from OperatorSchoolCoverage coverage where coverage.operatorSchool.id = :operatorSchoolId")
    int deleteAllByOperatorSchoolId(@Param("operatorSchoolId") UUID operatorSchoolId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from OperatorSchoolCoverage coverage where coverage.operatorSchool.id = :operatorSchoolId")
    int deleteAllByOperatorSchoolIdAndClear(@Param("operatorSchoolId") UUID operatorSchoolId);

    @Modifying(flushAutomatically = true)
    @Query("delete from OperatorSchoolCoverage coverage where coverage.id in :ids")
    int deleteAllByIds(@Param("ids") Collection<UUID> ids);
}
