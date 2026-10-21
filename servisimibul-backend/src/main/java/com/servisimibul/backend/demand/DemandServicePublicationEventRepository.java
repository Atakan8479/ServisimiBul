package com.servisimibul.backend.demand;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DemandServicePublicationEventRepository
        extends JpaRepository<DemandServicePublicationEvent, UUID> {

    long countByResponseId(UUID responseId);
}
