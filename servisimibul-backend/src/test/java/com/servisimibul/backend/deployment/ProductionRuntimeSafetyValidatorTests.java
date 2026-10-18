package com.servisimibul.backend.deployment;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionRuntimeSafetyValidatorTests {

    @Test
    void acceptsRestrictedProductionRuntimeWithoutMigrationConfiguration() {
        MockEnvironment environment = safeProductionEnvironment();

        assertThatCode(() -> new ProductionRuntimeSafetyValidator().validate(environment))
                .doesNotThrowAnyException();
    }

    @Test
    void preservesTheAuthorizedNonProductionMigrationProfile() {
        MockEnvironment environment = safeProductionEnvironment();
        environment.setActiveProfiles("migration");
        environment.withProperty("spring.flyway.enabled", "true")
                .withProperty("spring.flyway.user", "migration-user");

        assertThatCode(() -> new ProductionRuntimeSafetyValidator().validate(environment))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsFlywayInProductionRuntime() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("spring.flyway.enabled", "true");

        assertUnsafe(environment, "Flyway must be disabled");
    }

    @Test
    void rejectsEffectiveMigrationConnectionSettingsInProductionRuntime() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("spring.flyway.user", "migration-user");

        assertUnsafe(environment, "Migration connection settings");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "SB_DB_MIGRATION_JDBC_URL",
            "SB_DB_MIGRATION_USER",
            "SB_DB_MIGRATION_PASSWORD"
    })
    void rejectsInjectedMigrationSecretsEvenWhenFlywaySettingsAreMasked(String property) {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty(property, "must-not-appear-in-error");

        assertUnsafe(environment, "must not be injected");
    }

    @Test
    void rejectsAdministrativeDatabaseUserInProductionRuntime() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("spring.datasource.username", "postgres");

        assertUnsafe(environment, "restricted runtime database role");
    }

    @Test
    void rejectsCombiningProductionAndMigrationProfiles() {
        MockEnvironment environment = safeProductionEnvironment();
        environment.setActiveProfiles("prod", "migration");

        assertUnsafe(environment, "cannot be active together");
    }

    private MockEnvironment safeProductionEnvironment() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.flyway.enabled", "false")
                .withProperty("spring.flyway.url", "")
                .withProperty("spring.flyway.user", "")
                .withProperty("spring.flyway.password", "")
                .withProperty("spring.datasource.username", "servisimibul_app");
        environment.setActiveProfiles("prod");
        return environment;
    }

    private void assertUnsafe(MockEnvironment environment, String expectedMessage) {
        assertThatThrownBy(() -> new ProductionRuntimeSafetyValidator().validate(environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(expectedMessage)
                .hasMessageNotContaining("migration-user")
                .hasMessageNotContaining("postgres-password")
                .hasMessageNotContaining("must-not-appear-in-error");
    }
}
