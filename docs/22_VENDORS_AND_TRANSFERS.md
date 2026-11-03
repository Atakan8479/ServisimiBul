# LEG-04 — Vendors, processors, and international transfers (decision record)

Issue: [#197](https://github.com/Atakan8479/ServisimiBul/issues/197). Depends on LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`). Feeds LEG-05 (`docs/21_PRIVACY_NOTICE_REQUIREMENTS.md`) and LEG-03 (`docs/20_RETENTION_AND_ERASURE.md`). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not a transfer assessment, and not a compliance claim. It lists every external service that touches, or could touch, ServisimiBul's personal data, what the repository proves about each one, and what is still unknown. Unknown evidence is recorded as a **release blocker**, not filled in with assumptions. It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision.

No vendor country, contract, legal role, or transfer basis under KVKK Article 9 is stated as fact unless the repository proves it. The repository proves none of them.

## 1. Decision summary

| Field | Value |
|---|---|
| Vendor legal roles (processor, independent controller, or neither) | `[PENDING: counsel]` — section 3 |
| Storage region, remote-access countries, and subprocessors per vendor | `[PENDING: owner evidence]` — section 3, release blockers in section 4 |
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
- **Application hosting.** Railway, Render, and a managed VPS are candidates; none is selected (D042, `docs/07_BACKEND_DEPLOYMENT.md`). D036 requires that the browser sees the frontend and `/api/v1` on the same origin. That is a browser-side requirement, not a physical topology. The frontend host, backend host, reverse proxy, and TLS terminator may be one provider or several, depending on the deployment that is eventually approved. Every one of these assignments is `[PENDING]`, and section 3 lists them separately so either architecture can be recorded.
- **Email.** SMTP delivery for verification and password reset is implemented through `SB_MAIL_*` settings and disabled until configured. No provider is selected (`docs/07_BACKEND_DEPLOYMENT.md`).
- **Logs and monitoring.** Production writes structured ECS logs to the console (`application-prod.properties`). Where they are stored, and any monitoring or alerting service, depend on the unselected host (D040).
- **Domain, DNS, CDN, reverse proxy, TLS.** Nothing in the repository records a domain, DNS provider, CDN, external reverse proxy, or TLS terminator. The production profile requires an HTTPS frontend origin when email is enabled (`docs/07_BACKEND_DEPLOYMENT.md`), so TLS will be terminated somewhere, but where and by whom is not decided.
- **Browser-side third parties.** None: `servisimibul-frontend/index.html` loads only the application bundle, `package.json` has no analytics or monitoring SDK, and no external fonts or scripts are loaded (LEG-02 section 3).
- **GitHub.** Hosts the repository, issues, and pull requests, and runs CI through GitHub Actions: checkout, Java and Node setup, artifact upload, and Gitleaks (`.github/workflows`). CI uses disposable PostgreSQL with synthetic fixtures only (D045).
- **Backups.** Supabase managed backups depend on the plan. An encrypted logical export exists outside Git, and its storage location is not recorded in the repository (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`).
- **Developer workstations.** `dev-supabase.ps1` can connect a developer's machine to the shared database as the restricted runtime role (D046). Application writes made that way persist in shared Supabase.
- **Support tools.** No support desk, chat, or ticketing tool is integrated or referenced.

## 3. Vendor and transfer matrix

### 3.1 Usage status

Each row has one status, assigned only from repository evidence:

| Status | Meaning |
|---|---|
| **ACTIVE** | Exists and processes, or can process, personal data today |
| **PLANNED** | Required before a real-user launch, but not yet selected |
| **DISABLED** | Implemented in code but switched off; must be reassessed here before it is turned on |
| **UNDECIDED** | Might or might not be part of the deployment; the owner decides whether it is used |
| **NOT USED** | No integration exists; adding one triggers a new review here (O4) |

### 3.2 Matrix

Status, purpose, and data categories are verified (LEG-02 numbering). Every other value is `[PENDING: owner evidence]` (facts only the owner can supply, for example from a vendor dashboard or contract) or `[PENDING: counsel]` (legal decisions). For a vendor that is not selected yet, every evidence column depends on that future selection and is marked "on selection". "Evidence needed" names what would settle the row. It does not presume the answer.

| System | Status | Purpose | LEG-02 categories | Provider | Primary storage country / region | Countries of remote vendor access | Subprocessors | Contract / DPA and subprocessor-list reference | Legal role | Transfer abroad and basis (KVKK Art. 9) | Evidence needed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Database | ACTIVE | Stores all application data | 2–15, 9a | Supabase (D003) | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: counsel]` | `[PENDING: counsel]` | Project region; terms or DPA accepted for the organization; Supabase's published subprocessor list and support-access terms (V1) |
| Managed database backups | UNDECIDED | Recovery | 18 | Supabase, if the plan provides them | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: counsel]` | `[PENDING: counsel]` | Whether the current plan keeps managed backups, and where (V1). The last recorded plan was Free. |
| Logical export storage | ACTIVE | Recovery before migrations | 18 | `[PENDING: not recorded]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: counsel]` | `[PENDING: counsel]` | Where the encrypted export is held and who holds the key (V5) |
| Backend host | PLANNED | Runs Spring Boot | 1–17 in memory and in transit; 17 if logs are stored there | Not selected (D042) | On selection | On selection | On selection | On selection | `[PENDING: counsel]` | `[PENDING: counsel]` | Provider, region, support-access terms, subprocessors (V2) |
| Frontend host | PLANNED | Serves the SPA files | None, if it only serves static files; more if it also proxies `/api/v1` | Not selected; may be the backend host | On selection | On selection | On selection | On selection | `[PENDING: counsel]` | `[PENDING: counsel]` | Whether it is separate from the backend host, and if so the same evidence as V2 |
| Log storage | PLANNED | Operations, incidents | 17 | Not selected; may be the backend host | On selection | On selection | On selection | On selection | `[PENDING: counsel]` | `[PENDING: counsel]` | Where host logs are stored and for how long (V6) |
| Separate monitoring or alerting service | UNDECIDED | Alerts and metrics | 17, if it receives logs | None selected; may not be needed if the host provides it | On selection | On selection | On selection | On selection | `[PENDING: counsel]` | `[PENDING: counsel]` | Whether one is used at all (V6) |
| Email delivery | DISABLED | Verification and reset emails | 2, 16 | Not selected | On selection | On selection | On selection | On selection | `[PENDING: counsel]` | `[PENDING: counsel]` | Provider, region, terms, subprocessors before `SB_MAIL_ENABLED=true` (V3) |
| DNS | UNDECIDED | Resolves the domain name | Lookup metadata, such as the resolver's IP and the queried name; no request paths, headers, or bodies | Not recorded | On selection | On selection | On selection | On selection | `[PENDING: counsel]` | `[PENDING: counsel]` | Domain and DNS provider (V4) |
| CDN, reverse proxy, or TLS terminator | UNDECIDED | Delivers traffic; may terminate HTTPS | Without TLS termination, only encrypted traffic and connection metadata (1). If it terminates TLS, it can technically see request paths, headers, the `SBSESSION` cookie, credentials during login, and API payloads, so potentially 1–16 in transit, depending on configuration | Not recorded; the host platform may fill this role | On selection | On selection | On selection | On selection | `[PENDING: counsel]` | `[PENDING: counsel]` | Whether TLS terminates at the host or at a separate intermediary, and what that intermediary logs or retains (V4) |
| GitHub (repository, Actions) | ACTIVE | Source code, issues, CI | None of the platform users' data by design; developers' own account data | GitHub | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: counsel]` | `[PENDING: counsel]` | Confirmation that no production personal data enters issues, PRs, logs, or artifacts (O2) |
| Developer workstations (`dev-supabase.ps1`) | ACTIVE when shared-data mode is used | Shared-data development | 2–15 | Developers' own machines | `[PENDING: owner evidence]` | — | — | — | `[PENDING: counsel]` | `[PENDING: counsel]` | Who uses shared-data mode, from where, and under what rules (VQ5) |
| Developer tooling (AI coding assistants and similar) | ACTIVE | Code changes | None by design | Varies per developer | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: owner evidence]` | `[PENDING: counsel]` | `[PENDING: counsel]` | Confirmation that production personal data is never pasted into such tools (O2) |
| Analytics, advertising, chat, support tools | NOT USED | — | — | None | — | — | — | — | — | — | None now; adding one requires a new row first (O4) |

A row marked "on selection" never needs invented values. It is filled when the provider is chosen. The CDN row does not assume that a CDN or external proxy will be used, or that any provider retains everything it can technically see.

## 4. Release blockers (unknown evidence)

These unknowns are not resolved by assumption. Which ones block depends on each row's status in section 3:

- **ACTIVE and PLANNED rows:** PROPOSED, their evidence and the counsel decisions V7–V8 block a real-user launch.
- **DISABLED rows:** they block only their own activation, which needs this record updated first.
- **UNDECIDED rows:** the owner first decides whether the service is part of the approved deployment. If it is, it becomes PLANNED and blocks like any other. If not, it becomes NOT USED and needs no further details.
- **NOT USED rows:** they block nothing until they are adopted (O4).

A release blocker therefore applies to the deployment actually approved and the personal-data flows it really has. It never requires details about a service that will not be used. This does not relax anything for active or planned flows. The real-user pilot stays separately gated by LEG-01 L8, and production release by its own approval.

| # | Unknown (for each row it applies to: storage region, remote-access countries, subprocessors, contract or DPA, subprocessor-list reference) | Status of the related rows | Who can supply it |
|---|---|---|---|
| V1 | Supabase database and, if used, managed backups | ACTIVE / UNDECIDED | Owner, from the Supabase dashboard and published terms (read-only) |
| V2 | Backend host and, if separate, frontend host | PLANNED | Owner, at provider selection (D042) |
| V3 | Email provider | DISABLED; required before enabling SMTP | Owner |
| V4 | Domain and DNS, and whether a separate CDN, reverse proxy, or TLS terminator is used | UNDECIDED | Owner, as part of the deployment decision |
| V5 | Location and key custody of the encrypted logical export | ACTIVE | Owner |
| V6 | Log storage at the chosen host, and whether a separate monitoring service is used (retention also LEG-03) | PLANNED / UNDECIDED | Owner |
| V7 | Whether any flow is a transfer abroad, counting remote access as well as storage, and its basis under KVKK Article 9 | All ACTIVE and PLANNED rows | Counsel, after V1–V6 |
| V8 | Each vendor's legal role and required contract terms, including subprocessor terms | All ACTIVE and PLANNED rows | Counsel, after V1–V6 |

## 5. Safeguards, notices, and contracts (PROPOSED, B — only where applicable)

The issue asks for safeguards, notices, or standard contract responsibilities only where they actually apply. Until V7–V8 are answered, none is known to apply. PROPOSED working rules, which are not legal requirements:

- **O1 — Region-first selection.** When choosing the host (D042), email provider, and any DNS, CDN, or proxy, record the storage region, remote-access countries, subprocessor list, and terms as part of the selection decision, so that V2–V4 are answered by design.
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
