package com.servisimibul.backend.support;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IsolatedPostgresTestDatabaseTests {

    @Test
    void requiresAnExplicitDisposableDatabaseAttestationBeforeConnecting() {
        MockEnvironment environment = baseEnvironment()
                .withProperty("SB_TEST_DB_DISPOSABLE", "false");

        assertUnsafe(environment, "SB_TEST_DB_DISPOSABLE=true");
    }

    @Test
    void rejectsRemoteAdministratorTargetBeforeConnecting() {
        MockEnvironment environment = baseEnvironment()
                .withProperty(
                        "SB_TEST_DB_ADMIN_JDBC_URL",
                        "jdbc:postgresql://db.example.com:5432/servisimibul_ci"
                );

        assertUnsafe(environment, "named loopback database");
    }

    @Test
    void rejectsRuntimeTargetingAnotherLocalDatabaseBeforeConnecting() {
        MockEnvironment environment = baseEnvironment()
                .withProperty(
                        "SB_DB_JDBC_URL",
                        "jdbc:postgresql://localhost:5432/unrelated_database"
                );

        assertUnsafe(environment, "named loopback database");
    }

    @Test
    void rejectsSharedAdministratorAndRuntimeIdentityBeforeConnecting() {
        MockEnvironment environment = baseEnvironment()
                .withProperty("SB_TEST_DB_ADMIN_USER", "servisimibul_app");

        assertUnsafe(environment, "must be distinct");
    }

    private MockEnvironment baseEnvironment() {
        return new MockEnvironment()
                .withProperty("SB_TEST_DB_DISPOSABLE", "true")
                .withProperty("SB_TEST_DATABASE_NAME", "servisimibul_ci")
                .withProperty("SB_TEST_DB_INSTANCE_ID", "test-instance")
                .withProperty(
                        "SB_TEST_DB_ADMIN_JDBC_URL",
                        "jdbc:postgresql://localhost:5432/servisimibul_ci"
                )
                .withProperty("SB_TEST_DB_ADMIN_USER", "postgres")
                .withProperty("SB_TEST_DB_ADMIN_PASSWORD", "administrator-secret")
                .withProperty(
                        "SB_DB_JDBC_URL",
                        "jdbc:postgresql://localhost:5432/servisimibul_ci"
                )
                .withProperty("SB_DB_USER", "servisimibul_app")
                .withProperty("SB_DB_PASSWORD", "runtime-secret");
    }

    private void assertUnsafe(MockEnvironment environment, String expectedMessage) {
        assertThatThrownBy(() -> IsolatedPostgresTestDatabase.validateTargetsAndMigrate(environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(expectedMessage)
                .hasMessageNotContaining("administrator-secret")
                .hasMessageNotContaining("runtime-secret");
    }
}
