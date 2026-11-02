# UI-07 rollout gate

Issue: [#123](https://github.com/Atakan8479/ServisimiBul/issues/123). This gate verifies the merged UI-fidelity and UKOME work; it does not redesign screens. Remaining gaps become separate issues.

## Dependency state

Checked on 2026-11-02: every UI-01–UI-06, UKOME-01–02, and UI-FIDELITY-01–18 issue is closed, and #123 is the only open issue. The gate runs against `main` at `5793582`.

## Gate method

1. Every Manus screen ID (P01–P03, D01–D02, A01–A08, O01–O04, M01–M05, N01–N03) is opened at 320, 390, 768, and 1440 with mocked API data, checked for horizontal overflow and axe WCAG 2.2 AA violations, and captured at 1440 and 390 for comparison with its pinned Manus target.
2. Keyboard, skip link, focus, 200% zoom, and reduced motion are checked on representative public, operator, and admin routes.
3. The required commands run locally: typecheck, lint, Vitest, build, mocked Playwright, and the real Spring Boot + PostgreSQL + Vite journey against a disposable database.
4. Each screen receives a MATCH, MINOR GAP, MAJOR GAP, or NOT VERIFIED disposition from its captures.

Results are recorded below only after they are produced.
