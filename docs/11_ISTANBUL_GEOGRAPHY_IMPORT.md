# İstanbul Geography Verification and Import Runbook

## Purpose and current gate

This runbook covers A-11's one-time İstanbul geography preparation. PostgreSQL remains the application's runtime source of truth; the application must not call TurkiyeAPI at runtime.

The current stage is **source verification only**. Do not write import SQL, connect to a database, or import any records until a developer has run the verifier manually without Codex and recorded a passing result.

## Source and provenance

TurkiyeAPI v2 is a free, independent data source; it is not an official government API.

- API: <https://api.turkiyeapi.dev/v2>
- API reference: <https://docs.turkiyeapi.dev/tr/v2/api-reference/>
- Terms: <https://docs.turkiyeapi.dev/tr/v2/guide/terms>
- Publisher: <https://github.com/ubeydeozdmr/turkiye-api>
- Official district-name comparison: <https://istanbul.gov.tr/>
- Expected dataset version: `2025`
- Expected last-updated date: `2026-05-21`
- Expected İstanbul districts: `39`
- Expected İstanbul neighborhoods: `963`

The 39 district names were compared with the İstanbul Governorate list on 18 October 2026. That comparison does not prove that all 963 neighborhood names are current or officially accurate.

## Required human verification

Run this step yourself in PowerShell 7 from the repository root. Do not ask Codex to run it. It is read-only, needs no database credentials, and writes no API response files.

```powershell
pwsh -NoLogo -NoProfile -File .\scripts\Test-IstanbulGeographySource.ps1
```

The verifier:

- uses HTTPS with a timeout and bounded retries;
- verifies province 34 is `İstanbul`;
- matches exactly 39 district names against the Governorate list;
- follows every neighborhood page until all records are collected;
- checks parent IDs, duplicate IDs, duplicate district/name pairs, and per-district counts;
- requires metadata to remain version `2025`, last updated `2026-05-21`;
- prints only a short pass result, counts, version, and date.

A passing run has this shape:

```text
PASS: TurkiyeAPI İstanbul geography source verification completed.
Province: İstanbul (34)
Districts: 39
Neighborhoods: 963
Dataset version: 2025
Last updated: 2026-05-21
```

If the API is unavailable or any value differs, stop. Do not override the verifier, fabricate rows, rename records, or continue to database work. Investigate and update the reviewed expectations only through a separate human decision.

Record the following in the A-11 pull request before importer implementation:

- execution date;
- PowerShell version from `$PSVersionTable.PSVersion`;
- the six verifier output lines above;
- any optional neighborhood spot checks and remaining uncertainty.

Do not attach raw JSON or credentials.

## Verifier tests

The test suite uses only a loopback mock server and does not contact TurkiyeAPI or a database:

```powershell
pwsh -NoLogo -NoProfile -File .\scripts\Test-IstanbulGeographySource.Tests.ps1
```

## Import stage after the gate

After the manual verifier passes, continue on the same A-11 branch with a dedicated PowerShell 7 importer, isolated tests, and reviewed SQL DML. The importer must:

- default to dry-run;
- require explicit apply and prove the target is disposable local PostgreSQL 17;
- resolve generated database IDs through `province.code`, `(province_id, district.name)`, and `(district_id, neighborhood.name)`;
- never write TurkiyeAPI IDs into identity columns;
- insert only missing İstanbul geography records without truncating, deleting, renaming, or overwriting;
- preserve existing IDs, foreign keys, schools, and other provinces;
- report a row-count preview before apply;
- be idempotent, with a second execution inserting zero rows;
- verify foreign keys, final counts, and the existing geography API responses.

Real schools remain manually curated through the existing ADMIN school UI/API. Do not invent schools in the shared database.

## Shared Supabase boundary

A-11 must not access or modify shared Supabase. Even after the local import passes, a shared import requires a fresh, separate human approval covering the exact target, credentials and role, reviewed SQL, verified source snapshot, row diff, backup/recovery plan, and execution command.
