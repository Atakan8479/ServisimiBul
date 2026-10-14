CREATE TABLE spring_session (
    primary_id CHAR(36) NOT NULL,
    session_id CHAR(36) NOT NULL,
    creation_time BIGINT NOT NULL,
    last_access_time BIGINT NOT NULL,
    max_inactive_interval INTEGER NOT NULL,
    expiry_time BIGINT NOT NULL,
    principal_name VARCHAR(254),
    CONSTRAINT spring_session_pk PRIMARY KEY (primary_id),
    CONSTRAINT spring_session_id_unique UNIQUE (session_id)
);

CREATE INDEX spring_session_expiry_time_idx ON spring_session (expiry_time);
CREATE INDEX spring_session_principal_name_idx ON spring_session (principal_name);

CREATE TABLE spring_session_attributes (
    session_primary_id CHAR(36) NOT NULL,
    attribute_name VARCHAR(200) NOT NULL,
    attribute_bytes BYTEA NOT NULL,
    CONSTRAINT spring_session_attributes_pk
        PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT spring_session_attributes_session_fk
        FOREIGN KEY (session_primary_id) REFERENCES spring_session (primary_id) ON DELETE CASCADE
);

ALTER TABLE spring_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE spring_session_attributes ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE spring_session, spring_session_attributes FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE spring_session, spring_session_attributes
TO servisimibul_app;

CREATE POLICY spring_session_backend_access ON spring_session
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY spring_session_attributes_backend_access ON spring_session_attributes
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE spring_session, spring_session_attributes FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
