# OPS-01: production lock protocol — implementation boundary

**No production lock executor is enabled.** This is a reviewable protocol and an isolated test target, not permission to execute on shared Supabase.

## Coordinator requirements

- Never use only a Windows named mutex: it coordinates neither other hosts nor containerized workloads.
- Require an externally authenticated release approval that is distinct from the operator, explicitly bound to project ref, immutable commit, tested backup SHA and maintenance window. `ops-independent-approval-audit.yml` is a manual **advisory** review check, not a production deployment gate. It must run from `main` after the workflow itself is reviewed and merged.
- Use a dedicated **direct PostgreSQL session** to obtain a globally agreed application-specific advisory lock. This is cooperative; it cannot lock out uncoordinated writers, Supabase Dashboard jobs or direct Flyway CLI invocations. Do not assume it serializes Flyway's own lock.
- Treat session poolers as **unsuitable for a long-lived session-level lock**. A pooler may reassign backend sessions, and unlock in a different session is unsafe.
- Release coordinator must enforce a write maintenance window across all application instances, jobs, CI and independent migration operators. A lock that cannot demonstrably cover all migration entrypoints is an **unmet gate**.
- The coordinator must hold its socket open and continuously verify lock ownership / database system identity while the migration client runs; terminate the migration safely and keep maintenance mode on if the coordinator loses its connection.
- Database advisory locks cannot be assumed to exclude non-participating clients. For a truly safe release, enforce single-writer execution at the deployment/orchestration boundary and verify that the Flyway runner is the sole enabled migration actor.
- A future executor must use an authenticated and auditable two-person approval source, a database write-freeze verification step and a continuously held lock with an executable integration test demonstrating the second worker is rejected.
- Limit roles: runtime account never needs advisory-lock coordination or DDL privileges. The migration session needs the reviewed `postgres` identity only.
- Never unlock a session lock using a pooled connection or replay an unconditional rollback SQL script on a partially migrated database.

## Approval audit

`scripts/ops_github_approval.py` checks GitHub's current review records: PR is open, non-draft, targets main, head SHA matches exactly, approval is from a separate collaborator, not the PR author or workflow actor, and the reviewer has not changed their latest review to an incompatible state. GitHub API `author_association` is not equivalent to an independently verified branch-protection policy. This is a supporting signal only.

Use the GitHub Actions **OPS-01 independent approval audit** workflow manually from protected `main`, supplying PR number, full head SHA and the approved project ref. It has read-only contents / PR permissions and no Supabase credentials. An audit success is insufficient to enable live migration.

## Recovery confirmation for Free plans

Supabase's documented automatic daily backups are for Pro, Team and Enterprise projects; PITR is a separate paid feature. Free projects must manage exported backups themselves. Confirm the project's **actual billing plan and available Backups UI** before selecting a recovery method; project metadata is not proof of plan or restore availability. Application `public` backup does not include full platform state, other schemas, stored objects, roles/passwords, or a PITR timeline. Design a whole-project recovery rehearsal or defer shared migration; an archive restore that passes in an isolated cluster is necessary but not a platform disaster-recovery guarantee.

Official reference: https://supabase.com/docs/guides/platform/backups

## Go/no-go checklist

- [ ] CI success at reviewed SHA and protected main-branch deployment controls
- [ ] A distinct authenticated human reviewer, audit history and no stale approval
- [ ] Direct session-level lock plus a **verified** uncoordinated-writer freeze, with failure injection and parallel-client conflict test
- [ ] Project plan, backup availability and full-platform recovery method independently reviewed
- [ ] Fresh write-quiescent backup, verified digest and isolated V12→V15 replay
- [ ] Independently approved downtime/window and tested stop/rollback decision
- [ ] Reviewed release runner; production `-Apply` remains disabled until all are met

## Disposable lock contention test (Windows PostgreSQL 17)

Run `powershell.exe -NoProfile -File .\\scripts\\Test-SupabaseMigration.LockIntegration.ps1` from the repository checkout with PostgreSQL 17 tools available. It starts a fresh loopback-only disposable cluster, holds a session-level advisory lock in a dedicated `psql` process and checks from a second connection that a nonblocking acquisition is denied. The child process and cluster are cleaned up when the test exits. This is a **cooperative-lock feasibility test**, not a production exclusive gate, and it does not test write freezing or Flyway's own locking. It has not been wired into production operations.

## Failure injection and synthetic recovery limits

The isolated coordinator now terminates the complete child process group when its dedicated PostgreSQL lock session is lost. The isolated PostgreSQL CI workflow injects pg_terminate_backend while a long-running synthetic process is active, and requires prompt fail-closed exit. This does not prove automatic rollback of arbitrary database writes or complete production exclusivity.

The separate ops-synthetic-recovery workflow backs up synthetic public, auth and storage schemas and restores their data in an isolated PostgreSQL 17 environment. The ops_recovery_coverage.py manifest always reports full_supabase_platform_recovery_proven=false, even when all database schemas are present. Storage object binaries, provider secrets, API keys, roles/passwords, deployment settings, edge functions and selectable PITR are not covered by this logical test.

The actual Supabase project contains non-public managed schemas. The existing V12 archive is PUBLIC ONLY. A synthetic three-schema restore is not independent evidence of full-project recovery. Production go-live remains blocked pending a separately verified identity/Storage continuity and recovery plan, an independently approved write freeze, and a functioning non-cooperative migration exclusion strategy. No live restoration, schema modification or migration occurs in this workflow.

## Read-only actual-project recovery inventory (2026-10-25)

A read-only SQL check of the actual ServisimiBul PostgreSQL 17.11 primary at the expected system identifier found **0 Supabase Auth users, 0 Storage buckets, 0 Storage objects, 3 application users in public.app_user and 12 successful Flyway migrations**. Only anonymous aggregate counts were retrieved; no Auth identities, application user records, Storage object paths or secrets were exported. This is a snapshot, not a future guarantee; repeat close to any authorized release. Existing real V12 public-only archive restoration and V15 rehearsal already passed all 13 checks in disposable PostgreSQL. Auth/Storage are empty now, but platform roles, managed schemas and settings remain outside the public-only dump.

`scripts/ops_project_recovery_assessment.py` provides an offline sanitized-input recovery-scope decision. It always refuses to mark full-platform recovery or production go-live complete without independently rehearsed recovery. No shared database export, restore, migration or permission modification was performed to establish this evidence. Keep private evidence JSON and backup archive off GitHub.
