# ServisimiBul — V12 to V15 shared Supabase release runbook

## State of authorization
**Preparation only. This runbook does not authorize execution.** The repository's `migrate-supabase.ps1 -Apply` remains fail-closed. Never apply V13, V14 or V15 to shared Supabase just because an automated readiness check passed.

## Required independent gates
1. A named operator and a second reviewer approve the **exact immutable release commit**, the specific Supabase project, the V12 to V15 scope and a bounded maintenance window using an authenticated organization-controlled system (not an operator-authored local JSON file).
2. The exact intended direct/session-pooler database and separately restricted runtime account are checked with the OPS-01 read-only preflight immediately before execution. Confirm PostgreSQL 17, primary, system identifier, V1-V12 history/checksums, no conflicting objects and no competing migration activity.
3. Pause user writes and all automatic migration processes; identify and stop other CI/deployment runners before obtaining a **database-wide coordinated exclusive gate**. A local Windows mutex or an advisory lock from a separate process is not sufficient. Lock must be held for the entire migration on a dedicated PostgreSQL session; Flyway's own locking must also be respected. Never assert exclusive coordination without an independently proved integration.
4. Collect a **new** protected V12 application-schema backup after writes are paused, with matching project/system identifiers, Flyway checksums and SHA-256. Store off-repository with encryption, tight ACLs and documented retention. A `public`-schema archive is not a complete Supabase platform recovery point.
5. Restore that exact archive to **isolated PostgreSQL 17**, run V13–V15 twice, require Hibernate validation plus all 13 independent SQL checks; keep backup digest, run commit and independent restore identity. Use `Test-SupabaseReleaseReadiness.ps1` for local evidence inspection with a short backup-age window. A PASS is not external authorization.
6. Before any write, verify the database-level exclusive gate and independent approval are still valid. Perform only the approved migration set using a dedicated, reviewed migration runner. Keep the web process's Flyway disabled. **No such live runner has been enabled by OPS-01.**
7. Afterward independently run `docs/10_MIGRATION_VERIFICATION.sql`, inspect the full Flyway history and application smoke tests with the runtime role. If any gate fails, leave the environment in maintenance and escalate.

## Read-only readiness evidence
From the exact reviewed checkout, after a fresh local protected backup and a successful disposable V15 rehearsal:
```powershell
.\scripts\Test-SupabaseReleaseReadiness.ps1 `
  -ProjectRef "<approved-project-ref>" `
  -ReleaseCommit "<reviewed-40-character-sha>" `
  -BackupEvidencePath "C:\private\v12-backup.json" `
  -RestoreEvidencePath "C:\private\v15-restore-proof.json"
```
By default, backup evidence must be no more than 120 minutes old; timestamps, source/restore system identifiers, exact hash and release commit are validated. This check has no network or live database write capability. Protect both evidence JSON files and archive.

## Failure and rollback decision
- **Before any shared write**: abort, release the acquired gate through the reviewed procedure, restore normal traffic only after application-readiness checks.
- **If V13–V15 changes partially succeed or the 13 checks fail**: stop the application writers, keep the maintenance gate and escalate; do not run `flyway repair`, `clean`, `baseline`, blind down-SQL or reapply the same V15 migration.
- Use a **separately verified point-in-time recovery** or an isolated restoration strategy, decided by the release operator and approved by the second reviewer. PostgreSQL `pg_dump --schema=public` is not a full-platform point-in-time rewind. Before replacing anything, preserve a forensic post-failure copy and quantify writes and user-data loss since the pre-release backup.
- If the provider cannot restore to a chosen pre-migration timestamp, or the rollback path lacks an isolated rehearsal, **do not begin shared migration**.
- If new writes were allowed after the backup, restoring it over the active database can destroy those writes. Never perform such a restore automatically.

## Current state
Read-only preparation and local 13/13 V12-to-V15 rehearsal have been observed; all five PR #108 CI checks were successful at commit `6ed1892c`. PR remains a draft until current changes receive fresh CI and code review. OPS-01 live `-Apply` is intentionally unavailable.

## Maintenance implementation and residual blockers

The production web API now supports `SB_MAINTENANCE_TRAFFIC_FROZEN=true`. The highest-precedence HTTP filter responds 503 with no-cache to all requests except GET /livez. The production startup validator also requires `SB_DEMAND_FEEDBACK_SCHEDULER_ENABLED=false` whenever that flag is enabled. No remote flag is toggled automatically. This only quarantines a *single deployed web process*: all replicas, scheduled jobs, independent database clients, CI runners and Supabase Dashboard writes must be stopped or coordinated separately. Prove a write freeze across every entrypoint before creating the fresh backup. The production migration executor remains disabled and needs independent approval/recovery evidence.

GitHub `ops-independent-approval-audit.yml` can assess a distinct current-commit PR review, but it is not a protected production environment with immutable external authorization and does not certify a backup or maintenance window. Do not connect it to production credentials. Existing public-schema V12 recovery proof cannot restore all managed Supabase Auth/Storage/platform state. A real separate-platform restore and validated loss-of-data boundary remain required.

## Latest readiness gate — independent V12 recovery proof

The V15 disposable rehearsal now runs a **second** isolated PostgreSQL 17 restoration of the original V12 public-schema archive, checks that this rollback cluster is neither production nor the V15 rehearsal cluster, and verifies the exact V1–V12 Flyway history. Release-readiness verification fails unless the evidence includes the independent rollback rehearsal. This validates logical application data rollback mechanics only. It cannot restore the complete Supabase platform, recover future writes, or guarantee provider-managed Auth/Storage service state.

To prepare a later release, re-create the protected V12 backup *after* confirming the production application is quiescent, re-run the V12-to-V15-and-back recovery test on the **exact reviewed release**, check all CI jobs on that immutable SHA, and have a second operator review both the runtime write freeze and the off-site recovery plan. No live migration executor is authorized in this PR.

## V12 recovery fingerprint coverage

The isolated V12 restore/recovery rehearsal now compares a per-table count and deterministic row-content fingerprint for every application table in `public` (excluding Flyway history) across two isolated PostgreSQL 17 clusters. Content digests stay in the local process; neither row data nor their hashes are written to GitHub or the JSON release evidence. The comparison fails closed when application rows differ. Run this revised restore exercise using a **new** V12 backup tied to the final release commit. Existing V12 restore proofs do not demonstrate this newer check. This is not proof of provider-wide Supabase recovery, nor a guarantee that writes after the backup can be recovered.
