# UI-07 rollout gate

Issue: [#123](https://github.com/Atakan8479/ServisimiBul/issues/123). This gate verifies the merged UI-fidelity and UKOME work. The repository owner also folded the gap issues [#191](https://github.com/Atakan8479/ServisimiBul/issues/191), [#192](https://github.com/Atakan8479/ServisimiBul/issues/192), and [#193](https://github.com/Atakan8479/ServisimiBul/issues/193) into this PR, so it now also contains backend and frontend changes for them.

## Dependency state

Checked on 2026-11-02: every UI-01–UI-06, UKOME-01–02, and UI-FIDELITY-01–18 issue is closed, and #123 is the only open issue. The gate runs against `main` at `5793582`.

## Gate method

1. Every Manus screen ID (P01–P03, D01–D02, A01–A08, O01–O04, M01–M05, N01–N03) is opened at 320, 390, 768, and 1440 with mocked API data, checked for horizontal overflow and axe WCAG 2.2 AA violations, and captured at 1440 and 390 for comparison with its pinned Manus target.
2. Keyboard, skip link, focus, 200% zoom, and reduced motion are checked on representative public, operator, and admin routes.
3. The required commands run locally: typecheck, lint, Vitest, build, mocked Playwright, and the real Spring Boot + PostgreSQL + Vite journey against a disposable database.
4. Each screen receives a MATCH, MINOR GAP, MAJOR GAP, or NOT VERIFIED disposition from its captures.

## Verified results — 2026-11-02

All results below were produced locally on branch `feat/issue-123-ui-rollout-gate`, with retries disabled.

| Command | Result |
|---|---|
| Prettier (`--end-of-line auto`) | Clean |
| `npm run lint`, `npm run typecheck`, `npm run build` | Pass |
| `npm test`, serial | 230/230 in 14 files |
| `npm run test:e2e` | 204/204 |
| `npm run test:e2e:real` via `scripts/Test-RealFullStack.ps1` | 1/1 against a disposable PostgreSQL 17 database |
| Backend via `scripts/Test-IsolatedBackend.ps1` | 298/298 against a disposable database |
| `git diff --check` | Clean |

`npm run format:check` reports every CRLF working-copy file on Windows, while the repository stores LF. A bare `mvn test` fails without a database URL, so the isolated script is the backend source of truth.

## Absorbed features

### #191 — Notification read-state filters (N01–N03)

**Contract:** `GET /api/v1/notifications` accepts an optional `readState`:

| Value | Meaning |
|---|---|
| `ALL` (default) | Every notification |
| `UNREAD` | `read_at IS NULL` |
| `READ` | `read_at IS NOT NULL` |

Any other value, including lowercase, returns 400.

**Backend behavior:**
- Filtering happens in the repository query before pagination, so `totalElements` and `totalPages` describe the filtered set.
- Results stay recipient-scoped and newest first.
- The existing indexes on recipient plus creation time and on unread rows serve these queries, so no migration was needed.

**Frontend:**
- A shared `Tümü` / `Okunmamış` / `Okunmuş` button group uses `aria-pressed` in all three centers.
- Changing the filter resets the page, and paging keeps the filter.
- Marking an item read in a filtered view reloads the list; focus falls back to the notice when the item leaves the view.
- An emptied later page moves back to the last page.
- Read-all updates the list and the navigation badge.
- The unread count in the `Okunmamış` button comes from the unread-count endpoint, so no count is invented.

**Tests:**
- Backend: filtering, multi-page totals, recipient isolation, invalid values, read-all.
- Vitest: server filtering with paging, removal from the unread view, and a stale response from the previous filter.
- Playwright: N01–N03 at four widths with keyboard, axe, overflow, empty state and badge sync.
- Real journey: read-state totals add up, recipients are isolated, an invalid value returns 400, and a single read moves one item between states.

### #192 — Admin operator summary (M01)

**Contract:** `GET /api/v1/admin/operators/summary` is ADMIN only. It returns `{total, discoverable, changesRequested, suspended}` from two aggregate queries over the whole dataset.

| Field | Definition |
|---|---|
| `total` | Every operator profile |
| `discoverable` | The exact public search predicate: verified e-mail, enabled account, approval policy, active profile, public visibility, and at least one active school with same-province coverage |
| `changesRequested` | `approvalStatus = CHANGES_REQUESTED` |
| `suspended` | `active = false` |

**Label difference:** Manus labels the second card "Profili yayında". Approval alone does not publish an operator, so the card is labeled `Aramalarda görünen` and counts only discoverable operators.

**Frontend:** four cards load independently of the list.
- While loading, they show `—` with `aria-busy`.
- If the request fails, an alert with a retry replaces the cards, so no false zeros appear.
- A newer request wins over a stale one.

**Tests:**
- Backend:
    - counts measured against a baseline
    - an approved but uncovered operator, a hidden one, and a suspended one each excluded from `discoverable`
    - counts independent of list paging
    - 401 and 403 for non-admins
- Vitest: values and failure retry.
- Playwright: four widths with loading, values, error, and axe.
- Real journey:
    - `total` equals the list total
    - operators get 403
    - after a real suspension, `suspended` rises by 1 and `discoverable` falls by 1

### #193 — Demand board status filters (D01)

**Decision:** recorded as D058 in `docs/01_DECISIONS.md`.

**Contract:** `GET /api/v1/demands` accepts an optional `status`.

| Value | Meaning |
|---|---|
| `OPEN` (default) | Open demands |
| `FULFILLED` | `CLOSED` with reason `FULFILLED` |
| `CLOSED` | `CLOSED` with reason `INACTIVE` |
| `ALL` | The union of the three |

**Never listed:**
- `CLOSED(ADMIN)`, because it comes from moderation enforcement
- `ARCHIVED`, which is retention

Both remain reachable only by direct link, as before. Filtering happens before pagination and keeps the school, neighborhood, academic-year, and sort behavior. Any other value returns 400 with `fieldErrors.status`.

**Frontend:**
- `Tümü` / `Açık` / `Karşılandı` / `Kapalı` chips use `aria-pressed`, and `Açık` is the default.
- Changing a chip resets the page and keeps the applied selection and year.
- Each status has its own title and empty-state text.
- The create-demand panel appears only in the open view, so browsing closed demands never offers a duplicate creation.

**Tests:**
- Backend:
    - every lifecycle combination, with archived and admin-closed rows excluded
    - school, neighborhood, and year combinations
    - multi-page totals
    - a status transition
    - invalid values
- Vitest: parameters, page reset, kept year, and the create panel only in the open view.
- Playwright: four widths with keyboard, axe, and overflow.
- Real journey: each status matches its lifecycle, the totals add up, `ALL` pages correctly, and `ARCHIVED` returns 400.

## Earlier review findings

**Finding A, tariff integrity:** the real journey now captures the full public tariff response before the denied, missing-CSRF, stale, and invalid writes. It compares the full response afterwards with `toEqual`, and keeps the 403, 409, and 400 assertions.

**Finding B, screen identity:** each of the 25 entries in the gate manifest names its production h1. Screens that share a heading also name a unique landmark or control. The gate fails when:
- the heading or marker is missing
- a load error is visible (`yüklenemedi`)
- the not-found screen appears

A negative test proves the check rejects an unauthenticated O01 visit, which lands on login, and a missing route.

## Gate spec

**Files:** `e2e/ui-07-rollout-gate.spec.ts` (22 tests) and `e2e/ui-07-gate-features.spec.ts` (23 tests).

**At 320, 390, 768 and 1440, every screen shows:**
- no horizontal overflow
- no axe WCAG 2.2 AA violations

**At 1440:**
- doubling the root font size checks 200% text scaling only
- the skip link is the first Tab stop with a visible focus ring, and the next Tab lands in `main`

**Browser zoom:** checked separately as an effective viewport. A 1440×900 screen at 200% zoom is a 720×450 CSS viewport at device scale 2; the D01, N01, and M01 controls stay reachable there, with no overflow or axe violations. The 320 px checks also cover WCAG 400% reflow on a 1280 px screen.

**Reduced motion:** removes every animation and transition on the public, operator, and admin shells.

**Captures:** with `UI_07_CAPTURE=1`, the specs write the 1440 and 390 captures to `docs/screenshots/ui-07/`. These include:
- `N0x-filters`
- `N0x-filters-empty`
- `M01-summary`
- `D01-status-closed`

## UKOME evidence

| Requirement | Evidence |
|---|---|
| Schema and source provenance | `TariffApiTests.extendedAnnualAndAdditionalKilometerContractRoundTrips` and `pathIdentityAndBandContractAreValidated`; source metadata in `PublicTariffReference.test.tsx`; the real journey checks the official document link and source title |
| Missing JSON and error states | `TariffApiTests.missingTariffUsesSafeProblemDetails`; M04 Playwright load retry |
| Monthly and annual display | `PublicTariffReference.test.tsx` real monthly and annual amounts, with no invented annual or additional-kilometre amounts |
| 25+ km explanation | `PublicTariffReference.test.tsx` shows `25 km üzeri` only when the rule exists |
| HTTP 409 optimistic concurrency | `TariffApiTests.staleReplacementReturnsStableConflictAndKeepsCurrent`; M04 Playwright conflict tests; the real journey's stale write with full-response comparison |

## Screen dispositions

**Method:** each 1440 and 390 capture was compared by eye with the pinned Manus target at `cf77ff5`.

**Ignored as intentional:**
- the Manus demo banner, prototype top bar, and demo records
- differences required by real data, production routes, or approved decisions

| ID | Screen | Disposition | Notes |
|---|---|---|---|
| P01 | Homepage and school discovery | MINOR GAP | School picker and search form share one card; hero, content, and steps match |
| P02 | Operator results | MINOR GAP | Results render inside `/`, as the #123 boundary requires, not on a separate `/arama` page with a filter sidebar |
| P03 | UKOME tariff reference | MINOR GAP | Shown inside the selected-school flow, not as its own page; bands, the 25 km rule, and sources match |
| D01 | Demand board | MINOR GAP | Status chips now work (#193). Remaining: the board keeps the school and location form instead of a keyword search, and chips carry no per-status counts |
| D02 | Demand detail | MINOR GAP | Real sections replace the demo timeline; actions follow the server-driven lifecycle |
| A01 | Account type | MATCH | |
| A02 | Parent registration | MINOR GAP | No name or phone fields, because the real parent API takes only e-mail and password |
| A03 | Parent login | MATCH | |
| A04 | Operator registration | MATCH | |
| A05 | Operator login | MATCH | |
| A06 | E-mail verification | MATCH | |
| A07 | Password reset request | MATCH | |
| A08 | Password reset | MINOR GAP | One password field plus the reset code, matching the real API instead of the demo confirmation field |
| O01 | Operator overview | MATCH | |
| O02 | Operator profile | MATCH | |
| O03 | Schools and coverage | MATCH | |
| O04 | Vehicles and offerings | MATCH | |
| M01 | Operator applications | MINOR GAP | Real summary cards now show (#192), and `Aramalarda görünen` replaces the Manus `Profili yayında` label. Remaining: no keyword search box and no "Rapor özeti" button |
| M02 | Application detail | MATCH | |
| M03 | School catalog | MATCH | |
| M04 | UKOME tariff management | MATCH | |
| M05 | Moderation | MATCH | |
| N01 | Parent notifications | MATCH | Read-state filters now work (#191) |
| N02 | Operator notifications | MATCH | Same as N01 |
| N03 | Admin notifications | MATCH | Same as N01 |

**Totals:** 17 MATCH, 8 MINOR GAP, no MAJOR GAP or NOT VERIFIED.

**Populated captures:** the shared mock API now serves notifications, so N01–N03 captures are populated. Their empty states appear in `N0x-filters-empty`.

## Deployment compatibility

All new query parameters are optional and default to the previous behavior, so older clients keep working. The summary endpoint is additive. There is no migration, no configuration change, and no change to e-mail delivery.

## Performance

No Lighthouse or other performance metrics were collected, so none are reported.
