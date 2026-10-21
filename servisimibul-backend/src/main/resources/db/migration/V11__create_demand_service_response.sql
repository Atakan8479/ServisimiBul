CREATE TABLE demand_service_response (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id UUID NOT NULL,
    operator_id UUID NOT NULL,
    operator_school_id UUID,
    offers_morning BOOLEAN NOT NULL,
    offers_afternoon BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    publication_version INTEGER NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ NOT NULL,
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT demand_service_response_demand_fk
        FOREIGN KEY (demand_id) REFERENCES demand (id) ON DELETE CASCADE,
    CONSTRAINT demand_service_response_operator_fk
        FOREIGN KEY (operator_id) REFERENCES operator_profile (id) ON DELETE RESTRICT,
    CONSTRAINT demand_service_response_operator_school_fk
        FOREIGN KEY (operator_school_id) REFERENCES operator_school (id) ON DELETE SET NULL,
    CONSTRAINT demand_service_response_demand_operator_unique
        UNIQUE (demand_id, operator_id),
    CONSTRAINT demand_service_response_direction_check
        CHECK (offers_morning OR offers_afternoon),
    CONSTRAINT demand_service_response_status_check
        CHECK (status IN ('ACTIVE', 'WITHDRAWN')),
    CONSTRAINT demand_service_response_version_check
        CHECK (publication_version > 0),
    CONSTRAINT demand_service_response_withdrawn_at_check CHECK (
        (status = 'ACTIVE' AND withdrawn_at IS NULL)
        OR (status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL)
    )
);

CREATE TABLE demand_service_publication_event (
    id UUID PRIMARY KEY,
    response_id UUID NOT NULL,
    publication_version INTEGER NOT NULL,
    offers_morning BOOLEAN NOT NULL,
    offers_afternoon BOOLEAN NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT demand_service_publication_event_response_fk
        FOREIGN KEY (response_id) REFERENCES demand_service_response (id) ON DELETE CASCADE,
    CONSTRAINT demand_service_publication_event_version_unique
        UNIQUE (response_id, publication_version),
    CONSTRAINT demand_service_publication_event_version_check
        CHECK (publication_version > 0),
    CONSTRAINT demand_service_publication_event_direction_check
        CHECK (offers_morning OR offers_afternoon)
);

CREATE INDEX demand_service_response_public_idx
    ON demand_service_response (demand_id, status, published_at DESC, id DESC);
CREATE INDEX demand_service_response_operator_idx
    ON demand_service_response (operator_id, updated_at DESC);

ALTER TABLE demand_service_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_service_publication_event ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    demand_service_response,
    demand_service_publication_event
FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    demand_service_response,
    demand_service_publication_event
TO servisimibul_app;

CREATE POLICY demand_service_response_backend_access ON demand_service_response
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY demand_service_publication_event_backend_access ON demand_service_publication_event
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE demand_service_response, demand_service_publication_event FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
