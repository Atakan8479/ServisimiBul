# UX-01 — account & privacy design acceptance (issue #205)

Technical review of the pinned Manus account/privacy references against the existing React router and production components. This is a design-acceptance and integration-review record, not a new design, not production code, and not a legal or human design approval. All findings below were produced by an automated review of the repository at `main` (verified through `0a873c1`, including the merged APP-01 public legal-page scaffolding, APP-03 email-change, and APP-05 sign-out-all work); no human designer or counsel has signed off on this document or on any copy it quotes.

Pinned references (commit `aaf711c` unless noted): [screen inventory](https://github.com/Atakan8479/ServisimiBul/blob/aaf711cc3ad53fc8ceca3ea537ea693265197691/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/extensions/docs/account-privacy/screen-inventory.md), [flows and interactions](https://github.com/Atakan8479/ServisimiBul/blob/aaf711cc3ad53fc8ceca3ea537ea693265197691/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/extensions/docs/account-privacy/flows-and-interactions.md), [component map](https://github.com/Atakan8479/ServisimiBul/blob/aaf711cc3ad53fc8ceca3ea537ea693265197691/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/extensions/docs/account-privacy/component-map.md), [legal placeholders](https://github.com/Atakan8479/ServisimiBul/blob/aaf711cc3ad53fc8ceca3ea537ea693265197691/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/extensions/docs/account-privacy/legal-placeholders.md).

## Corrected APP cross-references

The pinned screen inventory labels every UX01 security row `APP-04`. The actual APP numbering, confirmed against `docs/06_PROGRESS.md` and the merged backend/frontend code, is:

| Action | Correct APP ID | Status in `main` |
|---|---|---|
| Email change | **APP-03** | Implemented but feature-gated: `/parent\|operator/account/email` (`EmailChangePage`) and `/verify-email-change` (`EmailChangeConfirmationPage`) exist and call the real backend, but `AccountSettingsPage` only shows the `EmailChangeAction` link when `user.emailChangeAvailable` is true. The backend (`AuthService.isEmailChangeAvailable()`) returns true only when the `emailChange.enabled()` config flag is on *and* a real email sender is available; otherwise the UI falls back to the disabled `FutureAction` row. |
| Password change | **APP-04** | Implemented (`PasswordChangePage`, `POST /api/v1/auth/change-password`). Not feature-gated. |
| Sign out of all devices | **APP-05** | Implemented and merged to `main` via PR #232 (`logoutAllDevices`, `SignOutAllDialog` confirmation in `AccountSettingsPage`). Not feature-gated. |

Any copy carried over from the Manus references into future tickets must use APP-03/APP-04/APP-05 as above, not the inventory's "APP-04" blanket label.

## Route, screen, and component reuse matrix

| Manus screen ID | Manus route | Existing production route | Existing component(s) to reuse | Status |
|---|---|---|---|---|
| UX01-01 / UX01-02 | `/parent\|operator/account` | `/parent/account`, `/operator/account` (`router.tsx`) | `WorkspaceShell`, `SectionShell`, `SurfaceCard`, `StatusBadge`, `Button` (`AccountSettingsPage.tsx`) | **Already built**, route and components match. |
| UX01-03 / UX01-04 (email pending/unavailable) | `/account/email?state=...` | `/parent\|operator/account/email` (`EmailChangePage`), `/verify-email-change` (`EmailChangeConfirmationPage`) | `FormField`, `Button`, `role="status"` text blocks (`account-email-pending`, `account-email-unavailable`) | **Already built**, route and components match. The "unavailable" state renders as a disabled row on the account page when `emailChangeAvailable` is false; the "pending" state renders inside `EmailChangePage`/`EmailChangeConfirmationPage` once the flag is on. |
| UX01-05 / UX01-06 (password form / error) | `/account/password?state=...` | `/parent/account/password`, `/operator/account/password` | `FormField`, `Button`, `StatusBadge` (`PasswordChangePage.tsx`) | **Already built**; query-string state variants are not used because the real form renders inline field errors instead of static mock states. |
| UX01-07 / UX01-08 (sign-out-all confirm/ended) | `/account/sessions?state=...` | No separate route; a native `<dialog>` on `/parent\|operator/account` (`SignOutAllDialog`) | `Button` (danger tone), native `<dialog>` with focus trap | **Already built and merged** (PR #232). No "ended" state screen exists; the UI redirects to login with `?loggedOutAll=true` instead. |
| UX01-09 (privacy notice) | `/privacy/notice` | `/privacy/notice` (public; no role guard) | `PublicLayout`, `StatePanel`, `PrivacyNoticePage` | **Route scaffold built by APP-01.** The public footer exposes the route, but the page renders an honest unavailable state because `APPROVED_NOTICE` remains `null`. Publishing notice text remains blocked on LEG-05 (#198). |
| UX01-10 (public request entry) | `/privacy/requests` | `/privacy/requests` (public; no role guard) | `PublicLayout`, `StatePanel`, `PublicRequestEntryPage`, existing `/parent/login` and `/operator/login` | **Route scaffold built by APP-01.** The public footer and privacy-notice page expose the route, but it does not submit a request or claim that login starts one. Publishing a real channel remains blocked on LEG-06 (#199). |
| UX01-11 / UX01-12 (mobile drawer open) | n/a (interaction state) | `WorkspaceShell` drawer, already shipped | `WorkspaceShell` (focus trap, `aria-modal`, skip link in `WorkspaceShell.tsx`) | **Already built**, exceeds the Manus reference (production already implements focus containment and a skip link; the reference only prescribes it as an extension). |
| UX02-* (data rights requests) | `/{role}/privacy/requests/...` | No route exists | None yet | Blocked on LEG-06/LEG-07 and APP-06/APP-07; out of scope for this PR. |
| UX03-* (deactivation / erasure) | `/{role}/lifecycle/...` | No route exists | None yet | Blocked on LEG-03/LEG-07; out of scope for this PR. |

No new parent dashboard or navigation structure is proposed. The parent keeps its existing `PublicLayout` navigation, where an authenticated parent receives the `/parent/account` link. The operator keeps its existing `WorkspaceShell` navigation and `/operator/account` link. APP-01 adds only the public footer links for `/privacy/notice` and `/privacy/requests`; it does not turn either route into a parent workspace or add a dashboard. The disabled "Kişisel veri başvuruları" row on the authenticated account page also stays disabled until LEG-06 approves a real workflow, even though the public request-information route now exists.

## Responsive behavior (1440 / 768 / 390 / 320)

Verified against `servisimibul-frontend/src/features/account/account-settings.css`:

- **1440px**: `AccountSettingsPage` renders the two-column `account-settings-grid` (Security / Privacy section cards side by side).
- **768px** (`@media (width <= 52rem)`): the grid collapses to a single column; action rows keep label/control pairing.
- **390/320px** (`@media (width <= 44rem)`): action rows stack vertically (control moves below its label), matching the Manus guidance that action order verticalizes on narrow mobile. No table layout is introduced at any breakpoint, matching the Manus note that UX01/02/03 must not add a tabular view.
- The sign-out-all dialog is a native `<dialog>` sized by the browser's modal layout at all four widths; no separate mobile layout was required.

Deviation from Manus: the reference screenshots are static 1440×900 and 390×844 full-page captures; production was verified using the live CSS breakpoints above rather than regenerating Manus-style screenshots, since this review is documentation-only and does not run a browser capture pass.

## Accessibility

- Password and email forms: labels and errors are wired through `FormField`, which sets `aria-invalid`/`aria-describedby` (consistent with the Manus `Field`/`SelectField` guidance).
- Sign-out-all dialog (`SignOutAllDialog`): native `<dialog>` with `showModal()`, initial focus on the cancel button, `aria-labelledby`, Escape handling that defers to the pending state, and focus restored to the opening control on close — this already satisfies the "focus trap, first focus, Escape, focus return" extension the Manus component map calls for.
- Mobile drawer (`WorkspaceShell`): focus moves into the drawer on open, is contained via `focusin` trapping, and returns to the menu button on close; a skip link is present. This exceeds what the Manus reference specifies as a to-do.
- Error and status text use `role="alert"` (`account-confirm-error`, `account-password-error`), matching the Manus requirement that general state changes be announced, though a `role="status"` live region for non-error updates (e.g., a future "oturumlar sonlandırıldı" toast) is not yet present because no such state exists in production.
- Not verified in this review: automated contrast or axe scanning. Per the Manus reference notes themselves, the pinned screens are a starting point, not a certification, and this task is documentation-only.

## Loading and error states

- `AccountSettingsPage` / `PasswordChangePage`: loader-driven `HydrateFallback: LoadingPage` and `ErrorBoundary: AccountSettingsRouteError` (403 vs. generic failure, with a retry action via `useRevalidator`).
- Password submission: field-level server errors mapped from `ApiError.problem.fieldErrors`, a rate-limit-specific message, and a generic connectivity fallback — no Manus mock states (`?state=...`) are used; all states are driven by real request outcomes.
- Sign-out-all: pending/disabled button state while the request is in flight, inline `role="alert"` error, and session-expired handling that clears the cached role and redirects to login.
- UX01-03/04 (email) renders the disabled `FutureAction` row when `emailChangeAvailable` is false (no email delivery configured); when the backend flag is on, `EmailChangePage`/`EmailChangeConfirmationPage` provide field-level server errors (`role="alert"`) and a `role="status"` pending block, mirroring the password form's pattern.

## Unresolved legal / policy decisions (not approved here)

Per the pinned `legal-placeholders.md`, the following remain pending and must not be treated as resolved by this review:

- `[LEGAL_COPY_PENDING]`, `[RETENTION_POLICY_PENDING]` — LEG-05 (#198) notice text and retention wording. APP-01 provides a safe unavailable-state page only; it does not resolve these placeholders.
- `[CONTACT_CHANNEL_PENDING]`, `[REQUEST_RESPONSE_POLICY_PENDING]`, `[IDENTITY_VERIFICATION_METHOD_PENDING]`, `[APPROVED_RESPONSE_PENDING]` — LEG-06 (#199) request-handling channel, SLA, and verification method. APP-01 provides a public entry route but deliberately publishes no email, KEP address, form, or submission claim.
- `[ACCOUNT_REACTIVATION_POLICY_PENDING]`, `[ACCOUNT_DEACTIVATION_EFFECTS_PENDING]` — LEG-07 (#200) deactivation/reactivation effects.
- `[SECURITY_SESSION_POLICY_PENDING]`, `[PASSWORD_POLICY_PENDING]` — already resolved in practice by the merged APP-04/APP-05 password policy and session-revocation behavior, but LEG review of that copy for UX01-05/06/07/08 has not occurred.

No notice text, retention period, contact channel, or reactivation guarantee is proposed or implied anywhere in this document.

## Deliberate deviations from Manus (summary)

- No `/account/sessions` or `/*/lifecycle/*` routes were added; sign-out-all uses an in-page dialog instead of a dedicated route, and email change reuses `/account/email` and `/verify-email-change` rather than Manus's query-string state variants. APP-01 later added the two public `/privacy/*` route scaffolds, but not the legally blocked notice text or request workflow.
- No query-string mock states (`?state=...`) were adopted; production renders states from real loaders/requests only.
- No new design system component names were introduced; existing `Button`, `FormField`, `SurfaceCard`, `SectionShell`, `StatusBadge`, `StatePanel`, and `WorkspaceShell` are reused as-is.
- Mobile focus-trap and skip-link behavior in `WorkspaceShell` already exceeds the Manus extension request.

## Open questions for maintainers

1. Should `docs/01_DECISIONS.md` or `docs/04_ROADMAP.md` record this APP-03/04/05 correction so future tickets stop inheriting the inventory's "APP-04" label? (Proposed, not applied in this PR.)
2. Should the UX01-07/08 "ended" screenshot state be formally dropped from the Manus inventory now that production uses a login redirect instead, or kept as a future toast design?
3. This review did not re-run the Chromium/axe UI-rollout-gate capture (`docs/17_UI_ROLLOUT_GATE.md`) for UX-01; confirm whether that gate needs a dedicated pass now that APP-01, APP-03 (gated), and APP-05 are on `main`.
4. Confirm the intended rollout condition for `emailChangeAvailable` (config flag plus live email sender) before UX01-03/04 copy is finalized, since the UI behavior differs between pilot environments with and without email delivery configured.
