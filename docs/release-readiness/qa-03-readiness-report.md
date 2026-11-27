# QA-03 release-readiness report — Issue #225

Date: 2026-11-27. Base: `main` at `d87026a` (all five CI checks green on that commit).
Status: **PREPARATION ONLY — NOT A SIGNED GO/NO-GO.** This report is evidence for a human decision. It contains no legal conclusion, no approval signature and no exercise result.

## 1. Verdict

**Recommended verdict: NO-GO for a real-user controlled pilot.**

The verdict is not CONDITIONAL because the remaining items are unresolved P0 legal and operational requirements, not conditions that can be accepted around:

- Every decision in [`docs/25_LEGAL_APPROVAL_TRACKER.md`](../25_LEGAL_APPROVAL_TRACKER.md) (LEG-01–LEG-07) is still `PENDING`. LEG-08–LEG-11 records ([`26`](../26_TERMS_CONTENT_SAFETY_AND_CHILD_DATA.md), [`27`](../27_VERBIS_ETBIS_IYS_APPLICABILITY.md), [`29`](../29_BREACH_INCIDENT_RESPONSE.md), [`30`](../30_COOKIE_TRACKING_AND_MARKETING_CONSENT.md)) all say `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`.
- No data controller is identified (L1), there is no monitored data-subject channel (L2, RQ1), and no qualified Turkish counsel is named anywhere in the repository.
- No hosting provider is selected (D042), there is no SMTP provider (V3), and there is no monitoring or alerting. Production config requires email verification and an enabled mailer, so operators cannot complete signup in production today.
- The privacy-request and incident tabletop drills have **not been performed**. This PR only adds plans for them.
- Supervised UAT has not been executed ([`15_CONTROLLED_PILOT_UAT_REPORT.md`](../15_CONTROLLED_PILOT_UAT_REPORT.md)).

Closed issues are **not** legal approval: #194–#204, #223, #224 and #166 are all closed, while their records stay draft and their sign-off fields stay `[PENDING]`. Green CI and the mocked and real-stack E2E suites prove application behavior in disposable environments only. They do not prove legal compliance, production configuration or operational readiness.

## 2. Verified (technical evidence only)

| # | Claim | Evidence |
|---|---|---|
| T1 | Production fails closed for legally dependent features: `app.data-rights.enabled=false`, `app.auth.account-deactivation.enabled=false`, `app.auth.email-change.enabled=false`, `app.auth.email-verification.required=true` | `servisimibul-backend/src/main/resources/application-prod.properties` lines 6–9 |
| T2 | Session cookie is `Secure` in prod. Runtime Flyway is disabled. Operator approval defaults to required. Parent registration defaults to disabled. | `application-prod.properties`, `application.properties` |
| T3 | Legal notice and terms pages cannot render unapproved text: `APPROVED_NOTICE` and `APPROVED_TERMS` are `null` whatever the flag says. Pages state that the notice and request channel are not yet live. | `servisimibul-frontend/src/features/legal/legal-notices.ts`, `LegalPages.tsx` |
| T4 | No analytics, advertising or third-party tracking dependency. The only cookie is first-party `SBSESSION`, plus a tab-scoped role hint in `sessionStorage`. No marketing messaging path exists. | [`30_COOKIE…`](../30_COOKIE_TRACKING_AND_MARKETING_CONSENT.md) §1–3; re-checked `package.json` and `index.html` on 2026-11-27 |
| T5 | Server-side session + CSRF + role and ownership checks, deactivation session revocation, and the data-rights 503 fail-closed path are exercised by the real full-stack suite | [`35_QA_01…`](../35_QA_01_ACCOUNT_PRIVACY_EVIDENCE.md); CI "Real full-stack E2E" green on `d87026a` |
| T6 | Moderation is human-only. Reports never change publication by themselves. Reporter identity is never exposed. | D053 in [`01_DECISIONS.md`](../01_DECISIONS.md); [`26`](../26_TERMS_CONTENT_SAFETY_AND_CHILD_DATA.md) §2.3 |
| T7 | Logical backup and restore procedure works in **disposable** environments only (A-13, APP-12 synthetic disposal reconciliation) | [`10_DATABASE_AND_BACKUP_OPERATIONS.md`](../10_DATABASE_AND_BACKUP_OPERATIONS.md) lines 118–133 |
| T8 | Shared Supabase is at schema V22 (applied 2026-11-22 under separate approval) | [`36_V22_MIGRATION_RUNBOOK.md`](../36_V22_MIGRATION_RUNBOOK.md), `06_PROGRESS.md` |
| T9 | Breach containment tools that exist today: per-user `revokeAll`, admin operator suspension. Missing: global session revocation, admin disable of a parent account. | [`29`](../29_BREACH_INCIDENT_RESPONSE.md) §3.3, §6 |

## 3. Release blockers (BLOCKED)

| ID | Blocker | Owner |
|---|---|---|
| B-01 | Data controller identity and public contact not decided (L1, L2) | Product owner + counsel |
| B-02 | No counsel engaged or recorded. Every Counsel or Joint item is unreviewed. | Product owner |
| B-03 | Privacy notice and terms not approved (NQ1–NQ5, LEG-08), so APP-01 publication stays gated | Counsel drafts, owner approves |
| B-04 | No monitored data-subject channel, handler or templates (RQ1–RQ7). The 30-day lifecycle has never been exercised. | Owner + counsel |
| B-05 | Breach roles, contacts, 72-hour "learning" point and notification signatory undefined. Tabletop not run. | Owner + counsel + security owner |
| B-06 | Hosting, domain, TLS, logs and email vendors not selected (V1–V6). Transfer basis not assessed (V7, V8). | Owner, then counsel |
| B-07 | No production deployment, monitoring or alerting. Rollback has not been rehearsed (D042, `07` §198). | Owner / ops |
| B-08 | Operator signup in production needs SMTP (verification required, `SB_MAIL_*` mandatory). No provider is chosen (V3). | Owner |
| B-09 | Retention periods and erasure rules not decided (R1–R8). Real erasure is unavailable, and no request can be honored end-to-end. | Owner + counsel |
| B-10 | Real-user pilot eligibility (L8) not decided. Supervised UAT not executed. | Owner + counsel |

## 4. Risks noted (not blockers on their own)

- `main` has no branch protection and no ruleset (read-only API check 2026-11-27: `protected=false`, `rulesets=[]`). This contradicts the intent in [`12_REPOSITORY_PROTECTION.md`](../12_REPOSITORY_PROTECTION.md). It needs a security owner decision before production traffic.
- Rate limits are in-memory and single-instance (D041). A restart resets them.
- With D052 enabled, parent emails are unverified. The documented risks are account squatting and no recovery.
- There's no global kill switch for sessions. Incident containment for parents relies on per-user revocation only.
- The restore procedure has never been proven against shared Supabase (managed PITR and dashboard restore have not been drilled).

## 5. What can be done technically vs. what needs people

| Technical (no approval needed to prepare) | Needs a human decision |
|---|---|
| Keep drill plans, ledger template and checklists current (this PR) | Controller identity, contacts, counsel engagement |
| Prepare a provider-neutral production config checklist and a smoke-test script | Provider selection, paid plans, domain and DNS |
| Draft a branch-protection ruleset per `12` for owner review | Enabling the ruleset (repo admin) |
| Run the synthetic drills **after** roles are named, in a disposable environment | Approving notice, terms and templates; legal assessments; L8 |
| Propose global session revocation and parent-account disable as tracked work | Prioritizing them; any schema or API change |

## 6. Prioritized path to controlled-pilot readiness

1. **Owner:** record the controller identity, postal and contact details and the monitoring person (L1, L2, RQ1 person). Engage qualified Turkish counsel and record a reference.
2. **Owner:** select hosting, domain and email vendors and record their regions and DPAs (V1–V6). Counsel then assesses transfers and vendor roles (V7, V8).
3. **Counsel:** give core opinions (L3, L4, L7, P1–P3), then retention and DSR process (R1–R8, RQ1–RQ7), then VERBIS, ETBIS and İYS (T1–T3) and the cookie position (C1–C4).
4. **Counsel drafts, owner approves:** privacy notice(s), terms, DSR response templates, breach data-subject notice. Record them as `D0xx` decisions.
5. **Security owner:** name the incident lead, deputy, legal assessor and notification decision-maker. Enable branch protection. Decide on global session revocation.
6. **Ops:** deploy to the chosen provider with prod properties. Verify SMTP, monitoring and alerts, a managed restore drill and a rollback rehearsal.
7. **Run** [the privacy-request drill](qa-03-privacy-request-drill.md) and [the incident drill](qa-03-incident-response-drill.md) with the named people. Record actual results.
8. **Run** supervised UAT per [`14_CONTROLLED_PILOT_UAT.md`](../14_CONTROLLED_PILOT_UAT.md).
9. **Owner + counsel:** decide L8 and sign [the Go/No-Go matrix](qa-03-go-no-go-matrix.md). Only then may #225 close.

## 7. Scope and limits of this report

Read-only analysis plus these four documents. No application code, API, migration, Supabase, production setting, email or feature flag was changed or contacted. No real personal data was used. Nothing here is legal advice.
