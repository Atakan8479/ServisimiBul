# LEG-06 — Data subject request channel and response process (decision record)

Issue: [#199](https://github.com/Atakan8479/ServisimiBul/issues/199). Depends on LEG-01 (`docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md`), LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`), and LEG-03 (`docs/20_RETENTION_AND_ERASURE.md`). Uses LEG-04 (`docs/22_VENDORS_AND_TRANSFERS.md`) and LEG-05 (`docs/21_PRIVACY_NOTICE_REQUIREMENTS.md`). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not a request procedure in force, and not a compliance claim. It records what the software can and cannot do today for someone who wants to exercise data rights. It then sets out the process decisions, including the channel, identity checks, deadlines, templates, and failure handling, that the owner and qualified Turkish counsel must make. It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision. It adds no approved decision.

**Legal sources checked (A, verified on 2026-11-03).** The following are quoted from official sources as facts for the decision-makers. How they apply to ServisimiBul is still `[PENDING: counsel]`.

- **Law No. 6698, Article 13.** The data controller must conclude a data subject's request as soon as possible and within thirty days at the latest, free of charge unless the process has a separate cost. Source: KVKK, [İlgili Kişiler Tarafından Yapılan Başvuruların Cevaplanması Yükümlülüğü](https://www.kvkk.gov.tr/Icerik/2046/Ilgili-Kisiler-Tarafindan-Yapilan-Basvurularin-Cevaplanmasi-Yukumlulugu).
- **Communiqué on Application Procedures and Principles to the Data Controller** (*Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ*, Resmî Gazete No. 30356, 10 March 2018; [text](https://www.resmigazete.gov.tr/eskiler/2018/03/20180310-6.htm)):
  - Article 5(1) lists the application methods: in writing, by registered electronic mail (KEP), with a secure electronic or mobile signature, from an email address previously given to and registered with the controller, or through a software or application built for the purpose.
  - Article 5(2) lists what an application contains:
    - name and surname, and a signature for written applications
    - the T.C. identity number for Turkish citizens, or nationality and passport or identity number for foreigners
    - a residence or business address for notifications
    - an email address, telephone, or fax if available
    - the subject of the request
  - Article 5(4)–(5) defines the application date as the date the application reaches the controller (for written applications, delivery to the controller or its representative).
  - Article 6 repeats the thirty-day maximum.
  - Article 7 covers when a fee may be charged.

The thirty-day general maximum is therefore a verified statutory requirement, not an assumption. Still `[PENDING: counsel]`:
- how valid receipt and the start date apply to each channel in section 3
- how incomplete submissions and requests for further identity proof affect the period
- any procedural exceptions

The internal service level and who owns it are `[PENDING: owner]`. Nothing in this record states that the application meets the deadline today; section 2 shows no channel exists. No response template text is written here.

## 1. Decision summary

| Field | Value |
|---|---|
| Request channel(s), and evidence that each is actually monitored | `[PENDING: owner + counsel]` — section 3 |
| Responsible person for handling requests | `[PENDING: owner]` |
| Rights and request types covered | `[PENDING: counsel]` |
| Identity verification method per requester type | `[PENDING: owner + counsel]` — section 4 |
| Response deadline | Statutory general maximum of 30 days (verified, see the legal sources above). How receipt, start date, incomplete submissions, and further identity proof apply: `[PENDING: counsel]`. Internal service level and owner: `[PENDING: owner]` |
| Identifying fields legally required for each supported request method | `[PENDING: counsel]` — section 4 |
| Response templates (Turkish) | `[PENDING: counsel drafts, owner approves]` |
| Rejection and appeal or complaint information | `[PENDING: counsel]` |
| Handling of failed submissions, extra identity proof, and delivery failures | `[PENDING: owner + counsel]` — section 6 |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. What exists today (verified)

Verified against `main` at `a6a3828` on 2026-11-03 by reading the account settings page, authentication rules, decisions, and the LEG-01 to LEG-05 records.

- **No request channel exists.** The account page lists "Kişisel veri başvuruları" (personal data requests) as disabled, with the explanation that it opens after the request channel and legal texts are approved. Deactivation and account deletion requests are also shown as disabled (`AccountSettingsPage.tsx`; APP-02).
- **No controller contact exists** (LEG-01 L1, L2), and the public site has no legal page or contact link (LEG-05 section 2).
- **Email delivery is disabled.** SMTP stays off until configured, and no provider is selected (LEG-04 section 3, row "Email delivery", status DISABLED). This record does not rely on email being sent by the application.
- **No request storage exists.** No table, API, or admin screen records a request, its status, or its deadline. Tracking requests is APP-07 ([#214](https://github.com/Atakan8479/ServisimiBul/issues/214)), and staff handling is APP-13 ([#220](https://github.com/Atakan8479/ServisimiBul/issues/220)).
- **What a signed-in session proves.** A session proves control of an account, not ownership of the email address in every case:
  - OPERATOR and ADMIN accounts verify their email before login (D005).
  - PARENT accounts in the controlled pilot may log in with an unverified email (D052), so an email reply may reach someone who does not own the account.
- **People without accounts also have data.** Anonymous visitors have IP-based rate-limiter state only in memory. People named in comments, descriptions, or reports have no account at all (LEG-02 section 2). They cannot use an in-account form.
- **Current self-service actions.** Account holders can already do some things themselves, which a response may point to:
  - change their password (APP-04)
  - sign out of all devices (APP-05)
  - operators can edit or hide their public profile (D028)
  - comment authors can delete their own comments (D050; but see LEG-03 on moderation snapshots)

## 3. Channel (C, with PROPOSED options)

The issue requires at least one legally appropriate channel that is actually monitored, without relying on the disabled SMTP. Which channels are legally acceptable is `[PENDING: counsel]`. The options below are listed for the decision; they are not recommendations of any legal form:

| Option | Who it serves | Depends on | Notes |
|---|---|---|---|
| C1 — A contact route published by the controller (for example a postal address or another route counsel accepts) | Everyone, including people without accounts | LEG-01 L1/L2 | Works without any application change; must have a named person monitoring it |
| C2 — An in-account request form (APP-06, [#213](https://github.com/Atakan8479/ServisimiBul/issues/213)) | Signed-in parents and operators | APP-06, APP-07 | Gives authenticated, traceable intake. It does not serve people without accounts, so it cannot be the only channel. |
| C3 — A public request form without login (APP-06) | Visitors and people named by others | APP-06, APP-07; abuse and rate limits | Needs identity checks (section 4) and a way to reply that does not depend on the disabled SMTP |

PROPOSED: C1 is required in any approved design, because it is the only option that serves every data subject in section 2. C2 and C3 are additions. **Monitoring evidence**, also PROPOSED: the owner records who monitors each channel, how often, who covers absences, and a dated test submission that was received and logged.

## 4. Identity verification with data minimization (PROPOSED, B)

The issue forbids *unnecessary* Turkish ID numbers. The Communiqué's Article 5(2), quoted above, lists the T.C. identity number among the contents of a formal application to the controller. So the identity number cannot be categorically excluded from a formal request. Nor does that make it a field for ordinary product use. PROPOSED principles, pending counsel:

- **Formal request versus product interaction.** A formal data-subject application under the Law and Communiqué is a different thing from ordinary signed-in actions such as editing a profile, deleting one's own comment, or changing a password. No identity number is added to registration, login, account settings, or any other existing flow. Which identifying fields are legally required for each supported request method (C1–C3) is `[PENDING: counsel]`.
- **Collect only with a documented reason.** The platform holds an email, a role, and, for operators, a business name and phone. It holds no national ID, birth date, or address (LEG-02). Any identifying field collected for a request must have a documented justification: either a legal requirement for that method, confirmed by counsel, or a specific need to link the request to data already held. It is used only for that request. How it is stored, who may access it, and how long it is kept are `[PENDING: owner + counsel]` (RQ7, LEG-03).
- **Four separate questions for every requester.** These are separate questions, and answering one does not answer the others:
  1. Does the requester control an authenticated session?
  2. Do they control the email address?
  3. Are they the data subject?
  4. Are they entitled to the specific data requested?

  A signed-in session answers only the first. For OPERATOR and ADMIN, the email has also been verified (D005). For a PARENT with an unverified email (D052), PROPOSED: answers are delivered inside the account rather than by email. That reduces the risk of sending data to an address the account holder may not own, but it does not prove who the account holder is, or that they may receive every item requested.
- **When more proof may be needed.** Further verification may be necessary before disclosure when a request covers another person's data, sensitive information, or a case where the identity link is uncertain, for example an unverified parent email claiming data beyond its own account. The method is `[PENDING: owner + counsel]`. This PR adds no identity check to the application and does not change D052.
- **Requester without an account (C1, C3).** PROPOSED: ask for the information counsel confirms as required for the method, plus a description of the data concerned, such as the demand, comment, or public profile it relates to. Additional proof is requested only when the request cannot otherwise be linked to the data, and is limited to what is needed for that link.
- **Authorized representatives versus unauthorized third parties.** A request from someone without authority is never answered with another person's data. Handling of third-party records follows LEG-03 O5 once it is decided. A request from a legal representative, guardian, or other authorized agent acting for the data subject is different: their authority must be verified before any data is disclosed. What evidence of authority is acceptable for each case is `[PENDING: counsel]`. Such evidence is collected only as needed, stored with restricted access, and kept only as long as the approved retention rule allows (RQ4, RQ7).

The exact methods, what counts as sufficient proof, and how long proof is kept are `[PENDING: owner + counsel]`. The Manus reference package's `[IDENTITY_VERIFICATION_METHOD_PENDING]` placeholder is a UX placeholder, not a decision.

## 5. Handling stages and the response clock (PROPOSED, B)

PROPOSED stages, for APP-07 to implement once approved: received → identity check (if needed) → under review → answered (fulfilled, partly fulfilled, or rejected with reasons). Each stage records its date, the responsible person, and what was done, without copying more personal data than the request already contains.

The response deadline and the technical erasure schedule are separate clocks (LEG-03 section 4). Answering a request on time does not mean the data has already disappeared from backups or logs. The response must not claim more than has happened.

The statutory general maximum is thirty days (legal sources above). How the application date applies to each channel, how incomplete submissions and requests for more proof or authority evidence are treated, and what a rejection must say are `[PENDING: counsel]`. PROPOSED: APP-07 records the application date as received, so the period can be tracked from the start.

## 6. Failures and exceptions (PROPOSED, B)

| Situation | PROPOSED handling | Pending |
|---|---|---|
| A submission does not arrive or cannot be read (form error, unreadable post) | The channel shows or sends a clear error, and C1 remains available as a fallback | Wording of the error |
| Extra identity proof is needed | The requester is told exactly what is missing and why, through the channel they used | Whether the clock pauses; how long to wait before closing |
| The reply cannot be delivered (no working email, returned post) | The attempt and the date are recorded, and another route the requester gave is tried; for signed-in requesters the answer stays visible in the account | What counts as a delivered answer |
| The request is outside the platform's data (for example about an operator's own phone records) | The requester is told that the platform does not hold that data, and LEG-01 L4 governs any referral to the operator | Wording, and the operator's role (L4) |

## 7. Templates

The issue requires response templates. **None is written here.** Templates must state the controller (LEG-01), the result, the reasons for a rejection, and any appeal or complaint route. They must be drafted by counsel in Turkish and approved by the owner, then stored with the approved notices (LEG-05 section 4) so their versions are traceable. Until then, PROPOSED: no screen or message promises a response, a deadline, or an outcome. This matches the rule APP-02 already follows.

## 8. Reconciliation with AUDIT-F4 (#166)

#166 asked for rights-request handling to be defined before any route or button was added. Section 2 confirms none was added: the account page shows requests as disabled, and no request storage exists. #166 was closed without a process on `main`. This record supplies the current state, the options, and the decisions needed. Implementation remains with APP-06, APP-07, and APP-13 after approval.

## 9. Open questions

| # | Question | Who answers |
|---|---|---|
| RQ1 | Which channel or channels are legally appropriate (C1–C3), and who monitors each one? | Counsel (channels), owner (person) |
| RQ2 | Which rights and request types does the process cover? | Counsel |
| RQ3 | Within the statutory thirty-day maximum: how valid receipt and the application date apply to each channel, and how incomplete submissions and requests for further proof affect the period. | Counsel |
| RQ4 | Which identifying fields are legally required for each request method, including when a T.C. identity number is required? What further proof is sufficient for each requester type, including unverified parent accounts? What evidence of authority is required from legal representatives, guardians, or authorized agents? | Owner + counsel |
| RQ5 | Approved Turkish templates for acknowledgement, request for proof, answer, partial answer, and rejection, including complaint or appeal information. | Counsel drafts, owner approves |
| RQ6 | How are delivery failures recorded, and when does a request count as answered? | Owner + counsel |
| RQ7 | How long are request records and identity proof kept? (feeds LEG-03) | Owner + counsel |

## 10. Remaining risks

1. Today nobody can submit a request: there is no channel, no contact, and email is off.
2. Unverified parent emails (D052) make email replies unsafe for those accounts.
3. People without accounts, including people named by others, have no route at all until C1 exists.
4. Without request records (APP-07), deadlines cannot be tracked or evidenced.

## 11. How to approve

1. **Technical draft.** The PR that adds this record may be merged after technical review. Merging is not legal approval, and the status line stays `DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED`.
2. **Owner and counsel review.** After LEG-01 L1/L2 are answered, counsel answers RQ1–RQ3 and RQ5, and the owner and counsel answer RQ4, RQ6, and RQ7. The owner names the responsible person and records monitoring evidence for each channel.
3. **Recording decisions.** A later, separately reviewed PR fills section 1, adds the approved `D0xx` entry to `docs/01_DECISIONS.md`, removes the matching open question, and changes this record's status line. No deadline, channel, person, template, or decision is recorded before it is actually given.
4. **Implementation gate.** APP-06, APP-07, and APP-13 may build safe, reversible scaffolding when their own issues allow it. No channel is presented to real users as working, and no deadline or outcome is promised, before the approved decision from step 3 exists and the channel has been tested end to end.
5. **Issue status.** Issue #199 stays open until its acceptance criteria are met by recorded, reviewed answers.
