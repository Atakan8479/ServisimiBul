# LEG-07 — Account hiding, deactivation, suspension, erasure, and reactivation (decision record)

Issue: [#200](https://github.com/Atakan8479/ServisimiBul/issues/200). Depends on LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`), LEG-03 (`docs/20_RETENTION_AND_ERASURE.md`), and LEG-06 (`docs/23_DATA_SUBJECT_REQUESTS.md`). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not an approved lifecycle policy, and not a compliance claim. It separates four operations that are easy to confuse: hiding a public profile, voluntary deactivation, administrative suspension, and an erasure request. For each one it records what the software does today, and then lays out the transition matrix, record effects, and wording that the owner and qualified Turkish counsel must decide. It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision.

`AGENTS.md` forbids assuming final state names beyond approved ones. The state labels in section 4 are therefore **working labels for discussion**, not new domain states, enum values, or database statuses.

## 1. Decision summary

| Field | Value |
|---|---|
| Role and state transition matrix, including session effects and reactivation conditions | `[PENDING: owner + counsel]` — section 4 |
| Effects of each operation on demands, supports, comments, responses, reports, notifications | `[PENDING: owner + counsel]` — section 5 |
| Protected third-party records, irreversible steps, legal holds | `[PENDING: owner + counsel]`, with LEG-03 — section 6 |
| End-user wording for each operation | `[PENDING: counsel drafts, owner approves]` — section 7 |
| Whether and how an administrative suspension can be lifted | `[PENDING: owner]` |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. What the software does today (verified)

Verified against `main` at `3bd2ee6` on 2026-11-03 by reading `OperatorApplicationService`, `OperatorProfile`, `AppUser`, the demand, comment, discovery, and notification repositories, `AuthController`, the account settings page, and decisions D010, D024, D028, D038, D048–D053, D056.

| Operation | Exists? | Who | What happens | Reversible in the software? |
|---|---|---|---|---|
| **Hide public profile** | Yes, operators only | The operator, self-service | `operator_profile.is_publicly_visible=false`. The operator drops out of discovery, and their demand responses stop being shown, because the publication predicate requires visibility (D028, D049). Comments stay published; the public author label becomes `Servis işletmecisi` instead of the business name (D050), while the stored author link is unchanged. Login and sessions are unaffected. | Yes, the operator can turn visibility back on at any time |
| **Administrative suspension** | Yes, operators only | An ADMIN, with a required reason (D056) | `operator_profile.active=false` and `app_user.enabled=false`. A `SUSPENDED` review row stores the reason, admin, and time. Every session is revoked. The operator cannot log in, drops out of discovery, and their responses stop being shown. Existing comments stay published with the public label `Servis işletmecisi`; the stored author link is unchanged. Notifications and other rows are kept. | **No.** No code path sets `enabled` or `active` back to true, and no unsuspend endpoint exists. |
| **Suspension of a parent account** | No | — | Moderation acts only on content: hiding comments, withdrawing responses, closing demands (D053). No route disables a PARENT. If a parent account were disabled, its supports would stop counting (D048 queries require `enabled`), and it could no longer post comments. | — |
| **Voluntary deactivation** | No | — | Shown as disabled on the account page, "policy not yet approved" (APP-02). Implementation is APP-09 ([#216](https://github.com/Atakan8479/ServisimiBul/issues/216)). | — |
| **Erasure request** | No | — | Shown as disabled on the account page. A plain account delete is blocked by ten `ON DELETE RESTRICT` references (LEG-03 section 2.4). Implementation is APP-10 and APP-11. | — |
| **Session-only actions** | Yes | The user | Logout, sign out of all devices (APP-05), and password change (APP-04) revoke sessions without changing account state. | n/a |

Not lifecycle states: the approval statuses `DRAFT`, `PENDING`, `CHANGES_REQUESTED`, `APPROVED` (D024). D010 and D024 are explicit that a correction request is not a ban. When `OPERATOR_APPROVAL_REQUIRED=false`, they do not restrict access at all (D038).

## 3. Four distinct operations

| | Hide profile | Voluntary deactivation | Administrative suspension | Erasure request |
|---|---|---|---|---|
| Initiated by | Operator | Account holder | ADMIN | Data subject or representative (LEG-06) |
| Purpose | Stop public listing | Stop using the account | Protect users or the platform | Exercise a data right |
| Login afterwards | Allowed | `[PENDING]` | Blocked (verified) | Unchanged by submitting the request; the effect at each later stage is `[PENDING: owner + counsel]` (section 4.2) |
| Reversible | Yes (verified) | `[PENDING]` | `[PENDING]`; not possible in software today | The request may be withdrawn or rejected (`[PENDING: counsel]`); an executed erasure cannot be undone (LEG-03) |
| Who may reverse | Operator | `[PENDING]`; never the user if a suspension also applies | `[PENDING]`; never the suspended user | — |
| Same as data erasure? | No | No | No | **No.** A request starts a rights-handling process (LEG-06, APP-10). Data is disposed of only if the request is approved, and only to the approved extent. The outcome may be full, partial, or a reasoned rejection, for example where retention is legally justified (LEG-03, `[PENDING: counsel]`). |

PROPOSED: product wording and APP implementations keep these four separate. None of them is presented as another one. For example, "deactivate" must never be described as "delete my data", and confirming an erasure request must never say or imply that data has been, or will certainly be, deleted.

## 4. Transition matrix (PROPOSED, B)

All labels here are **working labels for discussion**. They are not approved names, enum values, or database statuses. The model has two separate parts:

- **Account restrictions** (4.1) are independent conditions that can apply at the same time: Hidden (operator profile flag), Deactivated, and Suspended. Lifting one never lifts another.
- **An erasure request** (4.2) is a separate rights-handling process. It does not change account restrictions by itself. Only an approved erasure execution changes the account.

### 4.1 Account restrictions

| Change | Triggered by | Sessions | Condition | Status |
|---|---|---|---|---|
| Hidden on / off | Operator | Kept | Showing again still needs every eligibility rule (D008) | Verified, exists |
| Suspension applied | ADMIN with reason | All revoked | — | Verified, exists (operators) |
| Suspension lifted | **ADMIN only**, through an explicit, recorded admin operation | — | PROPOSED: never by the suspended user, and never as a side effect of deactivation and reactivation, password reset, email change, login, or withdrawing an erasure request | Not implemented; whether it should exist is `[PENDING: owner]` (AQ1) |
| Deactivation applied | Account holder | PROPOSED: all revoked | Confirmation step; effects `[PENDING]` | Not implemented (APP-09) |
| Deactivation lifted | Account holder, through an explicit reactivation mechanism | — | PROPOSED: only if no suspension applies, and no erasure has been executed. The mechanism is `[PENDING: owner]`. | Not implemented |

**Login is not reactivation.** Ordinary authentication must never clear a restriction implicitly. Today a disabled account cannot log in at all, because authentication checks `enabled` (`AuthenticatedUser.isEnabled`), and that stays true even after a password reset. If a reactivation mechanism is approved, it must be a separate, explicit action that first checks every independent restriction. A suspension recorded by an admin is therefore never cleared by a deactivated user reactivating.

### 4.2 Erasure request process

| Working stage | Meaning | Account and session effect | Owner of the workflow |
|---|---|---|---|
| Request received | A request has arrived through an approved channel | None by itself. Receipt is not execution. | LEG-06, APP-07, APP-10 |
| Identity and authority verification | Requester and any representative verified | None by itself | LEG-06 RQ4 |
| Under review | Legal holds, retention exceptions (LEG-03 R2, O4), and third-party records (O5) assessed | `[PENDING: owner + counsel]`; for example, whether the account stays usable meanwhile | LEG-06, APP-10 |
| Approved erasure execution | The approved, foreign-key-safe sequence runs | `[PENDING: owner + counsel]`; session revocation timing needs an explicit approved rule | LEG-03, APP-11 |
| Outcome | Completed, partially fulfilled, rejected with reasons, or withdrawn before execution (`[PENDING: counsel]`) | Completed: the account no longer exists in usable form. Partial, rejected, or withdrawn: all existing restrictions stay exactly as they were. | APP-10 |

Rules for this process:
- **Receipt is not deletion.** A received or verified request is never described or treated as erasure execution.
- **No transitions from erased records.** Once an erasure has been executed, no process stage or restriction change applies to that account again. A new request concerns only whatever data remains, for example backups under LEG-03.
- **Withdrawal never reactivates.** Withdrawing or rejecting a request leaves any suspension, deactivation, or hidden flag unchanged. There is no route from this process back to an unrestricted account.
- **Restricted users keep their data rights.** A suspended or deactivated person can still submit and follow a request through an approved channel that does not need login, such as LEG-06 C1. Being locked out of the app must not lock them out of their rights.

**Suspended operators cannot restore access themselves.** This issue requires it. Today the software meets it trivially, because nothing reverses a suspension. Any future feature must keep it true. Suspension is recorded independently of deactivation and erasure requests, and every self-service flow checks it first. PROPOSED: before any reactivation, deactivation, or erasure feature ships, **negative tests** prove that a suspended operator cannot regain access through:
- self-reactivation
- deactivating and then reactivating
- password reset
- email change
- login
- withdrawing an erasure request

Whether a parent account can be suspended at all is `[PENDING: owner]`. Today only content moderation applies to parents.

## 5. Effects on records (PROPOSED, B, with verified current behavior)

"Today" is verified for hiding and operator suspension. The other columns are PROPOSED options. All are `[PENDING: owner + counsel]`.

| Record | Hide profile (today) | Operator suspension (today) | Voluntary deactivation (PROPOSED) | Executed erasure, if approved (PROPOSED, with LEG-03 O5) |
|---|---|---|---|---|
| Operator public profile | Not listed | Not listed | Not listed | Removed or anonymized |
| Operator demand responses | Hidden, rows kept | Hidden, rows kept | Hidden, rows kept | Detached from the person; history kept only if counsel allows |
| Comments by the person | Published with a generic public label; stored author link kept | Published with a generic public label; stored author link kept | `[PENDING]`: keep with a generic label, or hide | Deleted or detached; moderation snapshots per LEG-02 P5 |
| Parent demands created | — | — | Demand stays for other supporters | Creator detached; demand kept for other supporters |
| Parent supports | — | — | `[PENDING]`: stop counting, as when disabled (D048) | Removed; counts recalculated |
| Reports made by the person | Kept, private | Kept, private | Kept, private | Reporter detached; case kept (D053) |
| Moderation and suspension records about the person | Kept | Kept (reason, admin, time) | Kept | `[PENDING: counsel]`; may be a legal-hold or retention exception (LEG-03 R2) |
| In-app notifications | Kept | Kept | `[PENDING]` | Deleted (they cascade with the user) |
| Sessions | Kept | All revoked | All revoked | Timing `[PENDING: owner + counsel]` (section 4.2); none remain once the account is erased |

## 6. Protected third-party records, irreversible steps, legal holds

- **Third-party records.** Demands shared with other supporters, comment threads, reports about someone else's content, and moderation cases contain other people's data or interests. PROPOSED: no lifecycle operation deletes another person's record. It detaches or anonymizes only the acting person's link (LEG-03 O5). `[PENDING: counsel]`.
- **Irreversible steps.** Only an executed erasure is meant to be irreversible; a request is not. Suspension is irreversible today only because of a missing feature, not by design. The decision in section 1 settles which it should be.
- **Legal holds.** PROPOSED: a hold (LEG-03 O4) blocks erasure and disposal for the records it covers, but not hiding, suspension, or deactivation. Whether holds exist at all is LEG-03 R5.

## 7. End-user wording (requirements only, no text)

Wording is `[PENDING: counsel drafts, owner approves]` and must follow these PROPOSED rules:

- Each operation's screen says what it does and does not do, using section 3. For example, deactivation does not erase data, and hiding does not suspend login.
- A suspended operator sees that the account is suspended and how to contact the platform. They see no self-service way to reactivate. The contact route depends on LEG-06 RQ1.
- Erasure wording never promises instant or complete deletion. It follows LEG-03 section 4 and the APP-10 acceptance criteria.
- The Manus placeholders `[ACCOUNT_REACTIVATION_POLICY_PENDING]` and `[ACCOUNT_DEACTIVATION_EFFECTS_PENDING]` stay placeholders. They are filled only from the approved decision.

## 8. Reconciliation with AUDIT-F4 (#166)

#166 asked for erasure, anonymization, and shared-record handling to be defined before cascade deletion or new buttons were added. Section 2 confirms that none was added. Deactivation and deletion are shown as disabled. Suspension exists but cannot be reversed, and nothing deletes accounts. #166 was closed without a lifecycle policy on `main`. This record supplies the current state, the distinctions, and the decisions needed. Implementation remains with APP-09, APP-10, and APP-11 after approval.

## 9. Open questions

| # | Question | Who answers |
|---|---|---|
| AQ1 | Should an administrative suspension be reversible, by whom, and with what recorded reason? | Owner |
| AQ2 | Should voluntary deactivation exist, what does it do to each record in section 5, and is it reversible? | Owner + counsel |
| AQ3 | Can parent accounts be suspended, or does moderation stay content-only? | Owner |
| AQ4 | Should comments by a suspended or deactivated person stay published with a generic author, or be hidden? | Owner + counsel |
| AQ5 | Which suspension and moderation records must survive an erasure request, and for how long? (with LEG-03 R2) | Counsel |
| AQ6 | Can an erasure request be withdrawn before it is carried out? | Counsel |
| AQ7 | Approved wording for each operation's confirmation and status screens. | Counsel drafts, owner approves |

## 10. Remaining risks

1. Suspension is one-way in the software, so a mistaken suspension cannot be undone without a manual database change, which is itself a controlled production write.
2. A suspended or hidden operator's comments stay public. The public author label becomes the generic `Servis işletmecisi`, but this is not anonymization. The stored `demand_comment.author_id` still links each comment to the identifiable account, and the free-text body may itself identify the author or others (LEG-02 categories 12 and 14). Retention and erasure of these comments remain open (LEG-02 P5, LEG-03 R1, AQ4).
3. Parents cannot be suspended, so moderation of an abusive parent is limited to their content.
4. Without an approved matrix, a future reactivation feature could accidentally let a suspended operator back in.

## 11. How to approve

1. **Technical draft.** The PR that adds this record may be merged after technical review. Merging is not legal approval, and the status line stays `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`.
2. **Owner and counsel review.** The owner answers AQ1 and AQ3. Counsel answers AQ5 and AQ6. Both answer AQ2 and AQ4, and counsel drafts AQ7 for the owner's approval.
3. **Recording decisions.** A later, separately reviewed PR fills section 1, adds the approved `D0xx` entry with any new state names to `docs/01_DECISIONS.md`, removes the matching open question, and changes this record's status line. No state name, transition, or wording is treated as approved before it is.
4. **Implementation gate.** APP-09, APP-10, and APP-11 may build safe, reversible scaffolding when their issues allow it. No deactivation, reactivation, or erasure is enabled for real users before step 3, and the test from section 4 must pass first.
5. **Issue status.** Issue #200 stays open until its acceptance criteria are met by recorded, reviewed answers.
