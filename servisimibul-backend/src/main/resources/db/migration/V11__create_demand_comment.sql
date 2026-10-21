CREATE TABLE demand_comment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id UUID NOT NULL,
    author_id UUID NOT NULL,
    author_role VARCHAR(20) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT demand_comment_demand_fk
        FOREIGN KEY (demand_id) REFERENCES demand (id) ON DELETE CASCADE,
    CONSTRAINT demand_comment_author_fk
        FOREIGN KEY (author_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT demand_comment_author_role_check CHECK (author_role IN ('PARENT', 'OPERATOR')),
    CONSTRAINT demand_comment_body_check CHECK (
        body = btrim(body)
        AND char_length(body) BETWEEN 2 AND 1000
    ),
    CONSTRAINT demand_comment_status_check CHECK (status IN ('PUBLISHED', 'HIDDEN'))
);

CREATE INDEX demand_comment_public_page_idx
    ON demand_comment (demand_id, status, created_at DESC, id DESC);
CREATE INDEX demand_comment_author_recent_idx
    ON demand_comment (demand_id, author_id, created_at DESC);

ALTER TABLE demand_comment ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE demand_comment FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE demand_comment TO servisimibul_app;

CREATE POLICY demand_comment_backend_access ON demand_comment
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE demand_comment FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
