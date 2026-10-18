# Verified repository and database state

Repository snapshot: 2026-10-18 at `main` commit `cf24a9b`. Latest shared Supabase audit: 2026-10-17; B-11 performs no Supabase operation.

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; `main` contains the existing `servisimibul-backend` Spring Boot project, Maven wrapper, geography/pilot-school and operator-school/general-coverage APIs, Flyway configuration, backend CI, the approved J-01/J-02 contracts, B-03 authentication workflows, B-04 session/admin bootstrap, A-05 tariff backend, A-06 vehicle/offering CRUD, A-07 offering-specific coverage/discovery enrichment, A-08 database/performance hardening, B-05 operator lifecycle, and A-10 deployment/observability foundation. It also contains the B-01 Vite React + TypeScript frontend and project-scoped frontend design tooling. Preserve these projects; do not generate a second application.

`pom.xml` declares Java 21 compatibility with Spring Boot 4.1.1, JPA, Security, Session JDBC, Validation, WebMVC, Mail, Actuator, PostgreSQL, Spring Boot Flyway, and Flyway PostgreSQL support. `application.properties` uses environment-driven runtime/migration credentials, disables Flyway by default, and keeps Hibernate at `ddl-auto=validate`. V1 creates the geography schema; V2 protects Flyway history; V3 adds identity persistence; V4 adds Spring Session persistence; V5 adds operator-school relationships and general coverage; V6 adds vehicles and service offerings; V7 makes the operator business name optional; and V8 adds offering-specific coverage. Shared Supabase has V1–V8. A-08 adds no migration because PostgreSQL 17 plans show that the existing V3/V5/V6/V8 indexes serve the measured pilot workload efficiently.

The backend `.gitignore` excludes `.env`, `application-local.*`, and local IDE files while retaining the safe `.env.example`. The root `.idea` directory and unrelated local Node files remain outside current cleanup scope.

## Shared Supabase state — last verified 2026-10-17
The controlled D017 cutover and approved V2–V8 migrations are complete on PostgreSQL 17.11. `public.flyway_schema_history` contains eight successful versioned rows, V1 through V8. All 16 application tables have RLS enabled with `servisimibul_app`-scoped backend policies. `operator_profile.business_name` is nullable and `service_offering_coverage` is present. The geography and school tables remain empty.

The separately provisioned `servisimibul_app` login has no superuser, database-creation, role-creation, inheritance, or RLS-bypass capability. `PUBLIC`, `anon`, and `authenticated` have no direct table or sequence privileges. `servisimibul_app` cannot access Flyway history. `public.flyway_schema_history` does not use RLS, but its direct privileges are restricted. `postgres` remains a controlled migration/administration identity, not the runtime login.

## Reconciliation history
D017's controlled drop/recreation was executed only after the four legacy geography tables were rechecked as empty. The exact four tables were dropped in one transaction without `CASCADE`, V1 migrated successfully, and Hibernate validation then succeeded through the restricted runtime connection. Automatic baseline, Flyway repair, schema reset, and destructive fallback remain forbidden.

## Known gaps
The root `README.md` maps both applications, and the backend README maps feature packages. B-01, B-03, B-04, B-05, B-07, B-10, A-02–A-10, the combined local launcher, frontend design tooling, the operator business-name optionality change, and public discovery UI are merged. B-10 merged in PR #53 as `9ebe2f0`; the provider-independent A-10 production-foundation follow-up merged in PR #54 as `cf24a9b`. B-11 end-to-end and accessibility validation is in review in PR #55; Frontend workflow `39121956828` and Secret scan workflow `39121956907` passed on the initial implementation commit. A real restore test, the missing pilot-geography write path, provider selection, monitoring/alerts, durable tariff-volume proof, migration rehearsal, and deployment/rollback rehearsal remain explicit gates.
