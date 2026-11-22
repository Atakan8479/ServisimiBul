package com.servisimibul.backend.offering;

import com.servisimibul.backend.ServisimibulBackendApplication;
import com.servisimibul.backend.support.IsolatedPostgresTestDatabase;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.health.contributor.Status;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Applies V1-V21 to a scratch disposable database, seeds pre-V22 vehicles, then applies V22 and
 * checks the fail-closed D059 backfill: every pre-existing vehicle has unknown history and stays
 * undeletable, while vehicles created afterwards start with complete history.
 */
class VehicleUsageHistoryMigrationTests {

    private static final String SEED = """
            insert into province (id, code, name) overriding system value values (1, '34', 'Istanbul');
            insert into district (id, province_id, name) overriding system value values (1, 1, 'Kadikoy');
            insert into neighborhood (id, district_id, name) overriding system value values (1, 1, 'Moda');
            insert into school (id, neighborhood_id, name, is_active)
            values ('00000000-0000-0000-0000-000000000101', 1, 'V22 School', true);
            insert into app_user (id, email, password_hash, role, is_enabled, email_verified_at)
            values ('00000000-0000-0000-0000-000000000201', 'v22@example.invalid', 'unused',
                    'OPERATOR', true, now());
            insert into operator_profile
                (id, user_id, business_name, contact_phone, approval_status, is_active, is_publicly_visible)
            values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201',
                    null, '+905551234567', 'APPROVED', true, true);
            insert into operator_school (id, operator_id, school_id, is_active)
            values ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301',
                    '00000000-0000-0000-0000-000000000101', true);
            insert into vehicle (id, operator_id, plate, capacity, is_active) values
                ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000301',
                 '34V22USED', 16, true),
                ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000301',
                 '34V22IDLE', 16, true);
            insert into service_offering (id, operator_school_id, vehicle_id, is_published)
            values ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000401',
                    '00000000-0000-0000-0000-000000000501', false);
            """;

    @Test
    void backfillMarksEveryPreexistingVehicleHistoryUnknownAndKeepsItUndeletable() throws Exception {
        IsolatedPostgresTestDatabase.withScratchDatabase(
                new StandardEnvironment(),
                "v22_backfill",
                (url, user, password) -> {
                    Flyway.configure().dataSource(url, user, password).target("21").load().migrate();
                    try (Connection connection = DriverManager.getConnection(url, user, password)) {
                        connection.createStatement().execute(SEED);

                        assertThatThrownBy(() -> connection.createStatement().executeQuery(
                                VehicleRepository.DELETION_STATE_SELECT + " where false"
                        )).isInstanceOf(SQLException.class)
                                .hasMessageContaining("usage_history_complete")
                                .hasMessageContaining("does not exist");
                    }

                    var dataSource = new DriverManagerDataSource(url, user, password);
                    var schemaHealth = new VehicleUsageSchemaHealthIndicator(
                            new JdbcTemplate(dataSource)
                    );
                    assertThat(schemaHealth.health().getStatus()).isEqualTo(Status.DOWN);
                    assertV21ProbeContract(url, user, password);

                    Flyway.configure().dataSource(url, user, password).target("22").load().migrate();

                    assertThat(schemaHealth.health().getStatus()).isEqualTo(Status.UP);

                    try (Connection connection = DriverManager.getConnection(url, user, password)) {
                        var statement = connection.createStatement();
                        ResultSet rows = statement.executeQuery("""
                                select plate, usage_history_complete, usage_recorded_at is not null
                                from vehicle order by plate
                                """);
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getString(1)).isEqualTo("34V22IDLE");
                        assertThat(rows.getBoolean(2)).isFalse();
                        assertThat(rows.getBoolean(3)).isFalse();
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getString(1)).isEqualTo("34V22USED");
                        assertThat(rows.getBoolean(2)).isFalse();
                        assertThat(rows.getBoolean(3)).isTrue();
                        assertThat(rows.next()).isFalse();

                        // Unknown history blocks even a vehicle with no current reference.
                        assertThatThrownBy(() -> statement.executeUpdate(
                                "delete from vehicle where plate = '34V22IDLE'"
                        )).isInstanceOf(SQLException.class)
                                .hasMessageContaining("cannot be deleted");
                        assertThatThrownBy(() -> statement.executeUpdate(
                                "update vehicle set usage_history_complete = true where plate = '34V22IDLE'"
                        )).isInstanceOf(SQLException.class)
                                .hasMessageContaining("cannot be marked complete");

                        statement.executeUpdate("""
                                insert into vehicle (id, operator_id, plate, capacity)
                                values ('00000000-0000-0000-0000-000000000503',
                                        '00000000-0000-0000-0000-000000000301', '34V22NEW', 8)
                                """);
                        ResultSet created = statement.executeQuery("""
                                select usage_history_complete, usage_recorded_at is null
                                from vehicle where plate = '34V22NEW'
                                """);
                        assertThat(created.next()).isTrue();
                        assertThat(created.getBoolean(1)).isTrue();
                        assertThat(created.getBoolean(2)).isTrue();
                        assertThat(statement.executeUpdate(
                                "delete from vehicle where plate = '34V22NEW'"
                        )).isEqualTo(1);
                    }
                }
        );
    }

    private void assertV21ProbeContract(String url, String user, String password) throws Exception {
        try (var application = new SpringApplicationBuilder(ServisimibulBackendApplication.class)
                .web(WebApplicationType.SERVLET)
                .run(
                        "--spring.profiles.active=local",
                        "--server.address=127.0.0.1",
                        "--server.port=0",
                        "--SB_DB_JDBC_URL=" + url,
                        "--SB_DB_USER=" + user,
                        "--SB_DB_PASSWORD=" + password,
                        "--spring.datasource.url=" + url,
                        "--spring.datasource.username=" + user,
                        "--spring.datasource.password=" + password,
                        "--spring.flyway.enabled=false",
                        "--SB_DEMAND_FEEDBACK_SCHEDULER_ENABLED=false",
                        "--SB_MAIL_ENABLED=false",
                        "--SB_ADMIN_BOOTSTRAP_ENABLED=false",
                        "--management.health.mail.enabled=false"
                )) {
            int port = ((WebServerApplicationContext) application).getWebServer().getPort();
            HttpClient client = HttpClient.newHttpClient();
            assertProbe(client, port, "/readyz", 503, "{\"status\":\"DOWN\"}");
            assertProbe(client, port, "/livez", 200, "{\"status\":\"UP\"}");
        }
    }

    private void assertProbe(
            HttpClient client,
            int port,
            String path,
            int expectedStatus,
            String expectedBody
    ) throws Exception {
        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertThat(response.statusCode()).isEqualTo(expectedStatus);
        assertThat(response.body()).isEqualTo(expectedBody);
    }

    /**
     * Supabase's {@code postgres} default ACL grants EXECUTE on new public functions directly to
     * the Data API roles, which {@code REVOKE ... FROM PUBLIC} alone would not remove. V22 must
     * leave its trigger functions executable by their owner only.
     */
    @Test
    void triggerFunctionsKeepNoExecuteGrantUnderSupabaseStyleDefaultPrivileges() throws Exception {
        IsolatedPostgresTestDatabase.withScratchDatabase(
                new StandardEnvironment(),
                "v22_function_acl",
                (url, user, password) -> {
                    Flyway.configure().dataSource(url, user, password).target("21").load().migrate();
                    try (Connection connection = DriverManager.getConnection(url, user, password)) {
                        connection.createStatement().execute("""
                                do $$
                                declare
                                    grantee text;
                                begin
                                    foreach grantee in array array[
                                        'anon', 'authenticated', 'service_role', 'servisimibul_app'
                                    ] loop
                                        if exists (select 1 from pg_roles where rolname = grantee) then
                                            execute format(
                                                'alter default privileges in schema public '
                                                    || 'grant execute on functions to %I', grantee);
                                        end if;
                                    end loop;
                                end
                                $$;
                                """);
                    }

                    Flyway.configure().dataSource(url, user, password).target("22").load().migrate();

                    try (Connection connection = DriverManager.getConnection(url, user, password)) {
                        ResultSet grants = connection.createStatement().executeQuery("""
                                select count(*)
                                from pg_proc function_info
                                cross join lateral aclexplode(coalesce(
                                    function_info.proacl,
                                    acldefault('f', function_info.proowner)
                                )) privilege
                                where function_info.pronamespace = 'public'::regnamespace
                                  and function_info.proname in (
                                      'record_vehicle_usage',
                                      'protect_vehicle_usage_history',
                                      'guard_vehicle_deletion'
                                  )
                                  and privilege.privilege_type = 'EXECUTE'
                                  and privilege.grantee <> function_info.proowner
                                """);
                        assertThat(grants.next()).isTrue();
                        assertThat(grants.getLong(1)).isZero();
                    }
                }
        );
    }
}
