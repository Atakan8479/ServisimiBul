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
| `identity` | User/operator JPA entities, lifecycle enums, repositories, and database-backed user loading; keeping the loader here preserves package-private password-hash access |
| `security` | Spring Security configuration, authenticated principal/current user, token hashing, and session-revocation contract |
| `geography` | Province, district, neighborhood, and school entities/repositories |
| `resources/db/migration` | Ordered Flyway migrations; never edit an applied migration |
| `src/test/...` | Tests mirror the production feature packages |

For authentication, read files in this order:

1. `auth/controller/AuthController` and `auth/dto` — HTTP endpoints and request shapes.
2. `auth/service/AuthService` — workflow orchestration and non-enumerating behavior.
3. `auth/service/AuthPersistenceService` — transaction boundaries and database state changes.
4. `auth/service/AuthInputValidator`, `AuthRateLimiter`, and `TokenGenerator` — focused security helpers.
5. `auth/service/AuthEmailSender` — email contract plus disabled/SMTP implementations.
6. `auth/exception` — safe exceptions and API error responses.

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
