# Legal approval tracker — LEG-01 to LEG-07

Status: **TRACKING DOCUMENT — NO DECISION IN IT IS APPROVED.**

This tracker gathers every legal and product-policy decision that LEG-01 to LEG-07 left open, so the owner and qualified Turkish counsel can work through them in one place. It is a checklist and index only. The questions, facts, and options stay in the seven technical records; this file does not repeat them and does not replace legal review.

**Technical completion is not legal approval.** All seven records were merged as technical drafts, and each one still says `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`. A closed issue or a merged documentation PR is not evidence that any decision below has been made. Repository ownership is not evidence of legal responsibility either: who the data controller is remains LEG-01 L1.

Out of scope: LEG-08 to LEG-11 (#201–#204) are still open issues and are not tracked here.

## 1. Sources

| Area | Issue | Merged technical PR | Record | Open question in `docs/01_DECISIONS.md` |
|---|---|---|---|---|
| LEG-01 Data controller and platform role | [#194](https://github.com/Atakan8479/ServisimiBul/issues/194) | [#227](https://github.com/Atakan8479/ServisimiBul/pull/227) | `docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md` | 4 |
| LEG-02 Personal data map and legal bases | [#195](https://github.com/Atakan8479/ServisimiBul/issues/195) | [#228](https://github.com/Atakan8479/ServisimiBul/pull/228) | `docs/19_PERSONAL_DATA_PROCESSING_MAP.md` | 5 |
| LEG-03 Retention, erasure, backups, holds | [#196](https://github.com/Atakan8479/ServisimiBul/issues/196) | [#229](https://github.com/Atakan8479/ServisimiBul/pull/229) | `docs/20_RETENTION_AND_ERASURE.md` | 6 |
| LEG-04 Vendors and international transfers | [#197](https://github.com/Atakan8479/ServisimiBul/issues/197) | [#233](https://github.com/Atakan8479/ServisimiBul/pull/233) | `docs/22_VENDORS_AND_TRANSFERS.md` | 8 |
| LEG-05 Privacy notices | [#198](https://github.com/Atakan8479/ServisimiBul/issues/198) | [#231](https://github.com/Atakan8479/ServisimiBul/pull/231) | `docs/21_PRIVACY_NOTICE_REQUIREMENTS.md` | 7 |
| LEG-06 Data subject requests | [#199](https://github.com/Atakan8479/ServisimiBul/issues/199) | [#235](https://github.com/Atakan8479/ServisimiBul/pull/235) | `docs/23_DATA_SUBJECT_REQUESTS.md` | 9 |
| LEG-07 Account lifecycle | [#200](https://github.com/Atakan8479/ServisimiBul/issues/200) | [#236](https://github.com/Atakan8479/ServisimiBul/pull/236) | `docs/24_ACCOUNT_LIFECYCLE_POLICY.md` | 10 |

Issue states on 2026-11-03: #194–#199 closed after their technical PRs merged; #200 reopened. This tracker does not change any issue.

## 2. Approval workflow

### 2.1 Where the work happens

This tracker's Draft PR ([#237](https://github.com/Atakan8479/ServisimiBul/pull/237)) is the single working place for the pending LEG-01 to LEG-07 approvals.

- Owner evidence and counsel decisions are added to this same PR as reviewed commits. This PR is the "later, separately reviewed PR" that the approval sections of the seven source records refer to.
- Parallel PRs that change the same pending decision records are avoided unless explicitly necessary.
- The PR stays Draft until the consolidated approval process is complete, or until the owner decides to merge part of it.
- Merging the PR, in whole or in part, never authorizes a production feature by itself. Activation still needs its own release gate (section 5, stage 6).

### 2.2 Decision types

The "Who decides" column in section 3 follows each source record. It sets which review stages apply:

| Type | Stages that apply | IDs |
|---|---|---|
| **Owner-only** (product or factual decisions) | Owner evidence or decision, then recording and release gate. No counsel review is required unless the owner or counsel finds a legal implication. | L6, P4, R7, V1–V6, VQ1, VQ4, NQ5, AQ1, AQ3, B1–B4, the LEG-06 service level |
| **Counsel** (legal opinions) | Counsel opinion, owner acceptance, recording, release gate | L3, L4, L7, P1–P3, V7, V8 (VQ2, VQ3), R2, NQ1, NQ3, NQ4, RQ2, RQ3, AQ5, AQ6 |
| **Joint** (owner supplies or decides; counsel reviews or drafts) | All stages | L1, L2, L5, L8, P5, R1, R3–R6, R8, VQ5, NQ2, RQ1, RQ4–RQ7, AQ2, AQ4, AQ7, and the unnumbered items in section 3 |

Counsel review is never skipped for a Counsel or Joint item. Owner-only items are not held back waiting for counsel.

### 2.3 Stages

A stage counts as complete only when its evidence is recorded. Nothing is inferred from earlier stages.

1. **Technical inventory completed.** Done for all seven areas: the records are merged.
2. **Owner evidence or decision.** Facts or product choices only the owner can provide, such as the controller's identity, vendor regions, or the monitoring person.
3. **Qualified Turkish counsel review** (Counsel and Joint items only). A dated written opinion or equivalent. The tracker cites a reference to it; privileged content is never committed.
4. **Owner approval.** The owner accepts the decision or the reviewed answer.
5. **Decision recorded.** Only after actual authorization, a reviewed commit (in this PR, per 2.1):
   - adds a `D0xx` entry to `docs/01_DECISIONS.md`
   - removes or narrows the open question
   - updates the source record's status line
   - sets the row here to `APPROVED` with the evidence reference, the reviewer's identity where counsel was involved, and the date

   Nothing is marked approved without all three.
6. **Release gates reviewed and authorized.** The dependent APP issues are checked against the recorded decision, and any production activation is explicitly authorized (section 5).

Status values used below: `PENDING` (stages 2–5 not complete), `EVIDENCE SUPPLIED`, `COUNSEL REVIEWED`, `APPROVED` (stage 5 recorded). Every item is `PENDING` today.

## 3. Decision status

"Who decides" and "Evidence needed" summarize the source record. The record itself is authoritative.

### LEG-01 — Data controller and platform legal role

| ID | Decision | Who decides | Evidence needed | Status |
|---|---|---|---|---|
| L1 | Identity of the data controller | Owner supplies; counsel reviews | Legal name and registration details | `PENDING` |
| L2 | Controller's public contact details and monitored channel | Owner supplies; counsel reviews disclosure | Postal address and a monitored channel | `PENDING` |
| L3 | Platform's legal role for the current MVP | Counsel | Written opinion on the section 2 facts | `PENDING` |
| L4 | Operators' responsibilities and personal-data roles | Counsel | Written opinion | `PENDING` |
| L5 | Audience and minimum age | Owner + counsel | Policy statement; how it is shown without over-collection | `PENDING` |
| L6 | Whether the pilot is free in every respect | Owner | Statement of any fees or plans | `PENDING` |
| L7 | Which regimes apply (KVKK, 5651, 6502, 6563, ETBIS) | Counsel | Per-regime outcome in the record's section 4 | `PENDING` |
| L8 | Real-user pilot eligibility | Owner + counsel, then a release decision | Recorded decision with conditions, after reviewing the applicable outstanding requirements of LEG-08 to LEG-11 and the QA and release gates (section 5) | `PENDING` |
| B1–B4 | PROPOSED interim safeguards | Owner | Adopt, change, or reject | `PENDING` |

### LEG-02 — Personal data map and legal bases

| ID | Decision | Who decides | Evidence needed | Status |
|---|---|---|---|---|
| P1 | Lawful basis per category (Art. 5, or Art. 6 for special categories) | Counsel | Per-category opinion | `PENDING` |
| P2 | Basis for publishing an individual operator's phone | Counsel | Opinion | `PENDING` |
| P3 | Each system's controller or processor role | Counsel, with LEG-04 | Opinion after V1–V6 | `PENDING` |
| P4 | Stronger controls for free-text fields | Owner | Product decision | `PENDING` |
| P5 | Moderation snapshots after the original is deleted | Owner + counsel, with LEG-03 | Decision | `PENDING` |

### LEG-03 — Retention, erasure, backups, legal holds

| ID | Decision | Who decides | Evidence needed | Status |
|---|---|---|---|---|
| R1 | Retention period, trigger, and erase-or-anonymize per category | Owner + counsel | Completed section 3 matrix | `PENDING` |
| R2 | Legal obligations to keep data despite erasure | Counsel | Opinion | `PENDING` |
| R3 | Shared records when one person is erased (O5) | Owner + counsel | Decision | `PENDING` |
| R4 | Backups after erasure (O1, O2) and the cycle stated to users | Owner + counsel | Decision | `PENDING` |
| R5 | Legal holds (O4): needed, who sets and lifts them | Owner + counsel | Decision | `PENDING` |
| R6 | Disposal evidence: content, location, retention | Owner + counsel | Decision | `PENDING` |
| R7 | Use or remove `ARCHIVED` demands | Owner | Product decision | `PENDING` |
| R8 | Disposal of inactive accounts (needs a schema change) | Owner + counsel | Decision | `PENDING` |
| — | Live-database erasure schedule (section 4) | Owner + counsel | Decision | `PENDING` |

### LEG-04 — Vendors and international transfers

| ID | Decision | Who decides | Evidence needed | Status |
|---|---|---|---|---|
| V1 | Supabase region, remote access, subprocessors, DPA; whether managed backups are used | Owner | Dashboard and published terms (read-only) | `PENDING` |
| V2 | Backend host, and frontend host if separate | Owner | Provider selection record (D042) | `PENDING` |
| V3 | Email provider, before SMTP is enabled | Owner | Provider, region, terms | `PENDING` |
| V4 | Domain, DNS, and any CDN, proxy, or TLS terminator | Owner | Deployment decision | `PENDING` |
| V5 | Location and key custody of the encrypted export | Owner | Statement | `PENDING` |
| V6 | Log storage and any separate monitoring service | Owner | Host configuration | `PENDING` |
| V7 / VQ3 | Transfers abroad (including remote access) and KVKK Art. 9 basis | Counsel, after V1–V6 | Opinion | `PENDING` |
| V8 / VQ2 | Vendor legal roles and contract terms, including subprocessors | Counsel, after V1–V6 | Opinion | `PENDING` |
| VQ1 | Supply V1–V6 | Owner | As above | `PENDING` |
| VQ4 | Adopt working rules O1–O4 | Owner | Decision | `PENDING` |
| VQ5 | Rules for developer workstations in shared-data mode (D046) | Owner + counsel | Decision | `PENDING` |

### LEG-05 — Privacy notices

| ID | Decision | Who decides | Evidence needed | Status |
|---|---|---|---|---|
| NQ1 | Number of notices; which of N1–N7 combine | Counsel | Opinion | `PENDING` |
| NQ2 | Approved Turkish wording (and whether English is needed) | Counsel drafts, owner approves | Approved texts | `PENDING` |
| NQ3 | Whether D043's public-phone sentence is sufficient | Counsel | Opinion | `PENDING` |
| NQ4 | Whether any processing needs explicit consent | Counsel | Opinion | `PENDING` |
| NQ5 | Notice maintenance owner and review triggers | Owner | Decision | `PENDING` |
| — | Notice delivery evidence level (section 4) | Owner + counsel | Decision | `PENDING` |

Every notice also depends on L1, L2, P1, V7, V8, and RQ1–RQ2.

### LEG-06 — Data subject requests

| ID | Decision | Who decides | Evidence needed | Status |
|---|---|---|---|---|
| RQ1 | Channels (C1–C3) and the monitoring person | Counsel (channels), owner (person) | Decision plus a dated test submission | `PENDING` |
| RQ2 | Rights and request types covered | Counsel | Opinion | `PENDING` |
| RQ3 | Application date and incomplete submissions within the statutory 30-day maximum | Counsel | Opinion | `PENDING` |
| RQ4 | Identifying fields per method (including T.C. ID), further proof, representative authority | Owner + counsel | Opinion and procedure | `PENDING` |
| RQ5 | Turkish response templates | Counsel drafts, owner approves | Approved texts | `PENDING` |
| RQ6 | Delivery failures; when a request counts as answered | Owner + counsel | Decision | `PENDING` |
| RQ7 | Retention of request records and identity proof | Owner + counsel | Decision (feeds R1) | `PENDING` |
| — | Internal service level and its owner | Owner | Decision | `PENDING` |

The statutory 30-day general maximum is a verified fact recorded in the LEG-06 record. It is not a pending decision, but its application is (RQ3).

### LEG-07 — Account lifecycle

| ID | Decision | Who decides | Evidence needed | Status |
|---|---|---|---|---|
| AQ1 | Whether and how an administrative suspension is reversed | Owner | Decision | `PENDING` |
| AQ2 | Voluntary deactivation and reactivation behavior | Owner + counsel | Decision | `PENDING` |
| AQ3 | Whether parent accounts may be suspended | Owner | Decision | `PENDING` |
| AQ4 | Comment visibility after suspension or deactivation | Owner + counsel | Decision | `PENDING` |
| AQ5 | Suspension and moderation records surviving erasure | Counsel | Opinion (with R2) | `PENDING` |
| AQ6 | Withdrawal of erasure requests | Counsel | Opinion | `PENDING` |
| AQ7 | End-user wording for lifecycle screens | Counsel drafts, owner approves | Approved texts | `PENDING` |
| — | Session-revocation timing across erasure-request stages | Owner + counsel | Decision | `PENDING` |

### Shared sign-off fields (every record)

Each of the seven records also leaves its decision owner, reviewer (qualified Turkish counsel), evidence reference, and decision date as `[PENDING]`. They are filled per area at stage 5.

## 4. Suggested review order

Many items depend on others. A practical order, which the owner may change:

1. **L1, L2, L6** (owner facts) and **V1–V6** (owner evidence). These unblock almost everything else.
2. **L3, L4, L7, P1–P3, V7, V8** (counsel's core opinions).
3. **R1–R8, RQ1–RQ7, AQ1–AQ7** (process decisions that depend on step 2).
4. **NQ1–NQ5** (notices, which need steps 1–3).
5. **L8** (real-user pilot eligibility), last. Completing LEG-01 to LEG-07 is not enough for L8 by itself; see the launch gate in section 5.

## 5. Development permissions and production release gates

**Safe, reversible development may continue** where the APP issue concerned allows it:

- UI scaffolding and disabled legal-page routes (APP-01)
- request intake and status infrastructure (APP-06, APP-07, APP-13)
- authorization and ownership checks
- internal-only workflows that do not run legally dependent processing (APP-09 to APP-12)
- tests

Data rules for that work are unchanged:
- Automated tests keep using disposable environments with synthetic data (D045). Shared Supabase is never used as an automated test database.
- Controlled shared-data development through `dev-supabase.ps1` remains permitted under D046 and its existing restrictions. This tracker neither revokes nor expands D046.
- New legally dependent processing is not activated early. Nothing here authorizes unrestricted processing of real data.

**Not allowed before the relevant decision reaches stage 6:**

| Gate | Blocked until | APP issues |
|---|---|---|
| Publishing legal or privacy notice text | L1, L2, P1, V7, V8, RQ1–RQ2, NQ1–NQ5 | APP-01 [#208](https://github.com/Atakan8479/ServisimiBul/issues/208) |
| Presenting a request channel as working, or promising a response | RQ1–RQ7, L1, L2 | APP-06 [#213](https://github.com/Atakan8479/ServisimiBul/issues/213), APP-07 [#214](https://github.com/Atakan8479/ServisimiBul/issues/214), APP-13 [#220](https://github.com/Atakan8479/ServisimiBul/issues/220) |
| Data access or export to requesters | RQ1–RQ4, P1 | APP-08 [#215](https://github.com/Atakan8479/ServisimiBul/issues/215) |
| Voluntary deactivation or reactivation | AQ1, AQ2, AQ4; negative suspension-bypass tests | APP-09 [#216](https://github.com/Atakan8479/ServisimiBul/issues/216) |
| Real erasure or anonymization | R1–R6, AQ5, AQ6, RQ4 | APP-10 [#217](https://github.com/Atakan8479/ServisimiBul/issues/217), APP-11 [#218](https://github.com/Atakan8479/ServisimiBul/issues/218) |
| Retention-based disposal | R1, R2, R4–R6 | APP-12 [#219](https://github.com/Atakan8479/ServisimiBul/issues/219) |
| Enabling SMTP for real users | V3, V7, V8 | APP-03 [#210](https://github.com/Atakan8479/ServisimiBul/issues/210) (also its own gates) |
| Real-user pilot or public launch | L8; every gate above that the launch relies on; review of the applicable outstanding requirements of LEG-08 to LEG-11 ([#201](https://github.com/Atakan8479/ServisimiBul/issues/201)–[#204](https://github.com/Atakan8479/ServisimiBul/issues/204)): terms and content safety, cookies and marketing consent, VERBIS/ETBIS/IYS, breach response | QA-01 [#223](https://github.com/Atakan8479/ServisimiBul/issues/223), QA-03 [#225](https://github.com/Atakan8479/ServisimiBul/issues/225) |

These gates add to, and never replace, each APP issue's own dependencies and release gates, and the existing security rules in `AGENTS.md` and `docs/03_SECURITY_AND_API.md`. Administrative suspension must never be bypassed through self-service flows (LEG-07 section 4). No real-user launch may be authorized on the strength of technical documentation alone. Completing every item in this tracker is also not sufficient on its own: LEG-08 to LEG-11 stay outside this tracker and keep their own issues and status, but their applicable requirements must be reviewed before any real-user pilot.

## 6. Completion checklist

- [ ] Owner-only: evidence or decisions for L6, P4, R7, V1–V6 (VQ1), VQ4, NQ5, AQ1, AQ3, B1–B4, and the LEG-06 service level
- [ ] Counsel: opinions referenced for L3, L4, L7, P1–P3, V7, V8, R2, NQ1, NQ3, NQ4, RQ2, RQ3, AQ5, AQ6
- [ ] Joint: owner input and counsel review for L1, L2, L5, P5, R1, R3–R6, R8, VQ5, RQ1, RQ4, RQ6, RQ7, AQ2, AQ4, and the unnumbered items in section 3
- [ ] Joint: approved Turkish texts (counsel drafts, owner approves) for NQ2, RQ5, AQ7
- [ ] Stage 5: each decision recorded by a reviewed commit in this PR, with evidence, reviewer where applicable, and date (`D0xx` entries; open questions 4–10 removed or narrowed; record status lines updated)
- [ ] Stage 6: APP release gates in section 5 reviewed and authorized per gate
- [ ] LEG-08 to LEG-11 applicable requirements reviewed for launch (outside this tracker)
- [ ] L8 real-user pilot decision recorded last

## 7. Maintaining this tracker

- Change a row's status only together with its evidence reference, reviewer where applicable, and date, in the same reviewed commit that records the decision (section 2.3, stage 5). That commit goes into this tracker's PR while it is open.
- If a source record changes its questions, update the matching row here in the same commit.
- This file never carries legal text, contract content, or privileged advice. It holds references only.
