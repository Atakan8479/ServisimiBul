# ServisimiBul backend

The backend uses Supabase PostgreSQL as its shared development database. Flyway owns the schema and Hibernate only validates it.

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
