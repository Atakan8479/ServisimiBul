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

public interface PublicOperatorDiscoveryRepository extends Repository<OperatorProfile, UUID> {

    @Query(
            value = """
                    select distinct profile
                    from OperatorProfile profile
                    join fetch profile.user user
                    where user.emailVerifiedAt is not null
                      and user.enabled = true
                      and user.role = :userRole
                      and profile.approvalStatus = :approvalStatus
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
                            and coverage.neighborhood.district.province.id =
                                school.neighborhood.district.province.id
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
                      and profile.approvalStatus = :approvalStatus
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
                            and coverage.neighborhood.district.province.id =
                                school.neighborhood.district.province.id
                      )
                    """
    )
    Page<OperatorProfile> findPublishedOperators(
            @Param("schoolId") UUID schoolId,
            @Param("neighborhoodId") Long neighborhoodId,
            @Param("userRole") UserRole userRole,
            @Param("approvalStatus") OperatorApprovalStatus approvalStatus,
            Pageable pageable
    );
}
