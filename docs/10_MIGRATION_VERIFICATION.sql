-- A-09 read-only post-migration verification for the repository's V1-V16 schema.
-- Run as the controlled migration/administration identity against the explicitly
-- confirmed target. Every row must report PASS. This script changes no state.

begin transaction read only;

select
    current_database() as database_name,
    current_user as execution_role,
    current_setting('server_version') as server_version,
    pg_is_in_recovery() as is_replica;

with
expected_tables(table_name) as (
    values
        ('app_user'),
        ('content_report'),
        ('demand'),
        ('demand_comment'),
        ('demand_lifecycle_event'),
        ('demand_service_feedback'),
        ('demand_support'),
        ('demand_support_reason'),
        ('demand_service_publication_event'),
        ('demand_service_response'),
        ('district'),
        ('email_verification_token'),
        ('in_app_notification'),
        ('moderation_audit_event'),
        ('moderation_case'),
        ('neighborhood'),
        ('operator_application_review'),
        ('operator_profile'),
        ('operator_school'),
        ('operator_school_coverage'),
        ('password_reset_token'),
        ('province'),
        ('school'),
        ('service_offering'),
        ('service_offering_coverage'),
        ('spring_session'),
        ('spring_session_attributes'),
        ('vehicle')
),
expected_sequences(sequence_name) as (
    values
        ('district_id_seq'),
        ('neighborhood_id_seq'),
        ('province_id_seq')
),
actual_tables as (
    select tablename::text as table_name
    from pg_tables
    where schemaname = 'public'
      and tablename <> 'flyway_schema_history'
),
actual_sequences as (
    select sequencename::text as sequence_name
    from pg_sequences
    where schemaname = 'public'
),
checks(sort_order, check_name, passed, detail) as (
    select 10,
           'primary PostgreSQL 17 target',
           current_setting('server_version_num')::integer between 170000 and 179999
               and not pg_is_in_recovery(),
           format('database=%s role=%s version=%s replica=%s',
                  current_database(), current_user, current_setting('server_version'), pg_is_in_recovery())

    union all
    select 20,
           'Flyway versions V1-V16 applied successfully',
           coalesce((
               select array_agg(version order by installed_rank) filter (where success)
               from public.flyway_schema_history
               where version is not null
           ), array[]::varchar[]) = array['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16']::varchar[]
           and not exists (
               select 1 from public.flyway_schema_history where not success
           ),
           coalesce((
               select string_agg(format('V%s:%s', version, success), ', ' order by installed_rank)
               from public.flyway_schema_history
               where version is not null
           ), 'no versioned history')

    union all
    select 30,
           'exact application table inventory',
           array(select table_name from actual_tables order by table_name)
               = array(select table_name from expected_tables order by table_name),
           format('actual=%s expected=%s',
                  (select count(*) from actual_tables),
                  (select count(*) from expected_tables))

    union all
    select 40,
           'exact application sequence inventory',
           array(select sequence_name from actual_sequences order by sequence_name)
               = array(select sequence_name from expected_sequences order by sequence_name),
           format('actual=%s expected=%s',
                  (select count(*) from actual_sequences),
                  (select count(*) from expected_sequences))

    union all
    select 50,
           'RLS enabled on every application table',
           not exists (
               select 1
               from expected_tables expected
               left join pg_class table_info on table_info.relname = expected.table_name
               left join pg_namespace schema_info
                   on schema_info.oid = table_info.relnamespace and schema_info.nspname = 'public'
               where table_info.oid is null or schema_info.oid is null or not table_info.relrowsecurity
           ),
           format('RLS-enabled=%s expected=%s',
                  (select count(*)
                   from pg_class table_info
                   join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                   join expected_tables expected on expected.table_name = table_info.relname
                   where schema_info.nspname = 'public' and table_info.relrowsecurity),
                  (select count(*) from expected_tables))

    union all
    select 60,
           'exact runtime RLS policies',
           (select count(*) from pg_policies policy
            join expected_tables expected on expected.table_name = policy.tablename
            where policy.schemaname = 'public') = (select count(*) from expected_tables)
           and not exists (
               select 1
               from pg_policies policy
               join expected_tables expected on expected.table_name = policy.tablename
               where policy.schemaname = 'public'
                 and not (
                     policy.roles = array['servisimibul_app']::name[]
                     and policy.cmd = 'ALL'
                     and policy.permissive = 'PERMISSIVE'
                     and policy.qual = 'true'
                     and policy.with_check = 'true'
                 )
           ),
           format('policy-count=%s expected=%s',
                  (select count(*) from pg_policies policy
                   join expected_tables expected on expected.table_name = policy.tablename
                   where policy.schemaname = 'public'),
                  (select count(*) from expected_tables))

    union all
    select 70,
           'runtime role is restricted',
           coalesce((
               select not rolsuper
                      and not rolcreatedb
                      and not rolcreaterole
                      and not rolinherit
                      and not rolbypassrls
               from pg_roles
               where rolname = 'servisimibul_app'
           ), false),
           case when exists (select 1 from pg_roles where rolname = 'servisimibul_app')
                then 'servisimibul_app exists'
                else 'servisimibul_app is missing'
           end

    union all
    select 80,
           'runtime role has exact table privileges',
           not exists (
               select 1
               from actual_tables
               where not has_table_privilege('servisimibul_app', format('public.%I', table_name), 'SELECT')
                  or not has_table_privilege('servisimibul_app', format('public.%I', table_name), 'INSERT')
                  or not has_table_privilege('servisimibul_app', format('public.%I', table_name), 'UPDATE')
                  or not has_table_privilege('servisimibul_app', format('public.%I', table_name), 'DELETE')
                  or has_table_privilege('servisimibul_app', format('public.%I', table_name), 'TRUNCATE')
                  or has_table_privilege('servisimibul_app', format('public.%I', table_name), 'REFERENCES')
                  or has_table_privilege('servisimibul_app', format('public.%I', table_name), 'TRIGGER')
           )
           and not exists (
               select 1 from pg_default_acl defaults
               cross join lateral aclexplode(defaults.defaclacl) privilege
               where defaults.defaclnamespace in (0::oid, 'public'::regnamespace)
                 and defaults.defaclrole = 'postgres'::regrole
                 and defaults.defaclobjtype in ('r', 'S')
                 and privilege.grantee = 'servisimibul_app'::regrole
           ),
           'requires SELECT, INSERT, UPDATE, DELETE only; no global/schema runtime default ACL'

    union all
    select 90,
           'public API roles have no direct table privileges',
           not exists (
               select 1
               from actual_tables
               cross join (values ('anon'), ('authenticated')) role_names(role_name)
               where has_table_privilege(role_name, format('public.%I', table_name),
                                         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           )
           and not exists (
               select 1
               from pg_class object_info
               join pg_namespace schema_info on schema_info.oid = object_info.relnamespace
               join actual_tables actual on actual.table_name = object_info.relname
               cross join lateral aclexplode(coalesce(
                   object_info.relacl,
                   acldefault('r'::"char", object_info.relowner)
               )) privilege
               where schema_info.nspname = 'public'
                 and privilege.grantee = 0
           ),
           'roles=PUBLIC,anon,authenticated'

    union all
    select 100,
           'sequence privileges are least-privilege',
           not exists (
               select 1
               from expected_sequences
               where not has_sequence_privilege('servisimibul_app', format('public.%I', sequence_name), 'USAGE')
                  or not has_sequence_privilege('servisimibul_app', format('public.%I', sequence_name), 'SELECT')
                  or has_sequence_privilege('servisimibul_app', format('public.%I', sequence_name), 'UPDATE')
           )
           and not exists (
               select 1
               from expected_sequences
               cross join (values ('anon'), ('authenticated')) role_names(role_name)
               where has_sequence_privilege(role_name, format('public.%I', sequence_name), 'USAGE,SELECT,UPDATE')
           )
           and not exists (
               select 1
               from pg_class object_info
               join pg_namespace schema_info on schema_info.oid = object_info.relnamespace
               join expected_sequences expected on expected.sequence_name = object_info.relname
               cross join lateral aclexplode(coalesce(
                   object_info.relacl,
                   acldefault('S'::"char", object_info.relowner)
               )) privilege
               where schema_info.nspname = 'public'
                 and privilege.grantee = 0
           ),
           'runtime=USAGE+SELECT; public API roles=none'

    union all
    select 110,
           'Flyway history is protected',
           not has_table_privilege('servisimibul_app', 'public.flyway_schema_history',
                                   'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           and not has_table_privilege('anon', 'public.flyway_schema_history',
                                       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           and not has_table_privilege('authenticated', 'public.flyway_schema_history',
                                       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           and not exists (
               select 1
               from pg_class object_info
               join pg_namespace schema_info on schema_info.oid = object_info.relnamespace
               cross join lateral aclexplode(coalesce(
                   object_info.relacl,
                   acldefault('r'::"char", object_info.relowner)
               )) privilege
               where schema_info.nspname = 'public'
                 and object_info.relname = 'flyway_schema_history'
                 and privilege.grantee = 0
           ),
           'RLS is not relied upon; direct privileges must be absent'

    union all
    select 120,
           'operator business name remains nullable',
           coalesce((
               select is_nullable = 'YES'
               from information_schema.columns
               where table_schema = 'public'
                 and table_name = 'operator_profile'
                 and column_name = 'business_name'
           ), false),
           'public.operator_profile.business_name'

    union all
    select 130,
           'session expiry cleanup index exists',
           to_regclass('public.spring_session_expiry_time_idx') is not null,
           'public.spring_session_expiry_time_idx'
)
select check_name,
       case when passed then 'PASS' else 'FAIL' end as result,
       detail
from checks
order by sort_order;

rollback;
