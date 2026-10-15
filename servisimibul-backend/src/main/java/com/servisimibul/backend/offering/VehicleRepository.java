package com.servisimibul.backend.offering;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {

    List<Vehicle> findAllByOperatorIdOrderByPlateAscIdAsc(UUID operatorId);

    Optional<Vehicle> findByIdAndOperatorId(UUID id, UUID operatorId);

    boolean existsByPlate(String plate);

    boolean existsByPlateAndIdNot(String plate, UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select vehicle
            from Vehicle vehicle
            where vehicle.id = :id
              and vehicle.operator.id = :operatorId
            """)
    Optional<Vehicle> findOwnedForUpdate(
            @Param("id") UUID id,
            @Param("operatorId") UUID operatorId
    );
}
