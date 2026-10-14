package com.servisimibul.backend.operatorschool;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OperatorSchoolCoverageRepository extends JpaRepository<OperatorSchoolCoverage, UUID> {

    @Query("""
            select coverage
            from OperatorSchoolCoverage coverage
            join fetch coverage.neighborhood neighborhood
            join fetch neighborhood.district district
            join fetch district.province
            where coverage.operatorSchool.operator.id = :operatorId
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

    @Modifying
    @Query("delete from OperatorSchoolCoverage coverage where coverage.operatorSchool.id = :operatorSchoolId")
    int deleteAllByOperatorSchoolId(@Param("operatorSchoolId") UUID operatorSchoolId);
}
