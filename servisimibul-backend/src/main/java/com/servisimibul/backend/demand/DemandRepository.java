package com.servisimibul.backend.demand;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DemandRepository extends JpaRepository<Demand, UUID> {

    Optional<Demand> findBySchoolIdAndNeighborhoodIdAndAcademicYear(
            UUID schoolId,
            Long neighborhoodId,
            String academicYear
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select demand from Demand demand where demand.id = :id")
    Optional<Demand> findForUpdateById(@Param("id") UUID id);

    @Query(
            value = """
                    select demand.id as id,
                           demand.status as status,
                           demand.academicYear as academicYear,
                           demand.createdAt as createdAt,
                           demand.updatedAt as updatedAt,
                           school.id as schoolId,
                           school.name as schoolName,
                           neighborhood.id as neighborhoodId,
                           neighborhood.name as neighborhoodName,
                           district.id as districtId,
                           district.name as districtName,
                           province.id as provinceId,
                           province.code as provinceCode,
                           province.name as provinceName,
                           count(support.id) as supporterCount,
                           count(case when support.needsMorning = true then 1 end) as morningCount,
                           count(case when support.needsAfternoon = true then 1 end) as afternoonCount
                    from Demand demand
                    join demand.school school
                    join demand.neighborhood neighborhood
                    join neighborhood.district district
                    join district.province province
                    left join DemandSupport support
                      on support.demand = demand
                     and support.status = com.servisimibul.backend.demand.DemandSupportStatus.ACTIVE
                     and support.parent.role = com.servisimibul.backend.identity.UserRole.PARENT
                     and support.parent.enabled = true
                     and support.parent.emailVerifiedAt is not null
                    where demand.status = com.servisimibul.backend.demand.DemandStatus.OPEN
                      and demand.academicYear = :academicYear
                      and (:schoolId is null or school.id = :schoolId)
                      and (:neighborhoodId is null or neighborhood.id = :neighborhoodId)
                    group by demand.id, school.id, neighborhood.id, district.id, province.id
                    order by
                      case when :mostSupported = true then count(support.id) end desc,
                      demand.createdAt desc,
                      demand.id desc
                    """,
            countQuery = """
                    select count(demand.id)
                    from Demand demand
                    where demand.status = com.servisimibul.backend.demand.DemandStatus.OPEN
                      and demand.academicYear = :academicYear
                      and (:schoolId is null or demand.school.id = :schoolId)
                      and (:neighborhoodId is null or demand.neighborhood.id = :neighborhoodId)
                    """
    )
    Page<DemandSummary> findOpenDemandSummaries(
            @Param("schoolId") UUID schoolId,
            @Param("neighborhoodId") Long neighborhoodId,
            @Param("academicYear") String academicYear,
            @Param("mostSupported") boolean mostSupported,
            Pageable pageable
    );

    @Query("""
            select demand.id as id,
                   demand.status as status,
                   demand.academicYear as academicYear,
                   demand.createdAt as createdAt,
                   demand.updatedAt as updatedAt,
                   school.id as schoolId,
                   school.name as schoolName,
                   neighborhood.id as neighborhoodId,
                   neighborhood.name as neighborhoodName,
                   district.id as districtId,
                   district.name as districtName,
                   province.id as provinceId,
                   province.code as provinceCode,
                   province.name as provinceName,
                   count(support.id) as supporterCount,
                   count(case when support.needsMorning = true then 1 end) as morningCount,
                   count(case when support.needsAfternoon = true then 1 end) as afternoonCount
            from Demand demand
            join demand.school school
            join demand.neighborhood neighborhood
            join neighborhood.district district
            join district.province province
            left join DemandSupport support
              on support.demand = demand
             and support.status = com.servisimibul.backend.demand.DemandSupportStatus.ACTIVE
             and support.parent.role = com.servisimibul.backend.identity.UserRole.PARENT
             and support.parent.enabled = true
             and support.parent.emailVerifiedAt is not null
            where demand.id = :id
            group by demand.id, school.id, neighborhood.id, district.id, province.id
            """)
    Optional<DemandSummary> findSummaryById(@Param("id") UUID id);

    @Query("""
            select support.demand.id as demandId,
                   reason as reason,
                   count(support.id) as total
            from DemandSupport support
            join support.reasons reason
            where support.demand.id in :demandIds
              and support.status = com.servisimibul.backend.demand.DemandSupportStatus.ACTIVE
              and support.parent.role = com.servisimibul.backend.identity.UserRole.PARENT
              and support.parent.enabled = true
              and support.parent.emailVerifiedAt is not null
            group by support.demand.id, reason
            """)
    List<DemandReasonCount> countReasons(@Param("demandIds") List<UUID> demandIds);

    interface DemandSummary {
        UUID getId();

        DemandStatus getStatus();

        String getAcademicYear();

        OffsetDateTime getCreatedAt();

        OffsetDateTime getUpdatedAt();

        UUID getSchoolId();

        String getSchoolName();

        Long getNeighborhoodId();

        String getNeighborhoodName();

        Long getDistrictId();

        String getDistrictName();

        Long getProvinceId();

        String getProvinceCode();

        String getProvinceName();

        long getSupporterCount();

        long getMorningCount();

        long getAfternoonCount();
    }

    interface DemandReasonCount {
        UUID getDemandId();

        SupportReason getReason();

        long getTotal();
    }
}
