# UX-02 — personal data rights request design acceptance (issue #206)

Technical review of the pinned Manus account/privacy references (screen inventory, flows and interactions, component map, legal placeholders — commit `aaf711c`) against the existing React router and production components, following the merged UX-01 review (`docs/22_UX_01_ACCOUNT_PRIVACY_DESIGN_ACCEPTANCE.md`, PR #242). This is a design-acceptance and integration-review record, not a new design, not production code, and not a legal or human design approval. Since this record was first merged (PR #243), the public unauthenticated entry point was built separately under APP-01 (#208, PR #245: `PrivacyNoticePage`/`PublicRequestEntryPage` in `servisimibul-frontend/src/features/legal/LegalPages.tsx`), matching what row "Public request entry" below already specified; every other screen remains **proposed** against existing infrastructure, not already built, and no KVKK request route, API, or mock backend exists on `main` for them.

**A submitted request is never a completed erasure.** UX02-07 ("received") is an acknowledgement of intake only; UX02-10 ("completed") is a reviewed, human-approved outcome. Neither state may claim data was deleted, nor may "received" claim the request was granted.

## Route, screen, and component reuse matrix

| Manus screen ID | Manus route | Proposed production route | Reusable component(s) | Status |
|---|---|---|---|---|
| UX02-01 empty list | `/parent/privacy/requests?state=empty` | `/parent\|operator/privacy/requests` | `WorkspaceShell`, `SectionShell`, `StatePanel` (empty variant), `Button` (new-request CTA) | Not built. Reuses the UX-01 account-page shell; no new layout. |
| UX02-02 loading list | `?state=loading` | same route, loading state | `StatePanel` (loading/skeleton variant) | Not built. |
| UX02-03 list error | `?state=error` | same route, error state | `StatePanel` (error variant, `role="alert"`, retry `Button`) | Not built. |
| UX02-04 new request form | `/parent/privacy/requests/new` | `/parent\|operator/privacy/requests/new` | `FormField` (subject select + description textarea), `Button`, `SurfaceCard` | Not built. Form is restricted to request subject + free-text description per the Manus flow; no national ID, student name/address, or health data field is added. |
| UX02-05 validation error | `?state=validation` | same route, inline error | `FormField` (`aria-invalid`, `aria-describedby`) — matches the pattern already shipped in `PasswordChangePage` | Not built. |
| UX02-06 operator erasure form | `/operator/privacy/requests/new?type=erasure` | `/operator/privacy/requests/new?type=erasure` | Same `FormField`/`SurfaceCard` as UX02-04, with erasure-specific copy | Not built. Must not imply erasure is guaranteed or immediate; copy depends on `[LEGAL_COPY_PENDING]`/`[RETENTION_POLICY_PENDING]`. |
| UX02-07 received | `/parent/privacy/requests/received` | `/parent\|operator/privacy/requests/received` | `SurfaceCard`, `StatusBadge` ("received" tone) | Not built. Must show a reference ID and response-time placeholder only — intake acknowledgement, not an outcome. |
| UX02-08 under review | `/parent/privacy/requests/status/under-review` | `/parent\|operator/privacy/requests/status/:status` | `SurfaceCard`, `StatusBadge` ("under review" tone) | Not built. Shares one status route/component across all five outcomes via a `status` param, consistent with the Manus status-page grouping. |
| UX02-09 additional verification | `/parent/privacy/requests/status/additional-verification` | same shared status route | `StatusBadge`, `StatePanel` (info variant) | Not built. Must not name a specific verification method (`[IDENTITY_VERIFICATION_METHOD_PENDING]`) and must not request a national ID number. |
| UX02-10 completed | `/parent/privacy/requests/status/completed` | same shared status route | `StatusBadge` ("completed" tone) | Not built. Copy must not assert that all data was erased; outcome text is `[APPROVED_RESPONSE_PENDING]`. |
| UX02-11 rejected | `/parent/privacy/requests/status/rejected` | same shared status route | `StatusBadge` ("rejected" tone), `StatePanel` (reason + next-step text) | Not built. Rejection must not be framed as a permanent ban; it shows a rejection reason only. Any resubmission or appeal path, and its copy, is undecided and must not be promised in this screen until LEG-06/07 approve one. |
| UX02-12 partially fulfilled | `/parent/privacy/requests/status/partially-fulfilled` | same shared status route | `StatusBadge` ("partially fulfilled" tone), `StatePanel` | Not built. Distinct tone/copy from both "completed" and "rejected" — partial outcomes must not collapse into either. |
| Public request entry | `/privacy/requests` | `/privacy/requests` | `PublicLayout`, `StatePanel`, existing `/parent/login`, `/operator/login` | **Built** (#208, PR #245: `PublicRequestEntryPage`). No account required to view; links to the existing login routes rather than inventing a request form or contact channel for anonymous users, and its copy states that signing in does not start or continue a request. |
| Populated multi-request list | (not in Manus inventory) | `/parent\|operator/privacy/requests` (data state) | `SurfaceCard` list items, `StatusBadge` per row | Not built. Per the issue's acceptance criteria, this reuses the empty/loading/error `StatePanel` pattern plus one `SurfaceCard` row per request — no new list/table component is proposed. |

No new dashboard, table view, or standalone layout is introduced at any breakpoint, consistent with the UX-01 precedent and the Manus guidance against adding a tabular view.

## Responsive behavior (1440 / 768 / 390 / 320)

The only UX-02 CSS on `main` is `legal.css`, covering the built public entry point (row above); it is not analogous to the list/form/status rows below, which have no CSS yet. Based on the Manus flows doc and the shipped UX-01 breakpoints in `account-settings.css`, production should carry the same rules forward for those rows rather than defining new ones:
- **1440px**: request list and status cards may sit in the existing two-column `SectionShell` pattern.
- **768px**: columns collapse to one, as `AccountSettingsPage` already does.
- **390/320px**: action order verticalizes, buttons reach the existing ≥46px mobile tap height, long placeholder text wraps rather than truncating.
- No table layout at any width.

This is a carried-forward expectation for the unbuilt rows, not a verified implementation — flagged as an open item below. The built entry point (`legal.css`) uses fluid type (`clamp()`) and a wrapping flex action row by design, which is expected to avoid layout breakage at 1440/768/390/320 without fixed breakpoints, but that expectation has not been checked against those viewport widths in a browser — flagged as unverified below, not confirmed responsive behavior.

## Accessibility

- Form errors follow the shipped `FormField` pattern: `aria-invalid` + `aria-describedby`, focus moved to the first invalid field on submit (matches `PasswordChangePage`).
- List loading/empty/error and status announcements use `StatePanel`: error states as `role="alert"`, status/progress updates as `role="status"`, matching the UX-01 precedent rather than introducing a new live-region convention.
- `StatusBadge` carries a text label alongside color for every outcome (received/under review/additional verification/completed/rejected/partially fulfilled) — color is never the sole signal.
- The public `/privacy/requests` entry point needs no account; as built (PR #245) it uses plain `NavLink`/`Link` elements to the two login routes, not a JavaScript-dependent redirect, so keyboard and screen-reader navigation reaches them directly.

## Role-specific behavior

- Parent and operator each get their own `/parent/privacy/requests...` and `/operator/privacy/requests...` route family inside their existing `WorkspaceShell`, matching the UX-01 precedent of one shell, two role-scoped route trees.
- UX02-06 (operator erasure form) is operator-only and must be visibly distinct from the general request form — it is the start of a request, not an erasure guarantee, and remains cross-referenced with the UX-03 lifecycle review (out of scope here).
- Anonymous/public visitors only reach the entry page (`/privacy/requests`, linking to the existing login routes); they never see the list, form, or status routes, consistent with the "no account, no in-product status tracking" boundary already set by UX-01.

## Legal and product dependencies (not approved)

Carried forward from the Manus legal-placeholders doc; none of the following are resolved, and this review does not resolve or approve any of them:

- `[LEGAL_COPY_PENDING]` — notice/decision/request-outcome copy (LEG-05/06 owner).
- `[RETENTION_POLICY_PENDING]` — retention/erasure effect on list and status copy (LEG-03, #196, merged as a decision record but not legally approved per `docs/06_PROGRESS.md`).
- `[CONTACT_CHANNEL_PENDING]` — no working intake/support channel exists; the public entry route must not imply one.
- `[REQUEST_RESPONSE_POLICY_PENDING]` — response-time text shown at UX02-07 through UX02-12 (LEG-06).
- `[IDENTITY_VERIFICATION_METHOD_PENDING]` — UX02-09 method text (APP-07/LEG-06).
- `[APPROVED_RESPONSE_PENDING]` — UX02-10/11/12 outcome and rejection-reason text. Rejection must not be framed as a permanent ban, but whether a correction/resubmission path exists, and what it looks like, is undecided and requires LEG-06/07 approval before this screen can show one.

UX-02 additionally depends on UX-01 (#205, review doc merged as PR #242, issue itself still open pending maintainer confirmation) for the shared account shell, and on APP-06/APP-07 (request submission/response backend, not yet built) before any of the routes above can be wired to real data.

The proposed `/{role}/privacy/requests/status/:status` route only varies `status`, matching the Manus route, and cannot by itself identify which request it shows — a real implementation needs a way to select one of a user's (possibly several) requests, such as a request-ID segment or query parameter, which this document does not specify. How that identifier is looked up, the ownership check that a parent/operator can only load their own request, and IDOR protection on that lookup are backend/APP-07 design decisions not yet made. Production must not ship this route without resolving request-specific lookup and authorization first.

## Deliberate deviations from Manus

- Status pages are consolidated into one shared `/{role}/privacy/requests/status/:status` route/component rather than five separate Manus-style static routes, following the UX-01 precedent of collapsing query-string state variants into one real component.
- The populated multi-request list (required by the issue's acceptance criteria but absent from the Manus inventory) is specified here as reusing `SurfaceCard`/`StatusBadge` rows rather than a new list component.
- No cookie banner, consent checkbox, or national-ID/student/health data field is introduced anywhere in this matrix, per the Manus "do not productionize" list.

## Open questions / not verified

- Only the public entry point (`/privacy/requests`, `/privacy/notice`) exists on `main`; this document remains a target matrix for the list/form/status routes, not a confirmation of their shipped behavior (contrast with UX-01, which reviewed already-merged code for every row).
- Responsive breakpoints for the unbuilt rows above are inferred from the UX-01 precedent, not measured against UX-02-specific markup. The built entry point uses fluid typography (`clamp()`) and a wrapping flex action row (`legal.css`) by design, which should avoid breakage at 1440/768/390/320 without fixed breakpoints — but this is a CSS-based expectation, not a browser-verified result; it has not actually been checked at those viewport widths.
- APP-06/APP-07 backend contracts (submission, status transitions, verification) are undefined; this review does not propose an API shape, per the issue's constraints.
