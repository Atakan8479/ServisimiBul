# QA-01 account and privacy lifecycle evidence — Issue #223

Date: 2026-11-09. Baseline: `main` at `b04ac69` (merged PRs #265–#267). The test stack is React/Vite through its real proxy, Spring Boot with server-side sessions and CSRF, and a disposable loopback PostgreSQL 17.4 database migrated from V1 through V21. No request interception, Supabase, production setting, real personal data, or persistent test data is used.

## Coverage audit and focused addition

Existing backend and real-browser coverage already exercises anonymous/parent/operator/admin authorization, CSRF, operator ownership/404 IDOR behavior, password and logout-all session revocation, suspension and discovery removal, shared parent demands, notification ownership, retry/error paths, and concurrent demand/operator-school writes. Mocked account browser tests already cover the gated dialog states, API failure/retry, keyboard focus, and responsive layouts. QA-01 therefore adds one separate real-stack scenario instead of duplicating those tests.

The new scenario proves parent and operator deactivation when the gate is explicitly enabled only in the disposable harness; anonymous receives 401, admin receives 403, missing CSRF receives 403 and a valid retry succeeds. It verifies all sessions are revoked, credentials cannot log in again, concurrent operator requests produce at least one 204 while the other may also return 204 or may observe the revoked session as 401 or 403, a deactivated operator disappears from anonymous discovery, and another parent's support plus the shared demand survive while only the deactivated parent's public contribution is removed. The default-disabled data-rights endpoint returns 503 through the real stack.

At 1440, 768, 390, and 320 pixels the real account page has no horizontal overflow and passes the configured axe WCAG tags. The native confirmation dialog moves focus to Cancel and passes the same axe scan. The run also found that the enabled deactivation trigger is 32 px high, below the repository helper's 44 px touch-target floor; no visual change was made because QA-01 excludes redesign work.

## Executed evidence

- Real full stack: 2/2 Playwright cases passed on fresh PostgreSQL 17.4 after Flyway V1–V21; the database, tariff volume, and generated credentials were deleted afterward.
- Backend: 383/383 tests passed and the application package built on a separate disposable PostgreSQL 17.4 cluster. The first local full rerun had two unrelated `DataRightsApiTests` assertion failures; the unchanged rerun passed, and no APP-13-owned file was modified.
- Frontend: 290/290 Vitest and 253/253 mocked Chromium cases passed; ESLint, strict TypeScript, and the Vite production build passed. Focused account Vitest passed 39/39.
- Harness safety self-test and `git diff --check` passed. Repository-wide Prettier remains red on 128 pre-existing files; the new QA-01 spec is formatted.
- Local PowerShell 5.1 cannot run the PowerShell-7-only deployment/privacy-inventory scripts (`pwsh` and `utf8NoBOM` are unavailable). Those CI checks remain required on the PR. Local `gitleaks` is not installed, so Secret scan also remains CI-only.

## Release decision and residual risk

QA-01 is **not accepted**. LEG-03, LEG-06, and LEG-07 approvals remain pending; production keeps deactivation and data-rights handling fail-closed. No erasure, anonymization, reactivation, retention schedule, automatic 30-day cleanup, legal hold, backup disposal, or restore-after-erasure workflow was executed or inferred. APP-13-owned service/entity/event/tests and migration/schema files were not changed. The 32 px destructive-action target needs the separately owned UI refinement before accessibility sign-off.
