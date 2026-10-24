package com.servisimibul.backend.moderation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContentReportRepository extends JpaRepository<ContentReport, UUID> {

    boolean existsByModerationCaseIdAndReporterId(UUID moderationCaseId, UUID reporterId);

    List<ContentReport> findByModerationCaseIdOrderByCreatedAtDescIdDesc(UUID moderationCaseId);
}
