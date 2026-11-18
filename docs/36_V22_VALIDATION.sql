-- V22 (#295, D059) read-only pre/post validation. Changes no state.
-- Run with the controlled migration/administration identity against the explicitly confirmed target:
--   psql --no-psqlrc --set ON_ERROR_STOP=1 --set phase=pre  --file docs/36_V22_VALIDATION.sql
--   psql --no-psqlrc --set ON_ERROR_STOP=1 --set phase=post --file docs/36_V22_VALIDATION.sql
-- Record the outputs in the release log. Every row with an `ok` column must report `t`.
-- Outputs are aggregate counts only; no personal data is selected.
-- Read-only is enforced by the explicit transaction below and verified before any other query.
-- Do not rely on PGOPTIONS: the Supabase session pooler ignores startup options.

begin transaction read only;

do $$
begin
    if current_setting('transaction_read_only') <> 'on' then
        raise exception 'Refusing to run V22 validation: transaction is not read-only';
    end if;
end
$$;

select current_database() as database_name,
       current_user as execution_role,
       current_setting('server_version') as server_version,
       pg_is_in_recovery() as is_replica,
       current_setting('transaction_read_only') as transaction_read_only;

select :'phase' = 'pre' as is_pre \gset

-- Write freeze (maintenance window): the runtime backend must be stopped, and no other session
-- may hold a write transaction. Session details are only trustworthy with pg_read_all_stats.
select pg_has_role(current_user, 'pg_read_all_stats', 'usage') as ok,
       'Execution role can see all sessions (pg_read_all_stats)' as check_name
union all
select not exists (select 1 from pg_stat_activity
                   where datname = current_database() and pid <> pg_backend_pid()
                     and usename = 'servisimibul_app'),
       'Write freeze: no runtime application (servisimibul_app) sessions'
union all
select not exists (select 1 from pg_stat_activity
                   where datname = current_database() and pid <> pg_backend_pid()
                     and backend_xid is not null),
       'Write freeze: no other session holds a write transaction';

-- Aggregate baseline; compare the pre and post values: they must be identical.
select (select count(*) from vehicle) as vehicles,
       (select count(*) from vehicle where not is_active) as inactive_vehicles,
       (select count(distinct vehicle_id) from service_offering) as vehicles_referenced_now,
       (select count(*) from service_offering) as service_offerings,
       (select count(*) from service_offering where is_published) as published_offerings;

\if :is_pre
-- Expected: Flyway at exactly V21, no failed rows, and no V22 object present yet.
select (select max(version::int) from flyway_schema_history where success) = 21 as ok,
       'Flyway latest successful version is 21' as check_name
union all
select not exists (select 1 from flyway_schema_history where not success),
       'No failed Flyway rows'
union all
select not exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'vehicle'
             and column_name in ('usage_history_complete', 'usage_recorded_at')),
       'V22 vehicle columns absent'
union all
select not exists (
           select 1 from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('record_vehicle_usage', 'protect_vehicle_usage_history',
                             'guard_vehicle_deletion')),
       'V22 functions absent'
union all
select not exists (
           select 1 from pg_trigger
           where tgname in ('service_offering_records_vehicle_usage',
                            'vehicle_usage_history_append_only', 'vehicle_deletion_guard')),
       'V22 triggers absent'
union all
select exists (
           select 1 from pg_tables
           where schemaname = 'public' and tablename = 'vehicle'
             and tableowner = current_user)
       and exists (
           select 1 from pg_tables
           where schemaname = 'public' and tablename = 'service_offering'
             and tableowner = current_user),
       'Execution role owns vehicle and service_offering (required for ALTER TABLE/CREATE TRIGGER)'
union all
select has_schema_privilege('public', 'CREATE'),
       'Execution role can create functions in schema public';
\else
-- Expected after V22: every pre-existing vehicle is history-unknown (never operator-deletable),
-- every currently referenced vehicle has recorded usage, and the guards are installed.
select (select max(version::int) from flyway_schema_history where success) = 22 as ok,
       'Flyway latest successful version is 22' as check_name
union all
select not exists (select 1 from flyway_schema_history where not success),
       'No failed Flyway rows'
union all
select not exists (
           select 1 from vehicle
           where usage_history_complete
             and created_at <= (select installed_on from flyway_schema_history
                                where version = '22' and success)),
       'No vehicle that existed before V22 has complete history (fail closed)'
union all
select not exists (
           select 1 from vehicle
           where usage_recorded_at is null
             and exists (select 1 from service_offering offering
                         where offering.vehicle_id = vehicle.id)),
       'Every currently referenced vehicle has recorded usage'
union all
select (select count(*) from pg_trigger
        where not tgisinternal and tgenabled = 'O'
          and tgname in ('service_offering_records_vehicle_usage',
                         'vehicle_usage_history_append_only', 'vehicle_deletion_guard')) = 3,
       'Three V22 triggers installed and enabled'
union all
select not exists (
           select 1
           from pg_proc function_info
           cross join lateral aclexplode(coalesce(
               function_info.proacl, acldefault('f', function_info.proowner))) privilege
           where function_info.pronamespace = 'public'::regnamespace
             and function_info.proname in ('record_vehicle_usage', 'protect_vehicle_usage_history',
                                           'guard_vehicle_deletion')
             and privilege.privilege_type = 'EXECUTE'
             and privilege.grantee <> function_info.proowner),
       'V22 trigger functions executable by owner only'
union all
select has_table_privilege('servisimibul_app', 'public.vehicle', 'SELECT,INSERT,UPDATE,DELETE')
       and not has_table_privilege('servisimibul_app', 'public.vehicle', 'TRUNCATE')
       and not exists (select 1 from pg_tables
                       where schemaname = 'public' and tablename = 'vehicle'
                         and tableowner = 'servisimibul_app'),
       'Runtime role grants unchanged: DML only, no TRUNCATE, not owner';

select count(*) filter (where not usage_history_complete) as history_unknown_vehicles,
       count(*) filter (where usage_recorded_at is not null) as usage_recorded_vehicles,
       count(*) filter (where usage_history_complete and usage_recorded_at is null) as deletable_candidates
from vehicle;
\endif

rollback;
