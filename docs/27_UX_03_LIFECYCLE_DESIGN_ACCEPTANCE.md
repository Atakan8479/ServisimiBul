# UX-03 — account lifecycle and erasure request design acceptance (issue #207)

Technical review of the pinned Manus account-lifecycle references (screen inventory, flows and interactions, component map, legal placeholders — commit `aaf711c`) against the existing React router, production components, and the LEG-03/LEG-07 decision records, following the merged UX-01 (`docs/22_UX_01_ACCOUNT_PRIVACY_DESIGN_ACCEPTANCE.md`, PR #242) and UX-02 (`docs/23_UX_02_PRIVACY_REQUEST_DESIGN_ACCEPTANCE.md`, PR #243) reviews. This is a design-acceptance and integration-review record, not a new design, not production code, and not a legal or human design approval. No lifecycle route, API, or mock backend exists on `main` today; every UX03-* screen below is **proposed** against existing infrastructure. Verified against `main` at `c4b959d` (merge of PR #243) on 2026-11-04, cross-referenced with `docs/24_ACCOUNT_LIFECYCLE_POLICY.md` (LEG-07, verified at `3bd2ee6`) and `docs/20_RETENTION_AND_ERASURE.md` (LEG-03, verified at `182a59d`).

## Five distinct operations, not one "lifecycle" state

Per LEG-07 section 3, these are five separable things. A single screen or component must never collapse two of them:

| Operation | Who triggers it | Built today? | Reversible in software today? |
|---|---|---|---|
| **Operator profile hiding** | Operator, self-service | **Yes** — `OperatorProfilePage`, `operator_profile.is_publicly_visible` | Yes, the operator toggles it back on at any time (D028, D049) |
| **Voluntary account deactivation** | Account holder | **No** — shown as a disabled `FutureAction` row on `AccountSettingsPage` (APP-09, #216) | `[PENDING]` — LEG-07 AQ2 |
| **Administrative suspension** | An ADMIN, with a required reason (D056) | **Yes** — `operator_profile.active=false`, `app_user.enabled=false`, all sessions revoked | **No.** No code path re-enables an operator; no unsuspend endpoint exists (LEG-07 section 2, row 2) |
| **Erasure request** | Data subject or representative | **No** — shown as a disabled `FutureAction` row (APP-10/APP-11, #217/#218) | A request may be withdrawn/rejected before execution; an executed erasure cannot be undone (LEG-03) |
| **Conditional reactivation** | Account holder, only if no suspension applies and no erasure executed | **No** — no mechanism exists; LEG-07 4.1 requires it to check every independent restriction first | n/a — not built |

Lifting one restriction never lifts another (LEG-07 4.1). A suspended operator who later "deactivates" or resets a password stays suspended; nothing in `main` lets any self-service action clear `operator_profile.active` or `app_user.enabled` back to true.

## Route, screen, and component reuse matrix

| Manus screen ID | Manus route | Proposed production route | Reusable component(s) | Status |
|---|---|---|---|---|
| UX03-01 | `/parent/lifecycle` | `/parent/lifecycle` | `WorkspaceShell`, `SectionShell`, `SurfaceCard` (one card per operation: deactivation, erasure) | Not built. Parents have no suspension or profile-hiding concept, so this page only ever shows deactivation and erasure entries, consistent with LEG-07 AQ3 (parent suspension is `[PENDING: owner]`, not assumed here). |
| UX03-02 | `/operator/lifecycle` | `/operator/lifecycle` | `WorkspaceShell`, `SectionShell`, `SurfaceCard`, link to existing `/operator/profile` for hiding | Not built. Must visually separate the four operator-facing concepts (hide, deactivate, admin suspension status, erasure) into distinct cards per the Manus flow; none may share one CTA. |
| UX03-03 | `/operator/profile` (existing screen, boundary reference only) | `/operator/profile` (`OperatorProfilePage`) | Existing visibility toggle | **Already built.** Per the Manus reference notes, this screen is not redesigned or copied; UX03-02 only links to it. |
| UX03-04 | `/parent/lifecycle/deactivate?state=confirm` | `/parent\|operator/lifecycle/deactivate` (confirm state) | `SurfaceCard`, `Button` (danger tone, **disabled** until LEG-07 approval), explanatory copy | Not built. Per the Manus flow and LEG-07 section 7, the destructive CTA must render disabled with a reason until an approved deactivation policy exists — this is not a cosmetic choice, it is the acceptance criterion in issue #207 ("no one-click... guarantees"). |
| UX03-05 | `?state=processing` | same route, processing state | `StatePanel` (loading variant, `role="status"`) | Not built. Must not claim the account state has changed while a request is in flight. |
| UX03-06 | `?state=success` | same route, success state | `StatePanel` (success variant), `StatusBadge` | Not built. Per the Manus note and LEG-07 section 1, this state is only wireable once a server-verified deactivation response exists; it is a conditional result UI, not a static confirmation. |
| UX03-07 | `?state=error` | same route, error state | `StatePanel` (error variant, `role="alert"`, retry `Button`) | Not built. Must offer retry and a `[CONTACT_CHANNEL_PENDING]` placeholder, not a dead end. |
| UX03-08 | `/operator/lifecycle/suspended` | `/operator/lifecycle/suspended` | `StatePanel` (info/blocked variant), **no** action button of any kind | Not built, and **has no accessible entry point today**: `SessionAuthenticationService` throws a generic `InvalidCredentialsException` for a disabled account (`AuthPersistenceService.isEnabled` filter), the same message as a wrong password, to avoid account enumeration. A suspended operator therefore cannot reach any authenticated route, including this one, until an admin or another out-of-band channel tells them. This screen is only reachable from a non-login surface (for example, a link an admin sends) — the route must not assume the operator can log in to see it. |
| UX03-09 | `/parent\|operator/lifecycle/erasure` → form | `/parent\|operator/lifecycle/erasure` → `/{role}/privacy/requests/new?type=erasure` | `SurfaceCard` explanatory screen, then the UX-02 `PrivacyRequestForm` (`docs/23_UX_02_PRIVACY_REQUEST_DESIGN_ACCEPTANCE.md` UX02-06) | Not built. This is an entry/explanation screen only; it hands off to the existing UX-02 erasure form rather than duplicating it, per the Manus flow and the UX-02 precedent of one shared form. |

No new dashboard, table, or standalone layout is introduced, consistent with the UX-01/UX-02 precedent.

## Confirmation / processing / success / failure / pending / recovery coverage

| Operation | Confirmation | Processing | Success | Failure | Pending/blocked | Recovery |
|---|---|---|---|---|---|---|
| Hide profile | N/A — existing toggle on `/operator/profile`, not re-reviewed here | Existing | Existing | Existing | — | Toggle back on (existing, reversible) |
| Deactivation | UX03-04 (CTA disabled until LEG-07) | UX03-05 | UX03-06 (conditional, server-verified only) | UX03-07 (retry + contact placeholder) | Shown as disabled `FutureAction` today | Reactivation mechanism `[PENDING: owner]` (LEG-07 4.1); never implicit via login, password reset, or email change |
| Administrative suspension | N/A — admin-initiated, not a self-service confirm | N/A | N/A | N/A | UX03-08 (operator sees a blocked state, no action) | **None available to the operator.** LEG-07 requires negative tests proving no self-reactivation path (section 4.2) |
| Erasure request | UX03-09 entry screen → UX-02 submission flow | Shared with UX-02 "received"/"under review" | Shared with UX-02 "completed" (never implies full/immediate deletion) | Shared with UX-02 "rejected"/"partially fulfilled" | Shared with UX-02 status route | Request may be withdrawn before execution (`[PENDING: counsel]`, LEG-07 AQ6); withdrawal never reactivates any other restriction |
| Conditional reactivation | Not designed; LEG-07 4.1 requires checking suspension, deactivation, and erasure state first | — | — | — | Entirely `[PENDING]` | Must be an explicit, separate action — never a side effect of another flow |

## Erasure requests never imply deletion

Per LEG-03 section 2.4 and LEG-07 section 3, an `app_user` row cannot currently be deleted: ten `ON DELETE RESTRICT` foreign keys (operator profile, tokens, demand creator, supports, comments, reports, moderation actions) block a plain `DELETE`, and no approved disposal sequence exists yet (APP-11, #218). Every UX03-09 and shared UX-02 screen must therefore:
- call the action a **request**, never "delete my account" or "delete my data" as an instant action;
- never show elapsed time, a countdown, or a completion percentage toward deletion;
- on the UX-02 "completed" status shared by erasure, state only that review finished and an outcome was reached — not that all data was removed (LEG-03 section 4: live rows, sessions, logs, and backups each clear on independent, still-`[PENDING]` schedules);
- on rejection or partial fulfillment, show the reasoned outcome only; no appeal/resubmission path is promised here, consistent with the UX-02 review's same caveat (LEG-07 AQ6 is still open).

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
- LEG-07 AQ3 (whether parent accounts can be suspended at all) — UX03-01 assumes no, consistent with today's content-only moderation of parents; this is carried from LEG-07, not decided here.
- LEG-07 AQ4 (whether a suspended/deactivated person's comments stay published with a generic author or are hidden) — affects no UX03 screen directly but is cross-referenced because UX03-02/08 may need to describe this effect once resolved.
- LEG-07 AQ6 (whether an erasure request can be withdrawn) — UX03-09's "withdraw" affordance, if any, cannot be designed until this is answered.
- LEG-07 section 4.1's required **negative tests** (suspended operator cannot regain access via self-reactivation, deactivate-then-reactivate, password reset, email change, login, or erasure withdrawal) are a product/QA gate for implementation, not satisfied by this document, and are listed here so they are not lost before APP-09/10/11 start.

No reactivation guarantee, deactivation effect, retention period, or contact channel is proposed or implied anywhere in this document.

## Deliberate deviations from Manus

- UX03-09 is specified as a short explanation screen that hands off into the existing UX-02 erasure form (`type=erasure`) rather than a separate end-to-end form, avoiding a duplicate submission path.
- The deactivation query-string states (`?state=confirm|processing|success|error`) are kept as one route with state-driven rendering, not four static Manus-style routes, following the UX-01/02 precedent of collapsing mock state variants into one real component.
- UX03-08 is specified with no interactive controls at all (the Manus component map already calls for this — "AdminSuspensionState (yalnız işletmeciye bilgi; reactivation yok)" — but this review makes explicit that even a disabled-looking reactivate button must not exist, since a disabled button a developer later "fixes" is a bigger risk than one that was never coded).
- This review flags, rather than assumes, how UX03-08 is reached at all, since today's generic login error means no authenticated route can get a suspended operator there — the Manus reference does not address this gap.

## Open questions / not verified

- No UX-03 route, component, or CSS exists on `main`; this document is a target matrix for implementation, not a confirmation of shipped behavior, matching the UX-02 precedent (contrast with UX-01, which reviewed already-merged code).
- How UX03-08 is reached without authenticated access is unresolved; this document does not propose a mechanism (email, admin-shared link, or otherwise), since that is a product/security decision outside this review's scope.
- Responsive breakpoints above are inferred from the UX-01/02 precedent, not measured against UX-03-specific markup.
- APP-09/APP-10/APP-11 backend contracts (deactivation, erasure execution, record-level effects) are undefined; this review does not propose an API shape, per the issue's constraints.
- Whether parent accounts can ever be suspended (LEG-07 AQ3) remains open; if answered differently in the future, UX03-01 would need a suspension-status card added, which this document does not pre-design.
