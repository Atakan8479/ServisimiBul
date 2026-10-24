package com.servisimibul.backend.moderation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ModerationAuditEventRepository extends JpaRepository<ModerationAuditEvent, UUID> {

    List<ModerationAuditEvent> findByModerationCaseIdOrderByCreatedAtDescIdDesc(UUID moderationCaseId);
}
