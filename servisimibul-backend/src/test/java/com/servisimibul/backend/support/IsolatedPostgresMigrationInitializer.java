package com.servisimibul.backend.support;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;

public final class IsolatedPostgresMigrationInitializer
        implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        IsolatedPostgresTestDatabase.validateTargetsAndMigrate(
                applicationContext.getEnvironment()
        );
    }
}
