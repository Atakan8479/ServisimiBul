# LEG-04 — Vendors, processors, and international transfers (decision record)

Issue: [#197](https://github.com/Atakan8479/ServisimiBul/issues/197). Depends on LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`). Feeds LEG-05 (`docs/21_PRIVACY_NOTICE_REQUIREMENTS.md`) and LEG-03 (`docs/20_RETENTION_AND_ERASURE.md`). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not a transfer assessment, and not a compliance claim. It lists every external service that touches, or could touch, ServisimiBul's personal data, what the repository proves about each one, and what is still unknown. Unknown evidence is recorded as a **release blocker**, not filled in with assumptions. It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision.

No vendor country, contract, legal role, or transfer basis under KVKK Article 9 is stated as fact unless the repository proves it. The repository proves none of them.

## 1. Decision summary

| Field | Value |
|---|---|
| Vendor legal roles (processor, independent controller, or neither) | `[PENDING: counsel]` — section 3 |
| Physical location of personal data per vendor | `[PENDING: owner evidence]` — release blockers in section 4 |
| Contracts or terms in force per vendor | `[PENDING: owner evidence]` |
| Whether each flow is a transfer abroad, and its basis under KVKK Article 9 | `[PENDING: counsel]` |
| Required safeguards, notices, or contract responsibilities | `[PENDING: counsel]`, recorded only where actually applicable |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. What the repository proves (verified)

Verified against `main` at `7d593e9` on 2026-11-03 by reading decisions, deployment and operations docs, configuration, workflows, and the frontend entry point. Shared Supabase and every vendor dashboard were deliberately not accessed.

- **Database.** PostgreSQL is provided by Supabase; Supabase Auth, Storage, and the Data API are not used for application data (D003, D018, D033). The last recorded evidence shows the shared project on PostgreSQL 17.11 and the organization on the Free plan (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`). **The project's region is not recorded anywhere in the repository.**
- **Application hosting.** Railway, Render, and a managed VPS are candidates; none is selected (D042, `docs/07_BACKEND_DEPLOYMENT.md`). Production serves the frontend and `/api/v1` from the same origin (D036), so the frontend host is the same unselected decision.
- **Email.** SMTP delivery for verification and password reset is implemented through `SB_MAIL_*` settings and disabled until configured. No provider is selected (`docs/07_BACKEND_DEPLOYMENT.md`).
- **Logs and monitoring.** Production writes structured ECS logs to the console (`application-prod.properties`). Where they are stored, and any monitoring or alerting service, depend on the unselected host (D040).
- **DNS, CDN, domain.** Nothing in the repository records a domain, DNS provider, CDN, or TLS terminator.
- **Browser-side third parties.** None: `servisimibul-frontend/index.html` loads only the application bundle, `package.json` has no analytics or monitoring SDK, and no external fonts or scripts are loaded (LEG-02 section 3).
- **GitHub.** Hosts the repository, issues, and pull requests, and runs CI through GitHub Actions: checkout, Java and Node setup, artifact upload, and Gitleaks (`.github/workflows`). CI uses disposable PostgreSQL with synthetic fixtures only (D045).
- **Backups.** Supabase managed backups depend on the plan. An encrypted logical export exists outside Git, and its storage location is not recorded in the repository (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`).
- **Developer workstations.** `dev-supabase.ps1` can connect a developer's machine to the shared database as the restricted runtime role (D046). Application writes made that way persist in shared Supabase.
- **Support tools.** No support desk, chat, or ticketing tool is integrated or referenced.

## 3. Vendor and transfer matrix

Purpose and data categories are verified from the repository (LEG-02 numbering). Every column after them is `[PENDING]` until the owner supplies evidence and counsel decides. "Evidence needed" names what would settle the cell. It does not presume the answer.

| Vendor / system | Purpose | LEG-02 categories | Provider | Country of storage / access | Legal role | Contract / terms | Who at the vendor can access | Transfer basis (KVKK Art. 9) | Evidence needed |
|---|---|---|---|---|---|---|---|---|---|
| Database | Stores all application data | 2–15, 9a | Supabase (D003) | `[PENDING]` | `[PENDING: counsel]` | `[PENDING]` | `[PENDING]` | `[PENDING: counsel]` | Project region and organization plan from the Supabase dashboard; the terms or DPA accepted for the organization |
| Database backups | Recovery | 18 | Supabase (plan-dependent) | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Whether managed backups exist on the current plan, and where they are kept |
| Logical export storage | Recovery before migrations | 18 | `[PENDING: not recorded]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Where the encrypted export is held, and who holds the key |
| Application and frontend host | Runs the backend and serves the SPA | 1–17 in transit and in memory; 17 stored | Not selected (D042) | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Selected provider, region, and terms; part of provider selection |
| Log storage and monitoring | Operations, incidents | 17 | Not selected | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Same as host, plus any separate log or alerting service |
| Email delivery | Verification and reset emails | 2, 16 | Not selected | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Selected SMTP provider, region, terms; needed before `SB_MAIL_ENABLED=true` |
| DNS, CDN, TLS | Name resolution and traffic delivery | 1 in transit | Not recorded | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Whether a domain and CDN or proxy will be used, and which |
| GitHub (repository, Actions) | Source code, issues, CI | None of the platform's users' data is designed to be stored there; developers' own account data | GitHub | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Confirmation that no production personal data enters issues, PRs, logs, or artifacts (PROPOSED check, O2) |
| Developer workstations (`dev-supabase.ps1`) | Shared-data development | 2–15 when used | Developers' own machines | `[PENDING]` | `[PENDING]` | `[PENDING]` | Two developers | `[PENDING]` | Who uses shared-data mode, from where, and under what rules |
| Developer tooling (AI coding assistants and similar) | Code changes | None by design | Varies per developer | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | Confirmation that production personal data is never pasted into such tools (PROPOSED rule, O2) |

Analytics, advertising, chat, and support tools are omitted because none is in use (section 2). They must be added here before any is introduced.

## 4. Release blockers (unknown evidence)

These unknowns are not resolved by assumption. PROPOSED: each blocks a real-user launch until it is recorded with evidence. A real-user pilot is separately gated by LEG-01 L8.

| # | Unknown | Who can supply it |
|---|---|---|
| V1 | Supabase project region and the terms or DPA accepted for the organization | Owner, from the Supabase dashboard (read-only) |
| V2 | Application host, region, and terms | Owner, at provider selection (D042) |
| V3 | Email provider, region, and terms, before enabling SMTP | Owner |
| V4 | Domain, DNS, CDN, or proxy, if any | Owner |
| V5 | Location and key custody of the encrypted logical export | Owner |
| V6 | Log storage location and retention at the chosen host (also LEG-03) | Owner |
| V7 | Whether any flow is a transfer abroad, and its basis under KVKK Article 9 | Counsel, after V1–V6 |
| V8 | Each vendor's legal role and required contract terms | Counsel, after V1–V6 |

## 5. Safeguards, notices, and contracts (PROPOSED, B — only where applicable)

The issue asks for safeguards, notices, or standard contract responsibilities only where they actually apply. Until V7–V8 are answered, none is known to apply. PROPOSED working rules, which are not legal requirements:

- **O1 — Region-first selection.** When choosing the host (D042) and email provider, record the region and terms as part of the selection decision, so that V2–V3 are answered by design.
- **O2 — Keep personal data out of development tools.** No production personal data in GitHub issues, PRs, CI logs, artifacts, or developer AI tools. Synthetic fixtures only (D045). This extends the existing rule against committing secrets or private data (`AGENTS.md`).
- **O3 — Notice input.** Once V1–V8 are recorded, the recipients-and-transfers element of every LEG-05 notice is filled from section 3, not written independently.
- **O4 — Change trigger.** Adding or changing a vendor, region, or plan updates section 3 in the same PR as the change, before data flows to it.

## 6. Reconciliation with AUDIT-F4 (#166)

#166 did not list vendors or transfers explicitly, but it required the counsel-reviewed KVKK notice that needs this information (LEG-05, section 3, "Recipients and transfers"). No vendor review exists on `main`, so its closure did not provide one. This record supplies the vendor inventory and the list of unknowns. The legal roles, transfer bases, and contracts remain open here.

## 7. Open questions

| # | Question | Who answers |
|---|---|---|
| VQ1 | Supply V1–V6 (section 4). | Owner |
| VQ2 | For each vendor in section 3, what is its legal role, and what contract terms are needed? | Counsel |
| VQ3 | Which flows are transfers abroad, and on what basis under KVKK Article 9? | Counsel |
| VQ4 | Are O1–O4 adopted as project rules? | Owner |
| VQ5 | Do developer workstations using shared-data mode (D046) need their own rules or a separate record? | Owner + counsel |

## 8. Remaining risks

1. Every vendor's location and legal role is unknown, so no notice can state recipients or transfers (LEG-05).
2. Selecting a host or email provider without recording region and terms would recreate this gap.
3. Shared-data development mode puts real data on developer machines without a recorded rule.
4. Personal data pasted into GitHub or developer tools would create unrecorded processing (O2).

## 9. How to approve

1. **Technical draft.** The PR that adds this record may be merged after technical review. Merging is not legal approval, and the status line stays `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`.
2. **Evidence.** The owner supplies V1–V6 with dated evidence references, without committing credentials, contract copies, or other private documents.
3. **Owner and counsel review.** Counsel answers VQ2, VQ3, and VQ5. The owner answers VQ4.
4. **Recording decisions.** A later, separately reviewed PR fills section 1 and section 3, adds the approved `D0xx` entry to `docs/01_DECISIONS.md`, removes the matching open question, and changes this record's status line. No country, contract, role, or transfer basis is recorded before it is actually established.
5. **Issue status.** Issue #197 stays open until its acceptance criteria are met by recorded evidence and reviewed answers.
