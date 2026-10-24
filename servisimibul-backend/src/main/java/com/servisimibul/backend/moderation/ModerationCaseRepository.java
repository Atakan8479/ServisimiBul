package com.servisimibul.backend.moderation;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface ModerationCaseRepository extends JpaRepository<ModerationCase, UUID>,
        JpaSpecificationExecutor<ModerationCase> {

    Optional<ModerationCase> findByTargetTypeAndTargetIdAndStatusIn(
            ModerationTargetType targetType,
            UUID targetId,
            Collection<ModerationCaseStatus> statuses
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select moderationCase from ModerationCase moderationCase where moderationCase.id = :id")
    Optional<ModerationCase> findForUpdateById(@Param("id") UUID id);

}
