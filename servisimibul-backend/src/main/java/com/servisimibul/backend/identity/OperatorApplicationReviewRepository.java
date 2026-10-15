package com.servisimibul.backend.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OperatorApplicationReviewRepository
        extends JpaRepository<OperatorApplicationReview, UUID> {

    List<OperatorApplicationReview> findAllByOperatorIdOrderByReviewedAtAscIdAsc(UUID operatorId);
}
