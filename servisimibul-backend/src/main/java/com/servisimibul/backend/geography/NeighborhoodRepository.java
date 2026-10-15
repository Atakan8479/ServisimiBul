package com.servisimibul.backend.geography;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NeighborhoodRepository extends JpaRepository<Neighborhood, Long> {

    List<Neighborhood> findAllByDistrictIdOrderByNameAscIdAsc(Long districtId);

    @EntityGraph(attributePaths = {
            "district",
            "district.province"
    })
    @Query("select neighborhood from Neighborhood neighborhood where neighborhood.id = :id")
    Optional<Neighborhood> findDetailedById(@Param("id") Long id);
}
