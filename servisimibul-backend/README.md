# ServisimiBul backend

The backend uses Supabase PostgreSQL as its shared development database. Flyway owns the schema and Hibernate only validates it.

## Code map

Production code is grouped by feature first, then by technical responsibility:

| Package/path | Responsibility |
|---|---|
| `auth/controller` | Authentication HTTP endpoints |
| `auth/dto` | Authentication request and response records |
| `auth/service` | Registration, verification, recovery, validation, token, rate-limit, and email workflows |
| `auth/exception` | Authentication exceptions and safe API error responses |
| `auth/config` | Authentication beans and email configuration properties |
| `identity` | User/operator JPA entities, lifecycle enums, repositories, database-backed user loading, and the non-HTTP admin bootstrap; keeping credential access here preserves package-private password hashes |
| `security` | Spring Security configuration, authenticated principal/current user, token hashing, JDBC session revocation, cookie policy, and remembered-session lifetime enforcement |
| `geography` | Province, district, neighborhood, and school entities/repositories |
| `geography/controller` | Public geography and admin school HTTP endpoints |
| `geography/dto` | Geography and school API request/response types |
| `geography/service` | Geography lookup and pilot school catalog workflows |
| `geography/exception` | Geography API exceptions and Problem Details responses |
| `resources/db/migration` | Ordered Flyway migrations; never edit an applied migration |
| `src/test/...` | Tests mirror the production feature packages where visibility permits |

For authentication, read files in this order:

1. `auth/controller/AuthController` and `auth/dto` — HTTP endpoints and request shapes.
2. `auth/service/AuthService` — workflow orchestration and non-enumerating behavior.
3. `auth/service/AuthPersistenceService` — transaction boundaries and database state changes.
4. `auth/service/AuthInputValidator`, `AuthRateLimiter`, and `TokenGenerator` — focused security helpers.
5. `auth/service/AuthEmailSender` — email contract plus disabled/SMTP implementations.
6. `auth/exception` — safe exceptions and API error responses.

## Initial admin bootstrap

After V4 is reviewed, merged, and applied, configure the four temporary `SB_ADMIN_*` credential variables and set `SB_ADMIN_BOOTSTRAP_ENABLED=true`. Run the backend once without a web server:

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.arguments=--spring.main.web-application-type=none"
```

The command requires two distinct admin emails, creates only missing accounts, verifies them, refuses a database that would not contain exactly two admins, and never replaces existing admin passwords. After it exits successfully, remove the four credentials and disable the bootstrap flag before starting the normal web application. It exposes no HTTP endpoint.

## Java toolchain

Use JDK 25 to run IntelliJ IDEA and Maven. The application remains Java 21 source/bytecode compatible through `<java.version>21</java.version>` in `pom.xml`; do not enable Java 22+ language features or preview features.

Each developer must configure JDK 25 on their own computer:

- Set IntelliJ Project SDK and Maven Runner JRE to JDK 25.
- Set the IntelliJ project language level to Java 21.
- Set `JAVA_HOME` to the local JDK 25 installation and ensure its `bin` directory precedes older Java installations in `PATH`.
- Verify both `java -version` and `.\mvnw.cmd --version` before building.

## Environment

Copy `.env.example` to an ignored `.env` and replace the example values. Spring Boot does not read `.env` itself, so load it through the IntelliJ run configuration or export the variables before starting the application.

`SB_DB_USER` must be the least-privilege `servisimibul_app` login, not `postgres`. Migration credentials are separate and should only be present during an approved migration run. Keep `SB_FLYWAY_ENABLED=false` for the normal application runtime.

Local HTTP development must explicitly set `SPRING_PROFILES_ACTIVE=local` and `SB_COOKIE_SECURE=false`, as shown in `.env.example`. Deployed environments use the `prod` profile, which enforces a Secure `SBSESSION` cookie and structured JSON logs.

Before V1 runs, an administrator must provision the runtime login outside Flyway. Use a newly generated password and never commit the executed statement:

```sql
CREATE ROLE servisimibul_app
    LOGIN PASSWORD '<generated-password>'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE postgres TO servisimibul_app;
```

V1 grants this role access only to the geography tables and their identity sequences. Every later migration must explicitly grant and add a role-scoped RLS policy for each new runtime table.

## Tests

Tests require a clean PostgreSQL 17 database with `servisimibul_app`, `anon`, and `authenticated` roles. The GitHub Actions workflow provisions an isolated PostgreSQL service automatically. It never connects to Supabase.

Run locally by pointing the `SB_DB_*` variables at a disposable PostgreSQL database, enabling Flyway, and supplying the separate `SB_DB_MIGRATION_*` administrator variables:

```powershell
.\mvnw.cmd verify
```

Do not run the test suite against the shared Supabase project: the V1 test expects a clean database.

## Deployment and probes

The backend exposes status-only `/livez` and `/readyz` probes. All sensitive Actuator endpoints are disabled. Runtime and migration credentials must remain separate.

See [`docs/07_BACKEND_DEPLOYMENT.md`](../docs/07_BACKEND_DEPLOYMENT.md) for the environment contract, controlled migration sequence, smoke checks, observability policy, and rollback procedure. Once implemented, the UKOME tariff store uses the approved `SB_TARIFF_STORAGE_DIR` persistent volume and is never written inside the JAR.
