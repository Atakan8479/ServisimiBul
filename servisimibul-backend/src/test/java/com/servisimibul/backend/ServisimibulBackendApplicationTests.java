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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ServisimibulBackendApplicationTests {

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
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("6");
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
}
