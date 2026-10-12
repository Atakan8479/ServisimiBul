# Progress ledger (update only after verification)

## Current gate: 2 — Foundational backend and Flyway cutover review
Status: Gate 0 and Gate 1 are complete. The Gate 2 foundation and V1 migration passed clean-database and repeat-start verification on disposable PostgreSQL 17. The shared Supabase project remains unchanged; its four-table cutover still requires review and explicit destructive-execution approval.

| Gate | Status | Evidence/PR | Human approval |
|---|---|---|---|
| 0 Context + repo read-only review | complete | Repository/docs/backend review, 2026-10-11 | Workflow continued to Gate 1 |
| 1 Decide Supabase/Flyway existing-table strategy | complete | Read-only catalog inspection, 2026-10-12; D017 | Option A approved 2026-10-12 |
| 2 Build Flyway-backed backend foundation | in review | Local PostgreSQL 17: `mvnw.cmd --batch-mode verify` and repeat `test` passed; Flyway history v1; ACL/RLS catalog checks passed, 2026-10-12 | D018 approved; Supabase cutover not yet approved |
| 3 Geography entity model | pending | — | — |
| 4 Auth/session/email/admin review | pending | — | — |
| 5 Operator school coverage + catalog | pending | — | — |
| 6 Parent public search | pending | — | — |
| 7 Optional offerings/tariff JSON | pending | — | — |
| 8 Pilot QA and UI | pending | — | — |

## Session handoff template
Date:
Git branch / PR:
Task ID and scope:
Files changed:
Decisions made (approved vs proposed):
Commands and tests actually executed:
Results / evidence:
Known blockers and risks:
Required next human decision:
Next single task (do not auto-start):

Never mark tasks done because code was generated: verification and review required.

## Verified Gate 2 evidence — 2026-10-12

- Branch: `codex/gate2-flyway-foundation`.
- V1 applied to a clean disposable PostgreSQL 17.4 database and recorded one successful Flyway history row.
- A second startup reported schema version 1 as current and applied no migration.
- Maven results: 1 test, 0 failures, 0 errors, 0 skipped; packaged build succeeded on Java 21.0.2.
- All four geography tables had RLS enabled and one `servisimibul_app`-only policy each.
- `servisimibul_app` had `SELECT`, `INSERT`, `UPDATE`, and `DELETE` only on the four tables, required identity-sequence access, and no `BYPASSRLS`.
- `anon` and `authenticated` had no table access. A rolled-back future-table probe confirmed neither role inherited table or sequence access from PostgreSQL default privileges.
- The disposable local cluster was stopped and deleted. No Supabase writes, drops, migrations, or role changes were performed.
