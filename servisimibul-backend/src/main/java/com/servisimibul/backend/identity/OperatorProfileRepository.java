package com.servisimibul.backend.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OperatorProfileRepository extends JpaRepository<OperatorProfile, UUID> {

    Optional<OperatorProfile> findByUserId(UUID userId);
}
