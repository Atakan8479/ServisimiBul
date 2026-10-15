# Verified repository and database state

Repository snapshot: 2026-10-15. Latest shared Supabase audit: 2026-10-12.

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; `main` contains the existing `servisimibul-backend` Spring Boot project, Maven wrapper, geography/pilot-school and operator-school/general-coverage APIs, Flyway configuration, backend CI, the approved J-01/J-02 contracts, B-03 authentication workflows, B-04 session/admin bootstrap, A-05 tariff backend, A-06 vehicle/offering CRUD, B-05 operator lifecycle, and A-10 deployment/observability foundation. It also contains the B-01 Vite React + TypeScript frontend foundation. Preserve these projects; do not generate a second application.

`pom.xml` declares Java 21 compatibility with Spring Boot 4.1.1, JPA, Security, Session JDBC, Validation, WebMVC, Mail, Actuator, PostgreSQL, Spring Boot Flyway, and Flyway PostgreSQL support. `application.properties` uses environment-driven runtime/migration credentials, disables Flyway by default, and keeps Hibernate at `ddl-auto=validate`. V1 creates the geography schema; V2 protects Flyway history; V3 adds identity persistence; V4 adds Spring Session persistence; V5 adds operator-school relationships and general coverage; V6 adds vehicles and service offerings; V7 makes the operator business name optional; and the A-07 feature branch proposes V8 for offering-specific coverage. V2–V8 have not been applied to shared Supabase.

The backend `.gitignore` excludes `.env`, `application-local.*`, and local IDE files while retaining the safe `.env.example`. The root `.idea` directory and unrelated local Node files remain outside current cleanup scope.

## Shared Supabase state — last verified 2026-10-12
The controlled D017 cutover is complete on PostgreSQL 17.11. Flyway V1 owns the public geography schema, and `public.flyway_schema_history` contained one successful V1 row at the final audit. `province`, `district`, `neighborhood`, and `school` were empty, matched the approved constraints/defaults, and had RLS enabled with `servisimibul_app`-scoped backend policies.

The separately provisioned `servisimibul_app` login has no superuser, database-creation, role-creation, or RLS-bypass capability. It has only the approved geography object privileges. `anon` and `authenticated` had no geography table access. `postgres` remains a controlled migration/administration identity, not the runtime login.

V2 through V7 have not been applied to shared Supabase during pull-request development, and proposed V8 likewise remains unapplied. Applying any pending migration there remains a separate operation requiring merged/reviewed migrations, a fresh read-only state check, the confirmed target/command, and explicit human approval.

## Reconciliation history
D017's controlled drop/recreation was executed only after the four legacy geography tables were rechecked as empty. The exact four tables were dropped in one transaction without `CASCADE`, V1 migrated successfully, and Hibernate validation then succeeded through the restricted runtime connection. Automatic baseline, Flyway repair, schema reset, and destructive fallback remain forbidden.

## Known gaps
The root `README.md` maps both applications, and the backend README maps feature packages. B-01, B-03, B-04, B-05, A-02–A-06, A-10, and the operator business-name optionality change are merged. A-07 offering-specific coverage and discovery enrichment is implemented in PR #45; PostgreSQL 17 workflow `38754276561` passed all 89 tests, and review remains pending.
