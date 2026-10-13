# Verified repository and database state

Repository snapshot: 2026-10-13. Latest shared Supabase audit: 2026-10-12.

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; `main` contains the existing `servisimibul-backend` Spring Boot project, Maven wrapper, geography entities/repositories, Flyway configuration, backend CI, and the approved J-01 contract. Preserve this project; do not generate a second Spring application.

`pom.xml` declares Java 21 compatibility with Spring Boot 4.1.1, JPA, Security, Validation, WebMVC, PostgreSQL, Spring Boot Flyway, and Flyway PostgreSQL support. `application.properties` uses environment-driven runtime/migration credentials, disables Flyway by default, and keeps Hibernate at `ddl-auto=validate`. V1 creates the geography schema; V2 removes application-role access to Flyway history without modifying V1. Merged B-02 PR #32 adds the verified V3 identity schema and its JPA/security foundation; V3 has not been applied to shared Supabase.

The backend `.gitignore` excludes `.env`, `application-local.*`, and local IDE files while retaining the safe `.env.example`. The root `.idea` directory and unrelated local Node files remain outside current cleanup scope.

## Shared Supabase state — last verified 2026-10-12
The controlled D017 cutover is complete on PostgreSQL 17.11. Flyway V1 owns the public geography schema, and `public.flyway_schema_history` contained one successful V1 row at the final audit. `province`, `district`, `neighborhood`, and `school` were empty, matched the approved constraints/defaults, and had RLS enabled with `servisimibul_app`-scoped backend policies.

The separately provisioned `servisimibul_app` login has no superuser, database-creation, role-creation, or RLS-bypass capability. It has only the approved geography object privileges. `anon` and `authenticated` had no geography table access. `postgres` remains a controlled migration/administration identity, not the runtime login.

V2 and V3 have not been applied to shared Supabase during pull-request development. Applying either there remains a separate operation requiring merged/reviewed migrations, a fresh read-only state check, the confirmed target/command, and explicit human approval.

## Reconciliation history
D017's controlled drop/recreation was executed only after the four legacy geography tables were rechecked as empty. The exact four tables were dropped in one transaction without `CASCADE`, V1 migrated successfully, and Hibernate validation then succeeded through the restricted runtime connection. Automatic baseline, Flyway repair, schema reset, and destructive fallback remain forbidden.

## Known gaps
The root `README.md` remains minimal. There is no merged frontend, session lifecycle, admin bootstrap, operator workflow, or public-discovery feature yet. B-03 registration, email verification, and password-recovery work is in progress on its feature branch; B-04 remains responsible for login, persisted sessions, and admin bootstrap. The A-10 deployment/observability work is in a separate unmerged PR and is not part of this repository snapshot.
