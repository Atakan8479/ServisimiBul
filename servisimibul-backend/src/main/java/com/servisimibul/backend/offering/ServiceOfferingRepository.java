package com.servisimibul.backend.offering;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServiceOfferingRepository extends JpaRepository<ServiceOffering, UUID> {

    interface OwnedReference {

        UUID getVehicleId();

        UUID getOperatorSchoolId();
    }

    @Query("""
            select offering
            from ServiceOffering offering
            join fetch offering.operatorSchool operatorSchool
            join fetch operatorSchool.school
            join fetch offering.vehicle
            where operatorSchool.operator.id = :operatorId
            order by offering.createdAt, offering.id
            """)
    List<ServiceOffering> findAllDetailedByOperatorId(@Param("operatorId") UUID operatorId);

    @Query("""
            select offering
            from ServiceOffering offering
            join fetch offering.operatorSchool operatorSchool
            join fetch operatorSchool.school
            join fetch offering.vehicle
            where offering.id = :id
              and operatorSchool.operator.id = :operatorId
            """)
    Optional<ServiceOffering> findDetailedOwned(
            @Param("id") UUID id,
            @Param("operatorId") UUID operatorId
    );

    @Query("""
            select offering.vehicle.id as vehicleId,
                   offering.operatorSchool.id as operatorSchoolId
            from ServiceOffering offering
            where offering.id = :id
              and offering.operatorSchool.operator.id = :operatorId
            """)
    Optional<OwnedReference> findOwnedReference(
            @Param("id") UUID id,
            @Param("operatorId") UUID operatorId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select offering
            from ServiceOffering offering
            where offering.id = :id
              and offering.operatorSchool.operator.id = :operatorId
            """)
    Optional<ServiceOffering> findOwnedForUpdate(
            @Param("id") UUID id,
            @Param("operatorId") UUID operatorId
    );

    boolean existsByVehicleIdAndAvailableSeatsGreaterThan(UUID vehicleId, int capacity);

    @Modifying(flushAutomatically = true)
    @Query("""
            update ServiceOffering offering
            set offering.published = false,
                offering.updatedAt = CURRENT_TIMESTAMP
            where offering.vehicle.id = :vehicleId
              and offering.published = true
            """)
    int unpublishAllByVehicleId(@Param("vehicleId") UUID vehicleId);
}
