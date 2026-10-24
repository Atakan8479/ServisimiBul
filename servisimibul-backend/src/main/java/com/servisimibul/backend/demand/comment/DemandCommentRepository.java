package com.servisimibul.backend.demand.comment;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface DemandCommentRepository extends JpaRepository<DemandComment, UUID> {

    @EntityGraph(attributePaths = "author")
    Page<DemandComment> findByDemandIdAndStatus(
            UUID demandId,
            DemandCommentStatus status,
            Pageable pageable
    );

    boolean existsByDemandIdAndAuthorIdAndBodyAndCreatedAtAfter(
            UUID demandId,
            UUID authorId,
            String body,
            OffsetDateTime cutoff
    );

    @EntityGraph(attributePaths = "author")
    Optional<DemandComment> findByIdAndDemandId(UUID id, UUID demandId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select comment
            from DemandComment comment
            join fetch comment.demand
            join fetch comment.author
            where comment.id = :id
            """)
    Optional<DemandComment> findForUpdateById(@Param("id") UUID id);
}
