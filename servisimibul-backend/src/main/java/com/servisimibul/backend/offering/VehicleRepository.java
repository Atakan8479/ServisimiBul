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

    String DELETION_STATE_SELECT = """
            select vehicle.id as vehicleId,
                   vehicle.usage_history_complete as historyComplete,
                   vehicle.usage_recorded_at is not null as usageRecorded,
                   exists (
                       select 1 from service_offering offering where offering.vehicle_id = vehicle.id
                   ) as inUse
            from vehicle
            """;

    /**
     * Reads D059 deletion eligibility from the database. The V22 usage columns are deliberately
     * not mapped on {@link Vehicle}, so no application write can reset them.
     */
    @Query(nativeQuery = true, value = DELETION_STATE_SELECT + " where vehicle.operator_id = :operatorId")
    List<DeletionState> findDeletionStatesByOperatorId(@Param("operatorId") UUID operatorId);

    @Query(nativeQuery = true, value = DELETION_STATE_SELECT + " where vehicle.id = :id")
    Optional<DeletionState> findDeletionState(@Param("id") UUID id);

    interface DeletionState {
        UUID getVehicleId();

        Boolean getHistoryComplete();

        Boolean getUsageRecorded();

        Boolean getInUse();
    }

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
