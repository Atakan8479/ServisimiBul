# LEG-05 — Role-specific privacy notice requirements (decision record)

Issue: [#198](https://github.com/Atakan8479/ServisimiBul/issues/198). Depends on LEG-01 (`docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md`), LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`), and LEG-04 ([#197](https://github.com/Atakan8479/ServisimiBul/issues/197), not yet started). It also uses LEG-03 (`docs/20_RETENTION_AND_ERASURE.md`). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

**This document contains no privacy notice text.** It defines which notices are needed, where each one appears, what each must contain, and how versions are owned and published, so that counsel can draft and approve the actual wording. Nothing here may be copied into the product as a notice. It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision and makes no compliance claim.

## 1. Decision summary

| Field | Value |
|---|---|
| Approved notice text for each context in section 2 | `[PENDING: counsel drafts, owner approves]` |
| Data controller and contact route stated in the notices | `[PENDING: LEG-01 L1, L2]` |
| Lawful basis per purpose | `[PENDING: LEG-02 P1]` |
| Recipients and international transfers | `[PENDING: LEG-04]` |
| Retention statements | `[PENDING: LEG-03 R1]` |
| Rights and how to exercise them | `[PENDING: LEG-06]` |
| Whether any processing needs explicit consent | `[PENDING: counsel]` — section 5 |
| Notice owner and publication procedure | `[PENDING]` — PROPOSED in section 4 |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. Notice contexts and where they appear

Each context is a group of people whose data is processed in a recognizably different way. The LEG-02 category numbers show which data each notice must cover. "Screens" lists the existing routes (`servisimibul-frontend/src/app/router.tsx`) where a link to the notice would be shown; the placement is PROPOSED and implementing it is APP-01 ([#208](https://github.com/Atakan8479/ServisimiBul/issues/208)).

"LEG-02 categories" lists the data processed **about** the people in each context. A context covers people who are the subject of a record even when they cannot access it.

| # | Context | Who | LEG-02 categories | Screens (PROPOSED placement) | Existing in-product text (verified, not a notice) |
|---|---|---|---|---|---|
| N1 | Visitor | Anyone using public search, demand board, or demand pages without an account | 1, 17. Visitors also read third-party data (operator profiles 6, responses 11, comments 12). That data is about operators and authors and belongs to N2, N3, and N5, not to the visitor. | Public footer on every `PublicLayout` page | Footer links only to home, demand board, and the two registration pages (`layouts.tsx`) |
| N2 | Parent account | Parents who register, create or support demands, comment, report, or give feedback | 1–5, 9, 9a, 10, 12, 13, 14, 15, 16, 17, 18 | `/parent/register` before submission, `/parent/account`, footer | `/parent/register` says a parent account is not needed for searching and is used only for demands and notifications (`AuthPages.tsx`, `ParentSignupPage`) |
| N3 | Operator account and public profile | Operators, including individuals, and anyone named in their profile | 1–8, 11, 12, 13, 14, 15, 16, 17, 18 | `/operator/register` before submission, `/operator/profile`, `/operator/account`, footer | `/operator/register` says the phone and shared business information may be visible to visitors (D043, `RegisterPage`); `/operator/profile` labels the phone as public and explains the visibility toggle (`OperatorProfilePage.tsx`) |
| N4 | Reporting | Reporters, and people whose content is reported | 13, 14, 15 | The report form (`ReportControl.tsx`) next to the submit action | The form warns against writing a student name, full address, or phone number |
| N5 | Public comments | Comment authors, and people they mention | 12, 14 | The comment form on demand pages (`DemandComments.tsx`) | The form explains parent pseudonyms and warns against sharing student names, phone numbers, or full addresses; the demand board and detail page repeat similar guidance |
| N6 | Administration | Administrators, and every user whose data administrators see in reviews, moderation, and audit | Administrators' own: 2, 3, 5, 15, 17, 18. Data administrators record or see about others: 7, 13, 14 | Admin area for administrators; the moderation part also belongs in N2–N5 | None |
| N7 | Account emails | Recipients of verification and password-reset emails, once delivery is enabled | 2, 4, 16 | Inside or linked from each email template | Delivery is disabled until `SB_MAIL_*` is configured |

Whether N4–N7 are separate notices or sections of N1–N3 is `[PENDING: counsel]`. The table only makes sure no context is forgotten.

**Moderation records (category 14).** A moderation case can hold data about several people:
- the author of the reported content, through `target_snapshot`, which keeps a copy even after the author deletes the comment
- the reporter, through the linked `content_report`
- a person named in the reported content
- the administrator, through `moderated_by`, `decision_reason`, and the audit events

That is why category 14 appears in N2, N3, N4, N5, and N6. Being covered by a notice context does not mean direct access. Only administrators can read moderation cases, and reporter identity is excluded even from administrator responses (D053; LEG-02 categories 13 and 14).

**Public operator phone.** The issue requires a clear explanation of operator phone visibility. The facts the notice must reflect are in LEG-02 category 6 and in D028, D037, and D043:
- an eligible profile is public by default, and the operator can hide it
- the phone is the only public contact channel
- an operator may be an individual

How the notice explains this, and whether D043's current registration sentence is sufficient, is `[PENDING: counsel]`.

## 3. Required content per notice

The issue lists seven elements. Each one depends on a decision that is not yet made:

| Element | Source of the answer | Status |
|---|---|---|
| Data controller identity | LEG-01 L1 | `[PENDING]` |
| Processing purposes | LEG-02 section 4 "Product function" describes what the code does. The declared legal purpose is decided here. | `[PENDING: counsel]` |
| Legal grounds | LEG-02 P1 | `[PENDING]` |
| Collection method | LEG-02 "Source" column (verified: from the user, generated, or copied by the system) | Facts ready; wording `[PENDING]` |
| Recipients and transfers | LEG-02 "Visible to" column for in-product recipients; LEG-04 for vendors, regions, and transfers | In-product facts ready; vendors `[PENDING: LEG-04]` |
| Rights | LEG-06 | `[PENDING]` |
| Contact route | LEG-01 L2, LEG-06, APP-06 | `[PENDING]`. No monitored channel exists today. |

PROPOSED: the notice also states retention in line with LEG-03 once approved, and accurately describes children's data. The technical facts for counsel are below; they are not user-facing wording:

- The application does not request or maintain structured student records or dedicated home-address fields (D015).
- User-generated free text may still contain personal information about children or other individuals, for example in comments, operator and offering descriptions, report explanations, and moderation snapshots that are kept after the original is deleted (LEG-02 section 5).
- The existing warnings and post-publication moderation reduce this but do not guarantee that such information is never entered or stored.

How the notice describes this, and whether special-category data needs particular safeguards (LEG-02 P1, P4), is `[PENDING: counsel]`.

## 4. Versions, publication, and ownership (PROPOSED, B)

None of this exists today. PROPOSED for the owner's decision:

- **One file per approved notice version** in the repository, with a version identifier, effective date, owner, and the reviewer reference from section 1. Git history then serves as the change history. Implementation is APP-01.
- **Screens link to a version, not to copied text.** Each screen in section 2 links to the current version of its notice, so changing a notice never requires editing several components.
- **Change history visible to users.** Each published notice shows its effective date and links to its earlier versions.
- **A notice change goes through a reviewed PR**, carries counsel's evidence reference, and is recorded in `docs/06_PROGRESS.md`.
- **No per-user acknowledgement record** unless counsel decides one is necessary (see the delivery evidence subsection below, and section 5 for consent). A notice informs; it is not something the user accepts.

Who owns notice maintenance after launch is `[PENDING]`.

### PROPOSED — Notice delivery evidence

Showing that a notice was published and showing that it was made available to the right people are separate questions. PROPOSED evidence levels, for the owner and counsel to choose from:

1. **Publication evidence.** That a given notice version existed and was in force: version identifier, effective and publication dates, the approving review reference, and the PR or release that published it.
2. **Presentation evidence.** That the relevant notice was available at the right point of each user journey: a version-to-screen mapping (section 2), the processing context each screen covers, and release or deployment evidence showing which version each screen linked to over time. It needs no data about individual users.
3. **Individual-level evidence.** A minimal record that a specific person was shown a specific version, kept only if counsel decides it is necessary for a specific processing. Nothing here assumes it is required.

The evidence model, where it is stored, who can access it, and how long it is kept are `[PENDING: owner + counsel]`. Nothing in this subsection adds tracking, database tables, API endpoints, or mandatory checkboxes. Showing or delivering a notice does not by itself establish explicit consent (section 5).

## 5. Transparency is not consent

Verified facts:
- Neither registration form has a consent or "I accept" checkbox; the only checkbox on the authentication pages is "remember me" on login (`AuthPages.tsx`).
- D043 explicitly decided that registration needs no separate acknowledgement or publication-confirmation step.
- No analytics, advertising, or marketing processing is implemented (LEG-02 section 3).

That last fact rules out only those specific processing types. It does not settle whether any other processing needs consent. The lawful basis has to be assessed for each processing purpose under LEG-02 P1, including the open question of publishing an individual operator's phone (LEG-02 P2). This record assumes neither that consent is needed nor that it is not.

PROPOSED: notices are shown as information, with links, and never as an unnecessary mandatory checkbox. A consent mechanism is added only for a specific processing that counsel identifies as requiring explicit consent, and it is kept separate from notice delivery (section 4). Cookies and marketing belong to LEG-09 ([#202](https://github.com/Atakan8479/ServisimiBul/issues/202)). Whether any current processing needs explicit consent is `[PENDING: counsel]`.

## 6. Existing in-product guidance is not a notice

The texts listed in section 2 tell users how the product behaves and what not to share. They are product decisions (for example D043) and safety guidance. They do not identify a controller, a legal basis, recipients, retention, or rights, so they do not replace a notice. The account page shipped personal-data features as disabled and states no notice (APP-02). Until approved notices exist, PROPOSED: no screen says or implies that a privacy notice is available.

## 7. Reconciliation with AUDIT-F4 (#166)

#166 asked for a counsel-reviewed Turkish KVKK notice. No notice text, legal page, or footer link exists on `main` (LEG-01 section 2; this record, section 2), so its closure did not deliver one. This record defines the notice contexts, content, and publication model. The approved wording remains open here; publishing it is APP-01.

## 8. Open questions

| # | Question | Who answers |
|---|---|---|
| NQ1 | How many separate notices are needed, and which of N1–N7 can be combined? | Counsel |
| NQ2 | Approved wording for each notice, in Turkish, plus whether an English version is needed. | Counsel drafts, owner approves |
| NQ3 | Is D043's registration sentence about the public phone sufficient, or must the operator see the full notice before registering? | Counsel |
| NQ4 | Does any current processing require explicit consent (section 5)? | Counsel |
| NQ5 | Who maintains notices after launch, and what triggers a review (for example a new LEG-02 category or a new vendor)? | Owner |

## 9. Remaining risks

1. No notice can be completed until LEG-01 L1/L2, LEG-02 P1, LEG-04, and LEG-06 are decided. LEG-04 has not started.
2. Real users currently see product guidance but no notice (section 6).
3. Individual operators publish personal phone numbers based on a product disclosure that is not a reviewed notice (section 2).
4. Without a version model, notice changes would not be traceable (section 4).

## 10. How to approve

1. **Technical draft.** The PR that adds this record may be merged after technical review. Merging is not legal approval, and the status line stays `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`.
2. **Owner and counsel review.** Once LEG-01, LEG-02, LEG-04, and LEG-06 answers exist, counsel drafts the notices and answers NQ1–NQ4; the owner answers NQ5 and approves the wording.
3. **Recording decisions.** A later, separately reviewed PR fills section 1, adds the approved `D0xx` entry to `docs/01_DECISIONS.md`, removes the matching open question, and changes this record's status line. No date, reviewer, notice text, or decision is recorded before it is actually given.
4. **Implementation gate.** APP-01 may build the page structure and links with clearly non-final placeholders that are never shown to real users. Publishing notice text requires the approved decision from step 3.
5. **Issue status.** Issue #198 stays open until its acceptance criteria are met by approved text and recorded decisions.
