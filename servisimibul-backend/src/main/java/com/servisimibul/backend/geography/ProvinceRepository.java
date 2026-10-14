package com.servisimibul.backend.geography;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProvinceRepository extends JpaRepository<Province, Long> {

    List<Province> findAllByOrderByNameAscIdAsc();
}
