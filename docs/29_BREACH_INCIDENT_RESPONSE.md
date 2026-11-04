# LEG-11 — Personal data breach incident response and notification (decision record)

Issue: [#204](https://github.com/Atakan8479/ServisimiBul/issues/204). Depends on LEG-01 (`docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md`), LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`), and LEG-04 (`docs/22_VENDORS_AND_TRANSFERS.md`). Uses LEG-03 and the operational runbooks in `docs/07_BACKEND_DEPLOYMENT.md` and `docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`. Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not an approved breach policy, and not a compliance claim. It records the legal sources checked, what the product and its runbooks provide today, and the structure that the owner and qualified Turkish counsel must fill: roles and contacts, an incident ledger, decision points, escalation, and the notification decision. It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision and no template text copied from elsewhere.

The consolidated tracker (`docs/25_LEGAL_APPROVAL_TRACKER.md`) covers LEG-01 to LEG-07 only. LEG-11 keeps its own issue and this record; its pending items are in section 13.

## 1. Decision summary

| Field | Value |
|---|---|
| Data controller that notifies | `[PENDING: LEG-01 L1]` |
| Incident roles and named contacts | `[PENDING: owner]` (section 4) |
| Breach risk-assessment criteria | `[PENDING: counsel]` (section 6) |
| When the controller "learns" of a breach for the 72-hour clock | `[PENDING: counsel]` (section 6) |
| Who decides and signs a Board or data-subject notification | `[PENDING: owner + counsel]` (section 9) |
| Data-subject notice wording and channel | `[PENDING: counsel drafts, owner approves]` |
| Incident ledger location and retention | `[PENDING: owner + counsel]`, with LEG-03 |
| Vendor incident contacts and contract terms | `[PENDING: LEG-04 V1–V6, V8]` |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. Legal sources checked (A)

Checked on 2026-11-03 against the KVKK Authority's breach-notification page (`kvkk.gov.tr`, "Veri İhlali Bildirimi"). How these apply to ServisimiBul depends on the controller (LEG-01 L1) and is `[PENDING: counsel]`.

- **Law No. 6698, Article 12(5):** if processed personal data is obtained by others unlawfully, the controller notifies the data subject and the Board "en kısa sürede" (as soon as possible). Article 12(1) requires technical and administrative measures to prevent unlawful access.
- **Board decision 2019/10 (24 January 2019)** on breach-notification procedures:
  - the controller notifies the Board without delay and **within 72 hours at the latest** of learning of the breach;
  - if notice cannot be given within 72 hours for a justified reason, the reasons for the delay are given with the notice;
  - affected data subjects are notified within the shortest reasonable time after they are identified, directly where a contact address is available, otherwise by an appropriate method such as the controller's website;
  - processors notify the controller without delay when they learn of a breach;
  - the controller records each breach, its effects, and the measures taken, and keeps the records available for the Board;
  - the controller prepares a breach response plan that names who reports internally and who is responsible, and reviews it periodically.
- **Board notification route:** the Personal Data Breach Notification Form, through the Authority's online system or the published Word form. Information that is not yet available may be supplied in stages. Complaints to the Authority use a separate route.

This record does not restate the form's fields as approved content, and does not decide whether any particular event is a reportable breach.

## 3. What exists today (verified)

Verified against `main` at `e532129` on 2026-11-03 by reading decisions D042, D046, D053, the security and backend code, and the runbooks.

### 3.1 Runbooks
- `docs/10_DATABASE_AND_BACKUP_OPERATIONS.md` has an **operational incident recovery checklist**: incident commander and scribe, containment, read-only scoping, backup and recovery-point records, least-destructive recovery, fresh approval for destructive restores, verification, credential rotation, and follow-up. Its restore procedure preserves the damaged database and logs as evidence.
- `docs/07_BACKEND_DEPLOYMENT.md` treats any real secret-scan finding as an incident: revoke or rotate first, then review history removal separately.
- **Neither runbook covers personal data breach assessment or notification.** No breach ledger, contact list, legal escalation, or notification step exists anywhere in the repository.

### 3.2 Detection and evidence in the product
- **Logs:** production uses structured ECS console logging, with Spring Security at `INFO` and SQL bind logging off (`application-prod.properties`). Authentication email failures log only the exception class. Where logs are stored and for how long depends on the host, which is not selected (D042; LEG-04 V2, V6; LEG-03 category 17).
- **No security alerting or dedicated security-event log.** There is no alert on failed logins, admin actions, or unusual data access. Rate limiting is in memory (`InMemoryRateLimiter`, salted SHA-256 keys) and is lost on restart.
- **Audit records that do exist:** moderation audit events (D053), operator review history (`OperatorApplicationReview`), and demand lifecycle events (`DemandLifecycleEvent`). They are business records, not access logs.
- **Actuator** exposes only health, without details (`application.properties`).
- **Admin notifications** cover only `CONTENT_REPORTED`; nothing notifies anyone of a security event.

### 3.3 Containment capabilities
- **Per-user session revocation:** `SessionRevoker.revokeAll` deletes one user's Spring Session JDBC sessions; it is used for password reset, password change, a user's own "log out everywhere" (`logoutAll`), email change, and operator suspension. **There is no product feature to revoke all users' sessions at once.**
- **Account disable:** operator suspension disables the account (LEG-07). No equivalent admin action exists for parent accounts.
- **Credential storage:** passwords use `BCryptPasswordEncoder`; one-time tokens are stored as SHA-256 hashes (`TokenHasher`). These reduce, but do not remove, the impact of a database disclosure; the assessment is `[PENDING: counsel]`.
- **Secrets:** database, session, and mail credentials are environment variables, and the Secret scan workflow runs on pull requests (`docs/07_BACKEND_DEPLOYMENT.md`).

### 3.4 Contact and notification capability
- **Email is disabled** for the controlled pilot (`SB_MAIL_ENABLED=false`, `docs/03_SECURITY_AND_API.md`; LEG-04 V3). The product cannot email affected users today.
- No public controller contact or website notice page exists (LEG-01 L2; LEG-05).
- No code sends any notification to the Board or to data subjects about a breach, and none is proposed (section 9).

### 3.5 Where personal data sits
LEG-02 lists 18 categories plus 9a. The places a breach could occur, from LEG-04: the Supabase database and any managed backups (V1), the future backend and frontend hosts (V2), the email provider once enabled (V3), DNS/CDN/TLS (V4), the encrypted logical export and its key custody (V5), and log storage (V6). Developer workstations using shared-data mode (D046) can also hold or reach that data (LEG-04 VQ5).

## 4. Roles and contacts (C, with PROPOSED structure)

| Role | Responsibility | Holder |
|---|---|---|
| Incident lead | Opens the ledger entry, coordinates, keeps the clock | `[PENDING: owner]` |
| Scribe | Records times, decisions, and evidence locations | `[PENDING: owner]`; may be the incident lead in the pilot |
| Technical lead | Containment, scoping, recovery under `docs/10` | `[PENDING: owner]` |
| Legal assessor | Assesses whether it is a breach, its risk, and notification duties | `[PENDING: counsel]` |
| Notification decision-maker | Approves and signs any Board or data-subject notice on behalf of the controller | `[PENDING: owner + counsel]`, depends on LEG-01 L1 |
| Communications | Prepares approved notices and answers to affected users | `[PENDING: owner]` |
| Vendor liaison | Contacts each vendor's incident channel | `[PENDING: owner]`, with LEG-04 |

PROPOSED (B):
- In the pilot one person may hold several roles, but the technical lead alone never decides that no notification is needed.
- Contacts (names, phone numbers, out-of-hours reachability) are kept in the ledger location chosen in section 7, **not in this repository**.
- A deputy is named for the incident lead and the notification decision-maker, so the 72-hour clock does not depend on one person.

## 5. Incident classification (PROPOSED, B)

Working labels only, not legal categories:

| Label | Meaning | Examples |
|---|---|---|
| Security event | Something unusual, not yet shown to affect personal data | Failed-login burst, Secret scan finding in a branch with no real secret, health-check failures |
| Suspected personal data breach | Personal data may have been accessed, disclosed, altered, lost, or made unavailable without authority | Exposed database credential, an API returning another user's data, a lost device in shared-data mode (D046), a vendor incident report |
| Confirmed personal data breach | The legal assessor confirms personal data was affected | Any of the above once confirmed |

PROPOSED escalation: any suspected breach is escalated to the legal assessor and the notification decision-maker **on the same day it is recorded**, without waiting for the technical scope to be complete. Whether a security event that later proves harmless still needs a ledger entry is `[PENDING: owner]` (IQ4).

## 6. Procedure and decision points (PROPOSED, B; legal points C)

| Stage | Actions | Decision point |
|---|---|---|
| 1. Detect and record | Open a ledger entry with the detection time, reporter, and first facts | Is it a suspected personal data breach? Escalate if in doubt |
| 2. Contain | Follow `docs/10` incident recovery steps 1–2: stop deployments, rotate exposed credentials, revoke affected sessions (`revokeAll`), disable affected accounts, take a host or vendor service offline if needed | Containment approved by the incident lead; destructive actions need the approvals in `docs/10` |
| 3. Preserve evidence | Section 8 | — |
| 4. Assess scope | Which systems (section 3.5), which LEG-02 categories, which groups of people, roughly how many, since when | Scope is a technical fact-finding step; it does not decide the legal outcome |
| 5. Legal assessment | Is it a breach under Article 12(5)? What is the likely effect on the people concerned? | `[PENDING: counsel]` criteria; recorded with reasons in the ledger |
| 6. Notification decision | Board notification within 72 hours of learning; data-subject notification once they are identified; reasons for any delay | Signed by the notification decision-maker (section 9) |
| 7. Notify | Manually, through the Authority's route; data-subject notices through the approved channel | Section 9 |
| 8. Recover | `docs/10` steps 3–10 | Recovery owner signs off |
| 9. Close and review | Root cause, follow-up tasks, update of this record or the runbooks | Incident lead closes the ledger entry |

**The 72-hour clock** (C): the Board decision counts from when the controller learns of the breach. What counts as "learning" — for example, a processor's report, a developer's discovery, or the legal assessor's confirmation — is `[PENDING: counsel]` (IQ2). PROPOSED (B) until then: the ledger records every candidate time (detection, escalation, confirmation), and planning assumes the earliest.

**Data in scope**, for the assessment (A, from LEG-02): credentials and one-time tokens (categories 3, 4), sessions (5), account email and phone (2, 6), parent demand and support linking a parent to a school and pickup neighborhood (9, 9a), public comments and reports that may contain children's data (12, 13), moderation records (14), logs (17), and backups (18). How these affect the risk assessment is `[PENDING: counsel]`.

## 7. Incident ledger (PROPOSED, B)

The Board decision requires breach records to be kept for the Board. PROPOSED fields:

1. Incident ID and status (open, closed)
2. Detection time, escalation time, confirmation time, and who reported it
3. Systems and vendors involved (section 3.5)
4. LEG-02 categories and groups of people affected; approximate count and how it was estimated
5. Cause, as known, and how it changed during the investigation
6. Containment and recovery measures, with times
7. Evidence references (location, hash, access list), never the evidence itself
8. Legal assessment and its reasons
9. Notification decisions: Board yes/no with time and reference, data subjects yes/no with time and channel, reasons for any delay, and who signed
10. Vendor communications
11. Follow-up tasks and closure date

PROPOSED rules:
- The ledger is **not** kept in this repository, in GitHub issues, or in pull requests, because it may contain personal data and privileged advice. Its location, access list, and retention are `[PENDING: owner + counsel]` (IQ5), with LEG-03.
- Repository follow-up work refers to an incident only by its ID, with no personal data.
- Entries are append-only in practice: corrections are added, not overwritten.

## 8. Evidence preservation (PROPOSED, B)

- Preserve before fixing where it is safe: copy relevant logs, keep the suspect artifact, and keep the damaged database or snapshot, as `docs/10` already requires for restores.
- **Log retention is unknown** (LEG-04 V6, LEG-03 category 17). Until it is known, the first containment step includes exporting the logs for the affected period, because host logs may expire before an investigation finishes.
- Record a SHA-256 hash and the access list for each preserved item; store items encrypted, separately from the production systems.
- Never put credentials, tokens, session IDs, or raw personal data in tickets, chat, or commits; refer to the protected copy instead.
- Evidence retention is `[PENDING: owner + counsel]` (IQ5), and must also respect LEG-03 legal holds (O4).

## 9. Notification decision (C)

- **No automation.** No code, scheduled job, or email template sends a notification to the Board or to data subjects. Any future tooling may only help prepare drafts or the ledger, and needs a reviewed decision first.
- **Board:** submitted by the controller (LEG-01 L1) through the Authority's route (section 2), by the person authorised in section 4. Who that is, and how authority is evidenced, is `[PENDING: owner + counsel]` (IQ3).
- **Data subjects:** wording, language, and channel are `[PENDING: counsel drafts, owner approves]` (IQ6). Email is disabled today (section 3.4), so the channel may be in-app notice, a website notice, or email once V3 is resolved; this is a decision, not an assumption.
- **No public statement** about an incident is made before the notification decision-maker approves it.
- If counsel concludes no notification is required, the reasons are recorded in the ledger.

## 10. Vendor coordination (PROPOSED, B; depends on LEG-04)

| Vendor (LEG-04) | What to obtain before launch | Status |
|---|---|---|
| V1 Supabase database and backups | Incident reporting channel, what the vendor will tell the controller and how fast, access logs available to the project | `[PENDING: owner, read-only from dashboard and terms]` |
| V2 Backend and frontend host | Same, plus log export and retention | Host not selected (D042) |
| V3 Email provider | Same, plus whether messages and recipient lists are logged | Disabled; required before SMTP |
| V4 DNS, CDN, TLS | Incident channel; whether traffic content is visible | Undecided |
| V5 Encrypted export and keys | Who holds keys; how loss is detected | Owner |
| V6 Log storage | Retention, export, and access | Planned |

The processor's duty to tell the controller without delay (section 2) depends on each vendor's role and contract terms (LEG-04 V8, VQ2).

## 11. Tabletop drill (PROPOSED, B)

A discussion exercise, run before any real-user pilot and repeated at an interval `[PENDING: owner]` (IQ9). It uses only synthetic data and invented facts, touches no production or shared Supabase system, and sends nothing to the Authority or to any user.

**Scenario.** A developer working in shared-data mode (D046) notices that a database connection string with the application role's password was pasted into a public place several days ago. Logs from the backend host for that period may already have expired.

| Phase | Injects (facilitator reveals) | What participants must decide or produce |
|---|---|---|
| 1. Discovery | The finding is reported on a Friday evening; the incident lead is unreachable | Who opens the ledger entry; which candidate times are recorded (section 6); is this a suspected breach; who is escalated today |
| 2. Containment and evidence | Rotating the password will break the running backend; host logs older than the retention period are gone | Order of rotation and redeploy (`docs/07`, `docs/10`); which logs and snapshots are preserved first; hashes and storage of preserved items; whether all sessions must be revoked, given there is no global action (section 3.3) |
| 3. Legal assessment | Database statistics show unexplained reads of `app_user` and demand tables | Which LEG-02 categories and groups are affected; what the legal assessor needs to decide; when the 72-hour period started; what to record if facts are still incomplete at hour 72 |
| 4. Communications | A parent asks on the demand board whether data leaked; Supabase support has not answered | Who may reply and with what approved text; how affected users would be told while email is disabled; what goes to the Board in stages; what the vendor liaison asks V1 |
| 5. Close | — | Ledger closure fields; follow-up tasks referenced by incident ID only |

**Expected outputs:** a completed synthetic ledger entry, a timeline against the 72-hour period, a list of gaps found, and follow-up tasks. **Pass criteria** (PROPOSED): every decision point in section 6 has a named owner; the synthetic Board-notification decision is reached, with reasons, within the drill's simulated 72 hours; no real personal data or credential appears in drill notes.

The drill's synthetic ledger and notes are kept with the real ledger (section 7), not in this repository. A short, data-free summary (date, participants' roles, gaps, follow-up issue numbers) may be added to `docs/06_PROGRESS.md`.

## 12. Reconciliation with AUDIT-F4 (#166)

#166 asked for a KVKK privacy, retention, and rights-request process, and its inventory covered audit events. It did not cover breach response or notification. No breach procedure, ledger, or notification route exists on `main` (section 3), so its closure did not provide one. This record supplies the current state and the structure needed; logs and backups are already inventoried in LEG-02 categories 17 and 18.

## 13. Open questions

| # | Question | Who answers |
|---|---|---|
| IQ1 | Who holds each role in section 4, with a deputy for the incident lead and the notification decision-maker? | Owner |
| IQ2 | When does the controller "learn" of a breach for the 72-hour clock, including reports from processors and developers? | Counsel |
| IQ3 | Who decides and signs Board and data-subject notifications for the controller, and how is that authority evidenced? | Owner + counsel; depends on LEG-01 L1 |
| IQ4 | Which events must be recorded in the ledger, including events that prove harmless? | Owner + counsel |
| IQ5 | Where is the ledger kept, who can access it, and how long are ledger entries and evidence kept? | Owner + counsel, with LEG-03 |
| IQ6 | Approved data-subject notice wording, language, and channel, given that email is disabled today | Counsel drafts, owner approves |
| IQ7 | Risk-assessment criteria for deciding whether to notify, using the LEG-02 categories in section 6 | Counsel |
| IQ8 | Vendor incident channels and terms (section 10) | Owner supplies (LEG-04 VQ1); counsel reviews (VQ2) |
| IQ9 | Who runs the tabletop drill (section 11), how often, and must a completed drill gate the real-user pilot? | Owner |

## 14. Remaining risks

1. No breach procedure, ledger, or named contact exists, so the 72-hour period could pass while roles are worked out.
2. Log retention is unknown and logs live with an unselected host; evidence may be lost.
3. No security alerting exists, so detection depends on someone noticing.
4. There is no product action to revoke all sessions at once, or to disable a parent account.
5. Email is disabled, so affected users cannot be told by email today.
6. Shared-data development (D046) widens where a breach could start.
7. The controller is not identified (LEG-01 L1), so nobody can yet notify the Board on its behalf.

## 15. How to approve

1. **Technical draft.** The PR that adds this record may be merged after technical review. Merging is not legal approval, and the status line stays `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`.
2. **Owner and counsel review.**
   - The owner answers IQ1 and IQ9, and supplies IQ8.
   - Counsel answers IQ2 and IQ7, and drafts IQ6 for the owner's approval.
   - The owner and counsel answer IQ3, IQ4, and IQ5 together.
3. **Recording decisions.** A later, reviewed change records:
   - an approved `D0xx` entry in `docs/01_DECISIONS.md`
   - removal of the matching open question
   - an update to this record's status line

   No names, contacts, dates, or reviewers are recorded before they are actually given, and contact details go in the ledger location, not here.
4. **Drill.** The tabletop drill in section 11 is run once roles are named (IQ1). Whether a completed drill gates the real-user pilot is IQ9.
5. **Implementation gate.** Runbook updates, ledger tooling outside the product, and product containment features (for example a global session revocation) may be prepared as separate reviewed tasks. Nothing sends or schedules a regulatory or data-subject notification without the approved decision from step 3.
6. **Launch.** LEG-11's applicable requirements must be reviewed before any real-user pilot (tracker section 5, LEG-01 L8).
7. **Issue status.** Issue #204 stays open until its acceptance criteria are met by recorded, reviewed answers.
