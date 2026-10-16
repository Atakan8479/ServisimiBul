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

After configuring `servisimibul-backend/.env` and installing the frontend packages with `npm ci`, start the backend and frontend together from the repository root:

```powershell
.\dev.ps1
```

The launcher uses Java 21 or newer, requires Node.js 24, keeps backend environment variables out of the frontend process, disables Flyway and the one-shot ADMIN bootstrap, and enables the local HTTP cookie settings. The configured database must already be at the repository's latest Flyway version. Open `http://localhost:5173`; Vite proxies `/api` to Spring Boot on port 8080. Press Ctrl+C once to stop both processes.

If `JAVA_HOME` still points to an older JDK, either correct it or select a JDK for this run:

```powershell
.\dev.ps1 -JavaHome 'C:\path\to\jdk-25'
```
