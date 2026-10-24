package com.servisimibul.backend.demand;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface DemandServiceResponseRepository
        extends JpaRepository<DemandServiceResponse, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select response
            from DemandServiceResponse response
            join fetch response.demand
            join fetch response.operator operator
            join fetch operator.user
            left join fetch response.operatorSchool
            where response.id = :id
            """)
    Optional<DemandServiceResponse> findForUpdateById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select response
            from DemandServiceResponse response
            join fetch response.demand
            join fetch response.operator operator
            left join fetch response.operatorSchool
            where response.demand.id = :demandId
              and operator.id = :operatorId
            """)
    Optional<DemandServiceResponse> findOwnedForUpdate(
            @Param("demandId") UUID demandId,
            @Param("operatorId") UUID operatorId
    );

    @Query("""
            select response
            from DemandServiceResponse response
            join fetch response.demand
            join fetch response.operator operator
            left join fetch response.operatorSchool
            where response.demand.id = :demandId
              and operator.id = :operatorId
            """)
    Optional<DemandServiceResponse> findOwned(
            @Param("demandId") UUID demandId,
            @Param("operatorId") UUID operatorId
    );

    @Query(
            value = """
                    select response.id as id,
                           response.publicationVersion as publicationVersion,
                           response.offersMorning as offersMorning,
                           response.offersAfternoon as offersAfternoon,
                           response.publishedAt as publishedAt,
                           operator.id as operatorId,
                           operator.businessName as businessName,
                           operator.contactPhone as contactPhone
                    from DemandServiceResponse response
                    join response.demand demand
                    join response.operator operator
                    join operator.user user
                    where demand.id = :demandId
                      and demand.status = com.servisimibul.backend.demand.DemandStatus.OPEN
                      and response.status = com.servisimibul.backend.demand.DemandServiceResponseStatus.ACTIVE
                      and user.emailVerifiedAt is not null
                      and user.enabled = true
                      and user.role = com.servisimibul.backend.identity.UserRole.OPERATOR
                      and (:approvalRequired = false
                           or operator.approvalStatus = com.servisimibul.backend.identity.OperatorApprovalStatus.APPROVED)
                      and operator.active = true
                      and operator.publiclyVisible = true
                      and demand.school.active = true
                      and exists (
                          select coverage.id
                          from OperatorSchoolCoverage coverage
                          join coverage.operatorSchool operatorSchool
                          where operatorSchool.operator = operator
                            and operatorSchool.school = demand.school
                            and operatorSchool.active = true
                            and coverage.neighborhood = demand.neighborhood
                            and coverage.neighborhood.district.province.id
                                = demand.school.neighborhood.district.province.id
                      )
                    order by response.publishedAt desc, response.id desc
                    """,
            countQuery = """
                    select count(response.id)
                    from DemandServiceResponse response
                    join response.demand demand
                    join response.operator operator
                    join operator.user user
                    where demand.id = :demandId
                      and demand.status = com.servisimibul.backend.demand.DemandStatus.OPEN
                      and response.status = com.servisimibul.backend.demand.DemandServiceResponseStatus.ACTIVE
                      and user.emailVerifiedAt is not null
                      and user.enabled = true
                      and user.role = com.servisimibul.backend.identity.UserRole.OPERATOR
                      and (:approvalRequired = false
                           or operator.approvalStatus = com.servisimibul.backend.identity.OperatorApprovalStatus.APPROVED)
                      and operator.active = true
                      and operator.publiclyVisible = true
                      and demand.school.active = true
                      and exists (
                          select coverage.id
                          from OperatorSchoolCoverage coverage
                          join coverage.operatorSchool operatorSchool
                          where operatorSchool.operator = operator
                            and operatorSchool.school = demand.school
                            and operatorSchool.active = true
                            and coverage.neighborhood = demand.neighborhood
                            and coverage.neighborhood.district.province.id
                                = demand.school.neighborhood.district.province.id
                      )
                    """
    )
    Page<PublicResponseSummary> findPublicResponses(
            @Param("demandId") UUID demandId,
            @Param("approvalRequired") boolean approvalRequired,
            Pageable pageable
    );

    interface PublicResponseSummary {
        UUID getId();

        int getPublicationVersion();

        boolean getOffersMorning();

        boolean getOffersAfternoon();

        OffsetDateTime getPublishedAt();

        UUID getOperatorId();

        String getBusinessName();

        String getContactPhone();
    }
}
