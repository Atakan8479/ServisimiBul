package com.servisimibul.backend;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ServisimibulBackendApplicationTests {

    @Autowired
    private Flyway flyway;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void migrationCreatesUsableProtectedGeographySchema() {
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("1");
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

        jdbcTemplate.update("insert into province (code, name) values ('34', 'Istanbul')");
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from province where code = '34'", Integer.class)).isOne();
    }

}
