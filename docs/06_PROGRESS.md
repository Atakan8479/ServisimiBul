# Progress ledger (update only after verification)

## Current stage: Phase 1/2 — Session authentication review and pilot catalog complete
Status: Gates 0–3, J-01, A-01, B-02, B-03, J-02, and A-02 are complete. B-04 passed isolated PostgreSQL verification and is awaiting review in PR #36; J-02 implementation remains pending.

| Gate | Status | Evidence/PR | Human approval |
|---|---|---|---|
| 0 Context + repo read-only review | complete | Repository/docs/backend review, 2026-10-11 | Workflow continued to Gate 1 |
| 1 Decide Supabase/Flyway existing-table strategy | complete | Read-only catalog inspection, 2026-10-12; D017 | Option A approved 2026-10-12 |
| 2 Build Flyway-backed backend foundation | complete | PR #1; disposable PostgreSQL checks; controlled Supabase cutover and read-only contract audit, 2026-10-12 | D018 and Option A cutover approved 2026-10-12 |
| 3 Geography entity model | complete | PR #3 merged; Java 21 package and disposable PostgreSQL 17 CI passed, 2026-10-12 | Geography persistence scope approved and reviewed 2026-10-12 |
| 4 Auth/session/email/admin review | in progress | B-02 PR #32 and B-03 PR #33 merged; B-04 PR #36 workflow `38607834839` passed 43 tests | B-03 merged; B-04 awaits review |
| 5 Operator school coverage + catalog | in progress | A-02 issue #13 and PR #35 merged as `26e2677db815abfe36ff6ae3cd14bbe75f35b69a`; workflow `38594885240` passed 36 tests | A-02 reviewed and merged 2026-10-14; operator coverage remains pending |
| 6 Parent public search | pending | — | — |
| 7 Optional offerings/tariff JSON | contract complete; implementation pending | J-02 issue #8 completed; PR #34 merged as `7249cc622df20efba5e730f140d62b8da6f65ce0`; D031–D036 | Contract approved and merged 2026-10-14 |
| 8 Pilot QA and UI | pending | — | — |

## Active work-package progress

| Task | Status | Evidence | Human approval |
|---|---|---|---|
| J-01 Authentication and API contract | complete | GitHub issue #7; PR #29 merged; decisions D020–D028 | Contract approved by Onat and reviewed by Atakan, 2026-10-13 |
| A-01 Flyway security and repository reconciliation | complete | GitHub issue #6; PR #31 merged as `3133dbb7dc6689cb0e2fb644ebffaf8df435e485`; PostgreSQL 17 workflows passed | Reviewed and merged 2026-10-13 |
| B-02 Identity persistence and security foundation | complete | GitHub issue #9; PR #32 merged as `3f064b856af546f73afe0132736fccd47006c52e`; PostgreSQL 17 Backend workflow run `38445768813` passed 14 tests | Scope and D029–D030 approved by Onat; reviewed and merged 2026-10-13 |
| B-03 Registration, verification, and recovery | complete | GitHub issue #10; PR #33 merged as `0e5fc7d77f7ac259c38477e415a64e5a01e94ecf`; PostgreSQL 17 workflow `38562354608` passed | Reviewed and merged 2026-10-14 |
| B-04 Session authentication and admin bootstrap | in review | GitHub issue #11; PR #36; PostgreSQL 17 workflow `38607834839` passed all 43 tests | Scope approved by Onat; review pending |
| J-02 Offering, tariff, and frontend contract | complete | GitHub issue #8 completed; PR #34 merged as `7249cc622df20efba5e730f140d62b8da6f65ce0`; decisions D031–D036 | Decision bundle approved and merged 2026-10-14 |
| A-02 Geography and pilot school catalog API | complete | GitHub issue #13; PR #35 merged as `26e2677db815abfe36ff6ae3cd14bbe75f35b69a`; post-B-03 workflow `38594885240` passed 36 tests | Reviewed and merged 2026-10-14 |

J-01 is documentation-only: it changes no Java code, dependency, migration, application configuration, or shared database state. The contract fixes registration, verification/recovery, session/cookie/CSRF behavior, application lifecycle, admin bootstrap, API errors, pagination, and public contact rules before B-02 implementation begins.

A-01 adds V2 without changing V1, removes application-role access to Flyway history, extends the PostgreSQL integration test, and reconciles the stale repository snapshot. No shared Supabase operation was part of the pull request.

B-02 adds V3 identity persistence, default-deny security, database-backed authentication prerequisites, BCrypt password hashing, SHA-256 token hashing, atomic token consumption, and authenticated-principal-derived current-user identity. B-03 supplies registration, verification/recovery controllers, and email delivery. B-04 PR #36 now supplies the reviewed-but-unmerged Spring Session lifecycle and admin bootstrap. No shared Supabase operation is part of these pull requests.

J-02 is documentation-only: it fixes the vehicle-backed offering constraints and lifecycle, tariff JSON persistence/version/concurrency/interval contract, and frontend toolchain/deployment contract before implementation. It changes no Java or frontend source, dependency, Flyway migration, application configuration, production setting, or shared database state.

A-02 adds anonymous geography/active-school reads and ADMIN-only pilot-school create, partial update, activation, and deactivation. It reuses the existing V1 geography schema, keeps bulk CSV import out of scope, and adds no migration or shared Supabase operation.

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

## Verified B-03 evidence — 2026-10-13

- Branch: `codex/b-03-registration-verification-recovery`; GitHub issue #10; PR #33.
- Registration atomically creates an `OPERATOR` user and `DRAFT`, active, publicly visible profile with normalized email and E.164 phone data. Duplicate registration returns the same generic response.
- Verification and reset tokens are random, stored only as SHA-256 hashes, expire after 24 hours and 30 minutes respectively, are single-use, and are invalidated when replaced.
- Resend and recovery responses do not reveal account existence. Verification uses the approved 60-second account cooldown and rolling 5/account/hour and 20/IP/hour limits; equivalent bounded controls protect other email-producing public endpoints.
- Email delivery uses Spring Mail with environment-only SMTP configuration and finite connection/write/read timeouts. Email stays disabled unless explicitly configured.
- Password reset preserves verification/application state and calls the session-revocation boundary. B-04 must replace its current no-op implementation when it adds Spring Session; no login session can exist before B-04.
- `AuthInputValidatorTests` and `AuthRateLimiterTests` passed locally on Java 21: 4 tests, 0 failures.
- Backend workflow `38450980182` passed V1→V2→V3 migration, Hibernate validation, and all 27 tests on isolated PostgreSQL 17, including 9 B-03 workflow tests: 0 failures, 0 errors, 0 skipped.
- A readability follow-up consolidated related request/email types, reducing the `auth` production package from 17 files to 11, and added repository/backend code maps. Workflow `38458744022` passed after the structure-only change.
- Review fixes added the public CSRF-token endpoint, stable malformed-JSON errors, asynchronous SMTP delivery, duplicate-registration timing normalization, and serialized token replacement. The rate limiter now uses the simpler FIFO `Queue` interface without changing behavior.
- JDK 25 packaging and 5 focused non-database tests passed locally. Backend workflow `38559593205` then passed all 31 tests against isolated PostgreSQL 17, including browser-style CSRF and concurrent token-issuance coverage: 0 failures, 0 errors, 0 skipped.
- Structure-only follow-up commit `14da1c2` moved authentication code into `config`, `controller`, `dto`, `exception`, and `service` subpackages while retaining package-private password-hash access in `identity`. The JDK 25 package build, 5 focused tests, and backend workflow run `38562354608` passed without changing behavior.
- PR #33 was reviewed and merged to `main` as `0e5fc7d77f7ac259c38477e415a64e5a01e94ecf` on 2026-10-14.
- No migration was added and shared Supabase was not read, migrated, or otherwise modified.

## Verified B-04 evidence — 2026-10-14

- Branch: `codex/b-04-session-auth-admin-bootstrap`; GitHub issue #11; PR #36.
- V4 adds the standard Spring Session JDBC tables with Flyway ownership, explicit `servisimibul_app` grants and RLS policies, and no `anon`/`authenticated` access. Spring Session's own schema initializer is disabled.
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout` use server-side sessions, CSRF, session-ID rotation, safe Problem Details for rejected credentials, and no JWT or browser token storage.
- Normal sessions expire after 30 minutes of inactivity. Optional remember-me sessions use a persistent `SBSESSION` HttpOnly, `SameSite=Lax`, path `/`, no-Domain cookie and a non-sliding 90-day absolute server deadline. `Secure` defaults to true and can be disabled only through the explicit local-development environment setting.
- At most two sessions are retained per account; a third login removes the oldest. The B-03 password-reset path now revokes real JDBC sessions through the completed `SessionRevoker` implementation.
- The explicitly enabled bootstrap runs without a web server, requires two distinct temporary admin credentials, creates only missing verified admins, refuses any result other than exactly two ADMIN accounts, exposes no HTTP route, logs no credentials, and preserves existing password hashes on rerun.
- Java 21 compilation and the two focused absolute-lifetime tests passed locally. The full local suite was not run because its configured datasource may be shared Supabase.
- Backend workflow run `38607834839` passed clean V1→V2→V3→V4 migration, Hibernate validation, all new session/bootstrap tests, and all existing regressions against isolated PostgreSQL 17: 43 tests, 0 failures, 0 errors, 0 skipped.
- Shared Supabase was not read, migrated, or otherwise modified. Applying V2–V4 and running the admin bootstrap remain separate post-merge operations requiring the normal approval gates.

## Verified J-02 contract evidence — 2026-10-14

- GitHub issue #8; PR #34 from branch `codex/j-02-offering-tariff-frontend-contract`; based on merged `origin/main` commit `3f064b856af546f73afe0132736fccd47006c52e`.
- Human-approved decisions D031–D036 define the optional-but-vehicle-backed offering model, vehicle lifecycle and constraints, persistent filesystem tariff store, immutable/atomic optimistic-concurrency writes, tariff metadata/band validation, and frontend baseline.
- Project brief, decision register, domain/data, security/API, roadmap, repository-state, and progress documents were reconciled to the same contract; superseded nullable-vehicle and unresolved-tariff-storage language was removed.
- `git diff --check` passed. Targeted repository searches found no remaining nullable offering-to-vehicle rule, unresolved tariff-storage placeholder, or obsolete tariff query parameter in the scoped documents.
- Maven and frontend tests were not run because J-02 changes documentation only and introduces no application source, dependency, configuration, or migration.
- No shared Supabase operation, production-setting change, migration, or database mutation was performed.

## Verified A-02 evidence — 2026-10-14

- GitHub issue #13; PR #35 from branch `codex/a-02-geography-school-catalog-api`; `origin/main` through merged B-03 commit `0e5fc7d77f7ac259c38477e415a64e5a01e94ecf` was integrated as merge commit `71bdf0b0383fc984f4e364c72b6738d561a525e2`.
- Public province/district/neighborhood reads, active-school list/detail with J-01 pagination and filters, and ADMIN create/partial-patch/activate/deactivate endpoints are implemented with DTOs and scoped RFC Problem Details.
- Tests cover anonymous sessionless reads, deterministic filtering/pagination, inactive-school exclusion, admin authorization, operator/anonymous denial, source identity conflicts, missing geography, optional-field clearing, and lifecycle visibility.
- `.\mvnw.cmd --batch-mode -DskipTests package` passed on JDK 25 with Java 21 release compilation, including all test sources.
- Full tests were not run locally because no disposable PostgreSQL instance is available: Docker is installed but its daemon is unavailable, and no local PostgreSQL client/service could be used. The shared Supabase database was intentionally not used.
- Backend workflow run `38476050909` passed clean V1→V2→V3 migration, Hibernate validation, existing security/persistence coverage, and all five A-02 API tests against isolated PostgreSQL 17.11: 19 tests, 0 failures, 0 errors, 0 skipped.
- Structure-only follow-up commit `b413a4a` moved the geography API into `controller`, `dto`, `service`, and `exception` subpackages. The JDK 25 package build and backend workflow run `38562568666` passed without changing behavior.
- After B-03 integration, the JDK 25 package build and 5 focused non-database authentication tests passed locally. Backend workflow run `38594885240` then passed all 36 tests against isolated PostgreSQL 17.11, including all 5 A-02 API tests: 0 failures, 0 errors, 0 skipped.
- No dependency, Flyway migration, runtime property/deployment configuration, shared Supabase, or production-setting change was made.
