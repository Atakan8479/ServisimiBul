package com.servisimibul.backend.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OperatorApplicationReviewRepository
        extends JpaRepository<OperatorApplicationReview, UUID> {
}
