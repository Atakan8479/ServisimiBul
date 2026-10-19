# Verified repository and database state

Repository snapshot: 2026-10-19 at `main` commit `0ffadfe`. Latest shared Supabase audit: 2026-10-17; A-11 and B-12–B-14 performed no shared Supabase operation.

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; the default branch is `main`. It contains the existing `servisimibul-backend` Spring Boot project, Maven wrapper, geography/pilot-school and operator-school/general-coverage APIs, Flyway configuration, the approved J-01/J-02 contracts, authentication/session/admin workflows, tariff and optional vehicle/offering support, discovery-readiness and anonymous search APIs, database/operations tooling, and provider-neutral deployment/observability foundations. It also contains the B-01 Vite React + TypeScript frontend, the complete public/operator/admin MVP paths, database-backed searchable school results, accessibility/E2E coverage, and project-scoped frontend design tooling. Preserve these projects; do not generate a second application.

PR #60 merged B-12 as `d6e766a`, PR #62 merged B-14 as `c073476`, PR #63 merged A-11 as `9f752a8`, and PR #64 merged B-13 as `0ffadfe`. A-11 adds a verified external-source checker plus a fail-closed importer for disposable local PostgreSQL 17; it did not import shared Supabase. B-12 and B-13 complete database-backed school location filtering, Turkish-normalized search, sorting, and deterministic pagination. B-14 adds authenticated operator discovery-readiness guidance while retaining backend-authoritative publication rules.

`pom.xml` declares Java 21 compatibility with Spring Boot 4.1.1, JPA, Security, Session JDBC, Validation, WebMVC, Mail, Actuator, PostgreSQL, Spring Boot Flyway, and Flyway PostgreSQL support. `application.properties` uses environment-driven runtime/migration credentials, disables Flyway by default, and keeps Hibernate at `ddl-auto=validate`. V1 creates the geography schema; V2 protects Flyway history; V3 adds identity persistence; V4 adds Spring Session persistence; V5 adds operator-school relationships and general coverage; V6 adds vehicles and service offerings; V7 makes the operator business name optional; and V8 adds offering-specific coverage. Shared Supabase has V1–V8. A-08 adds no migration because PostgreSQL 17 plans show that the existing V3/V5/V6/V8 indexes serve the measured pilot workload efficiently.

The backend `.gitignore` excludes `.env`, `application-local.*`, and local IDE files while retaining the safe `.env.example`. The root `.idea` directory remains tracked; a developer-local `.idea/compiler.xml` change was present during the J-04 audit and is unrelated to repository reconciliation.

## Repository protection — verified 2026-10-19

Read-only GitHub API inspection found that `main` was unprotected and no repository rulesets existed. The repository is public, `Atakan8479` has administrator access, and `LePqrta` has write access. Recent applicable Backend, Frontend, and Secret scan workflows succeeded, but PRs #60, #62, #63, and #64 contained no submitted GitHub review. Backend and Frontend also both emitted the ambiguous check-run name `test`.

J-04 defines unique required check names, unfiltered pull-request execution, CODEOWNERS, and the target no-bypass ruleset in `docs/12_REPOSITORY_PROTECTION.md`. Do not claim protection is active until the post-write GitHub API verification is recorded in `docs/06_PROGRESS.md`.

## Shared Supabase state — last verified 2026-10-17
The controlled D017 cutover and approved V2–V8 migrations are complete on PostgreSQL 17.11. `public.flyway_schema_history` contains eight successful versioned rows, V1 through V8. All 16 application tables have RLS enabled with `servisimibul_app`-scoped backend policies. `operator_profile.business_name` is nullable and `service_offering_coverage` is present. The geography and school tables remain empty.

The separately provisioned `servisimibul_app` login has no superuser, database-creation, role-creation, inheritance, or RLS-bypass capability. `PUBLIC`, `anon`, and `authenticated` have no direct table or sequence privileges. `servisimibul_app` cannot access Flyway history. `public.flyway_schema_history` does not use RLS, but its direct privileges are restricted. `postgres` remains a controlled migration/administration identity, not the runtime login.

## Reconciliation history
D017's controlled drop/recreation was executed only after the four legacy geography tables were rechecked as empty. The exact four tables were dropped in one transaction without `CASCADE`, V1 migrated successfully, and Hibernate validation then succeeded through the restricted runtime connection. Automatic baseline, Flyway repair, schema reset, and destructive fallback remain forbidden.

## Known gaps
The root `README.md` maps both applications and repository CI, while the backend README maps feature packages. Application work through A-11 and B-14 is merged. J-04 repository-protection activation and verification remain pending until its unique checks run on a pull request and the owner-approved ruleset is applied. Shared Supabase still has no geography or school rows; A-11 intentionally stopped at the verified disposable-local importer. A shared import requires its own reviewed approval and execution plan. A real restore test, provider selection, monitoring/alerts, durable tariff-volume proof, migration rehearsal, and deployment/rollback rehearsal remain explicit launch gates.
