package com.servisimibul.backend.demand;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DemandServiceFeedbackRepository extends JpaRepository<DemandServiceFeedback, UUID> {

    @EntityGraph(attributePaths = {
            "publicationEvent",
            "publicationEvent.response",
            "publicationEvent.response.operator"
    })
    @Query("""
            select feedback
            from DemandServiceFeedback feedback
            where feedback.support.id = :supportId
            order by feedback.createdAt desc, feedback.id desc
            """)
    List<DemandServiceFeedback> findDetailedBySupportId(@Param("supportId") UUID supportId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "support",
            "publicationEvent",
            "publicationEvent.response",
            "publicationEvent.response.operator"
    })
    @Query("""
            select feedback
            from DemandServiceFeedback feedback
            where feedback.support.id = :supportId
              and feedback.publicationEvent.id = :publicationEventId
            """)
    Optional<DemandServiceFeedback> findOwnedForUpdate(
            @Param("supportId") UUID supportId,
            @Param("publicationEventId") UUID publicationEventId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select feedback
            from DemandServiceFeedback feedback
            where feedback.id = :id
            """)
    Optional<DemandServiceFeedback> findForUpdateById(@Param("id") UUID id);

    @Query("""
            select feedback.support.demand.id
            from DemandServiceFeedback feedback
            where feedback.id = :id
            """)
    Optional<UUID> findDemandIdById(@Param("id") UUID id);

    @Query("""
            select feedback.id
            from DemandServiceFeedback feedback
            where feedback.status = com.servisimibul.backend.demand.DemandServiceFeedbackStatus.AWAITING_FEEDBACK
              and (feedback.expiresAt <= :now
                   or (feedback.openedAt is not null
                       and feedback.reminderDueAt <= :now
                       and feedback.reminderTriggeredAt is null))
            order by feedback.expiresAt, feedback.id
            """)
    List<UUID> findDueIds(@Param("now") OffsetDateTime now, Pageable pageable);

    @Query("""
            select feedback
            from DemandServiceFeedback feedback
            where feedback.support.id = :supportId
              and feedback.status = com.servisimibul.backend.demand.DemandServiceFeedbackStatus.AWAITING_FEEDBACK
            """)
    List<DemandServiceFeedback> findAwaitingBySupportId(@Param("supportId") UUID supportId);

    @Query("""
            select feedback
            from DemandServiceFeedback feedback
            where feedback.publicationEvent.response.id = :responseId
              and feedback.status = com.servisimibul.backend.demand.DemandServiceFeedbackStatus.AWAITING_FEEDBACK
            """)
    List<DemandServiceFeedback> findAwaitingByResponseId(@Param("responseId") UUID responseId);

    boolean existsBySupportIdAndStatus(UUID supportId, DemandServiceFeedbackStatus status);

    boolean existsBySupportIdAndPublicationEventId(UUID supportId, UUID publicationEventId);
}
