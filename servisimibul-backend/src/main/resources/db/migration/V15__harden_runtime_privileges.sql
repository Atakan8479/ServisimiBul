-- V15: remove excessive Supabase default grants inherited by servisimibul_app.
-- The migration owner (postgres) remains responsible for Flyway and DDL.
-- No Supabase platform roles or default ACLs belonging to supabase_admin are changed.

-- Stop if the reviewed application table inventory has drifted.
DO $$
DECLARE
    actual_names text[];
    expected_names text[] := ARRAY[
        'app_user',
        'content_report',
        'demand',
        'demand_comment',
        'demand_lifecycle_event',
        'demand_service_feedback',
        'demand_support',
        'demand_support_reason',
        'demand_service_publication_event',
        'demand_service_response',
        'district',
        'email_verification_token',
        'moderation_audit_event',
        'moderation_case',
        'neighborhood',
        'operator_application_review',
        'operator_profile',
        'operator_school',
        'operator_school_coverage',
        'password_reset_token',
        'province',
        'school',
        'service_offering',
        'service_offering_coverage',
        'spring_session',
        'spring_session_attributes',
        'vehicle'
    ];
BEGIN
    SELECT array_agg(tablename::text ORDER BY tablename) INTO actual_names
    FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'flyway_schema_history';
    SELECT array_agg(name ORDER BY name) INTO expected_names FROM unnest(expected_names) AS expected(name);
    IF actual_names IS DISTINCT FROM expected_names THEN
        RAISE EXCEPTION 'V15 refused: public application table inventory differs from reviewed V14 schema';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'servisimibul_app' AND rolcanlogin
        AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
        AND NOT rolinherit AND NOT rolbypassrls) THEN
        RAISE EXCEPTION 'V15 refused: missing or elevated runtime role';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM pg_default_acl defaults
        CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
        WHERE defaults.defaclnamespace = 0::oid
          AND defaults.defaclrole = 'postgres'::regrole
          AND defaults.defaclobjtype IN ('r', 'S')
          AND privilege.grantee = 'servisimibul_app'::regrole
    ) THEN
        RAISE EXCEPTION 'V15 refused: global postgres default privileges grant runtime access';
    END IF;
END
$$;

-- ALTER DEFAULT PRIVILEGES is scoped to the creator role + schema.
-- Future tables/sequences need an explicit least-privilege GRANT in their migration.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON TABLES FROM servisimibul_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON SEQUENCES FROM servisimibul_app;

-- First remove *all* inherited direct grants, including on Flyway history.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM servisimibul_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM servisimibul_app;

-- Explicit grants for reviewed application tables; no TRUNCATE/REFERENCES/TRIGGER.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.app_user,
    public.content_report,
    public.demand,
    public.demand_comment,
    public.demand_lifecycle_event,
    public.demand_service_feedback,
    public.demand_support,
    public.demand_support_reason,
    public.demand_service_publication_event,
    public.demand_service_response,
    public.district,
    public.email_verification_token,
    public.moderation_audit_event,
    public.moderation_case,
    public.neighborhood,
    public.operator_application_review,
    public.operator_profile,
    public.operator_school,
    public.operator_school_coverage,
    public.password_reset_token,
    public.province,
    public.school,
    public.service_offering,
    public.service_offering_coverage,
    public.spring_session,
    public.spring_session_attributes,
    public.vehicle
TO servisimibul_app;

-- IDENTITY-backed geography sequences require USAGE + SELECT, not UPDATE.
GRANT USAGE, SELECT ON SEQUENCE
    public.province_id_seq,
    public.district_id_seq,
    public.neighborhood_id_seq
TO servisimibul_app;

-- flyway_schema_history is intentionally excluded from all runtime grants.
