# UX-03 — account lifecycle and erasure request design acceptance (issue #207)

Technical review of the pinned Manus account-lifecycle references (screen inventory, flows and interactions, component map, legal placeholders — commit `aaf711c`) against the existing React router, production components, and the LEG-03/LEG-07 decision records, following the merged UX-01 (`docs/22_UX_01_ACCOUNT_PRIVACY_DESIGN_ACCEPTANCE.md`) and UX-02 (`docs/23_UX_02_PRIVACY_REQUEST_DESIGN_ACCEPTANCE.md`) reviews. This is a design-acceptance and integration-review record, not a new design, not production code, and not a legal or human design approval. Verified against `main` at `6f7424f` on 2026-11-04. APP-09 now supplies a real deactivation API and an in-page confirmation dialog on the existing account routes, but `app.auth.account-deactivation.enabled` defaults to `false` and is fixed `false` in production. No standalone lifecycle, erasure, suspension-status, or reactivation route exists; those parts of UX03 remain proposed and legally gated.

## Five distinct operations, not one "lifecycle" state

Per LEG-07 section 3, these are five separable things. A single screen or component must never collapse two of them:

| Operation | Who triggers it | Built today? | Reversible in software today? |
|---|---|---|---|
| **Operator profile hiding** | Operator, self-service | **Yes** — `OperatorProfilePage`, `operator_profile.is_publicly_visible` | Yes, the operator toggles it back on at any time (D028, D049) |
| **Voluntary account deactivation** | Account holder | **Gated scaffold only** — `POST /api/v1/auth/deactivate`, `DeactivateAccountAction`, and `DeactivateAccountDialog` exist, but the flag is off by default and in production; users still see the disabled `FutureAction` row | **No reactivation path exists.** LEG-07 AQ2 and the public-visibility/content effects remain pending, so activation is blocked. |
| **Administrative suspension** | An ADMIN, with a required reason (D056) | **Yes** — `operator_profile.active=false`, `app_user.enabled=false`, all sessions revoked | **No.** No code path re-enables an operator; no unsuspend endpoint exists (LEG-07 section 2, row 2) |
| **Erasure request** | Data subject or representative | **No** — shown as a disabled `FutureAction` row (APP-10/APP-11, #217/#218) | A rejected request is not reversible by the requester; withdrawal before execution is **not an available or guaranteed capability** — it may only be offered if LEG-07 AQ6 is approved. An executed erasure cannot be undone (LEG-03). |
| **Conditional reactivation** | Account holder, only if no suspension applies and no erasure executed | **No** — no mechanism exists; LEG-07 4.1 requires it to check every independent restriction first | n/a — not built |

Lifting one restriction never lifts another (LEG-07 4.1). A suspended operator who later "deactivates" or resets a password stays suspended; nothing in `main` lets any self-service action clear `operator_profile.active` or `app_user.enabled` back to true.

## Route, screen, and component reuse matrix

| Manus screen ID | Manus route | Current / proposed production mapping | Reusable component(s) | Status |
|---|---|---|---|---|
| UX03-01 | `/parent/lifecycle` | Existing `/parent/account` (`parentLoader`) inside `PublicLayout`; no standalone lifecycle route | `AccountSettingsPage`, `SectionShell`, `SurfaceCard`, gated `DeactivateAccountAction`, disabled erasure `FutureAction` | **Partially built.** The existing privacy section keeps deactivation and erasure distinct. Deactivation remains unavailable while the flag is false; erasure remains a disabled placeholder. Parent suspension is unsupported and LEG-07 AQ3 remains open. |
| UX03-02 | `/operator/lifecycle` | Existing `/operator/account` (`operatorLoader`) inside `WorkspaceShell`; no standalone lifecycle route | Same `AccountSettingsPage`, plus the existing link to `/operator/profile` for profile visibility | **Partially built.** Profile visibility stays separate from account deactivation, and erasure remains disabled. No authenticated suspension-status or reactivation entry exists. |
| UX03-03 | `/operator/profile` (existing screen, boundary reference only) | `/operator/profile` (`OperatorProfilePage`) | Existing visibility toggle | **Already built.** Per the Manus reference notes, this screen is not redesigned or copied; UX03-02 only links to it. |
| UX03-04 | `/parent/lifecycle/deactivate?state=confirm` | Native `DeactivateAccountDialog` on `/parent/account` or `/operator/account`; no separate route | `DeactivateAccountAction`, `DeactivateAccountDialog`, danger `Button` | **Built but gated off.** The real action appears only when `accountDeactivationAvailable` is true; otherwise the account page shows an unavailable `FutureAction`. The dialog states that deactivation ends access and sessions, is not erasure, and has no self-reactivation path. |
| UX03-05 | `?state=processing` | Pending state in the same dialog | Disabled cancel/confirm controls; confirm label changes to `Devre dışı bırakılıyor…` | **Built but gated off.** Escape and close are suppressed while the request is pending, so the UI does not imply completion before the server responds. |
| UX03-06 | `?state=success` | Server `204` clears client auth state and redirects to the role login with `?accountDeactivated=true` | Existing role login route | **Backend transition and redirect built but gated off.** The login pages do not currently render a message for this query parameter, so no production completion screen exists and none is claimed here. |
| UX03-07 | `?state=error` | Inline error in the same dialog; the confirm control remains available for retry | `role="alert"`, danger `Button` | **Built but gated off.** API/rate-limit/network errors keep the authenticated account page and session; expired sessions follow the existing role-login redirect. No contact channel is invented. |
| UX03-08 | `/operator/lifecycle/suspended` | `/operator/lifecycle/suspended` | `StatePanel` (info/blocked variant), **no** action button of any kind | Not built, and **has no accessible entry point today**: `SessionAuthenticationService` throws a generic `InvalidCredentialsException` for a disabled account (`AuthPersistenceService.isEnabled` filter), the same message as a wrong password, to avoid account enumeration. A suspended operator therefore cannot reach any authenticated route, including this one, until an admin or another out-of-band channel tells them. This screen is only reachable from a non-login surface (for example, a link an admin sends) — the route must not assume the operator can log in to see it. |
| UX03-09 | `/parent\|operator/lifecycle/erasure` → form | Disabled `FutureAction` on the account page today; proposed handoff to `/{role}/privacy/requests/new?type=erasure` | Existing account privacy section, then the planned UX-02 `PrivacyRequestForm` | **Not built.** APP-01's public `/privacy/requests` page is information-only and does not submit a request. UX03-09 remains a short proposed explanation screen handing off to one shared future form, never an instant-delete action. |

No new dashboard, table, or standalone layout is introduced. Parent lifecycle entry points remain in `PublicLayout`; operator entry points remain in `WorkspaceShell`; both reuse `AccountSettingsPage` rather than copying the Manus shells.

## Confirmation / processing / success / failure / pending / recovery coverage

| Operation | Confirmation | Processing | Success | Failure | Pending/blocked | Recovery |
|---|---|---|---|---|---|---|
| Hide profile | N/A — existing toggle on `/operator/profile`, not re-reviewed here | Existing | Existing | Existing | — | Toggle back on (existing, reversible) |
| Deactivation | UX03-04 (CTA disabled until LEG-07) | UX03-05 | UX03-06 (conditional, server-verified only) | UX03-07 (retry + contact placeholder) | Shown as disabled `FutureAction` today | Reactivation mechanism `[PENDING: owner]` (LEG-07 4.1); never implicit via login, password reset, or email change |
| Administrative suspension | N/A — admin-initiated, not a self-service confirm | N/A | N/A | N/A | UX03-08 (operator sees a blocked state, no action) | **None available to the operator.** LEG-07 requires negative tests proving no self-reactivation path (section 4.2) |
| Erasure request | UX03-09 entry screen → UX-02 submission flow | Shared with UX-02 "received"/"under review" | Shared with UX-02 "completed" (never implies full/immediate deletion) | Shared with UX-02 "rejected"/"partially fulfilled" | Shared with UX-02 status route | **Withdrawal is not available today and may only be offered if LEG-07 AQ6 is approved** — no withdrawal mechanism may be designed or shown before that approval; if approved, withdrawal would never reactivate any other restriction (LEG-07 4.2) |
| Conditional reactivation | Not designed; LEG-07 4.1 requires checking suspension, deactivation, and erasure state first | — | — | — | Entirely `[PENDING]` | Must be an explicit, separate action — never a side effect of another flow |

## Erasure requests never imply deletion

Per LEG-03 section 2.4 and LEG-07 section 3, an `app_user` row cannot currently be deleted: ten `ON DELETE RESTRICT` foreign keys (operator profile, tokens, demand creator, supports, comments, reports, moderation actions) block a plain `DELETE`, and no approved disposal sequence exists yet (APP-11, #218). Every UX03-09 and shared UX-02 screen must therefore:
- call the action a **request**, never "delete my account" or "delete my data" as an instant action;
- never show elapsed time, a countdown, or a completion percentage toward deletion;
- on the UX-02 "completed" status shared by erasure, state only that review finished and an outcome was reached — not that all data was removed (LEG-03 section 4: live rows, sessions, logs, and backups each clear on independent, still-`[PENDING]` schedules);
- on rejection or partial fulfillment, show the reasoned outcome only; no appeal/resubmission path is promised here, consistent with the UX-02 review's same caveat;
- offer no withdrawal affordance for a submitted request unless and until LEG-07 AQ6 is approved (see the coverage table above) — the question is open, not resolved in either direction.

## No self-reactivation of administratively suspended operators

This is a hard constraint, not a copy preference:
- UX03-08 renders with **zero interactive elements that change account state** — no "reactivate," "appeal," or "contact support and resume" button that itself performs an action. Any contact information shown is informational text (`[CONTACT_CHANNEL_PENDING]`), not a form that could resubmit a login or a reactivation request.
- The route must not be linked from, or linkable to, the deactivation flow (UX03-04/05/06/07) or the erasure flow (UX03-09) — LEG-07 4.1 explicitly lists deactivation-then-reactivation, password reset, email change, login, and erasure withdrawal as paths that must **not** lift a suspension.
- Because login itself fails for a disabled account (generic `InvalidCredentialsException`, not a distinguishing message), production cannot currently route an authenticated user to UX03-08 at all. Before this screen is built, the entry path (an admin-sent link, a status page reachable without session auth, or similar) needs an explicit design decision this document does not make.

## Responsive behavior (1440 / 768 / 390 / 320)

No UX-03 CSS exists yet to verify against. Following the UX-01 shipped breakpoints (`account-settings.css`) and the UX-02 carried-forward expectation:
- **1440px**: lifecycle cards (hide / deactivate / suspension-status / erasure) sit in the existing two-column `SectionShell` grid, one card per operation — never merged into one card.
- **768px**: columns collapse to one, as `AccountSettingsPage` already does.
- **390/320px**: action order verticalizes; the danger-tone deactivation button and any retry button meet the existing ≥46px mobile tap height; long placeholder and explanatory text wraps rather than truncating.
- No table layout at any width, consistent with the Manus "do not add a tabular view" note and the UX-01/02 precedent.

This is a carried-forward expectation, not a verified implementation — flagged below as an open item, same caveat as UX-02.

## Accessibility and keyboard/focus requirements

- Destructive CTA (deactivation): while disabled (pre-LEG-07), it is a real `disabled` button, not a styled link, so it is correctly skipped by keyboard navigation and announced as unavailable by assistive tech — not a clickable element that silently no-ops.
- Confirmation step (UX03-04): if a dialog is used rather than a full route, it must follow the `SignOutAllDialog` precedent already shipped for APP-05 — native `<dialog>`, `showModal()`, initial focus on cancel, `aria-labelledby`, Escape handling deferred during a pending request, focus returned to the opening control on close.
- Processing/success/error states (UX03-05/06/07): processing and success use `role="status"`; errors use `role="alert"`, matching the UX-01/02 live-region convention — color is never the only signal, `StatusBadge` carries a text label.
- Suspended state (UX03-08): since it has no interactive elements, the page content itself must be announced on load (e.g. a heading plus `role="status"` summary), with no focus trap needed because there is no dialog.
- Erasure entry (UX03-09): identical `FormField` (`aria-invalid`/`aria-describedby`) pattern as the UX-02 form it hands off to; no new field-validation convention is introduced.
- Not verified in this review: automated contrast or axe scanning, consistent with the UX-01/02 caveat that these are a design starting point, not a certification.

## Legal and product dependencies (not approved)

None of the following are resolved by this review; all are `[PENDING]` per LEG-03/LEG-07 and the Manus `legal-placeholders.md`:

- `[ACCOUNT_REACTIVATION_POLICY_PENDING]`, `[ACCOUNT_DEACTIVATION_EFFECTS_PENDING]` — LEG-07 AQ2: whether deactivation exists, its effect on each record category (LEG-07 section 5), and whether/how it is reversible.
- `[LEGAL_COPY_PENDING]`, `[RETENTION_POLICY_PENDING]` — UX03-01/02/08/09 explanatory and erasure-entry text (LEG-03/LEG-07 owner + counsel).
- `[CONTACT_CHANNEL_PENDING]` — UX03-07/08/09; no working support/contact channel exists, so no channel name or address may appear.
- LEG-07 AQ1 (whether an administrative suspension should ever be reversible, and by whom) — currently **not possible in software** regardless of policy, since no unsuspend code path exists.
- LEG-07 AQ3 (whether parent accounts can be suspended at all) — currently unsupported in software (content-only moderation today); UX03-01 reflects that current absence, but whether a future parent-suspension policy should be added remains open and is not decided or foreclosed here.
- LEG-07 AQ4 (whether a suspended/deactivated person's comments stay published with a generic author or are hidden) — affects no UX03 screen directly but is cross-referenced because UX03-02/08 may need to describe this effect once resolved.
- LEG-07 AQ6 (whether an erasure request can be withdrawn) — UX03-09's "withdraw" affordance, if any, cannot be designed until this is answered.
- LEG-07 section 4.1's required **negative tests** (suspended operator cannot regain access via self-reactivation, deactivate-then-reactivate, password reset, email change, login, or erasure withdrawal) are a product/QA gate for implementation, not satisfied by this document, and are listed here so they are not lost before APP-09/10/11 start.

No reactivation guarantee, deactivation effect, retention period, or contact channel is proposed or implied anywhere in this document.

## Deliberate deviations from Manus

- UX03-09 is specified as a short explanation screen that hands off into the planned UX-02 erasure form (`type=erasure`, not yet implemented) rather than a separate end-to-end form, avoiding a duplicate submission path.
- The deactivation query-string states (`?state=confirm|processing|success|error`) are kept as one route with state-driven rendering, not four static Manus-style routes, following the UX-01/02 precedent of collapsing mock state variants into one real component.
- UX03-08 is specified with no interactive controls at all (the Manus component map already calls for this — "AdminSuspensionState (yalnız işletmeciye bilgi; reactivation yok)" — but this review makes explicit that even a disabled-looking reactivate button must not exist, since a disabled button a developer later "fixes" is a bigger risk than one that was never coded).
- This review flags, rather than assumes, how UX03-08 is reached at all, since today's generic login error means no authenticated route can get a suspended operator there — the Manus reference does not address this gap.

## Open questions / not verified

- No UX-03 route, component, or CSS exists on `main`; this document is a target matrix for implementation, not a confirmation of shipped behavior, matching the UX-02 precedent (contrast with UX-01, which reviewed already-merged code).
- How UX03-08 is reached without authenticated access is unresolved; this document does not propose a mechanism (email, admin-shared link, or otherwise), since that is a product/security decision outside this review's scope.
- Responsive breakpoints above are inferred from the UX-01/02 precedent, not measured against UX-03-specific markup.
- APP-09/APP-10/APP-11 backend contracts (deactivation, erasure execution, record-level effects) are undefined; this review does not propose an API shape, per the issue's constraints.
- Parent suspension is currently unsupported in software, and whether it should ever be added (LEG-07 AQ3) is a separate, still-open policy decision; if approved in the future, UX03-01 would need a suspension-status card added, which this document does not pre-design.
