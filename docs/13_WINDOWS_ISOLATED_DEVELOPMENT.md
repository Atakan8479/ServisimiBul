# A-12 isolated Windows development and test database

A-12 makes the root Windows launcher and local backend verification independent of the shared Supabase project. Both paths create a fresh PostgreSQL 17 cluster under the current user's temporary directory and delete it on exit.

## Prerequisites

- Windows PowerShell 5.1 or PowerShell 7.
- JDK 21 or newer. The project is compiled for Java 21; JDK 25 is the documented developer toolchain.
- Node.js 24 and frontend dependencies installed with `npm ci` in `servisimibul-frontend`.
- PostgreSQL 17 binaries containing `initdb.exe`, `pg_ctl.exe`, `pg_isready.exe`, `postgres.exe`, and `psql.exe`. A Windows installer or a user-scoped portable installation is sufficient; no PostgreSQL Windows service is required.

The scripts search an explicit `-PostgresBin` value, `SB_POSTGRES_BIN`, PostgreSQL 17 under Program Files, and common Scoop `postgresql17`/`postgresql` locations, in that order. `-JavaHome` overrides Java discovery.

## Start the full stack

From the repository root:

```powershell
.\dev.ps1
```

The command performs this sequence:

1. Resolves compatible Java, Node.js, and PostgreSQL binaries and fails before reading any backend environment file.
2. Creates a uniquely named `%TEMP%\ServisimiBul-A12-*` directory, a random loopback port, and generated passwords.
3. Initializes PostgreSQL 17 with UTF-8 data, host SCRAM authentication, the `servisimibul_app`, `anon`, and `authenticated` roles, the `servisimibul_a12` database, and a unique test-harness identity marker.
4. Applies Flyway in a non-web `migration` process using the temporary admin identity, while Hibernate validates through `servisimibul_app`.
5. Removes migration, ADMIN-bootstrap, and SMTP credential variables before starting Spring Boot as `servisimibul_app`.
6. Starts Spring Boot and Vite on `127.0.0.1`; Vite proxies `/api` to the loopback backend.
7. Stops both process trees and deletes the temporary tariff and database directories when the launcher exits, including failure paths.

The current test-period overrides from D038 and D044 remain explicit: email verification and operator approval are disabled only in this local launcher. They do not change deployment defaults or stored production state.

Use explicit binary paths when discovery is insufficient:

```powershell
.\dev.ps1 `
  -JavaHome 'C:\path\to\jdk-25' `
  -PostgresBin 'C:\path\to\postgresql-17\bin'
```

## Optional disposable demo content

For an isolated, temporary school catalog with three synthetic İstanbul schools:

```powershell
.\dev.ps1 -DemoData
```

For two temporary, verified administrator accounts, with randomly generated credentials printed once in the local terminal:

```powershell
.\dev.ps1 -DemoAdmins
```

These switches may be combined. They run only against the per-launch disposable PostgreSQL cluster; neither switch reads the ignored backend `.env` or touches Supabase. Do not copy these credentials into shared or production environments. All disposable data and accounts disappear when the launcher stops. The normal web process always disables ADMIN bootstrap.

The launcher waits for `http://127.0.0.1:8080/readyz` to report HTTP 200 before starting Vite, preventing transient API proxy failures during normal startup. Temporary network errors fetching public provinces are retried with a bounded, abortable delay.

The separate `dev-supabase.ps1` launcher also waits for backend readiness but never imports demo fixtures or bootstraps administrators. If it rejects `SB_DB_USER`, use `servisimibul_app` for a direct connection or the appropriate project-suffixed username for a session pooler. Do not change it to `postgres` or remove the restricted-role validation.

## Full-stack smoke test

```powershell
.\dev.ps1 -SmokeTest
```

The smoke path migrates the database, inserts one disposable province fixture through the runtime role, waits for `/readyz` and Vite, and verifies that `/api/v1/provinces` through the Vite proxy returns that fixture. It then exits and cleans up automatically.

## Backend verification

Run the complete Maven lifecycle against a fresh database:

```powershell
pwsh -NoLogo -NoProfile -File .\scripts\Test-IsolatedBackend.ps1
```

Run a focused Surefire selection:

```powershell
pwsh -NoLogo -NoProfile -File .\scripts\Test-IsolatedBackend.ps1 `
  -Tests GeographyCatalogApiTests
```

The test harness supplies the same disposable-database marker required by the repository's destructive migration tests. It must not be replaced with a shared or long-lived database.

Run the PowerShell safety regressions separately:

```powershell
pwsh -NoLogo -NoProfile -File .\scripts\Test-IsolatedDevelopment.Tests.ps1
```

## Environment-file separation

The ignored `servisimibul-backend/.env` is not part of either isolated path. It may continue to hold a developer's direct-run configuration, but it must never be used for the A-12 launcher or test harness.

- `.env.example` documents only normal restricted web-runtime variables.
- `.env.migration.example` documents privileged credentials for a reviewed one-shot migration process.
- `.env.bootstrap.example` documents two temporary ADMIN identities for a one-shot non-web bootstrap process and contains no migration credentials.

Never combine these examples into one persistent process environment. Never put database, SMTP, session, ADMIN, or Supabase credentials in frontend `VITE_*` variables.

## Safety and troubleshooting

- Database networking is restricted to `127.0.0.1`, and JDBC validation rejects a remote host or database name other than `servisimibul_a12`.
- Cleanup refuses to recursively remove any directory outside the Windows temp directory or without the exact `ServisimiBul-A12-` prefix.
- If startup reports that PostgreSQL 17 is missing, install its binaries or pass `-PostgresBin`; do not point the launcher at a running shared database.
- If ports 5173 or 8080 are occupied, stop the conflicting local process. Vite uses a strict port so it cannot silently move to another origin.
- A forced machine shutdown can leave a temp directory. Confirm no `postgres.exe` process uses its `data` directory before manually removing only that exact `ServisimiBul-A12-*` directory.
- Maven may warn that unauthenticated optional Flyway metadata feeds returned 401; the verified build uses resolved project artifacts and is successful when Maven ends with `BUILD SUCCESS`.

No A-12 command reads, migrates, repairs, baselines, resets, or writes the shared Supabase database.
