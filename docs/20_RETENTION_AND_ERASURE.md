# LEG-03 — Retention, erasure, anonymization, backups, and legal holds (decision record)

Issue: [#196](https://github.com/Atakan8479/ServisimiBul/issues/196). Depends on LEG-02 ([#195](https://github.com/Atakan8479/ServisimiBul/issues/195), `docs/19_PERSONAL_DATA_PROCESSING_MAP.md`) and LEG-01 (`docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md`). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not a retention policy, and not a compliance claim. It records how long each kind of data actually lives in the software today and what technically limits deleting it. It also lays out the matrix that the owner and qualified Turkish counsel must fill in. Category numbers refer to section 4 of the LEG-02 map. It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision.

No retention period, legal retention obligation, or response deadline is stated. Every such value is `[PENDING]`. A PROPOSED trigger or disposal method in section 3 is a technical option for the decision-makers, not a rule.

## 1. Decision summary

| Field | Value |
|---|---|
| Retention period per category | `[PENDING: owner + counsel]` — section 3 |
| Legal retention obligations that override erasure (if any) | `[PENDING: counsel]` |
| Erasure versus anonymization per category | `[PENDING: owner + counsel]` — section 3 |
| Response deadline for data-subject requests | `[PENDING: LEG-06]` — section 4 |
| Backup retention and restore-after-erasure procedure | `[PENDING: owner + counsel]` — section 5 |
| Legal-hold procedure | `[PENDING: owner + counsel]` — section 5 |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. What the software does today (verified)

Verified against `main` at `182a59d` (Flyway V1–V17) on 2026-11-02 by reading migrations, repositories, services, schedulers, and operations docs.

### 2.1 Automatic disposal that exists

| Data | Mechanism | Evidence |
|---|---|---|
| Expired sessions (category 5) | Spring Session JDBC deletes expired `spring_session` rows on its default once-a-minute schedule; attributes cascade | `docs/10_DATABASE_AND_BACKUP_OPERATIONS.md` "Session cleanup procedure"; V4 `ON DELETE CASCADE`; `SessionCleanupOperationsTests` |
| Revoked sessions | Logout, the two-session limit, and revocation triggers (password reset, disablement, suspension, role change) delete session rows | D022; `SessionAuthenticationService`, `JdbcSessionRevoker` |
| Rate-limiter state (category 1) | In memory only, expired keys removed, all state lost on restart | D041; `docs/07_BACKEND_DEPLOYMENT.md` |
| Browser role hint | `sessionStorage`, cleared when the tab closes | `auth-api.ts` |

Nothing else is deleted automatically. The only other scheduler, `DemandFeedbackScheduler`, changes feedback and support statuses (D051) and deletes nothing.

### 2.2 Deletion paths a user or admin can trigger

| Action | Effect | Evidence |
|---|---|---|
| Comment author deletes own comment | Hard delete of the `demand_comment` row; `moderation_case.comment_id` becomes NULL, but `target_snapshot` keeps a copy of the text | D050; `DemandCommentService`; V14 `ON DELETE SET NULL` |
| Operator removes a school relationship | Deletes `operator_school` and cascades its coverage, offerings, and offering coverage; `demand_service_response.operator_school_id` becomes NULL | `OperatorSchoolService`; V5, V6, V8, V11 |
| Account disablement or operator suspension | Sets `is_enabled=false` and revokes sessions; deletes no data | D022, D056 |
| Response withdrawal, demand closure | Status changes only; rows and history stay | D049, D051, D053 |
| Vehicle removal | Deactivation only; no hard delete | D032 |

### 2.3 Data that is never deleted today

`app_user`, `operator_profile`, verification and reset tokens (only marked consumed), operator reviews and suspension reasons, demands, supports and reasons, feedback, lifecycle events, operator responses and publication events, reports, moderation cases and audit events, and in-app notifications (only marked read). `DemandStatus.ARCHIVED` exists, but no code sets it. APP-02 shipped account deletion and data requests as disabled.

### 2.4 Foreign-key constraints on erasing an account

Deleting an `app_user` row fails while any of these ten `ON DELETE RESTRICT` columns has a referencing row (V3, V10, V12, V14):

| Referencing column | Data |
|---|---|
| `operator_profile.user_id` | Operator profile |
| `email_verification_token.user_id`, `password_reset_token.user_id` | Tokens |
| `operator_application_review.reviewed_by` | Admin who reviewed |
| `demand.created_by` | Demand creator, shared with other supporters |
| `demand_support.parent_id` | Parent's support |
| `demand_comment.author_id` | Comment author |
| `content_report.reporter_id` | Reporter |
| `moderation_case.moderated_by`, `moderation_audit_event.moderator_id` | Admin moderation actions |

Only `in_app_notification.recipient_user_id` cascades. Erasing a person therefore needs a designed sequence: deletion, anonymization, or reassignment of each referencing row. A plain `DELETE` will not work. Designing that sequence is APP-11 ([#218](https://github.com/Atakan8479/ServisimiBul/issues/218)) after this record is approved.

### 2.5 Backups and logs

- **Logical exports.** The operations runbook's "minimum pilot policy" is an export before every approved migration and at least once per 24 hours while irreplaceable data exists. It also says retention deletion is a separately reviewed operation (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`). That is an operational recovery rule, not a legal retention period.
- **Existing export.** An encrypted pre-V9 export is held outside Git pending explicit deletion approval.
- **Supabase managed backups** depend on the plan. The last recorded plan was Free.
- **Logs** go to structured console output in `prod`. Their retention depends on the hosting provider, which is not selected (D042, LEG-04).

## 3. Retention and disposal matrix

For each category: the retention reason, deadline or trigger, disposal method, owner, and exceptions are `[PENDING]` until decided. The "PROPOSED trigger" column lists events the software already records that a rule could hang on, so a decision does not require new tracking. These triggers are options, not recommendations of any duration.

| LEG-02 cat. | Data | Retention reason | PROPOSED trigger (option) | Deadline | Disposal method | Technical constraint | Owner | Exceptions |
|---|---|---|---|---|---|---|---|---|
| 1 | IP in rate limiter | `[PENDING]` | Already in memory only | Restart or key expiry (verified) | Already automatic | None | `[PENDING]` | — |
| 2–3 | Account email, password hash, role | `[PENDING]` | Erasure request; prolonged inactivity (no last-login column exists today) | `[PENDING]` | `[PENDING]` delete or anonymize | Ten `RESTRICT` references (2.4) | `[PENDING]` | `[PENDING]` legal hold, open dispute |
| 4 | Verification and reset tokens | `[PENDING]` | `expires_at` or `consumed_at` already stored | `[PENDING]` | Delete (option) | None beyond `user_id` | `[PENDING]` | — |
| 5 | Sessions | Sign-in | Expiry (verified) | 30 min idle or 90 days absolute (D022) | Automatic delete (verified) | None | `[PENDING]` | — |
| 6 | Operator public profile | `[PENDING]` | Account erasure; long hidden or suspended state | `[PENDING]` | `[PENDING]` | Responses, reviews, vehicles reference the profile with `RESTRICT` | `[PENDING]` | `[PENDING]` |
| 7 | Reviews and suspension reasons | `[PENDING]` | Account erasure; time since decision | `[PENDING]` | `[PENDING]` | Admin `reviewed_by` is `RESTRICT` | `[PENDING]` | `[PENDING]` dispute about a suspension |
| 8 | Operator schools, coverage, vehicles, offerings | `[PENDING]` | Operator removal (partly verified, 2.2); account erasure | `[PENDING]` | `[PENDING]` | Vehicles have no hard delete (D032) | `[PENDING]` | — |
| 9, 9a | Demands, supports, reasons, lifecycle events | `[PENDING]` | Demand `CLOSED`/`ARCHIVED`; academic year end; parent erasure | `[PENDING]` | `[PENDING]`; a demand is shared by every supporter | `demand.created_by` is `RESTRICT`; `ARCHIVED` is unused | `[PENDING]` | `[PENDING]` other supporters' interest |
| 10 | Feedback | `[PENDING]` | `evaluated_at` or expiry already stored | `[PENDING]` | `[PENDING]` | Cascades from support and publication | `[PENDING]` | — |
| 11 | Operator responses and publication events | `[PENDING]` | Withdrawal; demand closure; operator erasure | `[PENDING]` | `[PENDING]` | `moderation_case.service_response_id` is `RESTRICT`; notifications cascade | `[PENDING]` | `[PENDING]` open moderation case |
| 12 | Public comments | `[PENDING]` | Author deletion (verified); demand closure; author erasure | `[PENDING]` | `[PENDING]` delete or detach author | `author_id` is `RESTRICT` | `[PENDING]` | `[PENDING]` open report |
| 13 | Content reports | `[PENDING]` | Case `RESOLVED`/`DISMISSED`; reporter erasure | `[PENDING]` | `[PENDING]` | `reporter_id` is `RESTRICT` | `[PENDING]` | `[PENDING]` dispute |
| 14 | Moderation cases, snapshots, audit | `[PENDING]` | Case resolution; deletion of the original content | `[PENDING]` | `[PENDING]`; see LEG-02 P5 | Snapshot outlives the comment; moderator columns are `RESTRICT`; audit is append-only by design | `[PENDING]` | `[PENDING]` legal hold, dispute |
| 15 | In-app notifications | `[PENDING]` | `read_at` or `created_at` already stored | `[PENDING]` | Delete (option) | Cascades from user and linked rows | `[PENDING]` | — |
| 16 | Account email messages | `[PENDING]` | Provider-side | `[PENDING: LEG-04]` | Provider-side | Not selected | `[PENDING]` | — |
| 17 | Logs | `[PENDING]` | Host retention setting | `[PENDING: LEG-04]` | Host-side | Host not selected | `[PENDING]` | `[PENDING]` incident (LEG-11) |
| 18 | Backups | `[PENDING]` | Backup age | `[PENDING]` | Expiry of the backup copy | See section 5 | `[PENDING]` | `[PENDING]` legal hold |

## 4. Response deadline versus technical erasure

These are two separate clocks and must not be merged into one number:

1. **Response deadline.** The time within which a data subject must receive an answer to a request. Its length, start, and handling belong to LEG-06 ([#199](https://github.com/Atakan8479/ServisimiBul/issues/199)); that issue's title refers to a 30-day process, which this record does not confirm.
2. **Technical erasure schedule.** When the data actually disappears from each place it lives. Section 2 shows these places differ:
   - **Live database rows:** `[PENDING: owner + counsel]`. Approving an erasure mechanism does not mean every row is deleted at once. The schedule depends on identity verification, assessment of the request, other people's rights in shared records, any lawful obligation to keep data, legal holds, and the approved disposal rules. APP-11 ([#218](https://github.com/Atakan8479/ServisimiBul/issues/218)) builds the approved erasure or anonymization mechanism with foreign-key-safe processing. APP-12 ([#219](https://github.com/Atakan8479/ServisimiBul/issues/219)) builds the approved retention schedules, controlled disposal, evidence, and recovery procedures.
   - **Sessions:** Spring Session JDBC schedules expired-session cleanup once per minute by default (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`). Physical deletion can be delayed by scheduler execution, application downtime, or database failures.
   - **Rate-limiter memory:** on restart or key expiry.
   - **Logs:** per host setting (LEG-04).
   - **Backups:** only when each backup copy expires or is destroyed.

The response deadline and these physical schedules are independent. An answer may, for example, report erasure from live data while copies remain in backups until a stated date. Whether such wording is acceptable, and when, is `[PENDING: counsel]`.

**Disposal evidence (PROPOSED, B).** Each erasure, anonymization, or scheduled disposal run records what was disposed (table and row count, not the data), when, by which job or administrator, by which method, and under which approved rule. The evidence itself must not copy the disposed personal data. Where and for how long this evidence is kept is `[PENDING]`. Implementation belongs to APP-12 ([#219](https://github.com/Atakan8479/ServisimiBul/issues/219)) and APP-07.

## 5. Backups, legal holds, shared records, and restore after erasure

**Backups (verified constraints).** Logical exports and managed backups are whole-database copies. A single person cannot be removed from them without restoring, editing, and re-exporting, which is a production operation that needs approval (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`). Options for the decision-makers:
- PROPOSED O1: let backups expire on a fixed, documented cycle, and state that cycle in the response.
- PROPOSED O2: keep the backup but block restoring erased data (O3).

The choice and the cycle length are `[PENDING]`.

**Restore after erasure (PROPOSED, O3).** After any restore, re-apply every erasure performed since the backup was taken, before the system serves users. This needs a durable list of erased subjects that is kept outside the backups. That list is itself personal data, and its content and retention are `[PENDING: counsel]`. The A-13 drill (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`) is the place to rehearse it once APP-12 implements it.

**Legal holds.** No mechanism exists. PROPOSED O4: a hold recorded by an administrator, with reason, scope, and date, that suspends disposal for named records until it is lifted. Whether holds are needed, who may set them, and their maximum duration are `[PENDING: owner + counsel]`.

**Shared records.** Several records belong to more than one person:
- a demand is shared by all of its supporters
- a comment thread mixes several authors
- a moderation snapshot copies one user's content into a case another user reported
- a report links a reporter to someone else's content

PROPOSED O5: erasing one person detaches or anonymizes that person's link and keeps the other people's records. For example, a demand stays for its other supporters, with the creator replaced. Whether this balances the other users' interests correctly is `[PENDING: counsel]`.

## 6. Reconciliation with AUDIT-F4 (#166)

#166 asked for retention, erasure/anonymization, and handling of shared records before any route, button, or cascade deletion was added. Section 2 confirms none was added: no erasure route exists, and the account page shows deletion as unavailable. #166 was closed without a retention or erasure policy on `main`. This record supplies the current-state analysis and the decision matrix only. Retention values, notice wording, and implementation remain with this issue's approval, LEG-05, LEG-06, APP-10, APP-11, and APP-12.

## 7. Open questions

| # | Question | Who answers |
|---|---|---|
| R1 | How long should each category in section 3 be kept, from which trigger, and is erasure or anonymization required? | Owner + counsel |
| R2 | Does any law require keeping some data (for example, moderation or suspension records) for a minimum time, overriding erasure? | Counsel |
| R3 | When one person is erased, how are shared records handled (O5)? | Owner + counsel |
| R4 | How are backups handled after an erasure (O1 or O2), and what cycle is stated to the data subject? | Owner + counsel |
| R5 | Are legal holds needed (O4), and who may set and lift them? | Owner + counsel |
| R6 | What disposal evidence is kept, where, and for how long? | Owner + counsel |
| R7 | Should `ARCHIVED` demands be used as a retention step, or removed? This is a product decision. | Owner |
| R8 | Must inactive accounts be disposed of? No last-login time is stored today, so this would need a schema change through Flyway after approval. | Owner + counsel |

## 8. Remaining risks

1. Data accumulates without limit: apart from sessions, nothing is ever disposed of (2.3).
2. A person cannot be erased today without a designed sequence, because of `RESTRICT` references (2.4).
3. Deleted comments persist in moderation snapshots (category 14; LEG-02 P5).
4. Backups would bring erased data back after a restore unless O3 or an equivalent is approved and built.
5. Log retention is unknown until a host is selected (LEG-04).

## 9. How to approve

Technical review and legal approval are separate steps that happen in separate PRs:

1. **Technical draft.** PR #229 may be merged as a technical documentation draft once its technical review passes. Merging it is not legal approval. This record keeps its `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED` status until the review in step 2 has actually happened.
2. **Owner and counsel review.** Counsel answers R2–R6 and R8 as applicable. The owner answers R1 with counsel, and R7.
3. **Recording decisions.** A later, separately reviewed PR fills section 1 and the `[PENDING]` cells in section 3, referencing evidence without committing privileged content. The same PR adds the approved `D0xx` entry to `docs/01_DECISIONS.md`, removes open question 6, and changes this record's status line. No date, reviewer, legal basis, retention period, or decision is recorded before it is actually given.
4. **Implementation gate.** APP-10, APP-11, and APP-12 may build safe, reversible scaffolding when their own issues allow it. They must not activate real erasure, anonymization, or retention-based disposal before the approved decision from step 3 exists (see open question 6 in `docs/01_DECISIONS.md`).
5. **Issue status.** Issue #196 stays open until its legal and operational acceptance criteria are met by recorded, reviewed answers.
