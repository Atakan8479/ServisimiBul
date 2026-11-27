# QA-03 Go/No-Go matrix — Issue #225

Date prepared: 2026-11-27 (`main` `d87026a`). **UNSIGNED.** A status here changes only through a reviewed commit that cites evidence, the decider's role, and the date. See [`25_LEGAL_APPROVAL_TRACKER.md`](../25_LEGAL_APPROVAL_TRACKER.md) §2.3.

Status values: **VERIFIED** = backed by actual evidence in the repo or CI. **PENDING APPROVAL** = needs an authorized human decision. **BLOCKED** = a release-blocking requirement is unresolved. **NOT APPLICABLE** = backed by a documented justification. No row is NOT APPLICABLE today: every candidate (consent banner, İYS, ETBIS, VERBIS) still needs counsel's written opinion under LEG-09 and LEG-10.

Owners are roles. "Owner" = product owner (PROPOSED in the records: repository owner). "Counsel" = qualified Turkish counsel (not yet identified). "Security" = security owner (not yet named). "Ops" = deployment operator (not yet named).

| # | Area | Requirement | Evidence | Status | Missing approval / gap | Risk if launched now | Owner | Action |
|---|---|---|---|---|---|---|---|---|
| 1 | Controller | Data controller identified, contactable | [`18`](../18_LEGAL_ROLE_AND_DATA_CONTROLLER.md) L1, L2 | BLOCKED | L1, L2 | Processing with no accountable controller | Owner + Counsel | Record identity and monitored channel |
| 2 | Legal role | Platform role, operator roles, applicable regimes | [`18`](../18_LEGAL_ROLE_AND_DATA_CONTROLLER.md) L3, L4, L7 | BLOCKED | Counsel opinions | Wrong obligations assumed | Counsel | Written opinion reference |
| 3 | KVKK notices | Approved role-specific notices published | [`21`](../21_PRIVACY_NOTICE_REQUIREMENTS.md); `legal-notices.ts` (`APPROVED_NOTICE=null`) | BLOCKED | NQ1–NQ5 | Collecting data without a notice | Counsel drafts, Owner approves | Approve text, then a separate APP-01 change |
| 4 | Notice gate | Unapproved notice cannot render | `legal-notices.ts`, `LegalPages.tsx` | VERIFIED | — | — | — | Keep |
| 5 | Processing map | Lawful basis per category | [`19`](../19_PERSONAL_DATA_PROCESSING_MAP.md) P1–P5 | PENDING APPROVAL | P1–P5 | Unlawful-basis exposure | Counsel (+ Owner P4) | Opinion |
| 6 | Retention | Periods, triggers, backups, holds | [`20`](../20_RETENTION_AND_ERASURE.md), [`32`](../32_APP_12_RETENTION_DISPOSAL.md) | BLOCKED | R1–R8 | Indefinite retention; no defensible disposal | Owner + Counsel | Complete the R1 matrix |
| 7 | DSR channel | Monitored channel, handler, 30-day lifecycle exercised | [`23`](../23_DATA_SUBJECT_REQUESTS.md); `app.data-rights.enabled=false` | BLOCKED | RQ1–RQ7, service level | Missed statutory deadline | Owner + Counsel | Name handler; run [privacy drill](qa-03-privacy-request-drill.md) |
| 8 | DSR fail-closed | Intake returns 503; nothing stored while disabled | QA-01 real-stack ([`35`](../35_QA_01_ACCOUNT_PRIVACY_EVIDENCE.md)) | VERIFIED | — | — | — | Keep until #7 is approved |
| 9 | Lifecycle | Deactivation, suspension, reactivation, erasure policy | [`24`](../24_ACCOUNT_LIFECYCLE_POLICY.md), [`31`](../31_APP_11_ERASURE_SAFETY.md) | PENDING APPROVAL | AQ1–AQ7 | Users can't exercise erasure; policy gaps | Owner + Counsel | Decide; flags stay off meanwhile |
| 10 | Lifecycle gate | Deactivation and email change disabled in prod | `application-prod.properties` | VERIFIED | — | — | — | Keep |
| 11 | Vendors | Supabase region and DPA; host; email; DNS/CDN; logs; export custody | [`22`](../22_VENDORS_AND_TRANSFERS.md) V1–V6 | BLOCKED | Owner evidence | Unknown transfers and subprocessors | Owner | Supply V1–V6 |
| 12 | Transfers | KVKK Art. 9 basis for any transfer or remote access abroad | [`22`](../22_VENDORS_AND_TRANSFERS.md) V7, V8 | BLOCKED | Counsel, after #11 | Unlawful transfer | Counsel | Opinion |
| 13 | Breach | Roles, contacts, criteria, 72-hour start point, signatory | [`29`](../29_BREACH_INCIDENT_RESPONSE.md) §1, §4, §6 | BLOCKED | Owner + Counsel | Late or missed Board notification | Owner + Counsel + Security | Name roles; run [incident drill](qa-03-incident-response-drill.md) |
| 14 | Breach tools | Global session revocation; admin disable of parent accounts | [`29`](../29_BREACH_INCIDENT_RESPONSE.md) §3.3 | PENDING APPROVAL | Owner prioritization | Slower containment | Owner + Security | Decide whether pilot-blocking |
| 15 | Moderation | Human-only review, audit, reporter privacy | D053; [`26`](../26_TERMS_CONTENT_SAFETY_AND_CHILD_DATA.md) §2.3 | VERIFIED (technical) | — | — | — | — |
| 16 | Terms and complaints | Terms, content policy, notice and appeal route | [`26`](../26_TERMS_CONTENT_SAFETY_AND_CHILD_DATA.md) §1 | BLOCKED | Counsel drafts, Owner approves | No contractual basis; no complaint route | Counsel + Owner | Approve |
| 17 | Child data | Minimization safeguards in free text | [`26`](../26_TERMS_CONTENT_SAFETY_AND_CHILD_DATA.md) §5; P4 | PENDING APPROVAL | Owner (P4) | Children's data in public comments | Owner | Decide on extra controls |
| 18 | Cookies | Only essential session cookie; no trackers | [`30`](../30_COOKIE_TRACKING_AND_MARKETING_CONSENT.md) §1–2; dependency re-check 2026-11-27 | VERIFIED (inventory) | — | — | — | Re-check on any new script |
| 19 | Cookie banner | "No banner needed" position | [`30`](../30_COOKIE_TRACKING_AND_MARKETING_CONSENT.md) C1–C3 | PENDING APPROVAL | Counsel | Wrong consent posture | Counsel | Opinion |
| 20 | Marketing | No commercial messages sent | [`30`](../30_COOKIE_TRACKING_AND_MARKETING_CONSENT.md) §3 | VERIFIED (technical) | — | — | — | APP-14 stays inactive |
| 21 | Registrations | VERBIS, ETBIS, İYS applicability | [`27`](../27_VERBIS_ETBIS_IYS_APPLICABILITY.md) T1–T3 | PENDING APPROVAL | Counsel | Missed registration | Counsel | Opinion per regime |
| 22 | AuthN/AuthZ | Server session, CSRF, roles, ownership, rate limits | [`03`](../03_SECURITY_AND_API.md); CI Backend + Real E2E green on `d87026a` | VERIFIED (test envs) | — | Single-instance rate limits (D041) | — | — |
| 23 | Email | SMTP provider for operator verification and password reset | `application-prod.properties` `SB_MAIL_*`; V3 | BLOCKED | Owner (V3), Counsel (V7, V8) | Operators cannot register in prod | Owner | Select provider |
| 24 | Deployment | Provider, durable tariff volume, health probes, proxy trust | [`07`](../07_BACKEND_DEPLOYMENT.md); D040, D042 | BLOCKED | Owner (paid plan) | No production environment | Owner + Ops | Select and deploy |
| 25 | Monitoring | Alerts for errors, pool, restarts, backups | [`07`](../07_BACKEND_DEPLOYMENT.md) line 183 | BLOCKED | Ops | Incidents go undetected (affects the 72-hour clock) | Ops + Security | Configure and test an alert |
| 26 | Backup / restore | Proven on target platform; RPO/RTO recorded | [`10`](../10_DATABASE_AND_BACKUP_OPERATIONS.md) 118, 176 | PENDING APPROVAL | Approval for a managed restore drill | Unproven recovery | Ops + Owner | Approved drill on non-production target |
| 27 | Repo protection | `main` ruleset with required checks and review | [`12`](../12_REPOSITORY_PROTECTION.md); API 2026-11-27: unprotected | PENDING APPROVAL | Repo admin | Unreviewed code reaching prod | Security + Owner | Enable ruleset |
| 28 | Schema | Shared DB at V22; no pending migration | [`36`](../36_V22_MIGRATION_RUNBOOK.md) | VERIFIED | — | — | — | Fresh approval for any future migration |
| 29 | UAT | Supervised operator and parent sessions | [`15`](../15_CONTROLLED_PILOT_UAT_REPORT.md) | BLOCKED | Not executed | Unknown usability failures | Owner | Run sessions |
| 30 | Pilot gate | L8 real-user pilot eligibility | [`25`](../25_LEGAL_APPROVAL_TRACKER.md) §5 | BLOCKED | Owner + Counsel, last | — | Owner + Counsel | Decide after rows 1–29 |

## Sign-off (all pending; do not pre-fill)

| Role | Name | Decision | Evidence reference | Date |
|---|---|---|---|---|
| Product owner | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Qualified Turkish counsel | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Security owner | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Operations | `[PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` |

Final decision: `[PENDING]`. Recommended on current evidence: **NO-GO** ([report](qa-03-readiness-report.md) §1).
