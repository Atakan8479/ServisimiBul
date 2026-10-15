package com.servisimibul.backend;

import com.servisimibul.backend.geography.District;
import com.servisimibul.backend.geography.DistrictRepository;
import com.servisimibul.backend.geography.Neighborhood;
import com.servisimibul.backend.geography.NeighborhoodRepository;
import com.servisimibul.backend.geography.Province;
import com.servisimibul.backend.geography.ProvinceRepository;
import com.servisimibul.backend.geography.School;
import com.servisimibul.backend.geography.SchoolRepository;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ServisimibulBackendApplicationTests {

    private static final List<String> APPLICATION_TABLES = List.of(
            "app_user",
            "district",
            "email_verification_token",
            "neighborhood",
            "operator_application_review",
            "operator_profile",
            "operator_school",
            "operator_school_coverage",
            "password_reset_token",
            "province",
            "school",
            "service_offering",
            "service_offering_coverage",
            "spring_session",
            "spring_session_attributes",
            "vehicle"
    );

    private static final List<String> APPLICATION_SEQUENCES = List.of(
            "district_id_seq",
            "neighborhood_id_seq",
            "province_id_seq"
    );

    private static final List<String> PUBLIC_DATABASE_ROLES = List.of(
            "anon",
            "authenticated"
    );

    @Autowired
    private Flyway flyway;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ProvinceRepository provinceRepository;

    @Autowired
    private DistrictRepository districtRepository;

    @Autowired
    private NeighborhoodRepository neighborhoodRepository;

    @Autowired
    private SchoolRepository schoolRepository;

    @Test
    @Transactional
    void migrationCreatesUsableProtectedGeographySchema() {
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("8");
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(jdbcTemplate.queryForObject("select current_user", String.class))
                .isEqualTo("servisimibul_app");
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_class table_info
                join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                where schema_info.nspname = 'public'
                  and table_info.relname in ('province', 'district', 'neighborhood', 'school')
                  and table_info.relrowsecurity
                """, Integer.class)).isEqualTo(4);
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename in ('province', 'district', 'neighborhood', 'school')
                  and roles = array['servisimibul_app']::name[]
                """, Integer.class)).isEqualTo(4);
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('anon', 'public.province', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('authenticated', 'public.province', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_class table_info
                join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                where schema_info.nspname = 'public'
                  and table_info.relname in (
                      'app_user',
                      'operator_profile',
                      'email_verification_token',
                      'password_reset_token',
                      'operator_application_review'
                  )
                  and table_info.relrowsecurity
                """, Integer.class)).isEqualTo(5);
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename in (
                      'app_user',
                      'operator_profile',
                      'email_verification_token',
                      'password_reset_token',
                      'operator_application_review'
                  )
                  and roles = array['servisimibul_app']::name[]
                """, Integer.class)).isEqualTo(5);
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('anon', 'public.app_user', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('authenticated', 'public.app_user', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_class table_info
                join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                where schema_info.nspname = 'public'
                  and table_info.relname in ('spring_session', 'spring_session_attributes')
                  and table_info.relrowsecurity
                """, Integer.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename in ('spring_session', 'spring_session_attributes')
                  and roles = array['servisimibul_app']::name[]
                """, Integer.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('anon', 'public.spring_session', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('authenticated', 'public.spring_session', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_class table_info
                join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                where schema_info.nspname = 'public'
                  and table_info.relname in ('operator_school', 'operator_school_coverage')
                  and table_info.relrowsecurity
                """, Integer.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename in ('operator_school', 'operator_school_coverage')
                  and roles = array['servisimibul_app']::name[]
                """, Integer.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('anon', 'public.operator_school', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('authenticated', 'public.operator_school', 'SELECT')", Boolean.class))
                .isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('servisimibul_app', 'public.operator_school', 'SELECT')", Boolean.class))
                .isTrue();
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_class table_info
                join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                where schema_info.nspname = 'public'
                  and table_info.relname in ('vehicle', 'service_offering')
                  and table_info.relrowsecurity
                """, Integer.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename in ('vehicle', 'service_offering')
                  and roles = array['servisimibul_app']::name[]
                """, Integer.class)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('anon', 'public.vehicle', 'SELECT')", Boolean.class)).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('authenticated', 'public.service_offering', 'SELECT')", Boolean.class))
                .isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('servisimibul_app', 'public.vehicle', 'SELECT')", Boolean.class))
                .isTrue();
        assertThat(jdbcTemplate.queryForObject("""
                select relrowsecurity
                from pg_class table_info
                join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                where schema_info.nspname = 'public'
                  and table_info.relname = 'service_offering_coverage'
                """, Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename = 'service_offering_coverage'
                  and roles = array['servisimibul_app']::name[]
                """, Integer.class)).isOne();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('anon', 'public.service_offering_coverage', 'SELECT')",
                Boolean.class
        )).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('authenticated', 'public.service_offering_coverage', 'SELECT')",
                Boolean.class
        )).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege('servisimibul_app', 'public.service_offering_coverage', 'SELECT')",
                Boolean.class
        )).isTrue();
        assertThat(jdbcTemplate.queryForObject("""
                select is_nullable
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'operator_profile'
                  and column_name = 'business_name'
                """, String.class)).isEqualTo("YES");

        jdbcTemplate.update("insert into province (code, name) values ('34', 'Istanbul')");
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from province where code = '34'", Integer.class)).isOne();
    }

    @Test
    void applicationRolesCannotAccessFlywayHistory() {
        assertThat(hasAnyFlywayHistoryPrivilege("anon")).isFalse();
        assertThat(hasAnyFlywayHistoryPrivilege("authenticated")).isFalse();
        assertThat(hasAnyFlywayHistoryPrivilege("servisimibul_app")).isFalse();

        assertThatThrownBy(() -> jdbcTemplate.queryForObject(
                "select count(*) from public.flyway_schema_history", Integer.class
        )).isInstanceOf(DataAccessException.class);
    }

    @Test
    void everyApplicationTableAndSequenceHasTheExactSecurityContract() {
        assertThat(jdbcTemplate.queryForList("""
                select tablename
                from pg_tables
                where schemaname = 'public'
                  and tablename <> 'flyway_schema_history'
                order by tablename
                """, String.class)).containsExactlyElementsOf(APPLICATION_TABLES);

        assertThat(jdbcTemplate.queryForList("""
                select sequencename
                from pg_sequences
                where schemaname = 'public'
                order by sequencename
                """, String.class)).containsExactlyElementsOf(APPLICATION_SEQUENCES);

        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_class table_info
                join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
                where schema_info.nspname = 'public'
                  and table_info.relname = any (?::text[])
                  and table_info.relrowsecurity
                  and pg_get_userbyid(table_info.relowner) <> 'servisimibul_app'
                """, Integer.class, (Object) APPLICATION_TABLES.toArray(String[]::new)))
                .isEqualTo(APPLICATION_TABLES.size());

        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename = any (?::text[])
                  and roles = array['servisimibul_app']::name[]
                  and cmd = 'ALL'
                  and permissive = 'PERMISSIVE'
                  and qual = 'true'
                  and with_check = 'true'
                """, Integer.class, (Object) APPLICATION_TABLES.toArray(String[]::new)))
                .isEqualTo(APPLICATION_TABLES.size());

        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and tablename = any (?::text[])
                """, Integer.class, (Object) APPLICATION_TABLES.toArray(String[]::new)))
                .isEqualTo(APPLICATION_TABLES.size());

        APPLICATION_TABLES.forEach(table -> {
            assertTablePrivileges("servisimibul_app", table, true);
            PUBLIC_DATABASE_ROLES.forEach(role -> assertTablePrivileges(role, table, false));
        });
        APPLICATION_SEQUENCES.forEach(sequence -> {
            assertThat(hasSequencePrivilege("servisimibul_app", sequence, "USAGE")).isTrue();
            assertThat(hasSequencePrivilege("servisimibul_app", sequence, "SELECT")).isTrue();
            assertThat(hasSequencePrivilege("servisimibul_app", sequence, "UPDATE")).isFalse();
            PUBLIC_DATABASE_ROLES.forEach(role -> {
                assertThat(hasSequencePrivilege(role, sequence, "USAGE")).isFalse();
                assertThat(hasSequencePrivilege(role, sequence, "SELECT")).isFalse();
                assertThat(hasSequencePrivilege(role, sequence, "UPDATE")).isFalse();
            });
        });

        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from pg_class object_info
                join pg_namespace schema_info on schema_info.oid = object_info.relnamespace
                cross join lateral aclexplode(coalesce(
                    object_info.relacl,
                    acldefault(
                        case when object_info.relkind = 'S' then 'S'::"char" else 'r'::"char" end,
                        object_info.relowner
                    )
                )) privilege
                where schema_info.nspname = 'public'
                  and (
                      object_info.relname = any (?::text[])
                      or object_info.relname = any (?::text[])
                  )
                  and privilege.grantee = 0
                """, Integer.class,
                (Object) APPLICATION_TABLES.toArray(String[]::new),
                (Object) APPLICATION_SEQUENCES.toArray(String[]::new)))
                .isZero();

        assertThat(jdbcTemplate.queryForObject("""
                select count(*)
                from information_schema.role_table_grants
                where grantee = 'servisimibul_app'
                  and table_schema = 'public'
                  and table_name = any (?::text[])
                  and is_grantable = 'YES'
                """, Integer.class, (Object) APPLICATION_TABLES.toArray(String[]::new)))
                .isZero();

        assertThat(jdbcTemplate.queryForObject("""
                select not rolsuper
                       and not rolcreatedb
                       and not rolcreaterole
                       and not rolinherit
                       and not rolbypassrls
                from pg_roles
                where rolname = 'servisimibul_app'
                """, Boolean.class)).isTrue();
    }

    @Test
    void everyResolvedMigrationIsAppliedSuccessfullyAndReplayIsANoOp() {
        var migrations = Arrays.stream(flyway.info().all())
                .filter(migration -> migration.getVersion() != null)
                .toList();

        assertThat(migrations.stream()
                .map(migration -> migration.getVersion().getVersion())
                .toList()).containsExactly("1", "2", "3", "4", "5", "6", "7", "8");
        assertThat(migrations).allMatch(migration -> migration.getState() == MigrationState.SUCCESS);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
    }

    @Test
    @Transactional
    void repositoriesPersistGeographyAndEnforceSchoolSourceIdentity() {
        Province province = provinceRepository.save(new Province("34", "Istanbul"));
        District district = districtRepository.save(new District(province, "Kadikoy"));
        Neighborhood neighborhood = neighborhoodRepository.save(new Neighborhood(district, "Caferaga"));
        School school = schoolRepository.saveAndFlush(
                new School(neighborhood, "Example School", "Example address", "MEB", "123")
        );

        assertThat(school.getId()).isNotNull();
        assertThat(school.isActive()).isTrue();
        assertThat(school.getNeighborhood().getDistrict().getProvince().getCode()).isEqualTo("34");

        assertThatThrownBy(() -> schoolRepository.saveAndFlush(
                new School(neighborhood, "Duplicate Source School", null, "MEB", "123")
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    private boolean hasAnyFlywayHistoryPrivilege(String role) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                select bool_or(has_table_privilege(?, 'public.flyway_schema_history', privilege_name))
                from unnest(array[
                    'SELECT', 'INSERT', 'UPDATE', 'DELETE',
                    'TRUNCATE', 'REFERENCES', 'TRIGGER'
                ]) as privilege_name
                """, Boolean.class, role));
    }

    private void assertTablePrivileges(String role, String table, boolean runtimeAccessExpected) {
        List<String> runtimePrivileges = List.of("SELECT", "INSERT", "UPDATE", "DELETE");
        List<String> forbiddenPrivileges = List.of("TRUNCATE", "REFERENCES", "TRIGGER");
        runtimePrivileges.forEach(privilege -> assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege(?, ?, ?)",
                Boolean.class,
                role,
                "public." + table,
                privilege
        )).as("%s %s on %s", role, privilege, table).isEqualTo(runtimeAccessExpected));
        forbiddenPrivileges.forEach(privilege -> assertThat(jdbcTemplate.queryForObject(
                "select has_table_privilege(?, ?, ?)",
                Boolean.class,
                role,
                "public." + table,
                privilege
        )).as("%s must not have %s on %s", role, privilege, table).isFalse());
    }

    private boolean hasSequencePrivilege(String role, String sequence, String privilege) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "select has_sequence_privilege(?, ?, ?)",
                Boolean.class,
                role,
                "public." + sequence,
                privilege
        ));
    }
}
