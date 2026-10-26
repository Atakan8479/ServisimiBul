# Real full-stack end-to-end testing

J-03 complements, rather than replaces, the deterministic mocked browser suite and backend integration tests. It starts the actual Vite application and Spring Boot backend against a fresh PostgreSQL 17 database and a disposable tariff directory. It never reads the ignored backend `.env` and must never target Supabase.

## Local run

The reproducibility target is Windows PowerShell 5.1 or PowerShell 7 with Java 21 or newer, Node.js 24, `npm ci` in `servisimibul-frontend`, an installed Playwright Edge browser, and PostgreSQL 17 binaries. Run from the repository root:

```powershell
.\scripts\Test-RealFullStack.ps1
```

Use `-JavaHome` or `-PostgresBin` when automatic discovery is insufficient. The runner creates random database credentials and ports, applies all repository Flyway migrations with the disposable database administrator, seeds only synthetic J-03 geography, creates two synthetic administrators through the existing one-shot bootstrap, and runs Playwright serially. Cleanup removes the database cluster, tariff versions, and generated credentials even after a failure.

The same script also runs under PowerShell 7 on macOS and Linux when Java 21+, Node.js 24, PostgreSQL 17, and bundled Playwright Chromium are installed. Cross-platform support is a development convenience; the Windows command above remains the required reproducibility check.

Use these commands for the complete local verification layers:

```powershell
pwsh -NoProfile -File .\scripts\Test-IsolatedDevelopment.Tests.ps1
pwsh -NoProfile -File .\scripts\Test-RealFullStack.Tests.ps1
pwsh -NoProfile -File .\scripts\Test-RealFullStack.ps1
pwsh -NoProfile -File .\scripts\Test-IsolatedBackend.ps1
```

```powershell
Set-Location .\servisimibul-frontend
npm run format:check
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run build
npm run test:e2e
```

## Test layers

- `npm run test:e2e` remains the fast stateful mocked browser suite for broad UI and accessibility coverage.
- `npm run test:e2e:real` expects an already provisioned disposable environment and runs only `e2e-real`.
- `scripts/Test-RealFullStack.ps1` is the supported Windows command that provisions that environment.
- `Real full-stack E2E` in GitHub Actions uses a PostgreSQL 17 service and the same fixtures and Playwright project.

The real suite uses separate operator, administrator, and anonymous browser contexts. It disables Playwright traces because browser traces can retain session cookies; failure artifacts are screenshots only. Fixture identities use the reserved `.test` domain, tariff data is explicitly synthetic, and no generated password is printed or committed.

## REQ-09 lifecycle coverage

The real suite exercises business behavior only through the public UI and HTTP APIs. SQL is limited to synthetic fixture setup; it is never used to force demand, response, feedback, moderation, notification, or authentication state. The suite does not intercept browser requests or use the shared Supabase project.

| Area                       | Real verification                                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demand and support         | Registration, authenticated creation, canonical duplicate handling, join/edit/withdraw/reactivate, stable support identity, and concurrent duplicate prevention                                    |
| Operator response          | Eligibility, publication, withdrawal, republication, version history, public visibility, and loss/restoration of eligibility                                                                       |
| Comments and privacy       | Supporting-parent and eligible-operator authorship, non-supporter denial, pagination, author-only deletion, literal unsafe-looking text, parent pseudonyms, and publication-safe operator identity |
| Feedback timing            | Opened reminder and expiry, unopened expiry without a reminder, closure, reactivation, stable support identity, and duplicate-notification prevention                                              |
| Reporting and moderation   | Parent/operator reports, no automatic hiding or closure, admin-only notifications, reporter privacy, and comment hide/restore visibility                                                           |
| Security and accessibility | Real session cookies, CSRF rejection, role/ownership boundaries, no SMTP or AI dependency, 390×844 keyboard flow, overflow, and axe WCAG 2.2 AA checks                                             |

Production feedback defaults remain 7 days to reminder, 14 days to opened expiry, and 45 days to unopened expiry. The disposable REQ-09 runner overrides them to 5, 10, and 15 seconds and polls every 500 ms so the actual scheduler can be verified without a multi-week run. Backend integration tests retain exact coverage of the production-duration calculations.

The disposable PostgreSQL cluster starts with a test-only 200-connection limit. This accommodates the complete cached Spring integration-test contexts and does not alter production or shared-Supabase configuration.
