CREATE TABLE operator_school (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL,
    school_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT operator_school_operator_fk
        FOREIGN KEY (operator_id) REFERENCES operator_profile (id) ON DELETE RESTRICT,
    CONSTRAINT operator_school_school_fk
        FOREIGN KEY (school_id) REFERENCES school (id) ON DELETE RESTRICT,
    CONSTRAINT operator_school_operator_school_unique UNIQUE (operator_id, school_id)
);

CREATE TABLE operator_school_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_school_id UUID NOT NULL,
    neighborhood_id BIGINT NOT NULL,
    CONSTRAINT operator_school_coverage_operator_school_fk
        FOREIGN KEY (operator_school_id) REFERENCES operator_school (id) ON DELETE CASCADE,
    CONSTRAINT operator_school_coverage_neighborhood_fk
        FOREIGN KEY (neighborhood_id) REFERENCES neighborhood (id) ON DELETE RESTRICT,
    CONSTRAINT operator_school_coverage_pair_unique
        UNIQUE (operator_school_id, neighborhood_id)
);

CREATE INDEX operator_school_school_id_idx ON operator_school (school_id);
CREATE INDEX operator_school_coverage_neighborhood_id_idx
    ON operator_school_coverage (neighborhood_id);

ALTER TABLE operator_school ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_school_coverage ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE operator_school, operator_school_coverage FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE operator_school, operator_school_coverage
TO servisimibul_app;

CREATE POLICY operator_school_backend_access ON operator_school
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY operator_school_coverage_backend_access ON operator_school_coverage
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE operator_school, operator_school_coverage FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
