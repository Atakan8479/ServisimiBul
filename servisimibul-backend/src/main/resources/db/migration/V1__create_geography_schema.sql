DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'servisimibul_app') THEN
        RAISE EXCEPTION 'Required runtime role servisimibul_app must be provisioned outside Flyway';
    END IF;
END
$$;

CREATE TABLE province (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE district (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    province_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    CONSTRAINT district_province_fk
        FOREIGN KEY (province_id) REFERENCES province (id) ON DELETE RESTRICT,
    CONSTRAINT district_province_name_unique UNIQUE (province_id, name)
);

CREATE TABLE neighborhood (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    CONSTRAINT neighborhood_district_fk
        FOREIGN KEY (district_id) REFERENCES district (id) ON DELETE RESTRICT,
    CONSTRAINT neighborhood_district_name_unique UNIQUE (district_id, name)
);

CREATE TABLE school (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    source_name VARCHAR(100),
    source_code VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT school_neighborhood_fk
        FOREIGN KEY (neighborhood_id) REFERENCES neighborhood (id) ON DELETE RESTRICT,
    CONSTRAINT school_source_name_code_unique UNIQUE (source_name, source_code),
    CONSTRAINT school_source_code_requires_name CHECK (source_code IS NULL OR source_name IS NOT NULL)
);

CREATE INDEX school_neighborhood_id_idx ON school (neighborhood_id);

ALTER TABLE province ENABLE ROW LEVEL SECURITY;
ALTER TABLE district ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood ENABLE ROW LEVEL SECURITY;
ALTER TABLE school ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO servisimibul_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON province, district, neighborhood, school TO servisimibul_app;
GRANT USAGE, SELECT ON SEQUENCE province_id_seq, district_id_seq, neighborhood_id_seq TO servisimibul_app;

CREATE POLICY province_backend_access ON province
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY district_backend_access ON district
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY neighborhood_backend_access ON neighborhood
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY school_backend_access ON school
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE province, district, neighborhood, school FROM %I',
                data_api_role
            );
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON SEQUENCE province_id_seq, district_id_seq, neighborhood_id_seq FROM %I',
                data_api_role
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I',
                data_api_role
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
