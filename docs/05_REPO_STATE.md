# Verified repository and database state

Repository snapshot: 2026-10-19 at `main` commit `0ffadfe`. Latest shared Supabase audit: 2026-10-17; A-12 performs no Supabase operation.

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; `main` contains the existing `servisimibul-backend` Spring Boot project, Maven wrapper, geography/pilot-school and operator-school/general-coverage APIs, Flyway configuration, backend CI, the approved J-01/J-02 contracts, B-03 authentication workflows, B-04 session/admin bootstrap, A-05 tariff backend, A-06 vehicle/offering CRUD, A-07 offering-specific coverage/discovery enrichment, A-08 database/performance hardening, B-05 operator lifecycle, A-10 deployment/observability foundation, and the merged B-13 server-backed school results. It also contains the B-01 Vite React + TypeScript frontend and project-scoped frontend design tooling. Preserve these projects; do not generate a second application.

`pom.xml` declares Java 21 compatibility with Spring Boot 4.1.1, JPA, Security, Session JDBC, Validation, WebMVC, Mail, Actuator, PostgreSQL, Spring Boot Flyway, and Flyway PostgreSQL support. `application.properties` uses environment-driven runtime/migration credentials, disables Flyway by default, and keeps Hibernate at `ddl-auto=validate`. V1 creates the geography schema; V2 protects Flyway history; V3 adds identity persistence; V4 adds Spring Session persistence; V5 adds operator-school relationships and general coverage; V6 adds vehicles and service offerings; V7 makes the operator business name optional; and V8 adds offering-specific coverage. Shared Supabase has V1–V8. A-08 adds no migration because PostgreSQL 17 plans show that the existing V3/V5/V6/V8 indexes serve the measured pilot workload efficiently.

The A-12 branch adds an isolated Windows launcher/test harness that provisions disposable PostgreSQL 17 under `%TEMP%`, applies Flyway separately, and runs the web process only as `servisimibul_app`. Runtime, migration, and ADMIN-bootstrap examples are separate. The backend `.gitignore` excludes real `.env` variants while retaining the safe `*.example` templates. The unrelated local `.idea/compiler.xml` change remains outside current scope.

## Shared Supabase state — last verified 2026-10-17
The controlled D017 cutover and approved V2–V8 migrations are complete on PostgreSQL 17.11. `public.flyway_schema_history` contains eight successful versioned rows, V1 through V8. All 16 application tables have RLS enabled with `servisimibul_app`-scoped backend policies. `operator_profile.business_name` is nullable and `service_offering_coverage` is present. The geography and school tables remain empty.

The separately provisioned `servisimibul_app` login has no superuser, database-creation, role-creation, inheritance, or RLS-bypass capability. `PUBLIC`, `anon`, and `authenticated` have no direct table or sequence privileges. `servisimibul_app` cannot access Flyway history. `public.flyway_schema_history` does not use RLS, but its direct privileges are restricted. `postgres` remains a controlled migration/administration identity, not the runtime login.

## Reconciliation history
D017's controlled drop/recreation was executed only after the four legacy geography tables were rechecked as empty. The exact four tables were dropped in one transaction without `CASCADE`, V1 migrated successfully, and Hibernate validation then succeeded through the restricted runtime connection. Automatic baseline, Flyway repair, schema reset, and destructive fallback remain forbidden.

## Known gaps
The root `README.md` maps both applications, and the backend README maps feature packages. B-01, B-03–B-07, B-10–B-14, A-02–A-11, frontend design tooling, the operator business-name optionality change, and public discovery UI are merged. A-12 is implemented locally and requires human code review and a pull request before merge. Provider selection, monitoring/alerts, durable production tariff-volume proof, migration rehearsal, and deployment/rollback rehearsal remain explicit launch gates.
