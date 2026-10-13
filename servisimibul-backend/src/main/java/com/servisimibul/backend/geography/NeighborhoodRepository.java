package com.servisimibul.backend.geography;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NeighborhoodRepository extends JpaRepository<Neighborhood, Long> {

    List<Neighborhood> findAllByDistrictIdOrderByNameAscIdAsc(Long districtId);
}
