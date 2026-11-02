# LEG-01 — Data controller and platform legal role (decision record)

Issue: [#194](https://github.com/Atakan8479/ServisimiBul/issues/194). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice and not legal approval. It records verified product facts, the questions that only the owner and qualified Turkish counsel can answer, and the structure in which their answers must be recorded. Nothing here names a data controller, contact detail, legal basis, retention period, or regime outcome. Do not copy text from this file, the Manus reference package, or generic templates into user-facing legal notices.

Values in `[PENDING: …]` brackets are unanswered on purpose. Fill them only with an answer the owner approves, and record who supplied it, when, and on what evidence.

## 1. Decision summary

| Field | Value |
|---|---|
| Data controller (*veri sorumlusu*) | `[PENDING: legal or natural person, title, registration details — owner + counsel]` |
| Controller's public contact details | `[PENDING: address and a genuinely monitored channel — owner + counsel]` |
| Controller representative, if one is required | `[PENDING: counsel]` |
| Platform legal role for the current MVP | `[PENDING: counsel]` — see section 4 |
| Operator responsibilities | `[PENDING: counsel]` — see section 4 |
| Audience and minimum age | `[PENDING: owner + counsel]` — see section 3 |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. Verified product facts relevant to the legal role

Verified against `main` at `e304a3b` on 2026-11-02 by reading the repository. These are product facts, not legal conclusions.

### What the platform does today

- **Anonymous discovery.** Parents search by school and pickup neighborhood without an account, then contact an operator directly by phone (`docs/00_PROJECT_BRIEF.md`; D015). A neighborhood match is explicitly not a pickup guarantee.
- **Operator self-listing.** Operators register themselves with email, password, optional business name, and a mandatory public contact phone (`RegisterRequest`; D020, D037). The phone is the only public contact channel and the authentication email is never public (D009, D027). An eligible profile is public by default and the operator can hide it (D028, D043).
- **Parent demand coordination.** When explicitly enabled for the pilot, parents register with only email and password (`ParentRegisterRequest`; D047, D052) and create or support a demand for school + pickup neighborhood + academic year. Supports store only morning/afternoon need and fixed reason codes (D048).
- **Operator responses.** Eligible operators publish a demand-specific declaration of morning/afternoon availability. It is not a capacity, price, route, or service guarantee (D049).
- **User-generated content.** Public plain-text comments by supporting parents and eligible operators (D050), private user reports, and administrator moderation with audit (D053).
- **In-app notifications only.** No SMTP, SMS, push, or WebSocket delivery is active for notifications (`docs/03_SECURITY_AND_API.md`, REQ-07).
- **Official tariff reference.** The platform shows official UKOME fee bands only. There are no operator prices, no price estimates, and no fees calculated per family (D012, D013).
- **Administration.** Two bootstrap ADMIN accounts manage the school catalog, approval workflow when enabled, moderation, and tariffs (D016, D025).

### What the platform does not do today

- No booking, payment, contract conclusion, invoicing, or money flow between any parties. No payment code exists in the repository (`docs/00_PROJECT_BRIEF.md`, "Not MVP").
- No vehicle operation, driver employment, GPS tracking, or route planning by the platform. Operator and driver need not be the same person, and vehicle/offering records are optional operator-entered data (D011, D031).
- No ratings or reviews, and no private chat.
- No student records and no home addresses (D015; `docs/02_DOMAIN_AND_DATA.md`).
- No analytics, advertising, or tracking scripts: `servisimibul-frontend/index.html` loads only the application bundle and `package.json` contains no analytics SDK.
- No marketing email or SMS. Email delivery exists only for verification and password recovery and stays disabled until configured (`application-prod.properties`, `SB_MAIL_*`).

### Gaps that bear directly on LEG-01

- **No controller is identified anywhere** in the repository, the UI, or the decision register.
- **No public legal pages.** The public footer links only to the home page, demand board, and the two registration pages. Privacy notice and terms pages are APP-01 ([#208](https://github.com/Atakan8479/ServisimiBul/issues/208)).
- **No age data or age gate.** Neither registration request has an age, date-of-birth, terms, or consent field. Whether minors can register is therefore unknown, not controlled.
- **Operators may be natural persons.** Because the business name is optional (D037), a public operator profile may consist of an individual's own phone number.
- **Unverified parent emails in the pilot.** Under D052 a parent email is a login identifier only, so the platform cannot rely on it to reach a parent.
- **Hosting is not selected.** D042 keeps Railway, Render, and a managed VPS as candidates; the Supabase project region is not recorded in the repository. This is LEG-04 ([#197](https://github.com/Atakan8479/ServisimiBul/issues/197)).
- **Account settings show personal-data actions as unavailable.** APP-02 (PR #226) shipped them disabled and invented no notice, channel, retention period, or deletion promise.

## 3. Open questions for the owner and counsel

Each answer needs an owner, a reviewer where marked, evidence, and a date before it moves to `docs/01_DECISIONS.md` as an approved decision.

| # | Question | Who answers | Blocks |
|---|---|---|---|
| L1 | Who is the data controller: an existing company, a company still to be formed, one or more natural persons, or another arrangement? What is its exact legal name and registration detail? | Owner, confirmed by counsel | LEG-05, LEG-06, APP-01, any real-user pilot |
| L2 | What public contact details will the controller publish (postal address and at least one channel that is actually monitored)? This is separate from D027, which concerns operator contact data. | Owner | LEG-06, APP-01, APP-06 |
| L3 | Is the platform, for the current free pilot, solely a discovery and demand-coordination service and not a provider, broker, or organizer of transportation? What wording may the product use to say so? | Counsel | LEG-08, APP-01 |
| L4 | For data that operators receive outside the platform (for example, a parent's phone call), and for what operators publish on the platform, what are the operator's own responsibilities, and is any operator a processor of the platform? | Counsel | LEG-02, LEG-05, LEG-08 |
| L5 | Who is the intended audience? Must account holders be adults or parents/guardians? Is a minimum age required, and if so, how is it stated or checked without collecting more data than needed? | Owner + counsel | LEG-05, LEG-08, APP-01 |
| L6 | Is the pilot "free" in every respect, including to operators? Is any listing fee, featured placement, commission, or sponsorship planned, and when? | Owner | Section 4 reassessment triggers |
| L7 | Which of the regimes in section 4 apply to the current MVP, and which only to future commercial models? | Counsel | Section 4 |
| L8 | May the controlled pilot continue with real users before L1–L5 are answered, or must it stay with synthetic participants? | Owner + counsel | J-05, QA-03 ([#225](https://github.com/Atakan8479/ServisimiBul/issues/225)) |

## 4. Regime applicability

Applicability for every row is **UNDETERMINED** until counsel records an outcome. The "Subject" column only identifies each law and does not summarize its obligations. The "Facts for counsel" column lists the product facts from section 2 that are likely to matter, so counsel can work from verified behavior.

| Regime | Subject | Facts for counsel | Current MVP applicability | Rationale | Owner | Reassess when |
|---|---|---|---|---|---|---|
| Law No. 6698 (KVKK) | Personal data protection | Accounts, public operator phones that may belong to individuals, sessions and IP-based rate limiting, demands/supports, comments, reports, moderation, notifications, backups | `[PENDING: counsel]` | `[PENDING]` | `[PENDING]`; detailed work in LEG-02–LEG-07, LEG-11 | Any new data category, recipient, hosting provider, or region |
| Law No. 5651 | Internet publications and the roles of content, hosting, and access providers | Platform publishes operator profiles and user comments it does not author; administrators can hide comments and act on reports (D050, D053) | `[PENDING: counsel]` | `[PENDING]` | `[PENDING]`; content rules in LEG-08 | Rich media, open-ended posting, removal of comment limits, or wider public UGC |
| Law No. 6502 | Consumer protection | No sale, booking, payment, or contract between parent and platform; parents contract with operators off-platform | `[PENDING: counsel]` | `[PENDING]` | `[PENDING]` | Any paid feature for parents, bookings, price display beyond official tariffs, or operator-specific prices (Open question 2 in `docs/01_DECISIONS.md`) |
| Law No. 6563 | Electronic commerce | No online transaction; contact happens by phone outside the platform; no commercial electronic messages sent | `[PENDING: counsel]` | `[PENDING]` | `[PENDING]`; messaging in LEG-09 | Payments, bookings, commission, operator fees, featured listings, or any commercial email/SMS |
| ETBIS registration | E-commerce information system registration | Same facts as 6563; no revenue model is recorded in the repository | `[PENDING: counsel]` | `[PENDING]` | `[PENDING]`; registration review in LEG-10 | Same triggers as 6563 |
| VERBIS and IYS | Controller registry and commercial message management system | Pointer only: assessed in LEG-10 ([#203](https://github.com/Atakan8479/ServisimiBul/issues/203)) and LEG-09 ([#202](https://github.com/Atakan8479/ServisimiBul/issues/202)) | Out of LEG-01 scope | — | — | — |

## 5. Current MVP versus possible future commercial activities

| Activity | In current MVP? | Evidence | Why it matters to the legal role |
|---|---|---|---|
| Anonymous operator discovery and direct phone contact | Yes | Brief; D015 | Platform introduces parties but takes no part in the contract |
| Operator self-listing with public phone | Yes | D009, D027, D028, D043 | Publishes data supplied by operators, possibly individuals |
| Parent demands, supports, operator responses | Yes, parent registration is config-gated | D047–D049, D052 | Coordination of interest, not a booking |
| Public comments, reports, moderation | Yes | D050, D053 | Platform hosts and moderates third-party content |
| In-app notifications | Yes | REQ-07 | Service messages only, not marketing |
| Official UKOME tariff display | Yes | D012, D013, D054 | Reference information from a public authority, not a quote |
| Operator-specific prices | No; open question | `docs/01_DECISIONS.md` Open question 2 | Would change the 6502/6563 analysis |
| Bookings, seat reservation, contracts | No | Brief, "Not MVP" | Would move the platform toward intermediation |
| Payments, commissions, invoices | No | Brief, "Not MVP"; no payment code | Would change the 6502/6563/ETBIS analysis |
| Fees charged to operators, featured listings, advertising | Not present; no decision recorded | L6 | Would make the service commercial toward operators |
| Marketing email/SMS | No; SMTP used only for account emails when enabled | `application-prod.properties` | IYS and consent questions (LEG-09) |
| Ratings and reviews | No | Brief, "Not MVP" | Would add content-liability questions |

## 6. Reconciliation with AUDIT-F4 (#166)

[#166](https://github.com/Atakan8479/ServisimiBul/issues/166) asked for a KVKK inventory, a counsel-reviewed notice, legal basis, purposes, visibility, retention, erasure/anonymization, rights-request handling, and owner sign-off before any implementation. It was closed as completed on 2026-10-31 with no comments.

A search of `main` on 2026-11-02 found no KVKK policy, retention schedule, rights-request process, notice text, or decision entry produced by #166. Its closure therefore records triage, not an implemented or approved policy. Each part is now owned by a separate open issue:

| #166 element | Current owner |
|---|---|
| Data inventory, purposes, legal basis | LEG-02 [#195](https://github.com/Atakan8479/ServisimiBul/issues/195) |
| Retention, erasure, anonymization | LEG-03 [#196](https://github.com/Atakan8479/ServisimiBul/issues/196), APP-11 [#218](https://github.com/Atakan8479/ServisimiBul/issues/218), APP-12 [#219](https://github.com/Atakan8479/ServisimiBul/issues/219) |
| Counsel-reviewed notice | LEG-05 [#198](https://github.com/Atakan8479/ServisimiBul/issues/198), APP-01 [#208](https://github.com/Atakan8479/ServisimiBul/issues/208) |
| Rights-request handling | LEG-06 [#199](https://github.com/Atakan8479/ServisimiBul/issues/199), APP-06 [#213](https://github.com/Atakan8479/ServisimiBul/issues/213), APP-07 [#214](https://github.com/Atakan8479/ServisimiBul/issues/214) |
| Visibility of public data | D043 (product decision only; it states that legal review is separate) and LEG-05 |
| Owner sign-off | This record's section 1, then QA-03 [#225](https://github.com/Atakan8479/ServisimiBul/issues/225) |

All of these depend on L1 and L2: no notice or rights channel can name a controller or contact that has not been decided.

## 7. Remaining risks

These stay open until the corresponding question is answered. They are listed for the owner's decision, not resolved here.

1. **No identified controller (L1, L2).** Real users cannot be told who is responsible for their data or how to exercise their rights.
2. **Public personal data without an approved notice.** An operator who is an individual publishes a personal phone number. D043's registration disclosure is a product decision, not a reviewed privacy notice.
3. **Unknown audience age (L5).** Nothing prevents a minor from registering, and nothing records that the platform is meant for adults.
4. **Platform role not stated to users (L3).** Without approved wording, parents may read an operator listing, response, or tariff band as a platform-provided or guaranteed service.
5. **Third-party content.** Comments are public and moderated after publication. Responsibilities for removal and notice handling are undefined (L7, LEG-08).
6. **Hosting location unknown.** Transfer analysis cannot start until a provider and region are fixed (LEG-04).
7. **Change in business model.** Any trigger in section 4 can invalidate whatever conclusion counsel reaches for the free pilot. This record must be reassessed before such a change ships.

## 8. PROPOSED handling until approval (not approved)

- PROPOSED: no public or real-user launch depends on any `[PENDING]` value above until the owner records it with evidence. Synthetic and isolated testing continue as today.
- PROPOSED: product copy and legal pages (APP-01) state no controller, contact, legal basis, retention period, or service guarantee until L1–L5 are recorded here and promoted to `docs/01_DECISIONS.md`.
- PROPOSED: any change matching a section 4 trigger reopens this record before implementation.

## 9. How to approve

1. Counsel reviews sections 2–5 and supplies outcomes for L1–L7 and each row in section 4.
2. The owner fills section 1 and the `[PENDING]` cells with the approved answers, referencing the evidence without committing privileged content.
3. In the same PR, the owner adds an approved `D0xx` entry to `docs/01_DECISIONS.md` and removes the matching open questions there.
4. Only then may LEG-05, LEG-06, and APP-01 cite the controller and contact details.
