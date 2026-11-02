# UI-07 rollout gate

Issue: [#123](https://github.com/Atakan8479/ServisimiBul/issues/123). This gate verifies the merged UI-fidelity and UKOME work; it does not redesign screens. Remaining gaps become separate issues.

## Dependency state

Checked on 2026-11-02: every UI-01–UI-06, UKOME-01–02, and UI-FIDELITY-01–18 issue is closed, and #123 is the only open issue. The gate runs against `main` at `5793582`.

## Gate method

1. Every Manus screen ID (P01–P03, D01–D02, A01–A08, O01–O04, M01–M05, N01–N03) is opened at 320, 390, 768, and 1440 with mocked API data, checked for horizontal overflow and axe WCAG 2.2 AA violations, and captured at 1440 and 390 for comparison with its pinned Manus target.
2. Keyboard, skip link, focus, 200% zoom, and reduced motion are checked on representative public, operator, and admin routes.
3. The required commands run locally: typecheck, lint, Vitest, build, mocked Playwright, and the real Spring Boot + PostgreSQL + Vite journey against a disposable database.
4. Each screen receives a MATCH, MINOR GAP, MAJOR GAP, or NOT VERIFIED disposition from its captures.

## Verified results — 2026-11-02

All results below were produced on branch `feat/issue-123-ui-rollout-gate` on top of `main` at `5793582`.

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | 223/223 in 14 files |
| `npm run build` | Pass |
| `npm run test:e2e` (retries disabled) | 180/180, including the new 21-test gate spec |
| `npm run test:e2e:real` via `scripts/Test-RealFullStack.ps1` | 1/1 against a disposable PostgreSQL 17 database |
| Backend via `scripts/Test-IsolatedBackend.ps1` | 295/295 against a disposable database |
| Prettier | Clean with `--end-of-line auto` |

**Prettier on Windows:** `npm run format:check` reports 106 files on a Windows checkout only because Git converts the files to CRLF in the working copy; the repository stores LF. A bare `mvn test` fails without a database URL, so the documented isolated script is the backend source of truth.

### Gate spec

`servisimibul-frontend/e2e/ui-07-rollout-gate.spec.ts` opens all 25 Manus screen IDs with mocked API data.

**At 320, 390, 768 and 1440:**
- no horizontal overflow
- no axe WCAG 2.2 AA violations

**At 1440:**
- no overflow with 200% root text
- on routes without an extra interaction step, the skip link is the first Tab stop with a visible focus ring, and the next Tab lands inside `main`

**Reduced motion:** removes every animation and transition on the public, operator and admin shells.

**Results:** all 21 gate tests pass, with no horizontal overflow and no axe violations at any width.

**Capture:** set `UI_07_CAPTURE=1` to write the 1440 and 390 captures to `docs/screenshots/ui-07/`.

### Real full-stack additions

The J-03 journey already covered:
- anonymous discovery
- parent registration, login, demand support and feedback
- operator publication, coverage, activation, removal and notifications
- admin approval and moderation
- the UKOME publication

UI-07 adds two steps:
- **Tariff guards:**
  - an operator write returns 403
  - an admin write without CSRF returns 403
  - a stale `expectedVersion` returns 409
  - an empty band list returns 400
  - none of these change the public tariff
- **Catalog pagination:** the admin adds 11 schools; the public picker pages from `Sayfa 1 / 2` to `Sayfa 2 / 2` and selects a school from page 2.

### UKOME evidence

| Requirement | Evidence |
|---|---|
| Schema and source provenance | `TariffApiTests.extendedAnnualAndAdditionalKilometerContractRoundTrips` and `pathIdentityAndBandContractAreValidated`; source metadata in `PublicTariffReference.test.tsx`; the real journey checks the official document link and source title |
| Missing JSON and error states | `TariffApiTests.missingTariffUsesSafeProblemDetails`; M04 Playwright load retry |
| Monthly and annual display | `PublicTariffReference.test.tsx`: real monthly and annual amounts, and no invented annual or extra-kilometre amounts |
| 25+ km explanation | `PublicTariffReference.test.tsx` shows `25 km üzeri` only when the rule exists |
| HTTP 409 optimistic concurrency | `TariffApiTests.staleReplacementReturnsStableConflictAndKeepsCurrent`; M04 Playwright conflict tests; the real journey's stale write |

### Screen dispositions

**Method:** each 1440 and 390 capture in `docs/screenshots/ui-07/` was compared by eye with the pinned Manus target in `servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/exports/screenshots/`.

**Ignored as intentional:** differences required by real data, the production routes, or approved decisions. This includes the absence of Manus demo banners, the prototype top bar, and demo records.

**Mocked data:** the captures use mocked API data, so record counts differ from the demo.

| ID | Screen | Disposition | Notes |
|---|---|---|---|
| P01 | Homepage and school discovery | MINOR GAP | School picker and search form share one card; hero, content, and steps match |
| P02 | Operator results | MINOR GAP | Results render inside `/`, as the #123 boundary requires, not on a separate `/arama` page with a filter sidebar |
| P03 | UKOME tariff reference | MINOR GAP | Shown inside the selected-school flow rather than its own page; bands, the 25 km rule, and sources match |
| D01 | Demand board | MINOR GAP | Uses the school and location filter form; status chips are tracked in #193 |
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
| M01 | Operator applications | MINOR GAP | No summary count cards; tracked in #192 |
| M02 | Application detail | MATCH | |
| M03 | School catalog | MATCH | |
| M04 | UKOME tariff management | MATCH | |
| M05 | Moderation | MATCH | |
| N01 | Parent notifications | MINOR GAP | No read-state filters; tracked in #191 |
| N02 | Operator notifications | MINOR GAP | Same as N01 (#191) |
| N03 | Admin notifications | MINOR GAP | Same as N01 (#191) |

No screen is MAJOR GAP or NOT VERIFIED.

**Notification captures:** N01–N03 show empty states only, because the shared mock API returns no notifications; their populated states were verified in UI-FIDELITY-18.

**Populated captures:** M05 and O04 are populated from fixtures in the gate spec.

### Performance

No Lighthouse or other performance metrics were collected, so none are reported.
