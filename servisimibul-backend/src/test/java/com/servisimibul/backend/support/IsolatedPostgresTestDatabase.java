package com.servisimibul.backend.support;

import org.flywaydb.core.Flyway;
import org.springframework.core.env.Environment;

import java.net.InetAddress;
import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Set;

public final class IsolatedPostgresTestDatabase {

    private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "::1");
    private static final String MARKER_QUERY = """
            select current_database(), current_user, inet_server_addr()::text,
                   current_setting('server_version_num')::integer,
                   (select count(*)
                    from test_harness.database_instance
                    where instance_id = ?)
            """;

    private IsolatedPostgresTestDatabase() {
    }

    public static void validateTargetsAndMigrate(Environment environment) {
        requireDisposable(environment);
        String expectedDatabase = requiredSafeIdentifier(environment, "SB_TEST_DATABASE_NAME");
        String expectedMarker = required(environment, "SB_TEST_DB_INSTANCE_ID");

        ConnectionSettings administrator = settings(
                environment,
                "SB_TEST_DB_ADMIN_JDBC_URL",
                "SB_TEST_DB_ADMIN_USER",
                "SB_TEST_DB_ADMIN_PASSWORD"
        );
        ConnectionSettings runtime = settings(
                environment,
                "SB_DB_JDBC_URL",
                "SB_DB_USER",
                "SB_DB_PASSWORD"
        );
        if (!"servisimibul_app".equals(runtime.username())) {
            throw unsafe("runtime connection must use servisimibul_app");
        }
        if (administrator.username().equals(runtime.username())) {
            throw unsafe("administrator and runtime users must be distinct");
        }

        requireLoopbackUrl(administrator.url(), expectedDatabase);
        requireLoopbackUrl(runtime.url(), expectedDatabase);
        validateTarget(administrator, expectedDatabase, expectedMarker);
        validateTarget(runtime, expectedDatabase, expectedMarker);

        Flyway.configure()
                .dataSource(administrator.url(), administrator.username(), administrator.password())
                .load()
                .migrate();
    }

    public static Connection openVerifiedAdministratorConnection(Environment environment)
            throws SQLException {
        requireDisposable(environment);
        String expectedDatabase = requiredSafeIdentifier(environment, "SB_TEST_DATABASE_NAME");
        String expectedMarker = required(environment, "SB_TEST_DB_INSTANCE_ID");
        ConnectionSettings settings = settings(
                environment,
                "SB_TEST_DB_ADMIN_JDBC_URL",
                "SB_TEST_DB_ADMIN_USER",
                "SB_TEST_DB_ADMIN_PASSWORD"
        );
        requireLoopbackUrl(settings.url(), expectedDatabase);
        Connection connection = DriverManager.getConnection(
                settings.url(),
                settings.username(),
                settings.password()
        );
        try {
            validateConnection(
                    connection,
                    settings,
                    expectedDatabase,
                    expectedMarker
            );
            return connection;
        } catch (RuntimeException | SQLException failure) {
            connection.close();
            throw failure;
        }
    }

    public static String requiredSafeIdentifier(Environment environment, String property) {
        String value = required(environment, property);
        requireSafeIdentifier(value, property);
        return value;
    }

    private static void validateTarget(
            ConnectionSettings settings,
            String expectedDatabase,
            String expectedMarker
    ) {
        try (Connection connection = DriverManager.getConnection(
                settings.url(),
                settings.username(),
                settings.password()
        )) {
            validateConnection(connection, settings, expectedDatabase, expectedMarker);
        } catch (SQLException failure) {
            throw unsafe("could not verify the isolated PostgreSQL target", failure);
        }
    }

    private static void validateConnection(
            Connection connection,
            ConnectionSettings settings,
            String expectedDatabase,
            String expectedMarker
    ) throws SQLException {
        try (var statement = connection.prepareStatement(MARKER_QUERY)) {
            statement.setString(1, expectedMarker);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()
                        || !expectedDatabase.equals(result.getString(1))
                        || !settings.username().equals(result.getString(2))
                        || !isLoopback(result.getString(3))
                        || result.getInt(4) / 10_000 != 17
                        || result.getInt(5) != 1) {
                    throw unsafe("database identity or disposable marker did not match");
                }
            }
        }
    }

    private static ConnectionSettings settings(
            Environment environment,
            String urlProperty,
            String userProperty,
            String passwordProperty
    ) {
        String url = required(environment, urlProperty);
        String username = required(environment, userProperty);
        String password = required(environment, passwordProperty);
        requireSafeIdentifier(username, userProperty);
        return new ConnectionSettings(url, username, password);
    }

    private static void requireLoopbackUrl(String jdbcUrl, String expectedDatabase) {
        if (!jdbcUrl.startsWith("jdbc:postgresql://")) {
            throw unsafe("tests require a PostgreSQL JDBC URL");
        }
        URI uri;
        try {
            uri = URI.create(jdbcUrl.substring("jdbc:".length()));
        } catch (IllegalArgumentException invalidUrl) {
            throw unsafe("test JDBC URL is invalid", invalidUrl);
        }
        String path = uri.getPath();
        String database = path == null || path.length() < 2 ? "" : path.substring(1);
        if (!LOOPBACK_HOSTS.contains(uri.getHost()) || !expectedDatabase.equals(database)) {
            throw unsafe("tests may connect only to the named loopback database");
        }
    }

    private static boolean isLoopback(String address) {
        try {
            return address != null && InetAddress.getByName(address).isLoopbackAddress();
        } catch (Exception invalidAddress) {
            return false;
        }
    }

    private static String required(Environment environment, String property) {
        String value = environment.getProperty(property);
        if (value == null || value.isBlank()) {
            throw unsafe(property + " is required");
        }
        return value;
    }

    private static void requireDisposable(Environment environment) {
        if (!environment.getProperty("SB_TEST_DB_DISPOSABLE", Boolean.class, false)) {
            throw unsafe("SB_TEST_DB_DISPOSABLE=true is required");
        }
    }

    private static void requireSafeIdentifier(String value, String description) {
        if (!value.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw unsafe(description + " must be a safe PostgreSQL identifier");
        }
    }

    private static IllegalStateException unsafe(String message) {
        return new IllegalStateException("Unsafe isolated PostgreSQL test configuration: " + message);
    }

    private static IllegalStateException unsafe(String message, Exception cause) {
        return new IllegalStateException(
                "Unsafe isolated PostgreSQL test configuration: " + message,
                cause
        );
    }

    private record ConnectionSettings(String url, String username, String password) {
    }
}
