# Verified repository and database state

Repository snapshot: 2026-10-16. Latest shared Supabase audit: 2026-10-16.

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; `main` contains the existing `servisimibul-backend` Spring Boot project, Maven wrapper, geography/pilot-school and operator-school/general-coverage APIs, Flyway configuration, backend CI, the approved J-01/J-02 contracts, B-03 authentication workflows, B-04 session/admin bootstrap, A-05 tariff backend, A-06 vehicle/offering CRUD, A-07 offering-specific coverage/discovery enrichment, A-08 database/performance hardening, B-05 operator lifecycle, and A-10 deployment/observability foundation. It also contains the B-01 Vite React + TypeScript frontend and project-scoped frontend design tooling. Preserve these projects; do not generate a second application.

`pom.xml` declares Java 21 compatibility with Spring Boot 4.1.1, JPA, Security, Session JDBC, Validation, WebMVC, Mail, Actuator, PostgreSQL, Spring Boot Flyway, and Flyway PostgreSQL support. `application.properties` uses environment-driven runtime/migration credentials, disables Flyway by default, and keeps Hibernate at `ddl-auto=validate`. V1 creates the geography schema; V2 protects Flyway history; V3 adds identity persistence; V4 adds Spring Session persistence; V5 adds operator-school relationships and general coverage; V6 adds vehicles and service offerings; V7 makes the operator business name optional; and V8 adds offering-specific coverage. Shared Supabase has V1–V7; V8 is pending. A-08 adds no migration because PostgreSQL 17 plans show that the existing V3/V5/V6/V8 indexes serve the measured pilot workload efficiently.

The backend `.gitignore` excludes `.env`, `application-local.*`, and local IDE files while retaining the safe `.env.example`. The root `.idea` directory and unrelated local Node files remain outside current cleanup scope.

## Shared Supabase state — last verified 2026-10-16
The controlled D017 cutover and approved V2–V7 migration are complete on PostgreSQL 17.11. `public.flyway_schema_history` contains seven successful versioned rows, V1 through V7. The 15 current application tables have RLS enabled with `servisimibul_app`-scoped backend policies. `operator_profile.business_name` is nullable. Repository V8 is not applied, so `service_offering_coverage` is absent. The geography and school tables remain empty.

The separately provisioned `servisimibul_app` login has no superuser, database-creation, role-creation, inheritance, or RLS-bypass capability. `PUBLIC`, `anon`, and `authenticated` have no direct table or sequence privileges. `servisimibul_app` cannot access Flyway history. `public.flyway_schema_history` does not use RLS, but its direct privileges are restricted. `postgres` remains a controlled migration/administration identity, not the runtime login.

Applying V8 remains a separate operation requiring a fresh read-only state check, the confirmed target/command, a verified backup, and explicit human approval.

## Reconciliation history
D017's controlled drop/recreation was executed only after the four legacy geography tables were rechecked as empty. The exact four tables were dropped in one transaction without `CASCADE`, V1 migrated successfully, and Hibernate validation then succeeded through the restricted runtime connection. Automatic baseline, Flyway repair, schema reset, and destructive fallback remain forbidden.

## Known gaps
The root `README.md` maps both applications, and the backend README maps feature packages. B-01, B-03, B-04, B-05, B-07, A-02–A-08, A-10, the combined local launcher, frontend design tooling, and the operator business-name optionality change are merged. A-08 merged in PR #47 as `0054118`; PostgreSQL 17 workflows `38788568472` and `38880661526` passed all 93 tests covering query plans, N+1, stable pagination, complete RLS/grant auditing, and empty-database migration replay. A-09 operations documentation and verification coverage are in progress on `codex/a-09-database-backup-operations`. A real restore test and the missing pilot-geography write path remain explicitly gated work.
