CREATE TABLE moderation_case (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(24) NOT NULL,
    target_id UUID NOT NULL,
    demand_id UUID,
    comment_id UUID,
    service_response_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    target_title VARCHAR(255) NOT NULL,
    target_snapshot VARCHAR(2000) NOT NULL,
    moderated_by UUID,
    decision_reason VARCHAR(500),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT moderation_case_demand_fk
        FOREIGN KEY (demand_id) REFERENCES demand (id) ON DELETE RESTRICT,
    CONSTRAINT moderation_case_comment_fk
        FOREIGN KEY (comment_id) REFERENCES demand_comment (id) ON DELETE SET NULL,
    CONSTRAINT moderation_case_service_response_fk
        FOREIGN KEY (service_response_id) REFERENCES demand_service_response (id) ON DELETE RESTRICT,
    CONSTRAINT moderation_case_moderator_fk
        FOREIGN KEY (moderated_by) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT moderation_case_target_type_check CHECK (
        (target_type = 'COMMENT' AND comment_id IS NOT NULL
            AND demand_id IS NULL AND service_response_id IS NULL AND target_id = comment_id)
        OR (target_type = 'DEMAND' AND demand_id IS NOT NULL AND comment_id IS NULL
            AND service_response_id IS NULL AND target_id = demand_id)
        OR (target_type = 'SERVICE_RESPONSE' AND service_response_id IS NOT NULL
            AND demand_id IS NULL AND comment_id IS NULL AND target_id = service_response_id)
    ),
    CONSTRAINT moderation_case_status_check CHECK (
        status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')
    ),
    CONSTRAINT moderation_case_resolution_check CHECK (
        (status IN ('OPEN', 'IN_REVIEW') AND resolved_at IS NULL)
        OR (status IN ('RESOLVED', 'DISMISSED') AND moderated_by IS NOT NULL
            AND decision_reason IS NOT NULL AND resolved_at IS NOT NULL)
    ),
    CONSTRAINT moderation_case_reason_check CHECK (
        decision_reason IS NULL
        OR (decision_reason = btrim(decision_reason)
            AND char_length(decision_reason) BETWEEN 2 AND 500)
    )
);

CREATE UNIQUE INDEX moderation_case_active_comment_unique
    ON moderation_case (target_id)
    WHERE target_type = 'COMMENT' AND status IN ('OPEN', 'IN_REVIEW');
CREATE UNIQUE INDEX moderation_case_active_demand_unique
    ON moderation_case (target_id)
    WHERE target_type = 'DEMAND' AND status IN ('OPEN', 'IN_REVIEW');
CREATE UNIQUE INDEX moderation_case_active_response_unique
    ON moderation_case (target_id)
    WHERE target_type = 'SERVICE_RESPONSE' AND status IN ('OPEN', 'IN_REVIEW');
CREATE INDEX moderation_case_queue_idx
    ON moderation_case (status, updated_at DESC, id DESC);

CREATE TABLE content_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderation_case_id UUID NOT NULL,
    reporter_id UUID NOT NULL,
    reporter_role VARCHAR(20) NOT NULL,
    reason VARCHAR(32) NOT NULL,
    explanation VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT content_report_case_fk
        FOREIGN KEY (moderation_case_id) REFERENCES moderation_case (id) ON DELETE CASCADE,
    CONSTRAINT content_report_reporter_fk
        FOREIGN KEY (reporter_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT content_report_unique_reporter_case UNIQUE (moderation_case_id, reporter_id),
    CONSTRAINT content_report_role_check CHECK (reporter_role IN ('PARENT', 'OPERATOR')),
    CONSTRAINT content_report_reason_check CHECK (reason IN (
        'ABUSE_HARASSMENT',
        'HATE_DISCRIMINATION',
        'PERSONAL_DATA',
        'SPAM_ADVERTISING',
        'MISLEADING_SERVICE',
        'OTHER'
    )),
    CONSTRAINT content_report_explanation_check CHECK (
        explanation IS NULL
        OR (explanation = btrim(explanation) AND char_length(explanation) BETWEEN 2 AND 500)
    )
);

CREATE INDEX content_report_case_created_idx
    ON content_report (moderation_case_id, created_at DESC, id DESC);
CREATE INDEX content_report_reporter_created_idx
    ON content_report (reporter_id, created_at DESC);
CREATE INDEX content_report_reason_idx
    ON content_report (reason, created_at DESC);

CREATE TABLE moderation_audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderation_case_id UUID NOT NULL,
    moderator_id UUID NOT NULL,
    action VARCHAR(40) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT moderation_audit_case_fk
        FOREIGN KEY (moderation_case_id) REFERENCES moderation_case (id) ON DELETE CASCADE,
    CONSTRAINT moderation_audit_moderator_fk
        FOREIGN KEY (moderator_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT moderation_audit_action_check CHECK (action IN (
        'MARK_IN_REVIEW',
        'DISMISS',
        'RESOLVE_NO_ACTION',
        'HIDE_COMMENT',
        'RESTORE_COMMENT',
        'WITHDRAW_SERVICE_RESPONSE',
        'SUSPEND_OPERATOR',
        'CLOSE_DEMAND'
    )),
    CONSTRAINT moderation_audit_reason_check CHECK (
        reason = btrim(reason) AND char_length(reason) BETWEEN 2 AND 500
    )
);

CREATE INDEX moderation_audit_case_created_idx
    ON moderation_audit_event (moderation_case_id, created_at DESC, id DESC);

ALTER TABLE moderation_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_audit_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE moderation_case, content_report, moderation_audit_event FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE moderation_case, content_report, moderation_audit_event TO servisimibul_app;

CREATE POLICY moderation_case_backend_access ON moderation_case
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY content_report_backend_access ON content_report
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY moderation_audit_event_backend_access ON moderation_audit_event
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE moderation_case, content_report, moderation_audit_event FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
