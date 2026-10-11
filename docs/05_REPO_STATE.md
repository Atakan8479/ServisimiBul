# Verified starting state — snapshot 2026-10-11

## GitHub repository
`https://github.com/Atakan8479/ServisimiBul`; branch `main` has `servisimibul-backend/`, Maven wrapper, `pom.xml`, source and test directories, nearly empty `README.md`. `pom.xml` explicitly declares Java 21, Spring Boot parent `4.1.1`, Spring JPA, security, validation, WebMVC, PostgreSQL runtime and test starter dependencies. Flyway is NOT in the inspected `pom.xml`. `.gitignore` within backend excludes `.env`, `application-local.*`, `.idea`. A root `.idea` directory exists in repo; review hygiene later, don't remove without request. Check repo again at execution time.

## Supabase state (observed through connected tool on 2026-10-11)
Project `ServisimiBul`, region `eu-west-1`, PostgreSQL 17, active Free organization. Public schema had four **manually created** tables: `province`, `district`, `neighborhood`, `school`, all RLS enabled, all zero rows when last verified. Three direct geography FKs: district→province, neighborhood→district, school→neighborhood. No Supabase migration entries were reported before table creation; independently check Flyway history at setup. DO NOT ASSUME observations still current.

## Immediate constraint
Do not run `V1__create_geography_tables.sql` blindly against those existing tables. Re-verify row counts, schema and constraints; record one human-approved reconciliation choice (controlled drop/recreate OR explicit baseline plan). Never use automatic destructive fallback or `spring.flyway.baseline-on-migrate=true` without approval. Raw Supabase SQL Editor-created tables aren't automatically tracked by Flyway.

## Known repo gaps
No committed multi-document business context or `AGENTS.md` at prior inspection; no verified deployed frontend. Preserve `servisimibul-backend` (don't generate a second Spring project). React frontend layout is future work, not assumed implemented.
