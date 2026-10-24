# A-09 database and backup operations, verified locally by A-13

Originally verified against repository commit `f2ec9ea` and the shared Supabase project on 2026-10-16. Repository evidence records the approved V8 migration on 2026-10-17 and the separately approved V9–V12 migration from `main` commit `8454485` on 2026-10-22. A-13 exercised the logical database and tariff procedures against disposable loopback PostgreSQL 17.11 environments on 2026-10-19; the 2026-10-22 operation additionally restored an encrypted pre-V9 logical export and rehearsed V9–V12 against disposable PostgreSQL 17 before the shared migration. This runbook is operational guidance, not authorization to mutate a shared database, restore a backup, load pilot data, delete sessions, change billing, or change production settings. Each such action needs the target, operator, recovery point, and command reviewed immediately before execution; migrations and destructive or production-like actions additionally need explicit human approval.

## Current operational baseline

- The last approved evidence records the shared `ServisimiBul` project on Supabase PostgreSQL 17.11 and the organization on the Free plan; re-verify both before an operation.
- Flyway history contains twelve successful rows, V1 through V12, after the approved 2026-10-22 migration. V13 is absent.
- All 22 application tables have RLS enabled with the expected runtime policies. `flyway_schema_history` intentionally has no RLS, but `PUBLIC`, `anon`, `authenticated`, and the runtime role have no direct privileges on it.
- `PUBLIC`, `anon`, and `authenticated` have no direct privileges on any current application table or sequence.
- The latest verified counts are 1 province, 39 districts, 963 neighborhoods, 1 school, 3 users, and zero rows in all six V10–V12 demand tables. The encrypted pre-V9 logical export is retained outside Git pending explicit deletion approval.

### Historical A-09 pre-V8 baseline

The original 2026-10-16 A-09 audit found successful V1–V7 history, 15 RLS-enabled application tables, and no `service_offering_coverage`; V8 was then pending. Its checked-in verification intentionally reported nine current-state passes and four target-state failures. The separately approved 2026-10-17 operation subsequently applied V8 and verified all 13 target-state checks. Retain the earlier evidence as migration history, but do not use it as the current operational baseline.

The metadata audit used the connected Supabase administration interface and returned no credentials or row-level personal data. Re-run the preflight immediately before every operation because this snapshot will age.

## Roles and secret handling

Use separate identities:

| Operation | Identity | Constraint |
|---|---|---|
| Normal backend | `servisimibul_app` | Flyway disabled; never receives migration credentials. |
| Migration and verification | controlled migration/administration identity | Available only to the one-shot job; remove it afterward. |
| Logical backup | read-capable administration identity | Must read all application objects; do not use the browser-facing Supabase roles. |
| Restore | controlled administration identity | Use only after separate restore approval. |

Bind secrets through the deployment secret manager or a personal PostgreSQL password mechanism. Never place passwords in command arguments, shell history, logs, screenshots, Git, or backup manifests. The examples assume connection values are already bound in the process environment and deliberately do not show them.

## Migration runbook

### 1. Prepare and gate the release

1. Record the release commit and immutable artifact digest, target Supabase project reference, database name, expected current Flyway version, expected target version, operator, maintenance window, and rollback owner.
2. Confirm the reviewed migration files in the artifact exactly match the release commit. Never edit an already-applied migration.
3. Run the full backend verification against an empty disposable PostgreSQL 17 instance. Shared Supabase is not a test database.
4. Take and verify a pre-migration backup as described below. Record its timestamp, checksum, storage location, and Flyway version without recording credentials.
5. Confirm the old application is compatible with the target schema or place the service in maintenance mode. Prefer additive, forward-compatible migrations.
6. Obtain fresh explicit approval for the exact shared target and migration command. `baselineOnMigrate`, `repair`, schema reset, down migrations, and destructive fallback are forbidden unless separately reviewed and approved.

From `servisimibul-backend`, the local verification command is:

```powershell
$ErrorActionPreference = 'Stop'
& .\mvnw.cmd --batch-mode verify
if ($LASTEXITCODE -ne 0) { throw 'Backend verification failed' }
```

### 2. Read-only preflight

Run the identity query through the controlled administration connection. The result, not a label in a terminal profile, is the target evidence:

```powershell
& psql.exe --no-psqlrc --set ON_ERROR_STOP=1 --command `
  "select current_database(), current_user, current_setting('server_version'), pg_is_in_recovery();"
if ($LASTEXITCODE -ne 0) { throw 'Database identity check failed' }
```

Then inspect `flyway_schema_history`, pending object-name collisions, active sessions/transactions, database free space, and application readiness. The repository verifier currently targets V14 and [`10_MIGRATION_VERIFICATION.sql`](10_MIGRATION_VERIFICATION.sql) must report all 13 checks as `PASS` on a V14 target. The shared Supabase baseline recorded above remains V12; do not run the V14 verifier there or apply V13–V14 without a fresh reviewed plan and explicit approval. Do not infer current live state solely from this dated document.

Stop if the target, role, current version, checksums, schema objects, or active incident differs from the reviewed plan.

### 3. Execute once

Use the reviewed JAR with the non-web `migration` profile. The release system must already provide the `SB_DB_*` variables; do not paste secrets into the command:

```powershell
$ErrorActionPreference = 'Stop'
$env:SPRING_PROFILES_ACTIVE = 'migration'
$env:SB_FLYWAY_ENABLED = 'true'
$env:SB_ADMIN_BOOTSTRAP_ENABLED = 'false'

& "$env:JAVA_HOME\bin\java.exe" -jar .\target\servisimibul-backend-0.0.1-SNAPSHOT.jar `
  --spring.main.web-application-type=none
if ($LASTEXITCODE -ne 0) { throw 'Migration/validation process failed' }
```

Do not run two migration jobs concurrently. Do not start the new runtime until this process exits successfully and post-verification passes.

### 4. Verify and release

Run the checked-in verification SQL through the administration identity:

```powershell
& psql.exe --no-psqlrc --set ON_ERROR_STOP=1 `
  --file ..\docs\10_MIGRATION_VERIFICATION.sql
if ($LASTEXITCODE -ne 0) { throw 'Migration verification query failed' }
```

Every check must report `PASS`. Then:

1. Start the new immutable runtime with `SPRING_PROFILES_ACTIVE=prod`, `SB_FLYWAY_ENABLED=false`, only runtime database credentials, and the durable tariff volume.
2. Confirm `/livez` and `/readyz`, then perform one public discovery and one authorized feature smoke check appropriate to the release.
3. Observe errors, latency, connection count, locks, and restarts before removing the previous application.
4. Remove migration credentials from the job environment and record the evidence in the release log.

If migration or verification fails, keep traffic stopped or on the compatible old version, preserve logs, and choose a reviewed forward fix. Do not use `flyway repair` merely to make history appear clean.

## Backup strategy

Supabase managed backups and application-owned logical exports solve different problems:

- Supabase managed restore is the preferred whole-database recovery path when the plan provides it. Daily backups are available on paid plans; the currently verified Free plan requires an application-owned export if a recoverable copy is needed.
- A native PostgreSQL 17 custom-format dump is the Docker-free application-schema backup path for this project. It is not a complete clone of every Supabase platform feature.
- Supabase Storage objects are not part of database backups. ServisimiBul currently does not use Supabase Storage for tariffs or application uploads.
- Database backups do not preserve custom role passwords. Rebind/rotate runtime credentials after a managed restore and re-verify grants.
- A backup is not considered recoverable until a separately approved restore drill has succeeded. A-13 now proves the repository procedure in disposable local environments; its 47.623-second run is not a production RTO and does not prove a shared Supabase restore.

Official references rechecked on 2026-10-19: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump), [Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), and [PostgreSQL 17 backup and restore](https://www.postgresql.org/docs/17/backup.html).

### Repeatable disposable recovery drill

From the repository root on Windows with Java 21+, PowerShell 7, and native PostgreSQL 17 tools available:

```powershell
.\scripts\Test-BackupRestore.Tests.ps1
.\scripts\Test-BackupRestore.ps1
```

The drill refuses non-loopback or same-instance targets. It creates all database, archive, log, and tariff state under uniquely named `%TEMP%` directories, verifies source and target identities, restores only into a separately provisioned empty target, and deletes the temporary state in `finally`. A sanitized evidence summary is written to the ignored `servisimibul-backend/target/a13-backup-restore-evidence.json`. Supplying `-JavaHome`, `-PostgresBin`, or `-EvidencePath` overrides discovery/output without changing the safety gates. Never point this local drill at Supabase or another existing database.

### Docker-free logical backup

Install PostgreSQL 17 client tools on the operations host through the normal workstation/server approval process. Confirm `pg_dump.exe`, `pg_restore.exe`, and `psql.exe` report major version 17. Use `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, and `PGSSLMODE=require` from a secret binding; never print them.

```powershell
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDirectory = Join-Path $env:SB_BACKUP_ROOT "database-$stamp"
New-Item -ItemType Directory -Path $backupDirectory -ErrorAction Stop | Out-Null
$archive = Join-Path $backupDirectory 'servisimibul-public.pgdump'

& pg_dump.exe --format=custom --compress=9 --schema=public `
  --file $archive
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }

& pg_restore.exe --list $archive | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Archive structure check failed' }

Get-FileHash -Algorithm SHA256 -LiteralPath $archive |
  Select-Object Algorithm, Hash |
  Export-Csv -NoTypeInformation -LiteralPath "$archive.sha256.csv"
```

Keep ACL statements so application grants can be reconstructed. For custom archives, apply `--no-owner` to `pg_restore`; ownership selection at dump time is not used. The recovery target must have required roles such as `servisimibul_app`, `anon`, and `authenticated` before restoration. Store the archive and checksum encrypted on a different failure domain, restrict access, and record the source project, PostgreSQL version, Flyway version, timestamp, and retention class in a separate non-secret inventory.

Minimum pilot policy: create an export before every approved migration and at least once per 24 hours while irreplaceable data exists; keep enough independent copies to cover the agreed recovery window. Retention deletion is a separate reviewed operation—never make an untested cleanup command part of the backup job.

The official Supabase CLI dump/restore guide uses Docker for its containerized PostgreSQL tooling. Docker is optional for ServisimiBul: native PostgreSQL 17 client tools provide the logical-backup path above, and the application itself does not require Docker.

### Restore procedure and approval gate

1. Declare the incident, stop writes, identify the exact target and recovery point, calculate the maximum data-loss window, and obtain explicit restore approval.
2. Preserve the damaged database and logs when possible; do not overwrite the only evidence.
3. Prefer a new/disposable PostgreSQL 17 target for the first restoration. Provision required roles without reusing exposed passwords.
4. Verify the archive checksum and inspect `pg_restore --list`.
5. Restore with `--exit-on-error`, `--single-transaction`, and `--no-owner`. The exact command and target must be reviewed at the time. Never add `--clean` or restore over a populated target by default.
6. Run the migration verification SQL, Flyway validation, Hibernate validation through the runtime role, row-count/business checks, grant/RLS checks, and application smoke tests.
7. Rebind or rotate custom-role passwords and application secrets. Switch traffic only after the recovery owner signs off.
8. Record actual recovery point, data loss, duration, failures, and follow-up work.

For a Supabase managed restore, use the Dashboard backup/PITR workflow available to the project plan. It restores in place and causes downtime. Confirm the project reference and recovery point twice, expect temporary unavailability, and re-verify role passwords plus any external Storage objects afterward. A shared, managed, or production-like restore remains separately approval-gated; A-13 proves only the disposable local procedure.

## Tariff backup, restore, and rollback

`SB_TARIFF_STORAGE_DIR` is a backend-only persistent volume. It contains per-province immutable `versions/version-<version>.json` files and atomically replaced `current.json` files. Back it up independently from PostgreSQL and never copy only `current.json`.

Before a tariff write or volume maintenance:

1. Put the single tariff-writer instance in maintenance/drain mode so files cannot change during the copy.
2. Resolve and verify the source volume and a different, encrypted destination. Never use the repository, packaged JAR, or the same volume as the backup destination.
3. Recursively copy the entire storage root, calculate SHA-256 hashes for every file, and retain the manifest with the backup.
4. Compare the manifest file count/hashes with the source, then resume writes.

Example PowerShell after both paths have been independently verified:

```powershell
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $env:SB_TARIFF_STORAGE_DIR).Path
$destination = Join-Path $env:SB_TARIFF_BACKUP_ROOT (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $destination 'tariffs') -Recurse -ErrorAction Stop
Get-ChildItem -LiteralPath (Join-Path $destination 'tariffs') -File -Recurse |
  Get-FileHash -Algorithm SHA256 |
  Select-Object Path, Algorithm, Hash |
  Export-Csv -NoTypeInformation -LiteralPath (Join-Path $destination 'manifest.csv')
```

For restoration, extract/copy into a new empty volume, verify every hash, and start a non-production backend pointed at that volume. Read every current province through `GET /api/v1/tariffs?provinceCode=<code>` so the production validator checks the JSON. Confirm each `current.json` exactly matches its corresponding immutable version file. Only then, with separate restore approval and writes stopped, switch the production mount to the verified volume; keep the former volume recoverable.

Business rollback does not replace or delete files. An ADMIN reads the desired historical document, assigns a new unique version, keeps the current version as `expectedVersion`, and submits it through `PUT /api/v1/admin/tariffs/{provinceCode}`. This creates a new immutable version and atomically advances `current.json`; it never rewrites history. Verify the public GET afterward and create a fresh off-volume backup.

## Pilot-data loading procedure

The A-08 synthetic fixture is test-only. It runs in a rolled-back test transaction and must never be loaded into shared Supabase, staging, or production.

Real pilot schools follow D019:

1. Curate only schools actively used by the pilot. Record the authoritative source name/code, school name/address, intended active state, and exact neighborhood.
2. Search the read-only geography endpoints and confirm the province/district/neighborhood identity before creating a school.
3. Use the authenticated ADMIN workspace or `POST /api/v1/admin/schools` one school at a time. Do not build or run an unreviewed CSV/bulk importer.
4. Re-read the ADMIN record, then confirm active schools appear in the anonymous school search. Keep inactive or incomplete records non-public.
5. Reconcile the number and identifiers of requested, created, rejected, and skipped records; retain no student or parent data because the MVP does not collect it.

Current blocker: the shared geography tables are empty, while the current API can create schools only beneath an existing neighborhood and exposes no province/district/neighborhood write endpoint. Before the first real pilot school load, approve and review a minimal geography-seeding mechanism or admin CRUD extension. Do not bypass that missing workflow with ad-hoc production SQL. This runbook deliberately records the gate instead of inventing an unapproved import path.

## Session cleanup procedure

Spring Session JDBC performs scheduled expired-session cleanup; Spring Session 4.1.1 defaults the cleanup cron to once per minute. V4 provides the indexed `spring_session.expiry_time` column, and deleting a session cascades to `spring_session_attributes`.

Monitor aggregates only—never export cookie/session identifiers:

```sql
select
    count(*) filter (where expiry_time < (extract(epoch from clock_timestamp()) * 1000)::bigint) as expired,
    count(*) as total,
    min(to_timestamp(expiry_time / 1000.0)) as oldest_expiry
from public.spring_session;
```

If expired rows continually accumulate, first inspect scheduler/runtime health and database errors. Manual deletion is an exceptional production write and needs incident approval. Delete in short batches so locks and WAL stay bounded:

```sql
with expired_batch as (
    select primary_id
    from public.spring_session
    where expiry_time < (extract(epoch from clock_timestamp()) * 1000)::bigint
    order by expiry_time
    limit 1000
    for update skip locked
)
delete from public.spring_session session_row
using expired_batch
where session_row.primary_id = expired_batch.primary_id;
```

Commit each batch, observe database load, and stop when no rows are deleted. Let normal autovacuum reclaim space; do not run `VACUUM FULL` during service. A database-backed integration test verifies that this batch keeps active sessions and cascades expired attributes.

## Cost-monitoring checklist

The organization was verified on the Supabase Free plan on 2026-10-16. D014 forbids opting into a paid plan or add-on without approval. Review at least weekly during the pilot and before traffic/import changes:

- project status and Free-plan inactivity/pausing risk;
- database size and growth by table/index, connection count, long transactions, and compute saturation;
- cached and uncached egress, especially unexpected API/download traffic;
- Auth MAU, Storage, Realtime, Edge Function, and PITR usage—even though this application does not intentionally use those Supabase products;
- logical-backup size, duration, age, off-site retention, and last restore-drill status;
- tariff-volume size and backup age;
- email-provider usage, application-host cost, logs/retention, and alert delivery outside Supabase;
- upcoming billing-cycle limits and any projected overage.

Record the observation date, dashboard period, current value, trend, threshold, owner, and action. Treat upgrade prompts or PITR purchases as proposals requiring explicit approval. Official reference: [Supabase cost control](https://supabase.com/docs/guides/platform/cost-control).

## Incident recovery checklist

1. Name an incident commander and scribe; record detection time, affected environment, symptoms, release, and last known good state.
2. Contain safely: stop deployments/migrations, drain writes if integrity is uncertain, preserve logs and the suspect artifact, and revoke exposed credentials if applicable.
3. Determine scope with read-only checks: application failure, migration failure, database corruption/deletion, credential exposure, tariff-volume loss, or external-provider outage.
4. Record the newest verified database and tariff backups, checksums, Flyway versions, and realistic data-loss window.
5. Choose the least destructive recovery: application rollback for backward-compatible schema, reviewed forward-fix migration for schema defects, tariff business rollback as a new version, logical restoration to a new target, or Supabase managed restore.
6. Obtain fresh approval for every destructive, in-place, shared, or production-like restore action. Confirm target and recovery point aloud/in the incident record.
7. Execute with a second reviewer, capture command exit statuses without secrets, and stop on the first unexplained difference.
8. Verify migrations, Hibernate schema validation, RLS/grants, runtime-role access, sessions, tariffs, public discovery, ADMIN access, health probes, counts, and recent business writes.
9. Restore traffic gradually, monitor errors/latency/connections/cost, communicate actual data loss, and retain the replaced target until sign-off.
10. Rotate temporary credentials, close access, document actual RPO/RTO, and schedule corrective work plus the next restore drill.

The operational objective is a database recovery point no older than 24 hours once irreplaceable pilot data exists, plus a tariff backup after every approved tariff change. A-13 measured 47.623 seconds for its small disposable fixture; production recovery time remains unvalidated until an environment-representative, separately approved exercise is completed.

### OPS-01 guarded Windows migration tooling

Issue #107 provides `scripts/migrate-supabase.ps1`. Its default behavior is strictly read-only and its shared `-Apply` path remains deliberately fail-closed: developing and testing the tooling does not authorize V13/V14 on Supabase.

Prerequisites are PowerShell 7 (Windows PowerShell 5.1 is also syntax/safety-tested), PostgreSQL 17 `psql.exe`, Java 21+, the exact reviewed repository commit, and separate secret-managed passwords for the `postgres` migration identity and restricted `servisimibul_app` runtime identity. Prefer the direct endpoint for migration work; the Dashboard session-pooler endpoint on port 5432 is accepted when direct IPv6 is unavailable. Transaction-pooler port 6543 is rejected because migration and advisory/session semantics require a stable session. JDBC URLs must target `/postgres`, contain no credentials, and explicitly use `sslmode=require`, `verify-ca`, or `verify-full`.

Record the target database system identifier during a separately approved identity-verification step. Then place only the migration password in the invoking process and run preflight:

```powershell
$env:PGPASSWORD = '<migration-admin-password-from-secret-manager>'
$env:SB_DB_PASSWORD = '<restricted-runtime-password-from-secret-manager>'
.\scripts\migrate-supabase.ps1 `
  -ProjectRef '<20-character-project-ref>' `
  -ExpectedSystemIdentifier '<recorded-system-identifier>' `
  -MigrationJdbcUrl 'jdbc:postgresql://db.<ref>.supabase.co:5432/postgres?sslmode=verify-full' `
  -MigrationUser 'postgres' `
  -RuntimeJdbcUrl 'jdbc:postgresql://db.<ref>.supabase.co:5432/postgres?sslmode=verify-full' `
  -RuntimeUser 'servisimibul_app'
Remove-Item Env:PGPASSWORD
Remove-Item Env:SB_DB_PASSWORD
```

The preflight validates the project-scoped endpoint and usernames, PostgreSQL 17 primary/TLS/system identity, restricted runtime-role attributes, exact successful V1–V12 scripts and Flyway CRC32 checksums, V13→V14 repository ordering, absence of partial target objects, and absence of migration-like concurrent activity. It uses a read-only transaction and emits no password or connection string.

An apply attempt additionally requires the full reviewed release SHA, an exact project-ref confirmation, a SHA-256-verified PostgreSQL 17 V12 archive, evidence that the same archive restored into an isolated PostgreSQL 17 target and passed all 13 verification checks, an unexpired approval record bound to that project/release/backup, and a per-project local execution mutex. A confirmation flag alone is insufficient. Evidence JSON and archives are sensitive operational records: keep them outside Git with current-user-only ACLs and never place secrets in them.

The final shared execution step is intentionally not implemented because a local JSON file is not independently verifiable authorization. Even after every local prerequisite passes, `-Apply` stops before Flyway. Enabling it requires a separately reviewed external approval mechanism and a new explicit authorization. When that exists, execution must use the `migration` profile, Flyway enabled only for the one-shot process, ADMIN bootstrap and mail disabled, separate migration/runtime connections, non-web mode, Hibernate `ddl-auto=validate`, and Flyway's schema-history lock. Never add repair, baseline, clean, reset, recreation, automatic restore, or retry-after-partial-failure behavior.

After any future authorized execution, run `docs/10_MIGRATION_VERIFICATION.sql` as the migration identity and require exactly 13 PASS rows, then perform Hibernate validation through `servisimibul_app`. Any migration or validation failure ends the attempt; preserve logs and backup evidence, revoke temporary access, and escalate to the recovery owner. Do not automatically retry, repair, restore, or modify credentials.

Local verification uses only disposable PostgreSQL 17:

```powershell
pwsh -NoLogo -NoProfile -File .\scripts\Test-SupabaseMigration.Tests.ps1
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-SupabaseMigration.Tests.ps1
pwsh -NoLogo -NoProfile -File .\scripts\Test-SupabaseMigration.Integration.ps1
```

#### OPS-01 hardening notes

The preflight clears inherited libpq `PG*` connection overrides except the process-scoped password while running psql, then restores the caller environment. Prefer `sslmode=verify-full` with a trusted CA. Backup evidence additionally requires a readable PostgreSQL custom-format archive (`pg_restore --list`). Restore evidence must separately assert a V12 restore and a disposable V14 rehearsal with all 13 checks and a different system identifier; local JSON evidence is not independently verified proof. External approval and independently observed restore evidence remain mandatory. The Windows mutex only coordinates on one computer; future live execution requires a database-level exclusive gate and fresh preflight. `-Apply` remains disabled. OPS-01 offline PowerShell 5.1/7 checks are covered by the dedicated GitHub workflow; disposable PostgreSQL rehearsal remains an additional requirement.
