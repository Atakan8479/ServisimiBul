# Roadmap — approval-gated work packages

Do not complete multiple phases in one Codex run. Each phase must pass acceptance criteria, be reviewed, and update `06_PROGRESS.md` before moving on.

## Gate 0 — Onboard Codex (READ ONLY)
Inspect repository, docs, existing Maven stack, Supabase known state. Report discrepancies, architectural unknowns, staged plan and suggested first PR; **no file edits**. Success = humans approve interpretation and priorities.

## Gate 1 — Database reconciliation decision
Inspect current schema and exact constraints/rows/Flyway history. Supabase dev currently has four geography tables created outside Flyway (observed previously); re-verify. Present OPTIONS: (A) human-approved controlled drop/recreate when verified empty, Flyway V1 applies from scratch; (B) preserve schema, explicit Flyway baseline and V2+ for future changes. Explain tradeoffs, choose only after explicit approval. No automatic drops or migration runs. Success = recorded strategy.

## Gate 2 — Foundational backend & Flyway
Use existing `servisimibul-backend` and `pom.xml`. Confirm compatibility with Java 21, Spring Boot 4.1.1, PostgreSQL Flyway modules; set env-driven datasource (no secrets), `ddl-auto=validate`; commit controlled migrations matching approved Gate 1. Provide clean-db integration test and initial CI smoke test. Success = migration repeatable with verified history, successful build/tests.

## Gate 3 — Core geography/data integrity
JPA entities/repositories for Province, District, Neighborhood, School. Validate FKs, unique constraints, correct source-code identity and cross-province checks in service design. Bulk CSV import is deferred by D019. Success = repo tests and migration behavior pass.

## Gate 4 — Identity/security
AppUser + OperatorProfile + review/audit entities; email verification before login; password recovery; session+HttpOnly+CSRF; one-shot two-admin bootstrap. Spring Session JDBC schema migrations, normal 30-minute inactivity sessions, optional non-sliding 90-day “Remember me” sessions, global revocation triggers, concurrent-session limits, and expiry cleanup. MUST phase in sub-issues (security skeleton, registration, verification/recovery, sessions, admin review) with tests. Success = role, owner, session lifetime/revocation, CSRF, disabled-account, verification, recovery, and non-enumeration tests.

## Gate 5 — Operator/admin school coverage
OperatorSchool & OperatorSchoolCoverage API and operator profile edits; review/needs-correction/resubmission flow; admin CRUD for the deliberately small pilot school catalog. Bulk CSV import remains deferred. Success = ownership/cross-province/unique checks and verified admin school management.

## Gate 6 — Anonymous public discovery
Search by school + neighborhood; deterministic operator pagination; publication predicate; contact phone visible for a public profile; offerings NOT required. Responsive UI flow can be parallel only after API contract. Success = empty-offering case, wrong-school coverage, inactive/underapproved tests.

## Gate 7 — Optional offering/vehicle coverage and official tariff UI
Optional Vehicle/ServiceOffering remains independent of discovery, while each offering requires an active vehicle owned by the same operator and its own coverage subset. Test plate normalization/uniqueness, capacity and available-seat bounds, draft-to-published requirements, ownership, deactivation-driven unpublishing, and no automatic republishing. Store official UKOME JSON on the `SB_TARIFF_STORAGE_DIR` persistent backend volume with immutable versions, atomic `current.json` replacement, expected-version conflicts, provenance/effective dates, and validated contiguous bands. Never mislabel tariff or seat data and never infer exact distance from neighborhood. Success = integrity, lifecycle, JSON validation/versioning, conflict, recovery, and unauthorized-write tests.

## Gate 8 — Pilot readiness
Build the approved Node.js 24/npm Vite React+TypeScript SPA baseline with strict TypeScript, React Router Data Mode, React Hook Form + Zod, Vitest + React Testing Library + MSW, and same-origin `/api/v1` deployment. Complete the responsive public/admin/operator paths, performance/page loads, data privacy review, rate limiting, tariff-volume backup and restore instructions, session expiry/cleanup test, manual Supabase cost checks, and staging→pilot smoke tests.

B-10 completes the conditional operator-approval policy, persona/ownership/CSRF/session/header/CORS/logging regressions, anonymous health-probe authorization, and bounded endpoint-specific single-instance rate limiting. Production launch remains gated on isolated PostgreSQL CI, selected-host topology validation, staging measurements for provisional limits, monitoring/alerts, and a smoke test; implementation alone is not production approval.

## Post-MVP development environment

A-12 replaces the Windows combined launcher's shared-database dependency with a disposable loopback PostgreSQL 17 cluster. It owns generated local credentials, one-shot Flyway migration, restricted runtime startup, environment-example separation, automated cleanup, a full-stack proxy smoke test, and a local wrapper for the complete backend verification suite. Success = no backend `.env` read, no shared Supabase access, runtime uses `servisimibul_app`, both application servers bind to loopback, all backend tests pass on the disposable cluster, the proxied fixture is observed, and cleanup leaves no listener or temp cluster.

A-13 uses two independent A-12 clusters to prove the A-09 recovery procedures without a cloud or shared-database operation. It owns a PostgreSQL 17 custom archive, transactional restore into a pristine disposable target, V1–V8/inventory/RLS/grant/data verification, restored-backend startup, independent UKOME volume manifests, and rollback as a new immutable tariff version. Success = wrong/remote targets fail closed, all 13 migration checks pass after restore, relational discovery and tariff reads pass through the restored backend, historical tariff versions remain unchanged, and all temporary state is removed.

J-03 adds a separate real full-stack browser layer without replacing the mocked B-11 suite or backend integration tests. It owns a fresh disposable PostgreSQL 17 database, real Spring Boot and Vite processes on loopback, synthetic geography/admin/tariff fixtures, isolated operator/admin/public browser contexts, local-only email-verification bypass, safe diagnostics, and deterministic cleanup. Success = real session/CSRF/authz/ownership, approval, cross-district coverage, discovery without optional vehicles/offerings, visibility and coverage invalidation, UKOME persistence, suspension/session revocation, and limited mobile keyboard behavior pass locally and in relevant CI without contacting Supabase.

J-05 prepares and runs controlled, supervised pilot usability sessions on the J-03/A-12 foundation. It owns local-only synthetic fixtures, participant/facilitator scripts, prohibited-data rules, anonymized finding capture, severity/ownership, and an explicit local go/no-go decision. Automated smoke/E2E evidence does not substitute for human sessions. Success = critical operator and parent journeys observed, no open release blockers/high findings, reproducible follow-ups assigned, disposable cleanup proven, and remaining production gates stated without contacting Supabase or using real participant data.

## Parent demand workflow

REQ-01 adds the isolated `PARENT` role foundation. REQ-02 owns Flyway V10 plus anonymous demand reads and parent-only creation/support lifecycle with server-authoritative year, uniqueness, aggregate counts, and concurrency tests. REQ-03 owns the accessible frontend board and uses the REQ-02 API without client-side duplicate or paging logic. REQ-05 owns Flyway V11 plus operator-owned demand responses, append-only publication versions, immediate eligible publication, current-eligibility invalidation, anonymous contact cards, and the operator CTA/guidance flow. REQ-06/REQ-07 consume the stable publication event identity without redefining response eligibility. Shared Supabase V9–V11 migration remains a separately inspected and approved operation.

## Two-developer coordination
A: database, geo catalog, schema constraints, admin catalog/query performance.
B: authentication, authorization, API DTO/controller and security tests.
Both: architecture/contract reviews, tests, PRs; one migration owner at a time. No parallel branch changes to same Flyway version.

## Every task acceptance checklist
- Defined input, touched modules, explicit non-goals.
- Decisions marked approved or open; risks reported.
- All changed SQL and code reviewed.
- `./mvnw test` (or documented environment-specific command) actually run or blocker noted.
- Tests prove core invariant for task.
- Config contains no secrets.
- Progress file accurately updated after human acceptance.
