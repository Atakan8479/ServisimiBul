CREATE TABLE in_app_notification (
    id UUID PRIMARY KEY,
    recipient_user_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL,
    event_key VARCHAR(255) NOT NULL,
    demand_id UUID,
    service_response_id UUID,
    publication_event_id UUID,
    feedback_id UUID,
    moderation_case_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    CONSTRAINT in_app_notification_recipient_fk
        FOREIGN KEY (recipient_user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT in_app_notification_demand_fk
        FOREIGN KEY (demand_id) REFERENCES demand (id) ON DELETE CASCADE,
    CONSTRAINT in_app_notification_response_fk
        FOREIGN KEY (service_response_id) REFERENCES demand_service_response (id) ON DELETE CASCADE,
    CONSTRAINT in_app_notification_publication_fk
        FOREIGN KEY (publication_event_id) REFERENCES demand_service_publication_event (id) ON DELETE CASCADE,
    CONSTRAINT in_app_notification_feedback_fk
        FOREIGN KEY (feedback_id) REFERENCES demand_service_feedback (id) ON DELETE CASCADE,
    CONSTRAINT in_app_notification_moderation_case_fk
        FOREIGN KEY (moderation_case_id) REFERENCES moderation_case (id) ON DELETE CASCADE,
    CONSTRAINT in_app_notification_event_key_unique UNIQUE (event_key),
    CONSTRAINT in_app_notification_type_check CHECK (type IN (
        'DEMAND_CREATED',
        'SERVICE_PUBLISHED',
        'FEEDBACK_REMINDER',
        'SUPPORT_EXPIRED',
        'SERVICE_WITHDRAWN',
        'CONTENT_REPORTED'
    )),
    CONSTRAINT in_app_notification_target_check CHECK (
        (type = 'DEMAND_CREATED' AND demand_id IS NOT NULL
            AND service_response_id IS NULL AND publication_event_id IS NULL
            AND feedback_id IS NULL AND moderation_case_id IS NULL)
        OR (type = 'SERVICE_PUBLISHED' AND demand_id IS NOT NULL
            AND service_response_id IS NOT NULL AND publication_event_id IS NOT NULL
            AND feedback_id IS NOT NULL AND moderation_case_id IS NULL)
        OR (type IN ('FEEDBACK_REMINDER', 'SUPPORT_EXPIRED') AND demand_id IS NOT NULL
            AND service_response_id IS NOT NULL AND publication_event_id IS NOT NULL
            AND feedback_id IS NOT NULL AND moderation_case_id IS NULL)
        OR (type = 'SERVICE_WITHDRAWN' AND demand_id IS NOT NULL
            AND service_response_id IS NOT NULL AND publication_event_id IS NOT NULL
            AND feedback_id IS NOT NULL AND moderation_case_id IS NULL)
        OR (type = 'CONTENT_REPORTED' AND demand_id IS NULL
            AND service_response_id IS NULL AND publication_event_id IS NULL
            AND feedback_id IS NULL AND moderation_case_id IS NOT NULL)
    ),
    CONSTRAINT in_app_notification_read_time_check CHECK (
        read_at IS NULL OR read_at >= created_at
    )
);

CREATE INDEX in_app_notification_recipient_created_idx
    ON in_app_notification (recipient_user_id, created_at DESC, id DESC);
CREATE INDEX in_app_notification_recipient_unread_idx
    ON in_app_notification (recipient_user_id, created_at DESC, id DESC)
    WHERE read_at IS NULL;

ALTER TABLE in_app_notification ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE in_app_notification FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE in_app_notification TO servisimibul_app;

CREATE POLICY in_app_notification_backend_access ON in_app_notification
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE in_app_notification FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
