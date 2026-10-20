CREATE TABLE demand (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL,
    neighborhood_id BIGINT NOT NULL,
    academic_year VARCHAR(9) NOT NULL,
    created_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT demand_school_fk
        FOREIGN KEY (school_id) REFERENCES school (id) ON DELETE RESTRICT,
    CONSTRAINT demand_neighborhood_fk
        FOREIGN KEY (neighborhood_id) REFERENCES neighborhood (id) ON DELETE RESTRICT,
    CONSTRAINT demand_created_by_fk
        FOREIGN KEY (created_by) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT demand_school_neighborhood_year_unique
        UNIQUE (school_id, neighborhood_id, academic_year),
    CONSTRAINT demand_academic_year_check CHECK (
        academic_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND substring(academic_year FROM 6 FOR 4)::INTEGER
            = substring(academic_year FROM 1 FOR 4)::INTEGER + 1
    ),
    CONSTRAINT demand_status_check CHECK (status IN ('OPEN', 'CLOSED', 'ARCHIVED'))
);

CREATE TABLE demand_support (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id UUID NOT NULL,
    parent_id UUID NOT NULL,
    needs_morning BOOLEAN NOT NULL,
    needs_afternoon BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT demand_support_demand_fk
        FOREIGN KEY (demand_id) REFERENCES demand (id) ON DELETE CASCADE,
    CONSTRAINT demand_support_parent_fk
        FOREIGN KEY (parent_id) REFERENCES app_user (id) ON DELETE RESTRICT,
    CONSTRAINT demand_support_demand_parent_unique UNIQUE (demand_id, parent_id),
    CONSTRAINT demand_support_direction_check CHECK (needs_morning OR needs_afternoon),
    CONSTRAINT demand_support_status_check CHECK (status IN ('ACTIVE', 'WITHDRAWN'))
);

CREATE TABLE demand_support_reason (
    support_id UUID NOT NULL,
    reason_code VARCHAR(40) NOT NULL,
    CONSTRAINT demand_support_reason_pk PRIMARY KEY (support_id, reason_code),
    CONSTRAINT demand_support_reason_support_fk
        FOREIGN KEY (support_id) REFERENCES demand_support (id) ON DELETE CASCADE,
    CONSTRAINT demand_support_reason_code_check CHECK (reason_code IN (
        'NO_SUITABLE_SERVICE',
        'NO_AVAILABLE_SEATS',
        'PRICE_TOO_HIGH',
        'ROUTE_TOO_LONG',
        'SCHEDULE_UNSUITABLE',
        'OTHER'
    ))
);

CREATE INDEX demand_created_at_idx ON demand (created_at DESC, id DESC);
CREATE INDEX demand_support_demand_status_idx ON demand_support (demand_id, status);
CREATE INDEX demand_support_parent_id_idx ON demand_support (parent_id);

ALTER TABLE demand ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_support ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_support_reason ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE demand, demand_support, demand_support_reason FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE demand, demand_support, demand_support_reason
TO servisimibul_app;

CREATE POLICY demand_backend_access ON demand
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY demand_support_backend_access ON demand_support
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY demand_support_reason_backend_access ON demand_support_reason
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE demand, demand_support, demand_support_reason FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
