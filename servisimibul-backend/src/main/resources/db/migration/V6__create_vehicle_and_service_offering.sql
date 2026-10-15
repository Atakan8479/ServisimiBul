CREATE TABLE vehicle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL,
    plate TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_operator_fk
        FOREIGN KEY (operator_id) REFERENCES operator_profile (id) ON DELETE RESTRICT,
    CONSTRAINT vehicle_plate_unique UNIQUE (plate),
    CONSTRAINT vehicle_plate_canonical CHECK (
        length(plate) > 0
        AND plate = upper(regexp_replace(plate, '[[:space:]-]+', '', 'g'))
    ),
    CONSTRAINT vehicle_capacity_positive CHECK (capacity > 0)
);

CREATE TABLE service_offering (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_school_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    available_seats INTEGER,
    description TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT service_offering_operator_school_fk
        FOREIGN KEY (operator_school_id) REFERENCES operator_school (id) ON DELETE CASCADE,
    CONSTRAINT service_offering_vehicle_fk
        FOREIGN KEY (vehicle_id) REFERENCES vehicle (id) ON DELETE RESTRICT,
    CONSTRAINT service_offering_available_seats_nonnegative
        CHECK (available_seats IS NULL OR available_seats >= 0)
);

CREATE INDEX vehicle_operator_id_idx ON vehicle (operator_id);
CREATE INDEX service_offering_operator_school_id_idx ON service_offering (operator_school_id);
CREATE INDEX service_offering_vehicle_id_idx ON service_offering (vehicle_id);

ALTER TABLE vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_offering ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE vehicle, service_offering FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vehicle, service_offering
TO servisimibul_app;

CREATE POLICY vehicle_backend_access ON vehicle
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);
CREATE POLICY service_offering_backend_access ON service_offering
    FOR ALL TO servisimibul_app USING (true) WITH CHECK (true);

DO $$
DECLARE
    data_api_role TEXT;
BEGIN
    FOREACH data_api_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE vehicle, service_offering FROM %I',
                data_api_role
            );
        END IF;
    END LOOP;
END
$$;
