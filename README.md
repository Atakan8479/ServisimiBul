# ServisimiBul

ServisimiBul is a school transportation operator discovery platform. The repository is organized by purpose:

- [`docs/`](docs/) — product rules, approved decisions, domain model, security contract, roadmap, and verified progress. Start with `00_PROJECT_BRIEF.md`, then read in number order.
- [`servisimibul-backend/`](servisimibul-backend/) — the Spring Boot application, its tests, Flyway migrations, environment example, and backend-specific setup guide.
- [`servisimibul-frontend/`](servisimibul-frontend/) — the Vite React + TypeScript SPA, operator workspace, tests, environment example, and frontend setup guide.
- [`codex/prompts/`](codex/prompts/) — reusable onboarding prompts for new Codex sessions; not application code.
- [`.github/workflows/backend.yml`](.github/workflows/backend.yml) — isolated PostgreSQL 17 backend CI.
- [`.github/workflows/frontend.yml`](.github/workflows/frontend.yml) — Node.js 24 frontend formatting, lint, type-check, test, and build CI.

For the Java package map and the recommended reading order, see the [backend README](servisimibul-backend/README.md#code-map).

For shared Impeccable skills and each developer's personal 21st/Playwright MCP setup, see the [Windows frontend tooling guide](docs/09_FRONTEND_TOOLING.md).

## Run the application locally

Install JDK 21 or newer, Node.js 24, PostgreSQL 17 binaries, and the frontend packages with `npm ci`. Then start the backend and frontend together from the repository root:

```powershell
.\dev.ps1
```

The launcher does not read `servisimibul-backend/.env` or connect to Supabase. It creates a disposable PostgreSQL 17 cluster under the Windows temporary directory, provisions separate generated migration and `servisimibul_app` credentials, applies Flyway V1–V8 in a one-shot process, and starts both applications on `127.0.0.1`. Privileged credentials are removed before the web process starts. Ctrl+C stops both applications and deletes the cluster.

For the current testing period the launcher also auto-verifies newly registered local accounts and bypasses operator approval; production retains the safe verification and approval defaults. Open `http://127.0.0.1:5173`; Vite proxies `/api` to Spring Boot on port 8080.

Run the repeatable full-stack smoke path or the complete backend suite with:

```powershell
.\dev.ps1 -SmokeTest
pwsh -NoLogo -NoProfile -File .\scripts\Test-IsolatedBackend.ps1
```

If `JAVA_HOME` still points to an older JDK, either correct it or select a JDK for this run:

```powershell
.\dev.ps1 -JavaHome 'C:\path\to\jdk-25'
```

If PostgreSQL 17 is outside the detected Program Files or Scoop locations, pass `-PostgresBin 'C:\path\to\postgresql-17\bin'`. See the [isolated Windows development guide](docs/12_WINDOWS_ISOLATED_DEVELOPMENT.md) for prerequisites, safety boundaries, focused-test syntax, and environment-file responsibilities.
