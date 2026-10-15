# Verified repository and database state

Repository snapshot: 2026-10-15. Latest shared Supabase audit: 2026-10-12.

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; `main` contains the existing `servisimibul-backend` Spring Boot project, Maven wrapper, geography/pilot-school and operator-school/general-coverage APIs, Flyway configuration, backend CI, the approved J-01/J-02 contracts, B-03 authentication workflows, B-04 session/admin bootstrap, A-05 tariff backend, A-06 vehicle/offering CRUD, B-05 operator lifecycle, and A-10 deployment/observability foundation. It also contains the B-01 Vite React + TypeScript frontend foundation. Preserve these projects; do not generate a second application.

`pom.xml` declares Java 21 compatibility with Spring Boot 4.1.1, JPA, Security, Session JDBC, Validation, WebMVC, Mail, Actuator, PostgreSQL, Spring Boot Flyway, and Flyway PostgreSQL support. `application.properties` uses environment-driven runtime/migration credentials, disables Flyway by default, and keeps Hibernate at `ddl-auto=validate`. V1 creates the geography schema; V2 protects Flyway history; V3 adds identity persistence; V4 adds Spring Session persistence; V5 adds operator-school relationships and general coverage; and V6 adds vehicles and service offerings. V2–V6 have not been applied to shared Supabase.

The backend `.gitignore` excludes `.env`, `application-local.*`, and local IDE files while retaining the safe `.env.example`. The root `.idea` directory and unrelated local Node files remain outside current cleanup scope.

## Shared Supabase state — last verified 2026-10-12
The controlled D017 cutover is complete on PostgreSQL 17.11. Flyway V1 owns the public geography schema, and `public.flyway_schema_history` contained one successful V1 row at the final audit. `province`, `district`, `neighborhood`, and `school` were empty, matched the approved constraints/defaults, and had RLS enabled with `servisimibul_app`-scoped backend policies.

The separately provisioned `servisimibul_app` login has no superuser, database-creation, role-creation, or RLS-bypass capability. It has only the approved geography object privileges. `anon` and `authenticated` had no geography table access. `postgres` remains a controlled migration/administration identity, not the runtime login.

V2 through V5 have not been applied to shared Supabase during pull-request development, and proposed V6 likewise remains unapplied. Applying any pending migration there remains a separate operation requiring merged/reviewed migrations, a fresh read-only state check, the confirmed target/command, and explicit human approval.

## Reconciliation history
D017's controlled drop/recreation was executed only after the four legacy geography tables were rechecked as empty. The exact four tables were dropped in one transaction without `CASCADE`, V1 migrated successfully, and Hibernate validation then succeeded through the restricted runtime connection. Automatic baseline, Flyway repair, schema reset, and destructive fallback remain forbidden.

## Known gaps
The root `README.md` maps both applications, and the backend README maps feature packages. B-01, B-03, B-04, B-05, A-02, A-03, A-05, A-06, and A-10 are merged. A-04 anonymous public discovery is implemented on its feature branch and awaits isolated PostgreSQL verification and review. A-07 offering-specific coverage remains pending, so supported offering publication still fails closed and A-04 returns an empty `publishedOfferings` list.
