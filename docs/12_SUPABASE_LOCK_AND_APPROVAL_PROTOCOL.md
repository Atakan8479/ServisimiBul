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
