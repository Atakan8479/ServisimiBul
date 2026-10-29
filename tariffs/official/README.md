# Publishing the verified 2026–2027 Istanbul school-service tariff

The version-controlled, publication-ready canonical JSON is:

`tariffs/official/34/current.json`

It contains the 13 official monthly and annual distance bands, the monthly 87.99 TRY surcharge per kilometer beyond 25 km, and 17 explanatory conditions, along with the official source, decision number, and effective date.

**This repository file is NOT automatically loaded into the running API.** The backend reads `<SB_TARIFF_STORAGE_DIR>/34/current.json` and immutable files in `<SB_TARIFF_STORAGE_DIR>/34/versions/`. Neither copying this file into a live volume nor merging this PR constitutes approval to publish it.

## Review before publication

1. Check that the tariff source remains current at the date of publication. The document references the İBB Council decision of July 17, 2026, no. 813, effective July 20, 2026. Official source: https://tuhim.ibb.gov.tr/media/27492/okul-servis-ta%C5%9F%C4%B1mac%C4%B1l%C4%B1%C4%9F%C4%B1-%C3%BCcret-tarifesi.pdf.
2. Verify the JSON against `servisimibul-backend/src/test/resources/tariff/official/istanbul-2026-2027.json`, `docs/16_UKOME_2026_2027_TARIFF.md`, and the official PDF. Preserve integer kuruş and the `effectiveTo: null` value.
3. Identify the correct target deployment and configured `SB_TARIFF_STORAGE_DIR`; never assume test fixture volumes or repository paths are the active production volume.
4. Back up the current tariff and existing immutable versions off-volume before a write. Avoid replacing the filesystem `current.json` manually: such a copy would bypass version history, validation, optimistic concurrency, and atomic update logic.
5. Log in as an authorized ADMIN and open the existing tariff editor. Load the current version. If there is no tariff, the expected version is `null`; otherwise use the version returned by the backend.
6. Paste the **complete contents** of `tariffs/official/34/current.json` into the editor, inspect the preview and save via the existing admin API. If the current version is already `2026-2027-ibb-813`, do not try to write an identical version; verify the published document instead. For HTTP 409, stop and reconcile the concurrent change; do not blindly overwrite.
7. After approval and save, read the public endpoint `GET /api/v1/tariffs?provinceCode=34`, confirm the version and values, and check the public tariff table. Record who approved publication, date, response version, and backup location in the deployment log.

## Important boundaries

- Test files in `scripts/fixtures/j03` and `scripts/fixtures/j05` are **intentionally synthetic** and must not be used as official price sources.
- Do not change storage settings or connect to shared Supabase as part of this data-only PR.
- A merge only makes the canonical source file available in the repository. Explicit deployment approval is required to publish it.
- The displayed amounts are official reference maxima, not a personalized quoted fare or a route-distance calculation.
