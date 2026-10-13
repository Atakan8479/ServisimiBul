REVOKE ALL PRIVILEGES ON TABLE public.flyway_schema_history FROM PUBLIC;

DO $$
DECLARE
    application_role TEXT;
BEGIN
    FOREACH application_role IN ARRAY ARRAY['anon', 'authenticated', 'servisimibul_app']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = application_role) THEN
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE public.flyway_schema_history FROM %I',
                application_role
            );
        END IF;
    END LOOP;
END
$$;
