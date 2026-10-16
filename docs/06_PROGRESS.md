# Progress ledger (update only after verification)

## Current stage: Gate 8 — A-08 database and performance hardening in review
Status: Gates 0–7, J-01, A-01, B-01–B-07, J-02, A-02–A-07, A-10, and the operator business-name optionality change are complete. B-07 and the combined local launcher are merged. A-08 is implemented, verified, and ready for review in PR #47; review and merge remain pending.

Shared Supabase is at Flyway schema version 7 as of 2026-10-16; the controlled V2–V7 migration and post-migration security audit passed. Repository migration V8 from merged A-07 has not been applied to the shared database.

| Gate | Status | Evidence/PR | Human approval |
|---|---|---|---|
| 0 Context + repo read-only review | complete | Repository/docs/backend review, 2026-10-11 | Workflow continued to Gate 1 |
| 1 Decide Supabase/Flyway existing-table strategy | complete | Read-only catalog inspection, 2026-10-12; D017 | Option A approved 2026-10-12 |
| 2 Build Flyway-backed backend foundation | complete | PR #1; disposable PostgreSQL checks; controlled Supabase cutover and read-only contract audit, 2026-10-12 | D018 and Option A cutover approved 2026-10-12 |
| 3 Geography entity model | complete | PR #3 merged; Java 21 package and disposable PostgreSQL 17 CI passed, 2026-10-12 | Geography persistence scope approved and reviewed 2026-10-12 |
| 4 Auth/session/email/admin review | complete | B-02 PR #32, B-03 PR #33, B-04 PR #36, and B-05 PR #41 merged; final B-05 workflow `38726247161` passed | B-05 reviewed and merged 2026-10-15 |
| 5 Operator school coverage + catalog | complete | A-02 PR #35 and A-03 PR #39 merged; A-03 workflow `38634143068` passed all 68 tests | A-03 reviewed and merged 2026-10-14 |
| 6 Parent public search | complete | A-04 PR #43 merged as `4868ad46f8ec7df664c33c70321f1ae3ac6a73f2`; PostgreSQL 17 workflow `38735898544` passed all 85 tests | Reviewed and merged 2026-10-15 |
| 7 Optional offerings/tariff JSON | complete | A-05 and A-06 merged; A-07 PR #45 merged as `9b2116521edd5b320807d71879ce57db49182d77`; final pre-merge PostgreSQL 17 workflow `38781566742` passed all 90 tests | A-07 reviewed and merged 2026-10-15 |
| 8 Pilot QA and UI | in progress | B-01, B-06, and B-07 merged; A-08 PR #47 post-`main`-merge PostgreSQL 17 workflow `38880661526` passed all 93 tests | B-07 reviewed and merged 2026-10-16; A-08 execution approved 2026-10-15 and review pending |

## Active work-package progress

| Task | Status | Evidence | Human approval |
|---|---|---|---|
| J-01 Authentication and API contract | complete | GitHub issue #7; PR #29 merged; decisions D020–D028 | Contract approved by Onat and reviewed by Atakan, 2026-10-13 |
| A-01 Flyway security and repository reconciliation | complete | GitHub issue #6; PR #31 merged as `3133dbb7dc6689cb0e2fb644ebffaf8df435e485`; PostgreSQL 17 workflows passed | Reviewed and merged 2026-10-13 |
| B-02 Identity persistence and security foundation | complete | GitHub issue #9; PR #32 merged as `3f064b856af546f73afe0132736fccd47006c52e`; PostgreSQL 17 Backend workflow run `38445768813` passed 14 tests | Scope and D029–D030 approved by Onat; reviewed and merged 2026-10-13 |
| B-03 Registration, verification, and recovery | complete | GitHub issue #10; PR #33 merged as `0e5fc7d77f7ac259c38477e415a64e5a01e94ecf`; PostgreSQL 17 workflow `38562354608` passed | Reviewed and merged 2026-10-14 |
| B-04 Session authentication and admin bootstrap | complete | GitHub issue #11; PR #36 merged as `db4927de0747ebbb9c7a88644d9fd5b26456f199`; PostgreSQL 17 workflow `38608426669` passed all 43 tests | Reviewed and merged 2026-10-14 |
| J-02 Offering, tariff, and frontend contract | complete | GitHub issue #8 completed; PR #34 merged as `7249cc622df20efba5e730f140d62b8da6f65ce0`; decisions D031–D036 | Decision bundle approved and merged 2026-10-14 |
| A-02 Geography and pilot school catalog API | complete | GitHub issue #13; PR #35 merged as `26e2677db815abfe36ff6ae3cd14bbe75f35b69a`; post-B-03 workflow `38594885240` passed 36 tests | Reviewed and merged 2026-10-14 |
| A-03 Operator-school relationships and general coverage | complete | GitHub issue #15; PR #39 merged as `c3b6a7035c14184acc3a0d2f27fd4e88f036a502`; PostgreSQL 17 workflow `38634143068` passed all 68 tests | Reviewed and merged 2026-10-14 |
| A-05 UKOME tariff backend | complete | GitHub issue #20 closed; PR #37 merged as `9d7a2c29cb50977ce19898fedbcf02252d482642`; PostgreSQL 17 workflow `38613779518` passed all 62 tests | Reviewed and merged 2026-10-14 |
| A-06 Vehicle and ServiceOffering CRUD | complete | GitHub issue #21; PR #40 merged as `ac4a499ef9cbbede81ffc19be10cb711576fb66b`; PostgreSQL 17 workflow `38707204509` passed all 74 tests | Reviewed and merged 2026-10-15 |
| A-10 Backend deployment and observability | complete | GitHub issue #27; PR #30 merged as `b98e74246ab382908ee01410f7f251378ac1908e`; workflow `38610241315` passed all 50 tests | Sequencing override explicitly requested 2026-10-13; reviewed and merged 2026-10-14 |
| B-01 Frontend foundation | complete | GitHub issue #12; PR #38 merged as `1d7c5993328173e64e5cd725094f53b3aa76bd20`; final Node 24 workflow `38722048633` passed | Reviewed and merged 2026-10-15 |
| B-05 Operator profile and application lifecycle | complete | GitHub issue #14; PR #41 merged as `943706428b7c2d90525c4365de82799eac49e987`; final PostgreSQL 17 workflow `38726247161` passed | Reviewed and merged 2026-10-15 |
| A-04 Anonymous public discovery backend | complete | PR #43 merged as `4868ad46f8ec7df664c33c70321f1ae3ac6a73f2`; PostgreSQL 17 workflow `38735898544` passed all 85 tests | Reviewed and merged 2026-10-15 |
| Operator business-name optionality | complete | PR #44 merged as `6c19040643983bc35ace85c594c2e2c2d064dc83`; merged-head workflow `38749758044` passed all 87 tests | Domain-wide optionality approved, reviewed, and merged 2026-10-15 |
| A-07 Offering-specific coverage and discovery enrichment | complete | GitHub issue #22 closed; PR #45 merged as `9b2116521edd5b320807d71879ce57db49182d77`; final pre-merge PostgreSQL 17 workflow `38781566742` passed all 90 tests | Reviewed and merged 2026-10-15 |
| A-08 Database and performance hardening | in review | GitHub issue #24; PR #47; measured PostgreSQL 17 workflow `38788568472` and post-`main`-merge workflow `38880661526` passed all 93 tests; detailed evidence in `docs/08_DATABASE_PERFORMANCE.md` | Execution approved 2026-10-15; review pending |
| B-06 Operator workspace | complete | GitHub issue #17; PR #42 merged as `1aa8683`; Node 24 Frontend workflow `38730195352` passed all gates | Reviewed and merged 2026-10-15 |
| B-07 Admin workspace | complete | GitHub issue #18; PR #46 merged as `f60b6346de780168fc4789457cfc2c57b33981b2`; Backend workflow `38775737560` passed 87 tests; Frontend workflow `38775737657` passed all gates and 19 tests | Reviewed and merged 2026-10-16 |

J-01 is documentation-only: it changes no Java code, dependency, migration, application configuration, or shared database state. The contract fixes registration, verification/recovery, session/cookie/CSRF behavior, application lifecycle, admin bootstrap, API errors, pagination, and public contact rules before B-02 implementation begins.

A-01 adds V2 without changing V1, removes application-role access to Flyway history, extends the PostgreSQL integration test, and reconciles the stale repository snapshot. No shared Supabase operation was part of the pull request.

B-02 adds V3 identity persistence, default-deny security, database-backed authentication prerequisites, BCrypt password hashing, SHA-256 token hashing, atomic token consumption, and authenticated-principal-derived current-user identity. B-03 supplies registration, verification/recovery controllers, and email delivery. B-04 supplies the Spring Session lifecycle and admin bootstrap. No shared Supabase operation is part of these pull requests.

J-02 is documentation-only: it fixes the vehicle-backed offering constraints and lifecycle, tariff JSON persistence/version/concurrency/interval contract, and frontend toolchain/deployment contract before implementation. It changes no Java or frontend source, dependency, Flyway migration, application configuration, production setting, or shared database state.

A-02 adds anonymous geography/active-school reads and ADMIN-only pilot-school create, partial update, activation, and deactivation. It reuses the existing V1 geography schema, keeps bulk CSV import out of scope, and adds no migration or shared Supabase operation.

A-03 PR #39 adds V5 plus session-owned operator-school and same-province general-coverage APIs. It serializes lifecycle and coverage mutations with an owned relationship row lock, replaces coverage transactionally, and exposes another operator's relationship only as not found. V5 has not been applied to shared Supabase.

A-06 adds V6 plus session-owned vehicle and ServiceOffering APIs. Vehicle deactivation is lifecycle-based and transactionally unpublishes dependent offerings. A-07 now supplies the per-offering coverage and publication checks on its feature branch. V6 has not been applied to shared Supabase.

A-10 was intentionally started before its planned Phase 4 dependencies at human request. It adds production and migration profiles, status-only health/readiness, ECS JSON logging, B-03-compatible SMTP connection configuration, secret-safe diagnostics, and the deployment/rollback runbook. A-10 does not claim the product is production-ready: A-08, A-09, B-10, and remaining feature implementation are still required.

A-04 adds the anonymous school-and-neighborhood operator search with the full derived publication predicate, distinct stable pagination, public phone exposure, no authentication email, and no vehicle/offering visibility dependency. A-07 enriches each already-paginated operator with matching published offerings without changing base eligibility. No migration or shared Supabase operation is part of A-04.

## Verified operator business-name optionality evidence — 2026-10-15

- Branch: `codex/business-name-optional`; PR #44; based independently on `origin/main` commit `943706428b7c2d90525c4365de82799eac49e987`.
- Approved decision D037 supersedes the business-name requirement in D009 and D020 while retaining the mandatory public contact phone.
- V7 drops only the `operator_profile.business_name` NOT NULL requirement and retains the 2–120-character check for non-null values; it does not rewrite or delete existing data.
- Registration accepts missing, explicit-null, or blank `businessName` as `NULL`; a supplied name remains trimmed and validated. Profile PATCH can clear the value, and response DTOs expose it as nullable.
- `git diff --check` passed. `.\mvnw.cmd --batch-mode -DskipTests package` passed on JDK 25 with Java 21 release compilation, including all test sources.
- `AuthInputValidatorTests` passed locally: 4 tests, 0 failures, 0 errors, 0 skipped.
- Merged-head PostgreSQL 17 Backend workflow `38749758044` passed clean V1→V7 migration, repeat-migration and Hibernate validation, nullable registration/profile lifecycle coverage, A-04 discovery coverage, and all regressions: 87 tests, 0 failures, 0 errors, 0 skipped.
- Docker was not required locally; GitHub Actions supplied its own isolated PostgreSQL service. Shared Supabase was not read, migrated, or modified, and applying V7 remains a separate post-merge operation requiring the normal approval gate.

## Verified A-07 evidence — 2026-10-15

- Branch: `codex/a-07-offering-coverage`; GitHub issue #22; PR #45; based on merged `main` commit `6c19040643983bc35ace85c594c2e2c2d064dc83`.
- V8 adds the protected `service_offering_coverage` table with unique offering/general-coverage pairs, cascading foreign keys, backend-only grants, and RLS.
- The owner API replaces offering coverage by neighborhood ID, validates the exact parent OperatorSchool subset, permits empty draft coverage, and enforces valid coverage plus an active owned vehicle before publication.
- General coverage replacement is diff-based: unchanged IDs survive, removed dependent links are reconciled, and only published offerings left with zero coverage are unpublished. OperatorSchool deactivation also unpublishes dependent offerings.
- Anonymous discovery still paginates distinct operators first and then performs one page-scoped offering query. Only matching published offerings with an active owned vehicle are returned; absence of a matching offering never removes the operator.
- Public offering details include `offeringId`, mandatory `vehicleCapacity`, nullable `availableSeats`, and nullable `description`; vehicle identifiers and plates remain private. Clients can display `availableSeats/vehicleCapacity` only when the operator supplies `availableSeats`.
- `git diff --check` passed. `.\mvnw.cmd --batch-mode -DskipTests package` passed on JDK 25 with Java 21 release compilation for 106 production sources and 21 test sources. The 14 focused non-database validation, rate-limit, session, and tariff regressions passed with 0 failures/errors/skips.
- After merging current `main` through B-06, PR #45 PostgreSQL 17 workflow `38781566742` passed clean V1→V8 migration, repeat migration, Hibernate validation, RLS/grant checks, offering-coverage lifecycle/reconciliation tests, optional-seat public discovery enrichment tests, and every regression: 90 tests, 0 failures, 0 errors, 0 skipped.
- Docker and shared Supabase were not used. Applying V8 remains a separate post-merge operation requiring a fresh read-only audit and explicit approval.

## Verified A-08 evidence — 2026-10-15

- Branch: `codex/a-08-database-performance-hardening`; GitHub issue #24; PR #47; based on merged A-07 commit `9b2116521edd5b320807d71879ce57db49182d77` and reconciled with `main` at `bf1562ecf4221f950744195d2c36cfe04a334f42`.
- The deterministic, test-only pilot fixture contains 2,000 operators, 4,000 operator-school relationships, 20,000 general coverage rows, 2,000 vehicles, 4,000 offerings, and 12,000 offering-coverage rows. It runs transactionally and is rolled back; it is not a Flyway migration or production seed.
- The baseline workflow `38786531568` intentionally failed the 500 ms plan ceiling: discovery-page execution was 944.482 ms because the same-province comparison caused repeated geography traversal inside the correlated operator predicate.
- The optimized service validates the school/neighborhood province once and retains exact school/neighborhood membership in the paginated query. Same-province cross-district matching and cross-province exclusion remain covered by the A-04 API regression suite.
- PostgreSQL 17 workflow `38788568472` measured discovery page 5.575 ms, discovery count 4.724 ms, offering enrichment 1.184 ms, admin page 0.548 ms, and admin count 0.205 ms. The discovery page improved about 169 times and every measured plan passed the 500 ms regression ceiling.
- Existing V3/V5/V6/V8 indexes serve every measured query. Small in-memory sorts peak at 35 kB, so no speculative index and no V9 migration were added.
- Hibernate statistics enforce five SQL statements for a populated public discovery request and two for the admin queue, guarding against N+1 regressions. Two complete pagination passes return the same 120 unique operator IDs.
- The security suite enumerates all 16 application tables and three sequences, then verifies RLS, exact runtime policies/grants, absence of `anon`/`authenticated`/`PUBLIC` direct privileges, non-owner runtime access, no grant options, no RLS bypass, and protected Flyway history.
- Empty PostgreSQL 17 CI replay applied V1–V8 successfully, Hibernate validation passed through the restricted runtime role, and a second Flyway migration executed zero migrations.
- `git diff --check` and the Java 21-targeted package/test-source compilation passed locally on JDK 25. Measured workflow `38788568472` and post-`main`-merge workflow `38880661526` each passed all 93 tests with 0 failures, 0 errors, and 0 skipped. Detailed targets and plans are recorded in `docs/08_DATABASE_PERFORMANCE.md`.
- Docker and shared Supabase were not used locally. GitHub Actions supplied and destroyed its isolated PostgreSQL 17 service. Applying V2–V8 to shared Supabase remains a separate operation requiring a fresh read-only audit and explicit approval.

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

## Verified A-10 local evidence — 2026-10-13

- Branch: `codex/a-10-backend-deployment-observability`.
- Spring Boot Actuator and mail dependencies compile under JDK 25 with Java 21 release compatibility; the repackaged JAR build succeeded.
- `ObservabilityEndpointTests` and `ProductionConfigurationTests`: 7 tests, 0 failures, 0 errors, 0 skipped.
- Production startup in the focused test emitted ECS JSON, exposed only the health endpoint, omitted configured database/SMTP secret values, and did not create/log Spring Boot's temporary generated user password.
- `/livez`, `/readyz`, and Actuator health groups returned only aggregate status/probe-group information; sensitive Actuator endpoints and the discovery page were unavailable; cross-origin requests received no Actuator CORS header.
- A full local `./mvnw --batch-mode verify` was attempted without database environment variables. The 7 A-10 tests passed, while the 2 pre-existing geography integration tests could not create a datasource because no disposable PostgreSQL 17 service is installed locally. Shared Supabase was deliberately not used.
- PR #30 Backend workflow run #9 then passed the complete Maven verification against its isolated PostgreSQL 17 service.
- After B-03 merged, the A-10 branch was reconciled with `main`: the production mail contract now uses B-03's `SB_MAIL_*` names, and the runbook reflects J-02's approved tariff-volume decision. Twelve focused A-10/B-03 tests and the Java 21-targeted package build passed locally on 2026-10-14. PostgreSQL 17 workflow `38592108976` then passed all 38 tests: 0 failures, 0 errors, 0 skipped.
- After B-04 merged, A-10 was reconciled with `main`: duplicate session properties were reduced to one `spring.session.timeout` and one `SB_COOKIE_SECURE` contract. The 9 focused configuration, observability, and absolute-session-lifetime tests passed locally on JDK 25.
- PostgreSQL 17 workflow `38610241315` then passed the complete post-integration Maven verification: 50 tests, 0 failures, 0 errors, 0 skipped.
- PR #30 was reviewed and merged to `main` as `b98e74246ab382908ee01410f7f251378ac1908e`; the subsequent main push workflow `38610717696` succeeded.
- No migration or shared database operation was performed.

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
- PR #36 was reviewed and merged to `main` as `db4927de0747ebbb9c7a88644d9fd5b26456f199`; final workflow `38608426669` passed all 43 tests.
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

## Verified B-01 local evidence — 2026-10-14

- Branch: `codex/b-01-frontend-foundation`; GitHub issue #12.
- Added the approved Node.js 24/npm Vite React+TypeScript foundation with strict TypeScript, ESLint, Prettier, React Router Data Mode, React Hook Form, Zod, Vitest, React Testing Library, and MSW. The lockfile is committed and npm reported zero known vulnerabilities at installation time.
- Public, operator, and admin route shells are accessible and responsive navigation only; Spring Security and backend ownership checks remain authoritative.
- The shared API client always uses same-origin credentials, obtains Spring's CSRF header/token for state-changing requests, normalizes both existing backend field-error shapes, validates successful payloads with Zod, and marks only authenticated 401 responses as expired sessions.
- Node.js 24.22.0 checks passed: Prettier check, ESLint, strict TypeScript project build, 7 Vitest/Testing Library/MSW tests, and the Vite production build.
- PR #38 frontend workflow `38614330741` repeated the clean npm install and all five frontend gates successfully on Node.js 24.
- Onat manually accepted the initial route-shell baseline, then approved a shared polish pass. CSS-only motion/design tokens now provide short content entrances, interactive feedback, a pulsing loading indicator, clearer compact navigation, and a complete `prefers-reduced-motion` fallback; all five local gates and 7 tests still pass.
- Onat then requested actual page-to-page animation. Every internal navigation link now uses React Router's built-in View Transitions integration, with short exit/entry motion, a CSS fallback for unsupported browsers, and an explicit reduced-motion override. Formatting, lint, strict type-check, 8 tests, and the production build pass locally on Node.js 24.
- The local Vite server started successfully. Browser automation could not attach because the installed computer-control helper failed to initialize after its allowed retry; visual route inspection remains the reviewer check.
- No backend source, migration, shared Supabase state, production setting, or secret was changed.

## Verified A-05 local evidence — 2026-10-14

- Branch: `codex/a-05-ukome-tariff-backend`; GitHub issue #20; PR #37. The branch started from merged A-02 and then integrated current `main` through merged B-04 and A-10.
- The public endpoint reads the current official tariff by province code without requiring authentication. The ADMIN endpoint accepts an explicit expected version, validates the complete document, preserves immutable versions, and atomically replaces `current.json` on the configured backend-only filesystem.
- Validation covers province identity, required provenance/effective dates, absolute HTTPS source URL, `TRY`, safe immutable version identifiers, contiguous sorted half-open bands, a zero first boundary, an open final boundary, and nonnegative integer-kuruş amounts.
- Per-province in-process locking plus expected-version comparison permits one concurrent winner and returns stable `tariff_version_conflict` Problem Details to stale writers. Rejected writes preserve the previous complete current document.
- `.\mvnw.cmd --batch-mode "-Dtest=TariffValidatorTests,FileTariffStoreTests" test` passed 7 focused validation, filesystem, failure, and concurrency tests: 0 failures, 0 errors, 0 skipped.
- After B-04 and A-10 merged, `.\mvnw.cmd --batch-mode "-Dtest=TariffValidatorTests,FileTariffStoreTests,ProductionConfigurationTests,SessionLifetimeFilterTests,AuthEmailSenderTests,AuthInputValidatorTests,AuthRateLimiterTests" test` passed 17 focused tariff/configuration/session/authentication tests: 0 failures, 0 errors, 0 skipped.
- `.\mvnw.cmd --batch-mode -DskipTests package` passed on JDK 25 with Java 21 release compilation, including all test sources.
- Isolated PostgreSQL 17 Backend workflow `38613779518` passed the final application head after canonical integer-kuruş serialization: clean V1→V2→V3→V4 migration, Hibernate validation, five tariff API tests, four tariff storage tests, three tariff validation tests, and all existing regressions; 62 tests, 0 failures, 0 errors, 0 skipped.
- PR #37 was reviewed and merged to `main` as `9d7a2c29cb50977ce19898fedbcf02252d482642`; GitHub issue #20 closed as completed.
- Shared Supabase was not read, migrated, or modified.

## Verified A-03 evidence — 2026-10-14

- Branch: `codex/a-03-operator-school-coverage`; GitHub issue #15; PR #39; based on merged `main` commit `9d7a2c29cb50977ce19898fedbcf02252d482642`.
- V5 creates `operator_school` and `operator_school_coverage` with approved foreign keys and unique pairs, coverage cascade on relationship deletion, explicit `servisimibul_app` grants, role-scoped RLS policies, and no `anon`/`authenticated` access.
- Operator identity is derived only from the authenticated session. List/create/active-state patch/delete and full coverage replacement use DTOs, ownership-scoped lookups, CSRF/role protection, and safe Problem Details.
- Only active schools can be attached. Same-province neighborhoods in another district are accepted, cross-province and duplicate coverage are rejected, and invalid replacement leaves the earlier complete coverage set unchanged.
- PATCH, DELETE, and coverage replacement lock the owned `operator_school` row. Coverage replacement deletes and reinserts within one transaction; the concurrent test proves the final set is one complete submitted replacement rather than a mixed set.
- The initial isolated workflow `38633575254` found one delete-path persistence-context error after coverage had been replaced earlier in the same test transaction. The fix explicitly deletes and clears managed coverage before removing the relationship while retaining the database cascade as an integrity backstop.
- `git diff --check` passed. The Java 21-targeted package build, including all test sources, passed locally on JDK 25.
- Final isolated PostgreSQL 17 workflow `38634143068` passed clean V1→V2→V3→V4→V5 migration, Hibernate validation, migration/RLS/grant checks, all A-03 API and concurrency tests, and all regressions: 68 tests, 0 failures, 0 errors, 0 skipped.
- PR #39 was reviewed and merged to `main` as `c3b6a7035c14184acc3a0d2f27fd4e88f036a502`; GitHub issue #15 closed as completed.
- No shared Supabase read, migration, or mutation was performed. Applying V2–V5 remains a separate post-merge operation requiring a fresh read-only audit and explicit approval.

## Verified A-06 evidence — 2026-10-15

- Branch: `codex/a-06-vehicle-service-offering-crud`; GitHub issue #21; PR #40; based on merged A-03 commit `c3b6a7035c14184acc3a0d2f27fd4e88f036a502`.
- V6 creates `vehicle` and `service_offering` with ownership foreign keys, canonical globally unique plates, positive capacity and nonnegative-seat checks, timestamps, indexes, explicit `servisimibul_app` grants, role-scoped RLS policies, and no `anon`/`authenticated` access.
- Session-owned vehicle and offering endpoints enforce active owned vehicles, owned OperatorSchool references, seat-to-capacity limits, not-found ownership isolation, CSRF, and safe Problem Details. No monthly price was introduced.
- Vehicle deactivation transactionally unpublishes dependent offerings; reactivation never republishes them. Capacity cannot be reduced below an existing offering's available seats, and deleting an OperatorSchool cascades only its offerings while retaining vehicles.
- Offering publication fails closed as `offering_coverage_required` until A-07 adds valid per-offering coverage; vehicles and offerings remain optional and empty lists are supported.
- `git diff --check` passed. The Java 21-targeted package, including all test-source compilation, passed locally on JDK 25. Full local database tests were not run because Docker/PostgreSQL was unavailable, and shared Supabase was deliberately not used.
- Isolated PostgreSQL 17 workflow `38707204509` passed clean V1→V2→V3→V4→V5→V6 migration, repeat migration, Hibernate validation, migration/RLS/grant checks, all six A-06 API tests, and all regressions: 74 tests, 0 failures, 0 errors, 0 skipped.
- No shared Supabase read, migration, or mutation was performed. Applying V2–V6 remains a separate post-merge operation requiring a fresh read-only audit and explicit approval.

## Verified B-05 evidence — 2026-10-15

- Branch: `codex/b-05-operator-profile-lifecycle`; GitHub issue #14; PR #41; based on merged B-01 commit `1d7c5993328173e64e5cd725094f53b3aa76bd20`.
- Operator endpoints read and patch the four approved profile fields and move only `DRAFT` applications to `PENDING` or `CHANGES_REQUESTED` applications back to `PENDING`; protected account, approval, and review state is not client-settable.
- Admin endpoints provide a stable, bounded application queue plus detail, approval, reason-required revision requests, and suspension. Review history is append-only, self-review is rejected, and row locks serialize lifecycle decisions.
- Approved profile edits retain approval. Suspension deactivates the profile, disables the account, and revokes all server-side sessions; no duplicate publication flag was added.
- Existing role-based route rules and CSRF protection secure all mutations. Stable RFC Problem Details cover validation, state, not-found, and concurrent-update failures.
- `AuthInputValidatorTests` passed locally: 3 tests, 0 failures, 0 errors, 0 skipped. The Java 21-targeted package, including all test-source compilation, passed locally on JDK 25.
- Isolated PostgreSQL 17 workflow `38726002167` passed the complete Maven verification. Local database tests were not run because Docker/PostgreSQL is unavailable, and shared Supabase was deliberately not used.
- No dependency, migration, application configuration, frontend source, shared Supabase state, or production setting was changed.

## Verified A-04 evidence — 2026-10-15

- Branch: `codex/a-04-anonymous-public-discovery`; based on refreshed `origin/main` merge commit `943706428b7c2d90525c4365de82799eac49e987`.
- The anonymous collection endpoint applies email-verification, enabled-account, approved-profile, active-profile, public-toggle, active-school, active-relationship, exact-school, exact-neighborhood, and same-province predicates in one distinct operator query with stable business-name/UUID ordering.
- Operator pagination occurs before optional details and does not join Vehicle or ServiceOffering. Zero-vehicle, zero-offering, and draft-only operators remain eligible. `publishedOfferings` is intentionally empty until A-07 implements valid offering-specific coverage; authentication email is not exposed.
- The database-backed API suite covers empty optional data, wrong school/neighborhood, cross-district same-province matching, cross-province fail-closed behavior, every publication flag, inactive schools/relationships, duplicate related rows, stable pagination, safe parameter errors, and anonymous sessionlessness.
- `git diff --check` passed. `.\mvnw.cmd --batch-mode -DskipTests package` passed on JDK 25 with Java 21 release compilation, including all 21 test source files.
- Thirteen focused non-database authentication, session, tariff-validation, and tariff-storage regression tests passed: 0 failures, 0 errors, 0 skipped.
- PR #43 Backend workflow `38735898544` passed clean V1→V6 migration, Hibernate validation, all five A-04 API tests, and every regression against isolated PostgreSQL 17: 85 tests, 0 failures, 0 errors, 0 skipped.
- Docker is not an application dependency and was not required for verification; GitHub Actions supplied the isolated PostgreSQL service. Shared Supabase was deliberately not used.
- No dependency, Flyway migration, application property, frontend source, shared Supabase state, or production setting was changed.

## Verified B-06 evidence — 2026-10-15

- Branch: `codex/b-06-operator-workspace`; GitHub issue #17; PR #42; based on merged B-05 commit `943706428b7c2d90525c4365de82799eac49e987`.
- Public operator screens cover registration, email-link verification, login, and the optional 90-day Remember Me choice using the existing same-origin session and CSRF client. API responses are validated before use and server field errors are associated with their matching controls.
- The authenticated operator workspace guards routes through `/auth/me`, handles expired sessions, supports logout, and provides responsive profile/application and school/general-coverage flows. Native labeled inputs, checkboxes, fieldsets, status regions, skip links, visible focus, and reduced-motion behavior preserve keyboard and accessibility support.
- Visual-review follow-up removed user-facing pilot terminology, balanced auth-card alignment and spacing, added shared decorative roads with the user-provided top-view school bus asset across every public page, and placed the concise black homepage wordmark and subtitle on a readable surface card; the decoration is hidden from assistive technology and stops under reduced-motion preferences.
- Profile editing preserves the approved lifecycle and supports draft submission plus correction editing/resubmission. B-05 exposes `CHANGES_REQUESTED` but does not expose the admin's written reason to the operator; the UI therefore explains the required edit/resubmit step without inventing or leaking a reason. A later backend contract change is required to display it.
- School management uses only active pilot-school search results. Coverage options are fetched from every district in the attached school's province, grouped by district, and may span districts; selected identifiers remain untrusted and backend ownership/province validation stays authoritative.
- Local Node 24 checks passed in one sequential run: Prettier, ESLint, strict TypeScript, 15 Vitest/Testing Library/MSW tests, and the Vite production build.
- Frontend workflow `38730195352` repeated clean npm installation, formatting, lint, type-check, all tests, and the production build successfully.
- The local Vite server started successfully, but the in-app browser could not reach localhost and Chrome/Edge controls were unavailable. Visual and real backend-session verification remains the reviewer gate.
- No dependency, lockfile, backend source, migration, application configuration, shared Supabase state, production setting, or secret was changed.

## Verified B-07 local evidence — 2026-10-15

- Branch: `codex/b-07-admin-workspace`; GitHub issue #18; PR #46; based on merged B-06 commit `1aa8683b1999f8d77db97f2a7a4b0533f4ead41a`.
- The ADMIN-only route guard and workspace provide application queues, profile/review detail, reason-required correction requests, approval, and confirmed suspension. Spring Security and backend lifecycle checks remain authoritative.
- The school catalog screen creates and edits schools, uses the existing province/district/neighborhood reference endpoints, and confirms activation changes. A minimal paginated `GET /api/v1/admin/schools` endpoint includes inactive schools so administrators can find and reactivate them; the anonymous catalog remains active-only.
- Frontend ESLint and strict TypeScript passed. All 19 Vitest/Testing Library/MSW tests passed, including admin-role denial, revision-reason validation, approval/suspension confirmation, school creation, and inactive-school retention. The Vite production build passed.
- The touched frontend files pass Prettier. The repository-wide local Prettier check reports 12 pre-existing CRLF worktree files under Windows `core.autocrlf=true`; those tracked blobs remain LF and are outside the B-07 diff.
- The Java 21-targeted Maven package passed and compiled all 104 main and 21 test source files. The focused database-backed test could not start because no JDBC URL was supplied; it failed before executing tests with `'url' must start with "jdbc"`. Shared Supabase and the ignored `.env` were deliberately not used.
- PR #46 Backend workflow `38775737560` passed clean isolated PostgreSQL verification and all 87 tests. Frontend workflow `38775737657` passed formatting, lint, strict TypeScript, all 19 tests, and the production build.
- Onat completed the visual review and approved PR #46 for merge on 2026-10-16.
- No dependency, lockfile, migration, application configuration, shared Supabase state, production setting, or secret was changed.

## Verified shared Supabase V2–V7 migration evidence — 2026-10-16

- An approved read-only preflight found exactly one successful Flyway row at V1, the four empty geography tables, no V2–V7 target-table conflicts, and the required non-privileged `anon`, `authenticated`, and `servisimibul_app` roles.
- With admin bootstrap explicitly disabled, Flyway validated all seven repository migrations and successfully applied V2, V3, V4, V5, V6, and V7 to Supabase PostgreSQL 17.11. The schema finished at V7.
- The same no-web startup then completed Hibernate `ddl-auto=validate` through the restricted runtime datasource and exited successfully on Java 21.
- A rolled-back read-only audit confirmed successful history rows V1–V7, RLS enabled on all 15 application tables, and 15 table-scoped policies.
- `anon` and `authenticated` cannot read `app_user`; `servisimibul_app` can read application data but cannot read `flyway_schema_history`; `operator_profile.business_name` is nullable.
- `app_user` remained empty, confirming that the migration did not create either ADMIN account. Admin bootstrap remains a separate explicitly enabled operation.
- The ignored local `.env` and all credential values were left unchanged; no credentials were printed or committed.

## Verified Supabase ADMIN bootstrap evidence — 2026-10-16

- After the approved V2–V7 migration, the one-shot no-web bootstrap ran against the restricted runtime datasource with Flyway explicitly disabled for that process.
- The first attempt rejected an invalid first password before any write. A read-only check confirmed zero users afterward.
- After the password was corrected, the transactional bootstrap completed successfully on Java 21 without logging either identity or password.
- A rolled-back read-only audit confirmed exactly two users: both have role `ADMIN`, distinct emails, enabled accounts, and verified email timestamps. No operator profile or session row was created.
- The bootstrap enablement was process-only. The ignored local `.env` and credential values were not modified or committed.

## Verified frontend tooling setup — Impeccable — 2026-10-16

- The approved project-scoped install ran on `codex/dev-launcher` using the existing NVM Node.js 24.22.0 installation: `npx.cmd --yes impeccable@4.6.0 install --providers=codex --scope=project`.
- Before execution, the published npm archive passed its registry SHA-512 integrity check, its launcher matched the reviewed official source, and npm metadata confirmed no install/postinstall scripts in either the CLI package or its Windows engine package.
- Impeccable 4.6.0 is installed under `.agents/skills/impeccable/`; `.codex/hooks.json` references the correct project-local Windows launcher for PostToolUse and Stop. The user confirmed the skill is visible, and it appears in the session's available-skills catalog.
- The Windows launcher returned `4.6.0`; `engine-probe` returned `impeccable-engine 0.1.15`. The installed engine's SHA-256 matched the official engine-v0.1.15 Windows release checksum. Its machine-specific `scripts/bin/` directory is excluded from Git; another developer's launcher may download that engine on first use.
- After the user reported approving the hooks through Codex, read-only inspection found saved `trusted_hash` entries for this project's PostToolUse and Stop hooks. Hook execution was not separately tested, and `/impeccable init` was not run.
- The user-level Codex configuration checksum remained unchanged during installation; it subsequently changed when Codex saved the user's hook trust entries. This setup did not edit MCP entries. No application source, application dependency/lockfile, backend, database, Supabase, or production setting was modified. Existing unrelated untracked files were preserved.
- 21st MCP and Playwright MCP verification are recorded below. No component generation, publishing, browser download, commit, push, or merge was performed.

## Verified frontend tooling setup — 21st MCP — 2026-10-16

- Published `@21st-dev/cli` 1.18.0 passed its npm archive integrity check and source review before the approved login ran with Node.js 24.22.0. The user completed browser sign-in; the CLI exited successfully and saved personal authentication outside the repository under the user's `.config/21st/auth.json`.
- The already-installed CLI's `init --client codex` printed the official remote-server template. The installed Codex CLI registered only the requested `21st` server at `https://21st.dev/api/mcp`, referring to `API_KEY_21ST` rather than embedding a token in the configuration. The saved login token was placed in the Windows user environment without printing its value.
- A strict text-preservation assertion flagged a configuration difference beyond the removed 21st block. Follow-up inspection confirmed that all nine previously listed MCP server names and enabled states, the inspected plugin enablement settings, and this project's hook trust entries remain present. Exact preservation of every configuration line was not established.
- Authenticated MCP `tools/list` succeeded and exposed 51 tools. A read-only `tools/call` to `search` for `button`, scoped to components with limit 3, returned three component metadata results. No component code was fetched, generated, installed, or published.
- Personal Codex configuration and `API_KEY_21ST` are machine-local and must be configured independently on the other developer's computer. Both new MCP namespaces subsequently appeared in this chat's tool catalog, confirming Codex discovery after the environment refresh.
- Application source and application dependency/lockfile diffs remain empty. No backend, database, Supabase, or production setting was changed, and existing unrelated untracked files were preserved.

## Verified frontend tooling setup — Playwright MCP — 2026-10-16

- After explicit approval, `npx.cmd --yes @playwright/mcp@0.0.83 --version` installed the package into the personal npm cache and returned `Version 0.0.83`. Its official npm archive passed the registry integrity check; the package and its pinned Playwright dependencies have no install/postinstall scripts. The official package pins Playwright `1.64.0-alpha-1790635538000`.
- The installed Codex CLI registered `playwright` in the existing personal configuration. Its stdio launcher uses `cmd.exe /d /c` with the absolute NVM Node.js 24.22.0 `npx.cmd` path, pinned package version, `--browser msedge --isolated --headless`, and a personal output directory under `%USERPROFILE%/AppData/Local/ServisimiBul/playwright-mcp`. No project dependency or lockfile was changed.
- The configured stdio launch command passed MCP initialization and tool discovery (25 tools). Isolated headless Edge opened `https://example.com/`; accessibility snapshot and read-only DOM inspection passed. A full-page PNG was created outside the repository, verified as 1280×775 pixels and 46,987 bytes, and visually inspected. The isolated browser and test process were closed afterward; no browser download was required.
- The first smoke-test assertion incorrectly assumed a heading in the public page. Navigation had succeeded; the corrected check used the page's actual accessibility content, and the complete smoke test then exited successfully.
- Raw JSON preservation checks were sensitive to Codex's nondeterministic object-key ordering: consecutive read-only listings differed as raw JSON but matched after recursive key sorting. Final inspection retained all nine original MCP server names and enabled states, plus the newly configured 21st and Playwright entries. Exact preservation of every original TOML line was not established.
- Final checks confirmed that the saved personal 21st token is absent from every added/modified tooling text file; the high-confidence secret-marker scan passed. Application source and application dependency/lockfile diffs remain empty, and nothing is staged. The Impeccable platform binary remains ignored by Git.
- Impeccable skill discovery is verified and saved trust entries exist for both project hooks; automatic hook execution was not separately tested. Both 21st and Playwright subsequently appeared in this chat's tool catalog. Each additional developer must still restart their own Codex Desktop after personal configuration.
- Git-shareable changes are the Impeccable skill text/scripts, `.codex/hooks.json`, the root binary-ignore rule, and this progress ledger. Each developer independently configures personal 21st authentication, Windows environment, MCP server entries, and hook trust. If these shared skill files are already present on the second computer, skip project reinstallation; its launcher may download the platform engine on first use.
- No homepage design, Tailwind/shadcn integration, application source change, backend/database/Supabase operation, production change, component retrieval/generation/publishing, commit, push, or merge was performed.
- The shared handoff includes `docs/09_FRONTEND_TOOLING.md` and the upstream license/third-party notices. The user approved committing only these shared tooling files on `codex/frontend-tooling`; personal configuration and unrelated local files are excluded.
- Sharing checks passed for five vendored JavaScript files, four JSON files, both Windows hook paths, and the POSIX launcher syntax. A clean temporary Windows launcher/cache downloaded engine 0.1.15, passed its own checksum verification and engine probe, and matched the previously verified installed engine hash; the temporary test directory was removed. The POSIX syntax check required execution outside the Windows sandbox because Git Bash could not start inside it.
- The complete staged whitespace check reports upstream-only whitespace in `reference/extract.md`, `reference/harden.md`, and `reference/optimize.md`; these vendored files are kept unchanged. The project-authored handoff documentation and tooling configuration pass the scoped whitespace check. Application CI workflows are path-filtered to the application directories and are not expected for this tooling-only change.


## Verified combined local launcher evidence — 2026-10-16

- Root `dev.ps1` starts the Spring Boot backend and Vite frontend together without adding a dependency. It auto-selects Java 21+ and NVM-installed Node 24, loads the ignored backend `.env` only into the backend child process, and forces Flyway and ADMIN bootstrap off for ordinary local runs.
- Local HTTP startup explicitly uses the `local` profile and an insecure localhost-only session cookie; the frontend receives no newly loaded backend database or ADMIN credential variables.
- The launcher was first exercised on the B-07 head from Windows PowerShell 5 with Java 25 and Node 24.22.0. Its Java probe avoids native stderr handling, and environment-name validation is case-sensitive so Turkish locale casing does not reject valid names containing `I`. `http://localhost:5173`, `http://localhost:8080/api/v1/provinces`, and the same API request through Vite's `/api` proxy returned 200. One Ctrl+C stopped both process trees cleanly and released ports 5173 and 8080.
- After A-07 merged, the launcher was rerun from current `main`: Vite became ready, the backend connected through the restricted runtime datasource, and Hibernate correctly stopped on the missing V8 `service_offering_coverage` table because shared Supabase remains at V7 and the launcher keeps Flyway disabled. The launcher then stopped the frontend. A fully successful current-main run requires separate approval and application of V8.
- Windows PowerShell 5 syntax validation and `git diff --check` passed.
- An independent existing issue was exposed by the smoke check: `/readyz` returns 403 because the application security rules do not currently permit the configured probe path. The launcher does not alter backend authorization; probe authorization requires a separate reviewed fix.
