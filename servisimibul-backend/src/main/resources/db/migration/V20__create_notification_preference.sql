-- APP-15 (#222): per-user switches for genuinely optional in-app notification types.
-- A missing row means the type is enabled, so existing delivery is unchanged by default.
-- The type check keeps essential notifications (feedback, expiry, withdrawal, moderation)
-- impossible to disable at the database level.
CREATE TABLE notification_preference (
    user_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL,
    enabled BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT notification_preference_pk PRIMARY KEY (user_id, type),
    CONSTRAINT notification_preference_user_fk
        FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT notification_preference_type_check CHECK (type IN ('DEMAND_CREATED'))
);

ALTER TABLE notification_preference ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE notification_preference FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_preference TO servisimibul_app;

CREATE POLICY notification_preference_backend_access ON notification_preference
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE notification_preference FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
