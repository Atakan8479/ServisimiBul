# V22 vehicle usage history: shared Supabase migration runbook (#295, D059)

This runbook prepares the **separately approved** application of Flyway V22 to the shared Supabase database. It does not authorize that operation. **Status: V22 was applied to shared Supabase on 2026-11-22** under this runbook (evidence in `06_PROGRESS.md`); shared Supabase is at V1–V22. Keep this runbook as the record and as the template for future releases. Every step that touches the shared database needs fresh, explicit human approval for the exact target, operator, recovery point, and command. General rules, roles, and secret handling follow [`10_DATABASE_AND_BACKUP_OPERATIONS.md`](10_DATABASE_AND_BACKUP_OPERATIONS.md).

## What V22 changes

| Object | Change | Effect on existing data |
|---|---|---|
| `vehicle.usage_history_complete` | New `BOOLEAN NOT NULL`. Existing rows are backfilled `false`; the default for new rows is then `true`. | Every pre-V22 vehicle has unknown history and is never operator-deletable (fail closed). |
| `vehicle.usage_recorded_at` | New nullable `TIMESTAMPTZ`. Set to the migration time for every vehicle that an offering references at migration time. | Only used vehicles change. No other column or row changes. |
| `record_vehicle_usage()` + `service_offering_records_vehicle_usage` | `AFTER INSERT OR UPDATE OF vehicle_id` on `service_offering`. | Records the first use of a vehicle. |
| `protect_vehicle_usage_history()` + `vehicle_usage_history_append_only` | `BEFORE UPDATE` of the two columns on `vehicle`. | History cannot be cleared, rewritten or marked complete afterwards. |
| `guard_vehicle_deletion()` + `vehicle_deletion_guard` | `BEFORE DELETE` on `vehicle`. | Rejects deleting any used or pre-V22 vehicle. It has no bypass. |
| Function ACLs | `REVOKE ALL` from `PUBLIC`, and by name from `anon`, `authenticated`, `service_role` and `servisimibul_app` where they exist. | Supabase's default ACL would otherwise grant EXECUTE to its API roles directly. Firing a trigger does not check EXECUTE. |

V22 changes no table grants, RLS policies, foreign keys or other tables, and deletes no rows.

**Dependencies:** V1–V21 applied successfully (V6 `vehicle`/`service_offering`, V15 runtime-privilege hardening). The migration identity must own `vehicle` and `service_offering` and be able to create functions in `public`; on Supabase that is the `postgres` role used by earlier migrations. The runtime role `servisimibul_app` is never used to migrate.

**Locks:** `ALTER TABLE vehicle` takes an `ACCESS EXCLUSIVE` lock, and `CREATE TRIGGER` takes `SHARE ROW EXCLUSIVE` locks on `vehicle` and `service_offering`. The new columns use a constant default, so PostgreSQL 11+ adds them without a table rewrite. The only data update touches currently referenced vehicles. At current pilot volumes, expect the migration to run in well under a second, inside one Flyway transaction.

## Compatibility and deployment order

- **Old backend (V21 build) on a V22 schema: compatible.** It does not map the new columns, new vehicles default to complete history, and its offering writes fire the usage trigger. The old build has no vehicle-delete endpoint, so it remains a valid rollback target after V22. Although it could keep serving during V22, the approved procedure stops it for the maintenance window so the final backup, the migration and the baseline comparison see no concurrent writes (see below).
- **New backend (this PR) on a V21 schema: broken. Do not deploy it before V22.** It starts and `/readyz` reports UP, because Hibernate `validate` does not see the unmapped V22 columns. However, every operator vehicle endpoint (list, create, update, deactivate, delete) queries `usage_history_complete`/`usage_recorded_at` and fails with a server error. Deletion fails closed, so no data is lost, but the fleet workspace is unusable. The only supported order is **V22 first, then the new backend**.
- If any environment auto-deploys `main`, block it until V22 is applied and verified. No such automation is configured today.

## Maintenance window and write freeze

The final backup, the migration and the baseline comparison run inside one announced maintenance window with no application writes. Plan **45 minutes**; the database work itself takes a few minutes at pilot volume, and the rest is verification and buffer.

1. **Announce** the window and its end time. Pause any deployment automation and any manual data-entry, import, data-rights or administration work.
2. **Stop the runtime backend** (the V21 build) and keep its artifact unchanged for the restart. The runtime role `servisimibul_app` is the only application writer: Supabase API roles have no table privileges, and nobody runs ad hoc SQL during the window.
3. **Prove the freeze** before the backup: the `phase=pre` output must report `t` for *Execution role can see all sessions*, *no runtime application sessions* and *no other session holds a write transaction*. Session details are only trustworthy with `pg_read_all_stats`, so the first check is mandatory. Supavisor keeps released server connections open (idle, last statement `DISCARD ALL`); the check ignores those, but any other `servisimibul_app` session, including an idle client, fails it. Verified on 2026-11-19 against shared Supabase: a released pooled connection passed and a connected idle client failed.
4. **Backup → apply V22 → `phase=post`**, as below, without restarting the backend in between. `phase=post` repeats the freeze checks, and its baseline row must equal the `phase=pre` row exactly. Any difference is a No-Go.
5. **End the window.** On success, start the updated backend. On any failure, restart the retained V21 build (it is compatible with both V21 and V22 schemas) and follow *Failure recovery*.

## Read-only sessions

Every preflight, verification and baseline query must run in a read-only transaction that is verified before the first query. Both `36_V22_VALIDATION.sql` and `10_MIGRATION_VERIFICATION.sql` open `begin transaction read only`, then abort through `ON_ERROR_STOP` unless `transaction_read_only` is `on`. `36_V22_VALIDATION.sql` also prints `transaction_read_only`, which must read `on`.

Do **not** rely on `PGOPTIONS=-c default_transaction_read_only=on`: the Supabase session pooler ignores startup options, so such a session is silently read-write. A rehearsal on 2026-11-18 confirmed this (`transaction_read_only = off` through the pooler with `PGOPTIONS` set). Ad hoc queries must use an explicit `begin transaction read only` (or `set session characteristics as transaction read only`) and check `current_setting('transaction_read_only')` first. `scripts/Test-OperationalSqlReadOnly.Tests.ps1` is the CI regression for this contract.

## Go/No-Go checklist

All items must be **Go** before the shared migration. Any **No-Go** stops the operation.

| # | Check | Evidence |
|---|---|---|
| 1 | PR #304 reviewed, approved and merged to `main` by the owner; the release commit is recorded. | PR, merge commit |
| 2 | All five GitHub Actions workflows green on the release commit. | Actions run links |
| 3 | Release JAR built from that commit; the V22 file in the JAR matches the repository (`sha256sum`). | Artifact digest |
| 4 | Explicit owner approval for this V22 shared migration: target project reference, database, operator, window, rollback owner. | Approval record |
| 5 | Read-only preflight (`phase=pre`) passes on the confirmed target: `transaction_read_only = on`, identity, write freeze, Flyway exactly V21, no failed rows, no V22 objects, migration identity owns both tables (10/10 `t`). | Preflight output |
| 6 | Fresh encrypted pre-V22 logical backup taken inside the window; `pg_restore --list` succeeds; checksum, Flyway version 21 and baseline counts recorded outside Git. The archive has been restored once into a disposable database with matching baseline counts, and a machine-independent encrypted copy (owner-held passphrase, not DPAPI) is stored on separate media. | Backup inventory |
| 7 | No other migration, restore, or data-rights operation in progress; no open incident. | Operator confirmation |
| 8 | Rollback plan acknowledged: retain the V21-compatible backend artifact and restart it unless post-verification passes. Accepted by the owner on 2026-11-19. | Release log |
| 9 | Maintenance window announced; runtime backend stopped; deployment automation paused; write-freeze checks `t`. | Window record, preflight output |

## Approved execution sequence

Run from `servisimibul-backend` with secrets supplied by the secret binding, never on the command line. Commands are the ones in [`10_DATABASE_AND_BACKUP_OPERATIONS.md`](10_DATABASE_AND_BACKUP_OPERATIONS.md); only the V22-specific checks are listed here.

0. **Open the maintenance window** and stop the runtime backend, as described above.
1. **Preflight (read-only).** The script prints the identity row, including `transaction_read_only`, before its checks:
   ```powershell
   & psql.exe --no-psqlrc --set ON_ERROR_STOP=1 --set phase=pre --file ..\docs\36_V22_VALIDATION.sql
   if ($LASTEXITCODE -ne 0) { throw 'V22 preflight failed' }
   ```
   `transaction_read_only` must be `on` and every `ok` must be `t`. Record the aggregate baseline row (vehicles, inactive vehicles, referenced vehicles, offerings, published offerings).
2. **Backup.** Take the Docker-free logical backup from the runbook, run `pg_restore --list`, and record the checksum. Do not continue without it.
3. **Apply V22 once** with the release JAR and the `migration` profile (`SB_FLYWAY_ENABLED=true`, `SB_ADMIN_BOOTSTRAP_ENABLED=false`, `--spring.main.web-application-type=none`). Bind both database identities to the migration process only, never to a persistent user or machine environment or the runtime `.env`. Do not pass a Flyway target, `baselineOnMigrate` or `repair`. The runtime backend stays stopped.
4. **Post-verification (read-only):**
   ```powershell
   & psql.exe --no-psqlrc --set ON_ERROR_STOP=1 --set phase=post --file ..\docs\36_V22_VALIDATION.sql
   & psql.exe --no-psqlrc --set ON_ERROR_STOP=1 --file ..\docs\10_MIGRATION_VERIFICATION.sql
   ```
   `transaction_read_only` must be `on`, every `ok` must be `t` (10/10), the baseline row must equal the preflight row, `deletable_candidates` must be `0`, and the verifier must report **14/14 `PASS`**.
5. **Enable the updated backend** and close the window. Deploy the release build with `SPRING_PROFILES_ACTIVE=prod`, `SB_FLYWAY_ENABLED=false` and runtime credentials only. Confirm `/livez` and `/readyz`, then run a smoke check with a synthetic or owner-approved operator account. The fleet list must load, every pre-V22 vehicle must show the "history unknown" note with no **Sil** action, and public discovery must be unchanged. Do not delete real vehicles as a test.
6. **Observe and close.** Watch errors, latency, locks and restarts; remove the migration credentials from the job; record the evidence in `docs/06_PROGRESS.md` and in the "current operational baseline" section of the database runbook.

## Failure recovery

- **V22 fails while migrating.** PostgreSQL DDL is transactional and Flyway runs V22 in one transaction, so a failure rolls back completely: Flyway stays at V21 and no V22 object remains. Restart the retained V21 backend, preserve the logs, re-run the `phase=pre` checks to confirm the rollback, and prepare a reviewed forward fix. Never use `flyway repair`, hand-edit history, or partially apply the SQL.
- **Post-verification fails after a successful migration.** Do not deploy the new backend. The V21 build stays compatible, so restart it and end the window. Diagnose with read-only queries and fix forward through a new reviewed migration. Do not drop triggers or columns by hand.
- **The new backend misbehaves after deployment.** Roll the application back to the previous V21 build; it runs correctly on the V22 schema. Leave V22 in place.
- **Data loss or corruption (last resort).** Follow the restore procedure in the database runbook with separate restore approval: restore the pre-V22 archive into a new empty target with `--exit-on-error --single-transaction --no-owner`, verify it, and re-apply V22. First confirm that the target's `public` schema has no tables and drop that empty schema (no `CASCADE`); the archive recreates it. Then run `phase=pre` on the restored database, apply V22, and run `phase=post` plus the verifier. Any writes after the backup point are lost unless replayed. Prefer a forward fix whenever data is intact.

## Rehearsal evidence (disposable PostgreSQL only)

The full sequence was rehearsed on 2026-11-17 against a throwaway loopback PostgreSQL 17 cluster. That cluster had Supabase-like roles (`anon`, `authenticated`, `service_role`, `servisimibul_app`) and a Supabase-style `postgres` default ACL that grants EXECUTE on new functions. The rehearsal used the release JAR's `migration` profile and only synthetic data. The steps were:

1. V1–V21 migrated, then the preflight passed.
2. A pre-V22 backup was taken and listed.
3. V22 was applied, after which post-validation and the verifier (14/14 `PASS`) passed.
4. The pre-V22 archive was restored into an empty database, after its empty `public` schema was dropped, and preflight passed again.
5. V22 was re-applied to the restored database, and post-validation plus the verifier passed again.

Synthetic baseline counts (3 vehicles, 1 inactive, 1 referenced, 1 published offering) were identical before and after V22 in both databases. After V22 all 3 vehicles reported `history_unknown`, 1 had recorded usage, and 0 were deletable. The first restore attempt, without dropping the schema, failed on `CREATE SCHEMA public`, which is why that step is now documented. Before this hardening, a regression test showed that the Supabase-style default ACL left EXECUTE grants on the V22 trigger functions. V22 now revokes them by role name.

On 2026-11-18 the actual encrypted pre-V22 archive of shared Supabase was decrypted in memory and restored into a disposable loopback PostgreSQL 17 database, which was then removed. The restore reported Flyway V1–V21 with no failed rows and 34 tables. Its baseline counts matched the preflight, and `phase=pre` passed. A read-only recheck of shared Supabase through the session pooler then passed 10/10 with `transaction_read_only = on`, and the Flyway checksums of V1–V21 in the candidate JAR matched shared history. V22 was not applied.

The repository drill (`scripts/Test-BackupRestore.ps1`) separately exercises backup and restore of a V1–V22 database. Neither proves a shared Supabase restore or a production RTO.
