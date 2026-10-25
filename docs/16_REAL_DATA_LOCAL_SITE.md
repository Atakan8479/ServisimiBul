# Run ServisimiBul with the real V12 data, safely

The shared Supabase database currently remains at Flyway V12. The Spring Boot checkout contains V13–V15 entities and must **not** be started against a shared V12 schema: Hibernate validation would fail or new behavior could reference absent tables.

Use the verified private V12 backup from the 2026-10-25 rehearsal, rather than connecting the development web application directly to the shared Supabase runtime.

## Start in Windows PowerShell

From the repository root, while on `codex/ops-01-guarded-supabase-migration`:

```powershell
git pull --ff-only

.\dev-snapshot.ps1 -BackupEvidencePath "$env:USERPROFILE\Documents\ServisimiBul-Backups\servisimibul-v12-20261025T125207Z-f6d93a67-backup.json"
```

The launcher requires installed Java 21+, Node 24, PostgreSQL 17 binaries and frontend `node_modules` (install once with `npm ci` inside `servisimibul-frontend`). Use `-JavaHome` / `-PostgresBin` when tool discovery requires it.

It verifies project and source system identity, the archived custom-format backup SHA-256, Flyway V12 history and unchanged migration SQL; restores `public` only to a random loopback PostgreSQL 17 cluster; runs V13–V15 migrations and Hibernate validation **only on that disposable cluster**; and launches React on http://127.0.0.1:5173 and Spring Boot on http://127.0.0.1:8080. It neither reads the ignored shared `.env` nor passes migration secrets to the running web application.

Press Ctrl+C to terminate the two web processes and delete the temporary database copy. **Any data you enter is temporary** and will be discarded on exit. The original shared Supabase users and data are never modified by this runner; do not use real personal accounts to test password or contact workflows in screenshots.

## What to expect

The validated live source contains İstanbul, 39 districts, 963 neighborhoods, one school, an operator profile and a vehicle. It contains no published service offerings. Geography and school lookup should return real records, but an operator match may be empty until an offering or valid published operator coverage is configured (in the disposable copy for experimentation). This is not proof that all marketplace workflows already have complete production content.

## When you actually want the shared DB in the browser

`dev-supabase.ps1` is already supported for read/write development against a compatible shared schema. **Do not use it until the real Supabase database is at V15 and a fresh separately authorized production migration has passed all gates.** It writes back to shared Supabase, unlike `dev-snapshot.ps1`.

The documented review/maintenance/rollback approval procedure stays in `docs/11_SUPABASE_V15_RELEASE_RUNBOOK.md`. The new snapshot launcher is intentionally not a shortcut for live Flyway migration.
