# Paste this into the FIRST Codex session (English)

You are onboarding to a TWO-DEVELOPER project called ServisimiBul. You have no access to our previous conversations, so do not rely on chat history. The repository is the source of truth.

Repository: https://github.com/Atakan8479/ServisimiBul
Existing backend: servisimibul-backend

TASK TYPE: READ-ONLY REVIEW AND PLAN. DO NOT EDIT ANY FILE, CREATE A BRANCH, COMMIT, CONNECT TO OR WRITE TO SUPABASE, OR EXECUTE DESTRUCTIVE COMMANDS IN THIS SESSION.

1. Read `AGENTS.md` and ALL documents in `docs/` in filename order. If they are missing, stop and tell us exactly what is missing; do not improvise the architecture.
2. Inspect repository root and backend layout, `pom.xml`, application configuration, Java/test structure, and `.gitignore`. Do not regenerate an existing Spring Boot project.
3. Build a concise, accurate summary of (a) product goal, users and MVP exclusions; (b) approved architectural decisions; (c) proposed/not-yet-approved items; (d) domain invariants; (e) security invariants; (f) exact current implementation state.
4. Flag contradictions among decisions, docs and code. Never silently decide an unresolved issue. In particular, inspect the Flyway vs manually created 4 Supabase geography tables situation using only repository context; no database access or operation unless separately authorized.
5. Propose a staged set of small, ordered GitHub Issue-sized tasks. Gate 1 (migration strategy approval) must precede database mutations. For each task: goal, touched files, dependencies, tests, definition of done, and what must NOT be done.
6. End with up to 5 essential questions and propose exactly ONE immediate next task. Wait for our explicit approval before implementation.

Output language: Turkish for explanation; English for file/class names and potential issue titles. Show commands/tests executed truthfully; no assumptions of test success.
