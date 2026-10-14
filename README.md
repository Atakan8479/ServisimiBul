# ServisimiBul

ServisimiBul is a school transportation operator discovery platform. The repository is organized by purpose:

- [`docs/`](docs/) — product rules, approved decisions, domain model, security contract, roadmap, and verified progress. Start with `00_PROJECT_BRIEF.md`, then read in number order.
- [`servisimibul-backend/`](servisimibul-backend/) — the Spring Boot application, its tests, Flyway migrations, environment example, and backend-specific setup guide.
- [`codex/prompts/`](codex/prompts/) — reusable onboarding prompts for new Codex sessions; not application code.
- [`.github/workflows/backend.yml`](.github/workflows/backend.yml) — isolated PostgreSQL 17 backend CI.

For the Java package map and the recommended reading order, see the [backend README](servisimibul-backend/README.md#code-map).
