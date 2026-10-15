CREATE TABLE service_offering_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_offering_id UUID NOT NULL,
    operator_school_coverage_id UUID NOT NULL,
    CONSTRAINT service_offering_coverage_offering_fk
        FOREIGN KEY (service_offering_id) REFERENCES service_offering (id) ON DELETE CASCADE,
    CONSTRAINT service_offering_coverage_general_coverage_fk
        FOREIGN KEY (operator_school_coverage_id)
        REFERENCES operator_school_coverage (id) ON DELETE CASCADE,
    CONSTRAINT service_offering_coverage_pair_unique
        UNIQUE (service_offering_id, operator_school_coverage_id)
);

CREATE INDEX service_offering_coverage_general_coverage_id_idx
    ON service_offering_coverage (operator_school_coverage_id);

ALTER TABLE service_offering_coverage ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE service_offering_coverage FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_offering_coverage
TO servisimibul_app;

CREATE POLICY service_offering_coverage_backend_access ON service_offering_coverage
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE service_offering_coverage FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
