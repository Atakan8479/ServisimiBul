# QA-02 account and privacy evidence — Issue #224

Date: 2026-11-09. Scope: current React account settings/navigation, public and authenticated privacy-request entry, erasure-request receipt/status, and voluntary deactivation. Compared with the pinned Manus UX-01/02/03 extension and the accepted deviations in `docs/22`, `docs/23`, and `docs/28`.

## Verified improvements

- Deactivation and sign-out confirmation dialogs now expose their consequence text as the accessible dialog description.
- A failed deactivation returns keyboard focus to the enabled confirmation control after announcing the API error, so retry does not restart keyboard navigation.
- The enabled erasure-request Playwright journey now includes the required 768 px viewport; account and fail-closed public-request checks already covered 1440, 768, 390, and 320 px.

No legal copy, API behavior, feature flag, deletion behavior, reactivation path, contact channel, backend, migration, or production setting changed. Existing copy continues to distinguish profile hiding, voluntary deactivation, administrative suspension, and an erasure request; receipt status does not claim deletion.

## Evidence and limits

- Mocked Playwright: account settings for parent/operator, navigation separation, keyboard deactivation, failure announcement/focus, fail-closed public/authenticated request entry, erasure receipt/status, axe WCAG-tag scans, and horizontal-overflow checks.
- Vitest: existing account/data-rights/deactivation state and API-error coverage, including the assertion that an erasure receipt does not say data was deleted.
- These browser tests intercept APIs. They prove React behavior only and are not production, persistence, session, authorization, retention, or deletion assurance.

Actual local runs:

- `playwright test` for APP-02/06/10: 25/25 mocked Chromium cases passed, including axe and overflow assertions. The Windows runner did not exit after reporting all cases, so it was stopped after the completed results.
- Focused account Vitest: 39/39 passed. TypeScript, ESLint, production build, and formatting of changed files passed.
- Full Vitest: 282/290 passed; eight unrelated asynchronous route/discovery/demand tests timed out. The focused account suite remained green. Repository-wide Prettier also remains red on 118 pre-existing files; this PR does not reformat them.

## Remaining blockers

- QA-01 (#223) is open, so QA-02 is not accepted and Issue #224 must remain open.
- Real full-stack account/privacy lifecycle, security, persistence, retention, rollback, and actual API-error evidence remains owned by QA-01.
- Legal feature flags remain fail-closed; no working public KVKK channel, real erasure execution, self-reactivation, or suspension recovery path was tested or introduced.
