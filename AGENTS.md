# AGENTS.md — ServisimiBul coding agent operating rules

## Communication and token efficiency (Codex and Claude Code)
- Always communicate with developers in English, including questions, progress updates, code reviews, PR descriptions, and final reports. Never reply in Turkish. Preserve Turkish application UI text, translations, and product requirements unless the task explicitly changes them.
- Minimize narration: for complex or risky work, give only a brief plan; report meaningful milestones or blockers rather than every routine command. Avoid repeated summaries, pasted logs, and code dumps unless requested.
- Keep final responses to at most six short lines: result, essential tests/checks, commit or PR, and remaining blockers or risks. Include extra detail when needed to communicate material safety or failure information.
- Inspect only task-relevant files and documentation; prefer targeted searches and avoid rereading unchanged context, redundant tool calls, or needless subagents.
- Invoke optional tools or plugins (including Ponytail and Impeccable) only when explicitly requested or materially needed for the task; do not run them automatically on every task.
- Prefer focused tests while iterating, but always run the required security, regression, full-stack, and CI gates when applicable. Never hide failures, skip mandatory safeguards, or claim unexecuted checks passed.

## Task-scoped context loading
Consult the relevant source-of-truth documents before changing behavior: `docs/00_PROJECT_BRIEF.md` and `docs/04_ROADMAP.md` for scope/planning; `docs/01_DECISIONS.md` and `docs/02_DOMAIN_AND_DATA.md` for affected decisions and domain rules; `docs/03_SECURITY_AND_API.md` for security, authentication, APIs, or migrations; `docs/05_REPO_STATE.md` and `docs/06_PROGRESS.md` when current implementation or deployment status matters. Read only the pertinent sections and affected code. Inspect `servisimibul-backend/pom.xml` for relevant backend/dependency work, not automatically for unrelated tasks. These files are repository-shared context, not prior chat memory.

## Source of truth and precedence
1. Latest explicitly approved human instruction and decisions logged in `docs/01_DECISIONS.md`.
2. Approved architecture/domain rules in repository documents.
3. Actual repository code and database inspection for factual implementation state.
4. Suggestions marked PROPOSED are not approved decisions.
When sources conflict: stop, explain the conflict, and request a decision. Do not silently assume.

## Working method — one gated task at a time
- For substantial tasks, briefly state the objective and any essential plan, tests, decision points, and risks. Skip ceremonial plans for small changes; give detailed file inventories only when needed for review or approval.
- For the initial onboarding task: READ ONLY, NO WRITES. Ask for approval before code or remote operations.
- Implement only the explicitly approved task. Do not build unrelated modules or skip stages.
- Before changing remote databases, destructive SQL, schema migrations, or production settings: request explicit human approval and verify current state. Never reset/drop existing Supabase tables by default.
- Do not claim tests passed without executing them; state blockers and actual results.
- Finish with a compact result, affected scope, actual test outcomes, commit/PR reference, and any blockers; include command details only when necessary. Update `docs/06_PROGRESS.md` only with verified results after approval.
- Use feature branches and pull requests; never push directly to `main` without explicit permission. Code review is required before merge.

## Java and Lombok conventions
- Prefer `final` dependencies with Lombok `@RequiredArgsConstructor` for Spring services, controllers, and components. Do not use field injection.
- For ordinary JPA entities, prefer Lombok `@Getter` and `@NoArgsConstructor(access = AccessLevel.PROTECTED)`, plus explicit constructors and domain methods for valid state changes.
- Do not use blanket `@Setter`, `@Data`, or `@AllArgsConstructor` on JPA entities. Prefer Java records for request/response DTOs.
- Authentication and credential-bearing classes are the exception: generate only accessors known to be safe, never generate or expose getters or `toString()` output for password/token hashes, and keep security-sensitive behavior explicit when that is clearer.

## Product invariants
- Public discovery platform: parent search needs no account; no booking, payment, GPS, route optimization or student records in MVP.
- Operator is NOT necessarily driver; operator can serve multiple schools and own multiple vehicles.
- Operator can appear in searches without any Vehicle or ServiceOffering.
- Match by exact School + per-school Neighborhood coverage; neighborhood may be in another district of the SAME province, not another province.
- Operator business name is optional; public contact phone is mandatory. Active public operator profile exposes a valid contact phone; operator may hide entire profile.
- Published visibility is derived from email verified + enabled account + the effective operator-approval policy + active operator + public profile toggle + active school and matching coverage; do not cache a duplicate operator `isPublished` state. Administrative approval is required by the safe default and bypassed only when `OPERATOR_APPROVAL_REQUIRED=false` is explicitly configured for the pilot.
- Requesting corrections to a rejected application is NOT a permanent ban; track review reasons and let operator edit/re-submit. Do not assume final state names beyond approved ones.
- ServiceOffering is optional; each offering has its own coverage and it must be a subset of its OperatorSchoolCoverage.
- MVP tariffs are official UKOME distance bands stored as JSON, editable by admins via Spring Boot; NOT fare tables in PostgreSQL, and NO operator-entered monthly price for MVP. Do not infer kilometers from neighborhood.
- Authentication: Spring Security SERVER-SIDE SESSION + HttpOnly cookie + CSRF; NO JWT and NO Supabase Auth. Email verification before login. Public parents should not be forced into sessions.
- PostgreSQL via Supabase, migrations via Flyway, Hibernate `ddl-auto=validate`; Java 21, Spring Boot baseline in existing pom, React + TypeScript (frontend not yet assumed present).

## Security and safety
- Never commit DB passwords, session secrets, credentials, or private data. Use environment variables and safe examples.
- Respect backend ownership checks for all operator data and ADMIN role for admin actions. Never directly return JPA entities that contain sensitive fields.
- Never expose `service_role` credentials, database passwords, or admin tokens in frontend.
- Verify Spring Boot 4.x dependency compatibility before changing Maven dependencies.
- Write safe, reviewable migrations. Never mutate schema from Hibernate auto-DDL.
- If live DB conflicts with planned Flyway V1, explain safe alternatives; no automated deletes, `baselineOnMigrate`, or `repair` without approval.
- Any admin tariff JSON update must use the D033-approved backend-only persistent directory configured by `SB_TARIFF_STORAGE_DIR`, never resources inside a packaged JAR. Preserve immutable versions, expected-version concurrency, validation, and atomic same-filesystem saves required by D034–D035.

## Deliverable standard
Each approved task requires: limited-scope diff, relevant tests, validation notes, documentation/progress update, and PR-ready summary. Developers retain architectural and security approval authority.
