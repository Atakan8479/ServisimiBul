# Progress ledger (update only after verification)

## Current stage: Phase 1 — Identity/security foundation
Status: Gates 0–3, J-01, A-01, and B-02 are complete. B-03 implementation is in progress.

| Gate | Status | Evidence/PR | Human approval |
|---|---|---|---|
| 0 Context + repo read-only review | complete | Repository/docs/backend review, 2026-10-11 | Workflow continued to Gate 1 |
| 1 Decide Supabase/Flyway existing-table strategy | complete | Read-only catalog inspection, 2026-10-12; D017 | Option A approved 2026-10-12 |
| 2 Build Flyway-backed backend foundation | complete | PR #1; disposable PostgreSQL checks; controlled Supabase cutover and read-only contract audit, 2026-10-12 | D018 and Option A cutover approved 2026-10-12 |
| 3 Geography entity model | complete | PR #3 merged; Java 21 package and disposable PostgreSQL 17 CI passed, 2026-10-12 | Geography persistence scope approved and reviewed 2026-10-12 |
| 4 Auth/session/email/admin review | in progress | B-02 PR #32 merged; B-03 feature branch | B-02 scope and D029–D030 approved 2026-10-13; B-03 follows approved J-01 contract |
| 5 Operator school coverage + catalog | pending | — | — |
| 6 Parent public search | pending | — | — |
| 7 Optional offerings/tariff JSON | pending | — | — |
| 8 Pilot QA and UI | pending | — | — |

## Active work-package progress

| Task | Status | Evidence | Human approval |
|---|---|---|---|
| J-01 Authentication and API contract | complete | GitHub issue #7; PR #29 merged; decisions D020–D028 | Contract approved by Onat and reviewed by Atakan, 2026-10-13 |
| A-01 Flyway security and repository reconciliation | complete | GitHub issue #6; PR #31 merged as `3133dbb7dc6689cb0e2fb644ebffaf8df435e485`; PostgreSQL 17 workflows passed | Reviewed and merged 2026-10-13 |
| B-02 Identity persistence and security foundation | complete | GitHub issue #9; PR #32 merged as `3f064b856af546f73afe0132736fccd47006c52e`; PostgreSQL 17 Backend workflow run `38445768813` passed 14 tests | Scope and D029–D030 approved by Onat; reviewed and merged 2026-10-13 |
| B-03 Registration, verification, and recovery | in progress | GitHub issue #10; branch `codex/b-03-registration-verification-recovery`; Java 21 compile and 4 isolated tests passed locally | Implements the approved J-01 authentication contract; PostgreSQL integration verification pending |

J-01 is documentation-only: it changes no Java code, dependency, migration, application configuration, or shared database state. The contract fixes registration, verification/recovery, session/cookie/CSRF behavior, application lifecycle, admin bootstrap, API errors, pagination, and public contact rules before B-02 implementation begins.

A-01 adds V2 without changing V1, removes application-role access to Flyway history, extends the PostgreSQL integration test, and reconciles the stale repository snapshot. No shared Supabase operation was part of the pull request.

B-02 adds V3 identity persistence, default-deny security, database-backed authentication prerequisites, BCrypt password hashing, SHA-256 token hashing, atomic token consumption, and authenticated-principal-derived current-user identity. Registration/recovery controllers, email delivery, Spring Session lifecycle, and admin bootstrap remain assigned to B-03/B-04. No shared Supabase operation is part of PR #32.

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
- The disposable local cluster was stopped and deleted.
- PR #1 was merged as commit `37d77fd3b167bfa8b0f0ab34f5284d7d1c79180b` before the shared-database cutover.
- A separate `servisimibul_app` login was provisioned on Supabase with no superuser, database-creation, role-creation, or RLS-bypass capability; its restricted login was verified independently from the migration administrator.
- Immediately before cutover, all four existing geography tables were confirmed empty. Only `school`, `neighborhood`, `district`, and `province` were dropped, in one transaction and without `CASCADE`.
- Flyway applied V1 successfully to Supabase PostgreSQL 17.11. Hibernate `ddl-auto=validate` then completed through the restricted runtime connection.
- The final read-only Supabase audit confirmed one successful V1 history row, four empty RLS-enabled geography tables, four `servisimibul_app` policies, runtime CRUD grants, and no `anon` or `authenticated` read access.
- Flyway was disabled again in the ignored local `.env` after the controlled migration run. No credential values were printed or committed.

## Verified Gate 3 geography persistence evidence — 2026-10-12

- Branch: `codex/gate3-geography-persistence`; PR #3.
- `Province`, `District`, `Neighborhood`, and `School` map to the existing Flyway V1 schema; no migration or Supabase change was required.
- Minimal Spring Data JPA repositories were added for the four entities. Relationships are lazy and unidirectional, with no cascade deletion.
- Java 21 Maven packaging passed locally with tests skipped; the existing GitHub Backend workflow then passed the full Maven `verify` run against disposable PostgreSQL 17.
- The integration test persisted the complete province-to-school hierarchy and confirmed duplicate `(source_name, source_code)` pairs are rejected by the database constraint.
- Controllers, services, CSV import, public APIs, authentication, and later-gate models remain out of scope.

## Verified Java toolchain alignment — 2026-10-12

- Branch: `codex/jdk25-java21-alignment`.
- Approved convention: developers run IntelliJ IDEA and Maven with JDK 25 while the application remains Java 21 source/bytecode compatible.
- The shared IntelliJ project selects `openjdk-25` with Java 21 language level; Java 27 preview features are disabled.
- On the inspected Windows workstation, Microsoft OpenJDK 25.0.4.1 is registered in IntelliJ, and new PowerShell sessions resolve both `java` and Maven to that JDK.
- `.\mvnw.cmd --batch-mode -DskipTests package` succeeded with JDK 25; Maven compiled main and test sources with `release 21`, and the application class has class-file major version 65 (Java 21).
- Database-backed tests were intentionally skipped because this toolchain task did not provision the required disposable PostgreSQL database and must not run tests against shared Supabase.

## Verified A-01 evidence — 2026-10-13

- Branch: `codex/a-01-flyway-security-reconciliation`; GitHub issue #6; PR #31.
- V1 was left unchanged; V2 contains only privilege revocations for `public.flyway_schema_history`.
- The integration test expects Flyway schema version 2, verifies a repeated migration executes zero migrations, verifies `anon`, `authenticated`, and `servisimibul_app` have no Flyway-history privileges, and verifies the runtime connection cannot read the history table.
- `.\mvnw.cmd --batch-mode -DskipTests package` passed with JDK 25 and Java 21 release compilation.
- Backend workflow run `38443338668` passed the full Maven verification against isolated PostgreSQL 17, including clean V1→V2 migration, repeat no-op, Hibernate validation, and Flyway-history access denial.
- No shared Supabase read/write, migration, or schema operation was performed.

## Verified B-02 evidence — 2026-10-13

- Branch: `codex/b-02-identity-security-foundation`; GitHub issue #9; PR #32.
- Human-approved D029 fixes the SQL identity table name as `app_user`; D030 limits review decisions to `APPROVED` and `CHANGES_REQUESTED`, with suspension separate.
- V3 creates `app_user`, `operator_profile`, verification/reset token, and application-review tables with checks, foreign keys, indexes, explicit backend grants, RLS, and no `anon`/`authenticated` access.
- JPA entities/repositories preserve operator-only public creation, `DRAFT`/active/public defaults, private password and token hashes, and atomic single-use token consumption.
- Spring Security uses BCrypt, database-backed user details, verified-and-enabled authentication, CSRF, explicit public/role route matchers, and deny-by-default fallback. Current user identity comes only from the authenticated database principal.
- Repository Java conventions now prefer Lombok constructor injection and safe entity getters/no-argument constructors, while credential access and security behavior remain explicit; the convention is recorded in `AGENTS.md`.
- `.\mvnw.cmd --batch-mode -DskipTests package` passed locally on JDK 25 with Java 21 release compilation.
- Backend workflow run `38445768813` passed V1→V2→V3 migration, Hibernate validation, migration repeat no-op, RLS/grant checks, persistence, token replay/expiry, disabled/unverified authentication, ownership identity, route authorization, anonymous-session, and CSRF coverage on isolated PostgreSQL 17: 14 tests, 0 failures, 0 errors, 0 skipped.
- Shared Supabase was not read, migrated, or otherwise modified.
