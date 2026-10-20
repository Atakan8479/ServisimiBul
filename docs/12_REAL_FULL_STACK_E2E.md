# Real full-stack end-to-end testing

J-03 complements, rather than replaces, the deterministic mocked browser suite and backend integration tests. It starts the actual Vite application and Spring Boot backend against a fresh PostgreSQL 17 database and a disposable tariff directory. It never reads the ignored backend `.env` and must never target Supabase.

## Windows local run

Prerequisites are Java 21 or newer, Node.js 24, `npm ci` in `servisimibul-frontend`, an installed Playwright Edge browser, and PostgreSQL 17 binaries. Run from the repository root:

```powershell
.\scripts\Test-RealFullStack.ps1
```

Use `-JavaHome` or `-PostgresBin` when automatic discovery is insufficient. The runner creates random database credentials and ports, applies Flyway V1–V8 with the disposable database administrator, seeds only synthetic J-03 geography, creates two synthetic administrators through the existing one-shot bootstrap, and runs Playwright serially. Cleanup removes the database cluster, tariff versions, and generated credentials even after a failure.

## Test layers

- `npm run test:e2e` remains the fast stateful mocked browser suite for broad UI and accessibility coverage.
- `npm run test:e2e:real` expects an already provisioned disposable environment and runs only `e2e-real`.
- `scripts/Test-RealFullStack.ps1` is the supported Windows command that provisions that environment.
- `Real full-stack E2E` in GitHub Actions uses a PostgreSQL 17 service and the same fixtures and Playwright project.

The real suite uses separate operator, administrator, and anonymous browser contexts. It disables Playwright traces because browser traces can retain session cookies; failure artifacts are screenshots only. Fixture identities use the reserved `.test` domain, tariff data is explicitly synthetic, and no generated password is printed or committed.
