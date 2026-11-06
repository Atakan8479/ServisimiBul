package com.servisimibul.backend.datarights;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DataRightsRequestRepository extends JpaRepository<DataRightsRequest, UUID>,
        JpaSpecificationExecutor<DataRightsRequest> {

    Optional<DataRightsRequest> findFirstByRequesterIdAndTypeAndStatusInOrderByReceivedAtDesc(
            UUID requesterId,
            DataRightsRequestType type,
            Collection<DataRightsRequestStatus> statuses
    );

    Optional<DataRightsRequest> findFirstByRequesterIdAndTypeAndResponseDeliveredAtIsNullOrderByReceivedAtDesc(
            UUID requesterId,
            DataRightsRequestType type
    );

    List<DataRightsRequest> findTop50ByRequesterIdOrderByReceivedAtDescIdDesc(UUID requesterId);

    List<DataRightsRequest> findTop50ByRequesterIdAndTypeOrderByReceivedAtDescIdDesc(
            UUID requesterId,
            DataRightsRequestType type
    );

    Optional<DataRightsRequest> findByIdAndRequesterId(UUID id, UUID requesterId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from DataRightsRequest request where request.id = :id")
    Optional<DataRightsRequest> findForUpdateById(@Param("id") UUID id);

    @Query(value = "select exists (select 1 from data_rights_handler where user_id = :userId)",
            nativeQuery = true)
    boolean isDesignatedHandler(@Param("userId") UUID userId);
}
