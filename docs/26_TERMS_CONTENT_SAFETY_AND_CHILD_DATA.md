# LEG-08 — Terms of use, content safety, and child-data minimization (decision record)

Issue: [#201](https://github.com/Atakan8479/ServisimiBul/issues/201). Depends on LEG-01 (`docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md`) and LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`). Uses LEG-03, LEG-06, and LEG-07. Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not terms of use, not a content policy in force, and not a compliance claim. It records what the product does today about service claims, user content, moderation, and children's data. It then sets out the structure that the owner and qualified Turkish counsel must fill: terms, a content policy, moderation and complaint guidance, and platform responsibility boundaries. **It contains no terms or policy text.** It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision.

The consolidated tracker (`docs/25_LEGAL_APPROVAL_TRACKER.md`) covers LEG-01 to LEG-07 only. LEG-08 keeps its own issue and this record, and its pending items are listed in section 9.

## 1. Decision summary

| Field | Value |
|---|---|
| Terms of use text | `[PENDING: counsel drafts, owner approves]` |
| Content policy and moderation/complaint guidance | `[PENDING: counsel drafts, owner approves]` |
| Platform responsibility boundaries | `[PENDING: counsel]`, based on LEG-01 L3, L4, L7 |
| Notice to affected users and appeal route for moderation actions | `[PENDING: owner + counsel]` |
| Additional child-data safeguards | `[PENDING: owner]`, with LEG-02 P4 |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. What the product does today (verified)

Verified against `main` at `e5623d1` on 2026-11-03 by reading decisions D009, D012–D015, D043, D049–D053, the moderation package, notification types, and frontend pages.

### 2.1 Terms and service claims

- **No terms of use, content policy, or community rules exist**, and no page links to one. Registration has no acceptance step (LEG-05 section 5).
- **Service claims come from operators.** Profiles, descriptions, offerings, and demand responses are entered by operators. The platform does not verify vehicles, drivers, licenses, prices, or routes. Operator and driver need not be the same person (D011, D031).
- **Existing product disclaimers** (Turkish UI text, not legal text):
  - discovery results say a neighborhood match is not an address guarantee (`PublicDiscoveryPage.tsx`)
  - the demand board says a listing is not a service guarantee (`DemandBoardPage.tsx`)
  - the response form says shared details are not an exact price or free-seat guarantee (`DemandServiceResponseForm.tsx`)
  - responses are defined as availability declarations, not capacity, price, route, or service guarantees (D049)
  - tariffs are official UKOME bands, not quotes (D012, D013)

### 2.2 User-generated content

| Surface | Who | Public? | Limits | Evidence |
|---|---|---|---|---|
| Demand comments | Supporting parents, eligible operators | Yes | 2–1000 chars; duplicate and rate limits; parents shown as `Veli` | D050 |
| Operator profile and offering descriptions | Operators | Yes, when eligible | Trimmed; no length limit found in validation | LEG-02 section 5 |
| Demand responses | Eligible operators | Yes | Morning/afternoon flags only | D049 |
| Content reports | Parents, operators | No | Six fixed reasons; optional 2–500-char explanation | D053 |

### 2.3 Moderation (D053)

- **Reporting** never changes visibility by itself. Report reasons: `ABUSE_HARASSMENT`, `HATE_DISCRIMINATION`, `PERSONAL_DATA`, `SPAM_ADVERTISING`, `MISLEADING_SERVICE`, `OTHER` (`ReportReason.java`).
- **Only ADMIN acts**, with a required reason and an append-only audit event. The actions are `MARK_IN_REVIEW`, `DISMISS`, `RESOLVE_NO_ACTION`, `HIDE_COMMENT`, `RESTORE_COMMENT`, `WITHDRAW_SERVICE_RESPONSE`, `SUSPEND_OPERATOR`, and `CLOSE_DEMAND` (`ModerationAction.java`).
- **Nobody is told the outcome.** The only moderation notification is `CONTENT_REPORTED`, which goes to admins (`NotificationType.java`; LEG-02 category 15). The reporter and the affected author are not notified.
- **No appeal or complaint route exists** for an author whose comment was hidden, an operator whose response was withdrawn, or a suspended operator (LEG-07 section 2).
- **No general pre-approval and no automated detection** (D050, D053).

### 2.4 Children's data

- **No structured student data.** No form asks for a student's or child's name, school class, home address, health information, or route (D015; LEG-02 section 5). Demands use only school, pickup neighborhood, academic year, morning/afternoon flags, and fixed reason codes (D048). Discovery uses school and neighborhood, never an address.
- **Warnings exist on some surfaces:**
  - the comment form (`DemandComments.tsx`) warns against student names, phone numbers, and full addresses
  - the demand detail page and demand board add health information to that list (`DemandDetailPage.tsx`, `DemandBoardPage.tsx`)
  - the report form (`ReportControl.tsx`) warns against student names, full addresses, and phone numbers
  - the operator profile description hint asks operators not to add student or family information (`OperatorProfilePage.tsx`)
- **No guidance on offering descriptions.** The service offering description field has no hint (`OperatorOfferingsPage.tsx`). Both description fields are public and have no length limit in validation.
- **Content persists in moderation.** Moderation snapshots keep copies of reported content after the author deletes it (LEG-02 P5).

## 3. Platform responsibility boundaries (C)

Whether ServisimiBul is a discovery service or something more is LEG-01 L3, and is `[PENDING: counsel]`. The terms must state the boundaries that counsel approves. The facts they will rest on are in section 2.1 and LEG-01 section 2. PROPOSED topics the terms must cover, with no wording here:

1. What the platform does (discovery, demand coordination, official tariff reference) and does not do (no booking, payment, vehicle operation, or verification of operators), per LEG-01 section 2.
2. Operators' responsibility for their own claims and service, per LEG-01 L4.
3. Users' responsibility for what they post, and what may not be posted (section 4).
4. How reports and moderation work, and how to complain (section 4).
5. The relationship to the privacy notices (LEG-05) and data rights (LEG-06), without merging them.

## 4. Content policy and moderation guidance (PROPOSED, B)

**Prohibited-content categories.** PROPOSED: these align with the existing report reasons, so users, reporters, and admins share one vocabulary:
- abuse and harassment
- hate and discrimination
- personal data, especially children's data
- spam and advertising
- misleading service claims
- other unlawful content, as counsel defines

The approved definitions are `[PENDING: counsel]`.

**Admin moderation guidance.** PROPOSED internal guidance, for owner approval:
- comments containing a child's name, address, health details, or route are hidden with reason `PERSONAL_DATA`
- misleading operator claims are handled with `WITHDRAW_SERVICE_RESPONSE` or `SUSPEND_OPERATOR`, according to severity
- every action records a reason, as already required by D053

**Notice and complaint.** `[PENDING: owner + counsel]`. Options:
- tell the affected author or operator about the action and its reason
- tell the reporter the outcome
- offer a review or complaint route

The complaint route may use the LEG-06 channel or a separate one.

Timelines for reviewing reports are `[PENDING: owner]`. No automated detection or pre-approval is proposed; that stays LEG-02 P4.

## 5. Child-data minimization safeguards

| Safeguard | State | Next step |
|---|---|---|
| No structured fields for student identity, address, health, or route | Verified (D015, D048) | Keep; any new field needs a LEG-02 update first |
| Warning on the comment form, demand pages, report form, and operator profile description | Verified | Wording review with LEG-05 notices `[PENDING]` |
| Guidance on the service offering description | Missing | PROPOSED: add equivalent guidance; implementation is a separate APP task after approval |
| Admin guidance to hide child data under `PERSONAL_DATA` | Not written | PROPOSED in section 4 |
| Removal of child data from moderation snapshots | Not decided | LEG-02 P5, LEG-03 |
| Automated detection of names, addresses, or phone numbers | Deferred by D050 | LEG-02 P4, owner decision |

These are discouragement and response measures. They do not guarantee that such data is never entered (LEG-05 section 3).

## 6. Moderation and deletion versus data-subject erasure

| Operation | Who | What happens | Is it erasure? |
|---|---|---|---|
| Author deletes own comment | Comment author | Row hard-deleted; moderation snapshot remains (D050, LEG-03 section 2.2) | No. It is a product action, not a rights request. |
| Admin hides a comment | ADMIN | `HIDDEN`, restorable; audit kept (D053) | No. Content moderation; data kept. |
| Admin withdraws a response or closes a demand | ADMIN | Status change; history kept | No |
| Admin suspends an operator | ADMIN | Account disabled; data kept (LEG-07) | No |
| Erasure request | Data subject or representative | Rights process: review, then approved execution or a reasoned outcome (LEG-06, LEG-07 section 4.2, LEG-03) | Yes, if approved and carried out |

PROPOSED: the terms and every moderation screen use wording that keeps these apart. A hidden comment is never described as deleted, and an author deletion is never described as erasure of the author's data.

## 7. Reconciliation with AUDIT-F4 (#166)

#166 covered KVKK inventory, notices, retention, erasure, and rights, but not terms or content policy. The moderation and audit records it inventoried are covered in LEG-02 categories 13 and 14. No terms, content policy, or appeal process exists on `main` (section 2), so its closure did not provide one. This record supplies the current state and the structure needed.

## 8. Open questions

| # | Question | Who answers |
|---|---|---|
| TQ1 | Approved terms of use, in Turkish, with platform responsibility boundaries | Counsel drafts, owner approves; depends on LEG-01 L3, L4, L7 |
| TQ2 | Approved content policy definitions for each prohibited category | Counsel drafts, owner approves |
| TQ3 | Must affected authors, operators, or reporters be told about moderation actions and outcomes? | Owner + counsel |
| TQ4 | Is a review or complaint route needed for moderation actions and suspensions, and through which channel? | Owner + counsel, with LEG-06 RQ1 and LEG-07 AQ1 |
| TQ5 | Is a separate acceptance step needed for the terms, or is a linked notice enough? | Counsel, with LEG-05 NQ4 |
| TQ6 | Should the offering description get child-data and personal-data guidance, and should existing hints be aligned (section 5)? | Owner |
| TQ7 | Internal moderation guidance and report-review timelines (section 4) | Owner |

## 9. Remaining risks

1. Users currently post without any terms or content rules.
2. Moderated users and reporters are not told the outcome, and have no way to complain.
3. Operator profile and offering descriptions are public and unbounded, and the offering description carries no guidance.
4. Child data can enter free text, and moderation snapshots keep copies (LEG-02 P5).
5. Platform responsibility cannot be stated until LEG-01 L3 and L4 are answered.

## 10. How to approve

1. **Technical draft.** The PR that adds this record may be merged after technical review. Merging is not legal approval, and the status line stays `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`.
2. **Owner and counsel review.**
   - Counsel drafts TQ1 and TQ2 for the owner's approval, and answers TQ5.
   - The owner answers TQ6 and TQ7.
   - The owner and counsel answer TQ3 and TQ4 together.
   - Counsel review is required for every item except TQ6 and TQ7.
3. **Recording decisions.** A later, reviewed change records:
   - an approved `D0xx` entry in `docs/01_DECISIONS.md`
   - removal of the matching open question
   - an update to this record's status line
   
   No terms text, policy text, date, or reviewer is recorded before it is actually given.
4. **Implementation gate.** Terms and policy pages (APP-01), notices to affected users, complaint routes, and description warnings may be scaffolded with clearly non-final placeholders that real users never see. Publishing terms or policy text, or presenting a complaint route as working, requires the approved decision from step 3.
5. **Launch.** LEG-08's applicable requirements must be reviewed before any real-user pilot (tracker section 5, LEG-01 L8).
6. **Issue status.** Issue #201 stays open until its acceptance criteria are met by recorded, reviewed answers.
