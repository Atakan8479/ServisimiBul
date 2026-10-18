# B-11 end-to-end and accessibility validation

## Purpose and evidence boundary

B-11 owns repeatable frontend browser evidence for the MVP journeys and accessibility target. Playwright runs the real Vite React application against a deterministic, stateful same-origin API double. This keeps the suite safe, reviewable, and independent of personal accounts, email delivery, shared Supabase, or production credentials.

The browser suite proves frontend integration, navigation, form behavior, role-specific workspaces, state transitions, privacy presentation, responsive layout, and session-expiry recovery. It does not replace the merged PostgreSQL-backed backend authorization, ownership, persistence, migration, and security suites. It is not a deployment or staging smoke test.

## The 13 MVP journeys

`e2e/mvp-journeys.spec.ts` records each plan journey as a named Playwright step:

| #   | Journey                                                     | Browser evidence                                                                        |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Register and verify email                                   | Registration form, generic completion, email-link token page, verified success          |
| 2   | Log in and complete operator profile                        | Remember-me login, protected route, profile edit and success state                      |
| 3   | Submit application                                          | Draft-to-pending transition and read-only status                                        |
| 4   | Receive a correction request                                | ADMIN detail, reason-required action, confirmation, review state                        |
| 5   | Edit and resubmit                                           | Correction state, profile update, pending resubmission                                  |
| 6   | Receive approval                                            | ADMIN confirmation and approved state                                                   |
| 7   | Add school and general coverage                             | Pilot-school relationship plus same-province cross-district coverage                    |
| 8   | Appear in anonymous discovery without vehicles or offerings | Anonymous result, public phone, private email exclusion, no offering dependency         |
| 9   | Add a vehicle                                               | Active owned vehicle creation                                                           |
| 10  | Create and publish an offering                              | Vehicle-backed draft, specific coverage, publication                                    |
| 11  | Show the offering only in its specific coverage             | Offering visible in Moda but absent in Acıbadem while the base operator remains visible |
| 12  | Update and display an official tariff                       | ADMIN optimistic-version update and public official-reference presentation              |
| 13  | Suspend the operator and verify visibility/session removal  | ADMIN suspension, operator 401/session-expiry recovery, anonymous result removal        |

The mock state deliberately separates operator, administrator, and anonymous browser contexts. Suspension therefore invalidates the already-authenticated operator context rather than merely changing the active page's role.

## Accessibility and responsive target

`e2e/accessibility.spec.ts` scans representative public, registration, operator-profile, operator-school, admin-application, and admin-tariff routes at:

- Desktop: 1440×900
- Tablet: 768×1024
- Mobile: 390×844

The automated target is WCAG 2.2 AA rules available through axe-core, including earlier WCAG A/AA rules. The suite also verifies:

- no horizontal document overflow at any required viewport;
- the skip link is first in keyboard order and has a visible focus outline;
- protected-route loading uses the explicit accessible hydration fallback;
- reduced-motion mode removes decorative road and page-transition motion without a global selector that destroys all feedback;
- browser warnings, errors, and page exceptions fail the accessibility route checks.

Automated axe checks cannot prove every accessibility requirement. Before pilot launch, a human should still exercise the complete keyboard order, screen-reader announcements, zoom/text reflow, and real-device touch behavior in the selected staging environment.

## Major UI-state evidence

The browser suite covers success and session-expiry states. Existing Vitest/Testing Library/MSW tests remain the fast repeatable evidence for public discovery loading/empty/error states, authentication field errors, route loading/errors, tariff conflicts, and operator/admin success/error handling. The frontend workflow runs both layers plus the production build.

## Commands

From `servisimibul-frontend` with Node.js 24:

```powershell
npm.cmd ci
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npx.cmd playwright install --with-deps chromium
npm.cmd run test:e2e
npm.cmd run build
```

Local Windows runs use the installed Microsoft Edge channel and do not require a browser download. CI installs Playwright Chromium into its disposable runner.

Generated `test-results/` and `playwright-report/` directories are ignored and must not be committed.
