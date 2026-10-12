# Verified starting state — snapshot 2026-10-12

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; branch `main` has `servisimibul-backend/`, Maven wrapper, `pom.xml`, source and test directories, nearly empty `README.md`. `pom.xml` explicitly declares Java 21, Spring Boot parent `4.1.1`, Spring JPA, security, validation, WebMVC, PostgreSQL runtime and test starter dependencies. Flyway is NOT in the inspected `pom.xml`. `.gitignore` within backend excludes `.env`, `application-local.*`, `.idea`. A root `.idea` directory exists in repo; review hygiene later, don't remove without request. Check repo again at execution time.

## Supabase state (read-only JDBC inspection on 2026-10-12)
Project `ServisimiBul` uses PostgreSQL 17.11. The public schema has four **manually created** tables: `province`, `district`, `neighborhood`, and `school`; all had exactly zero rows. Three direct geography FKs exist: district→province, neighborhood→district, and school→neighborhood, all with `ON DELETE RESTRICT`. The documented unique and school-source check constraints were present. `province`, `district`, and `neighborhood` use `GENERATED ALWAYS AS IDENTITY`; `school.id` defaults to `gen_random_uuid()`.

All four tables have RLS enabled, `FORCE ROW LEVEL SECURITY` disabled, and no policies. `anon`, `authenticated`, `service_role`, and `postgres` have broad table grants. The inspected `postgres` role has `BYPASSRLS`; use it for controlled administration, not as an assumed production runtime role. Neither `public.flyway_schema_history` nor `supabase_migrations.schema_migrations` exists.

## Approved reconciliation direction and remaining constraint
Decision D017 approves controlled drop/recreation so Flyway V1 can own the geography schema from a clean state. This approval does **not** authorize executing destructive SQL. Before execution, review and approve the exact V1 DDL, treatment of the live-only `province.created_at` field, RLS/grants, database roles, rollback/recovery steps, and the exact four-table drop scope. Never use automatic destructive fallback, `spring.flyway.baseline-on-migrate=true`, or Flyway `repair` as a workaround.

## Known repo gaps
`AGENTS.md` and the multi-document project context are committed, but the root `README.md` remains nearly empty. Gate 2 now adds Flyway dependencies, environment-driven datasource configuration, a locally verified V1 migration, and backend CI; verification evidence is recorded in `docs/06_PROGRESS.md`. The shared Supabase schema has not been changed and still awaits the separately approved cutover. There is no verified frontend or implemented product feature beyond the generated application entry point. Preserve `servisimibul-backend` (don't generate a second Spring project).
