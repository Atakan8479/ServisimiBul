CREATE TABLE pending_email_change (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    proposed_email VARCHAR(254) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pending_email_change_user_fk
        FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT pending_email_change_user_unique UNIQUE (user_id),
    CONSTRAINT pending_email_change_token_hash_unique UNIQUE (token_hash),
    CONSTRAINT pending_email_change_email_normalized CHECK (
        proposed_email = lower(btrim(proposed_email))
        AND char_length(proposed_email) BETWEEN 3 AND 254
    ),
    CONSTRAINT pending_email_change_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT pending_email_change_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT pending_email_change_consumed_check CHECK (
        consumed_at IS NULL OR consumed_at >= created_at
    )
);

CREATE UNIQUE INDEX pending_email_change_active_email_unique
    ON pending_email_change (proposed_email)
    WHERE consumed_at IS NULL;
CREATE INDEX pending_email_change_expires_at_idx ON pending_email_change (expires_at);

ALTER TABLE pending_email_change ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE pending_email_change FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pending_email_change TO servisimibul_app;

CREATE POLICY pending_email_change_backend_access ON pending_email_change
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE pending_email_change FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
