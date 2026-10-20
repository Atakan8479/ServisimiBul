package com.servisimibul.backend.geography;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface SchoolRepository extends JpaRepository<School, UUID> {

    @EntityGraph(attributePaths = {
            "neighborhood",
            "neighborhood.district",
            "neighborhood.district.province"
    })
    @Query(
            value = """
                    select school
                    from School school
                    where school.active = true
                      and (:query = '' or cast(lower(function(
                            'translate',
                            school.name,
                            'İIÂÇĞÎÖŞÜÛâçğıîöşüû',
                            'iiACGIOSUUacgiiosuu'
                          )) as string) like concat('%', :query, '%') escape '!')
                      and (:provinceId is null or school.neighborhood.district.province.id = :provinceId)
                      and (:districtId is null or school.neighborhood.district.id = :districtId)
                    order by
                      case when :descending = false then cast(lower(function(
                        'translate', school.name,
                        'İIÂÇĞÎÖŞÜÛâçğıîöşüû',
                        'iiACGIOSUUacgiiosuu'
                      )) as string) end asc,
                      case when :descending = false then school.id end asc,
                      case when :descending = true then cast(lower(function(
                        'translate', school.name,
                        'İIÂÇĞÎÖŞÜÛâçğıîöşüû',
                        'iiACGIOSUUacgiiosuu'
                      )) as string) end desc,
                      case when :descending = true then school.id end desc
                    """,
            countQuery = """
                    select count(school)
                    from School school
                    where school.active = true
                      and (:query = '' or cast(lower(function(
                            'translate',
                            school.name,
                            'İIÂÇĞÎÖŞÜÛâçğıîöşüû',
                            'iiACGIOSUUacgiiosuu'
                          )) as string) like concat('%', :query, '%') escape '!')
                      and (:provinceId is null or school.neighborhood.district.province.id = :provinceId)
                      and (:districtId is null or school.neighborhood.district.id = :districtId)
                    """
    )
    Page<School> findPublicSchools(
            @Param("query") String query,
            @Param("provinceId") Long provinceId,
            @Param("districtId") Long districtId,
            @Param("descending") boolean descending,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "neighborhood",
            "neighborhood.district",
            "neighborhood.district.province"
    })
    @Query(
            value = """
                    select school
                    from School school
                    where (:query is null or lower(school.name) like lower(concat('%', :query, '%')))
                      and (:provinceId is null or school.neighborhood.district.province.id = :provinceId)
                      and (:districtId is null or school.neighborhood.district.id = :districtId)
                    order by lower(school.name), school.id
                    """,
            countQuery = """
                    select count(school)
                    from School school
                    where (:query is null or lower(school.name) like lower(concat('%', :query, '%')))
                      and (:provinceId is null or school.neighborhood.district.province.id = :provinceId)
                      and (:districtId is null or school.neighborhood.district.id = :districtId)
                    """
    )
    Page<School> findAdminSchools(
            @Param("query") String query,
            @Param("provinceId") Long provinceId,
            @Param("districtId") Long districtId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "neighborhood",
            "neighborhood.district",
            "neighborhood.district.province"
    })
    Optional<School> findByIdAndActiveTrue(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "neighborhood",
            "neighborhood.district",
            "neighborhood.district.province"
    })
    @Query("select school from School school where school.id = :id")
    Optional<School> findDetailedForUpdateById(@Param("id") UUID id);

    @EntityGraph(attributePaths = {
            "neighborhood",
            "neighborhood.district",
            "neighborhood.district.province"
    })
    @Query("select school from School school where school.id = :id")
    Optional<School> findDetailedById(@Param("id") UUID id);

    boolean existsBySourceNameAndSourceCode(String sourceName, String sourceCode);

    boolean existsBySourceNameAndSourceCodeAndIdNot(String sourceName, String sourceCode, UUID id);
}
