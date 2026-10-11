# Paste ONLY after Gate 1 migration strategy is explicitly approved

Our approved Flyway adoption strategy is: [FILL IN EXACTLY: A controlled drop/re-create OR B preserve/baseline, with details]. Do not infer this field.

Read `AGENTS.md` and `docs/00_PROJECT_BRIEF.md` through `docs/06_PROGRESS.md`, then inspect current repository state. Limit this task to Gate 2: set up a Flyway-backed Spring Boot database foundation in `servisimibul-backend`.

Before implementing, report expected files and any differences from the approved schema. Check Spring Boot 4.1.1 / Java 21 / Flyway PostgreSQL module compatibility rather than copying older build files. Use environment variables for connection settings and Hibernate `ddl-auto=validate`. Apply only approved migrations, and never change the remote Supabase development database without explicit separate approval.

Expected deliverables: limited PR-ready code diff, migrations conforming to approved reconciliation, safe `.env.example` or equivalent, tests for a clean local/test PostgreSQL database, setup commands, accurate results and progress update. No auth, operator CRUD, frontend or unrelated entities in this task.

Do not push to main, auto-merge, or proceed to next stage.
