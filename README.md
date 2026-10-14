# ServisimiBul

ServisimiBul is a school transportation operator discovery platform. The repository is organized by purpose:

- [`docs/`](docs/) — product rules, approved decisions, domain model, security contract, roadmap, and verified progress. Start with `00_PROJECT_BRIEF.md`, then read in number order.
- [`servisimibul-backend/`](servisimibul-backend/) — the Spring Boot application, its tests, Flyway migrations, environment example, and backend-specific setup guide.
- [`servisimibul-frontend/`](servisimibul-frontend/) — the Vite React + TypeScript SPA foundation, tests, environment example, and frontend setup guide.
- [`codex/prompts/`](codex/prompts/) — reusable onboarding prompts for new Codex sessions; not application code.
- [`.github/workflows/backend.yml`](.github/workflows/backend.yml) — isolated PostgreSQL 17 backend CI.
- [`.github/workflows/frontend.yml`](.github/workflows/frontend.yml) — Node.js 24 frontend formatting, lint, type-check, test, and build CI.

For the Java package map and the recommended reading order, see the [backend README](servisimibul-backend/README.md#code-map).
