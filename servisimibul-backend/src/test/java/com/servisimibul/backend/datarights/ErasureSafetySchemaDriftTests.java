package com.servisimibul.backend.datarights;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Mutates only a guarded disposable PostgreSQL schema and restores every constraint in finally. */
@SpringBootTest
@ResourceLock("app-user-foreign-key-schema")
class ErasureSafetySchemaDriftTests {

    private static final String CONSTRAINT = "demand_created_by_fk";
    private static final String DROP = "alter table demand drop constraint " + CONSTRAINT;
    private static final String ADD_RESTRICT = "alter table demand add constraint " + CONSTRAINT
            + " foreign key (created_by) references app_user (id) on delete restrict";

    @Autowired private ErasureSafetyPlanAssembler assembler;
    @Value("${spring.flyway.url}") private String adminUrl;
    @Value("${spring.flyway.user}") private String adminUser;
    @Value("${spring.flyway.password}") private String adminPassword;

    @Test
    void missingForeignKeyFailsClosedAndIsRestored() throws Exception {
        assertSchemaDrift(DROP);
    }

    @Test
    void renamedForeignKeyFailsClosedAndIsRestored() throws Exception {
        assertSchemaDrift(
                "alter table demand rename constraint " + CONSTRAINT + " to demand_created_by_fk_changed");
    }

    @Test
    void modifiedDeleteRuleFailsClosedAndIsRestored() throws Exception {
        assertSchemaDrift(
                DROP,
                "alter table demand add constraint " + CONSTRAINT
                        + " foreign key (created_by) references app_user (id) on delete cascade"
        );
    }

    private void assertSchemaDrift(String... mutations) throws Exception {
        requireDisposableDatabase();
        try {
            for (String mutation : mutations) {
                execute(mutation);
            }
            assertThatThrownBy(() -> assembler.assemble(UUID.randomUUID(), UUID.randomUUID()))
                    .isInstanceOfSatisfying(DataRightsApiException.class,
                            failure -> assertThat(failure.code()).isEqualTo("erasure_plan_schema_drift"));
        } finally {
            restoreBaseline();
        }
        assertThat(deleteRule()).isEqualTo("RESTRICT");
    }

    private void restoreBaseline() throws Exception {
        execute("alter table demand drop constraint if exists demand_created_by_fk_changed");
        execute("alter table demand drop constraint if exists " + CONSTRAINT);
        execute(ADD_RESTRICT);
    }

    private void execute(String sql) throws Exception {
        try (Connection connection = DriverManager.getConnection(adminUrl, adminUser, adminPassword);
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private String deleteRule() throws Exception {
        try (Connection connection = DriverManager.getConnection(adminUrl, adminUser, adminPassword);
             var statement = connection.prepareStatement("""
                     select delete_rule
                     from information_schema.referential_constraints
                     where constraint_schema = current_schema() and constraint_name = ?
                     """)) {
            statement.setString(1, CONSTRAINT);
            try (var result = statement.executeQuery()) {
                assertThat(result.next()).isTrue();
                return result.getString(1);
            }
        }
    }

    private static void requireDisposableDatabase() {
        assertThat(System.getenv("SB_TEST_DB_DISPOSABLE")).isEqualToIgnoringCase("true");
        assertThat(System.getenv("SB_TEST_DATABASE_NAME")).isEqualTo("servisimibul_a12");
    }
}
