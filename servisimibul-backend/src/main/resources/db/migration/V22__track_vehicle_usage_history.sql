-- V22 (#295, D059): durable, fail-closed vehicle usage history.
-- A vehicle that any service offering has ever referenced must never be permanently deleted by
-- an operator. Usage is recorded by the database itself, so every write path (service code,
-- offering reassignment, direct SQL) records it, and nothing in the application can clear it.

-- Pre-V22 vehicles get usage_history_complete=false: earlier references (reassigned offerings,
-- deleted school relationships) were never recorded, so their history is unknown (fail closed).
ALTER TABLE vehicle
    ADD COLUMN usage_history_complete BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN usage_recorded_at TIMESTAMPTZ NULL;

UPDATE vehicle
SET usage_recorded_at = now()
WHERE EXISTS (SELECT 1 FROM service_offering offering WHERE offering.vehicle_id = vehicle.id);

-- Only vehicles created from now on start with complete history.
ALTER TABLE vehicle ALTER COLUMN usage_history_complete SET DEFAULT true;

-- Record the first reference whenever an offering is created for, or moved to, a vehicle.
CREATE FUNCTION record_vehicle_usage() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE vehicle
    SET usage_recorded_at = now()
    WHERE id = NEW.vehicle_id
      AND usage_recorded_at IS NULL;
    RETURN NULL;
END
$$;

CREATE TRIGGER service_offering_records_vehicle_usage
    AFTER INSERT OR UPDATE OF vehicle_id ON service_offering
    FOR EACH ROW EXECUTE FUNCTION record_vehicle_usage();

-- Usage history is append-only: it can be recorded but never cleared, rewritten or upgraded.
CREATE FUNCTION protect_vehicle_usage_history() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.usage_history_complete AND NOT OLD.usage_history_complete THEN
        RAISE EXCEPTION 'vehicle usage history cannot be marked complete after the fact'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.usage_recorded_at IS NOT NULL
        AND NEW.usage_recorded_at IS DISTINCT FROM OLD.usage_recorded_at THEN
        RAISE EXCEPTION 'recorded vehicle usage cannot be changed or cleared'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER vehicle_usage_history_append_only
    BEFORE UPDATE OF usage_history_complete, usage_recorded_at ON vehicle
    FOR EACH ROW EXECUTE FUNCTION protect_vehicle_usage_history();

-- Database-level deletion guard (backstop for the backend check). It has no bypass: session
-- settings are not an authorization boundary, so no runtime-role transaction can skip it.
-- Privileged erasure of used vehicles is deferred to the approved LEG-03/APP-11 workflow, which
-- must introduce its own reviewed migration.
CREATE FUNCTION guard_vehicle_deletion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT OLD.usage_history_complete
        OR OLD.usage_recorded_at IS NOT NULL
        OR EXISTS (SELECT 1 FROM service_offering offering WHERE offering.vehicle_id = OLD.id) THEN
        RAISE EXCEPTION 'vehicle % has unknown or recorded offering usage and cannot be deleted', OLD.id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
END
$$;

CREATE TRIGGER vehicle_deletion_guard
    BEFORE DELETE ON vehicle
    FOR EACH ROW EXECUTE FUNCTION guard_vehicle_deletion();

-- Trigger functions are invoked by the trigger mechanism only; no direct EXECUTE for anyone.
-- Firing a trigger does not check EXECUTE, so revoking it changes no write path.
REVOKE ALL ON FUNCTION record_vehicle_usage(), protect_vehicle_usage_history(),
    guard_vehicle_deletion() FROM PUBLIC;

-- Supabase's postgres default ACL grants EXECUTE on new public functions directly to its API
-- roles; REVOKE FROM PUBLIC does not remove those grants, so revoke them by name when present.
DO $$
DECLARE
    function_grantee TEXT;
BEGIN
    FOREACH function_grantee IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'servisimibul_app']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = function_grantee) THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION record_vehicle_usage(), protect_vehicle_usage_history(), '
                    || 'guard_vehicle_deletion() FROM %I',
                function_grantee
            );
        END IF;
    END LOOP;
END
$$;
