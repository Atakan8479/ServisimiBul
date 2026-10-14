package com.servisimibul.backend.operatorschool;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OperatorSchoolRepository extends JpaRepository<OperatorSchool, UUID> {

    @Query("""
            select operatorSchool
            from OperatorSchool operatorSchool
            join fetch operatorSchool.school school
            join fetch school.neighborhood neighborhood
            join fetch neighborhood.district district
            join fetch district.province
            where operatorSchool.operator.id = :operatorId
            order by lower(school.name), operatorSchool.id
            """)
    List<OperatorSchool> findAllDetailedByOperatorId(@Param("operatorId") UUID operatorId);

    boolean existsByOperatorIdAndSchoolId(UUID operatorId, UUID schoolId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select operatorSchool
            from OperatorSchool operatorSchool
            where operatorSchool.id = :id
              and operatorSchool.operator.id = :operatorId
            """)
    Optional<OperatorSchool> findOwnedForUpdate(
            @Param("id") UUID id,
            @Param("operatorId") UUID operatorId
    );
}
