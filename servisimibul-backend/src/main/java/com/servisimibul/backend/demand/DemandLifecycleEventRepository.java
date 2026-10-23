package com.servisimibul.backend.demand;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DemandLifecycleEventRepository extends JpaRepository<DemandLifecycleEvent, UUID> {

    long countByDemandIdAndEventType(UUID demandId, DemandLifecycleEventType eventType);
}
