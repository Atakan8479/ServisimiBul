# LEG-02 — Personal data processing map and legal bases (decision record)

Issue: [#195](https://github.com/Atakan8479/ServisimiBul/issues/195). Depends on LEG-01 ([#194](https://github.com/Atakan8479/ServisimiBul/issues/194), `docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md`). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not a privacy notice, and not a compliance claim. It inventories what the software actually stores, shows, and sends, so that the owner and qualified Turkish counsel can decide purposes, lawful bases, and responsibilities. It uses the same four status categories as section "Status categories" of the LEG-01 record: **A** verified fact, **B** PROPOSED safeguard, **C** pending legal decision, **D** approved decision. It adds no approved decision.

Every lawful basis, controller/processor role, and retention period is `[PENDING]`. Retention, erasure, and backups are decided in LEG-03 ([#196](https://github.com/Atakan8479/ServisimiBul/issues/196)); vendors and transfers in LEG-04 ([#197](https://github.com/Atakan8479/ServisimiBul/issues/197)); notice text in LEG-05 ([#198](https://github.com/Atakan8479/ServisimiBul/issues/198)).

## 1. Decision summary

| Field | Value |
|---|---|
| Data controller for every category below | `[PENDING: LEG-01 L1]` |
| Lawful basis per category (KVKK Article 5, or Article 6 if special-category data is involved) | `[PENDING: counsel]` — see section 4 |
| Controller/processor role of each system and vendor | `[PENDING: counsel, with LEG-04]` — see section 3 |
| Operators' role for data they receive outside the platform | `[PENDING: LEG-01 L4]` |
| Decision owner | `[PENDING]` — PROPOSED: repository owner `Atakan8479` |
| Reviewer | `[PENDING]` — qualified Turkish counsel, not yet identified in the repository |
| Decision date | `[PENDING]` |
| Evidence of review | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` |

## 2. Data subjects

| Subject | How they appear | Verified basis for the statement |
|---|---|---|
| Anonymous visitor | Searches, reads demands and comments, sees operator phones; no account and no session for anonymous reads | `docs/03_SECURITY_AND_API.md`; D015 |
| Parent (`PARENT`) | Registers with email and password when enabled; creates/supports demands, comments, reports, gives feedback | D047, D048, D050–D053; `ParentRegisterRequest` |
| Operator (`OPERATOR`) | Registers with email, password, optional business name, mandatory public phone; may be a natural person | D020, D037; `RegisterRequest` |
| Administrator (`ADMIN`) | Two bootstrap accounts; their identifiers are stored on reviews, moderation, and audit rows | D016, D025; V3, V14 |
| People mentioned by others | Anyone named in a comment body, operator description, report explanation, or moderation reason | Free-text fields in section 4 |
| Students and children | Not a designed category: no student record exists (D015). Can appear only if a user types such data into free text | Section 5 |

## 3. Systems and possible processors

These are the places personal data exists today. Whether each vendor is a processor, an independent controller, or neither is `[PENDING: counsel, with LEG-04]`; where data physically resides is LEG-04.

| System | Personal data held | Verified state | Vendor |
|---|---|---|---|
| Spring Boot backend | All categories in section 4 while handling requests | Single instance (D040); provider not selected (D042) | `[PENDING: LEG-04]` |
| PostgreSQL database | Every table in section 4 | Supabase-hosted PostgreSQL (D003); shared database held 3 users at the last recorded count (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`) | Supabase; region `[PENDING: LEG-04]` |
| In-memory rate limiter | Salted SHA-256 hashes of IP addresses and account identities; never written to disk | `InMemoryRateLimiter` uses a random per-process salt; state resets on restart (D041) | None |
| Application logs | Error and security events; structured ECS console output in `prod` | `application-prod.properties`; SQL bind logging off; email-delivery failures log only the exception class (`AuthService`, `AuthEmailSender`) | Destination depends on the unselected host |
| Email delivery (SMTP) | Recipient email and a single-use verification or reset link | Implemented but disabled until `SB_MAIL_*` is configured (`docs/07_BACKEND_DEPLOYMENT.md`) | Not selected |
| Database backups | Copies of every table | Supabase managed backups depend on plan; an encrypted pre-V9 logical export is held outside Git pending deletion approval (`docs/10_DATABASE_AND_BACKUP_OPERATIONS.md`) | Supabase; export location not recorded in the repository |
| Browser | `SBSESSION` HttpOnly session cookie; `sessionStorage` role hint (`auth-api.ts`) | No analytics, advertising, or third-party scripts or fonts loaded (`index.html`, `package.json`) | None |
| Tariff storage directory | Official UKOME tariff content only; no user identifiers found in the tariff package | D033–D035 | Persistent volume on the unselected host |
| CI and tests | Synthetic fixtures only; disposable local PostgreSQL | D045; `.github/workflows` | GitHub Actions (no production data) |

## 4. Field and category inventory

"Product function" states what the code uses the data for. It is a verified fact, not a declared legal purpose; declared purposes belong to the approved notice (LEG-05). "Visible to" lists who can read the data through the application today.

| # | Category | Subjects | Fields (table.column) | Source | Product function | Visible to | Lawful basis (Art. 5/6) | Evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | Network identifier | Everyone | Client IP address (`ClientIdentityResolver`) | Network connection | Rate limiting of login, registration, recovery, verification, reset, and public search | Not stored by the application; may reach host/proxy logs `[PENDING: LEG-04]` | `[PENDING: counsel]` | D041; `InMemoryRateLimiter` |
| 2 | Account identity | Parent, operator, admin | `app_user.email`, `role`, `is_enabled`, `email_verified_at`, `created_at`, `updated_at` | The user; admins via bootstrap | Login identifier, role-based access, verification state | The user (`/auth/me`); never public (D027); no admin operator or moderation response contains an email field | `[PENDING: counsel]` | V3; `CurrentUserResponse` |
| 3 | Credential | Parent, operator, admin | `app_user.password_hash` (BCrypt) | The user | Authentication | Nobody; never returned by any DTO | `[PENDING: counsel]` | V3; `SecurityConfiguration` |
| 4 | One-time tokens | Parent, operator | `email_verification_token.*`, `password_reset_token.*` (SHA-256 hash, expiry, consumed time) | Generated | Email verification (24 h) and password reset (30 min) | Nobody; the raw token exists only in the sent link | `[PENDING: counsel]` | D021; V3 |
| 5 | Session | Logged-in users | `spring_session.principal_name` (the account email), times; `spring_session_attributes` (security context, CSRF token, remember-me deadline); `SBSESSION` cookie | Generated | Keeping the user signed in; CSRF protection; 30-minute or 90-day lifetime | Nobody | `[PENDING: counsel]` | D022, D023; V4; `AuthenticatedUser.getUsername()` |
| 6 | Operator public profile | Operator | `operator_profile.business_name` (optional), `contact_phone`, `description`, `is_publicly_visible`, `is_active`, `approval_status` | The operator | Public discovery and contact | Name, phone, description: **anyone** when eligible; status: operator and admins | `[PENDING: counsel]` | D009, D027, D028, D037, D043; `PublicOperatorDtos.OperatorResponse` |
| 7 | Operator review and suspension | Operator, admin | `operator_application_review.decision`, `reason`, `reviewed_by`, `reviewed_at` (includes `SUSPENDED` reasons) | Admins | Approval workflow and recorded suspension | Admins (`ReviewResponse`); the operator's own `ProfileResponse` contains no review reason | `[PENDING: counsel]` | D010, D024, D056; V3, V17 |
| 8 | Operator service details | Operator | `operator_school.*`, `operator_school_coverage.*`, `vehicle.plate`, `vehicle.capacity`, `service_offering.available_seats`, `description`, `is_published` | The operator | Discovery coverage; optional offering details | Schools and coverage drive public matches; published offering seats, capacity, description: anyone; plate: operator only (not in any public DTO) | `[PENDING: counsel]` | D011, D031, D032; V5, V6, V8 |
| 9 | Parent demand and support | Parent | `demand.created_by`, `school_id`, `neighborhood_id`, `academic_year`; `demand_support.parent_id`, `needs_morning`, `needs_afternoon`, `status`; `demand_support_reason.reason_code` | The parent | Coordinating transport interest per school and pickup neighborhood | Public sees only the demand and aggregate counts, never supporter identities (D048); the parent sees their own support | `[PENDING: counsel]` | D048, D055; V10 |
| 10 | Feedback | Parent | `demand_service_feedback.status`, `opened_at`, `reminder_due_at`, `expires_at`, `evaluated_at` (per support and publication) | The parent; scheduler | Recording satisfaction and closing demands | The parent; public sees only demand closure state | `[PENDING: counsel]` | D051; V13 |
| 11 | Operator demand response | Operator | `demand_service_response.*`, `demand_service_publication_event.*` | The operator | Declaring availability for a demand | Anyone while eligible: business name, phone, directions, time | `[PENDING: counsel]` | D049; V11 |
| 12 | Public comment | Parent, operator, people mentioned | `demand_comment.author_id`, `author_role`, `body` (free text, 2–1000 chars), `status` | The author | Public discussion on a demand | Anyone: body; parents shown only as `Veli`; operator name only when eligible (D050) | `[PENDING: counsel]`; Art. 6 risk via free text | D050; V12 |
| 13 | Content report | Reporter, reported person | `content_report.reporter_id`, `reporter_role`, `reason`, `explanation` (free text, 2–500) | The reporter | Moderation intake and de-duplication | Admins see reason and explanation; reporter identity is excluded from admin and public responses (D053) | `[PENDING: counsel]`; Art. 6 risk via free text | D053; V14 |
| 14 | Moderation record | Content author, admin | `moderation_case.target_title`, `target_snapshot` (copy of reported content, up to 2000 chars), `moderated_by`, `decision_reason`; `moderation_audit_event.moderator_id`, `action`, `reason` | System copy; admins | Review context and append-only audit | Admins | `[PENDING: counsel]` | D053; V14 |
| 15 | In-app notification | Parent, operator | `in_app_notification.recipient_user_id`, `type`, `event_key`, linked entity IDs, `read_at` (no free text) | Generated | Telling a user about events on their demands or reports | The recipient | `[PENDING: counsel]` | REQ-07 (`docs/03_SECURITY_AND_API.md`), D057; V16 |
| 16 | Account email message | Parent, operator | Recipient email; verification or reset link | Generated | Verification and password reset when delivery is enabled | The recipient and the SMTP provider `[PENDING: LEG-04]` | `[PENDING: counsel]` | `docs/07_BACKEND_DEPLOYMENT.md` |
| 17 | Logs | Everyone | Error and security events (`prod` ECS format) | Generated | Operations and incident investigation | Operators of the host `[PENDING: LEG-04]` | `[PENDING: counsel]` | `application-prod.properties` |
| 18 | Backups | Everyone with stored data | Copies of categories 2–15 | Generated | Recovery | Database administrators; backup location `[PENDING: LEG-03, LEG-04]` | `[PENDING: counsel]` | `docs/10_DATABASE_AND_BACKUP_OPERATIONS.md` |

Not personal data in the current design: provinces, districts, neighborhoods, school catalog rows (institutional names and addresses), official tariffs, and demand lifecycle events (`demand_lifecycle_event` stores no user identifier).

## 5. Data that must not be collected

Product rules already forbid student records and home addresses (D015; `docs/02_DOMAIN_AND_DATA.md`). No form field asks for a child's name, a home address, a national ID number, or health information, and the reporting UI warns against entering names, addresses, and phone numbers. The remaining exposure is free text that users type themselves:

| Free-text field | Length | Public? | Existing control | Concern |
|---|---|---|---|---|
| `demand_comment.body` | 2–1000 | Yes | Rate and duplicate limits only; phone/address detection deferred (D050); post-publication moderation (D053) | A parent may name a child, describe a medical need, or give an address in public |
| `operator_profile.description`, `service_offering.description` | `TEXT`; trimmed, no length limit found in validation | Yes | None specific | An operator may publish a driver's or their own personal details |
| `content_report.explanation` | 2–500 | No | UI warning | A reporter may restate the personal data being reported |
| `moderation_case.target_snapshot` | ≤2000 | No | Admin-only | Copies reported content, which remains after the author deletes the original comment |
| `operator_application_review.reason`, `moderation_case.decision_reason`, `moderation_audit_event.reason` | Text / ≤500 | No | Admin-only | Administrator wording may include personal details |

Whether any of these, if they receive health or other special-category data, require KVKK Article 6 handling is `[PENDING: counsel]`.

## 6. Minimization observations

Verified facts for the owner's attention. They are not findings of non-compliance.

1. **Public phone of a natural person.** Category 6 publishes an operator's phone to anyone, and the operator may be an individual (D037). D043's registration disclosure is a product decision, not a notice.
2. **Moderation snapshot outlives deletion.** Author deletion hard-deletes a comment (D050), but any moderation snapshot of it remains (category 14).
3. **Session table stores the email.** `spring_session.principal_name` holds the account email for session lookup and revocation.
4. **Unverified parent emails.** Under D052 the stored email may belong to someone other than the account holder, which affects any future notice or rights response sent to it.
5. **Logs and backups follow the database.** Categories 17–18 contain copies whose location and lifetime are not yet decided (LEG-03, LEG-04).

## 7. Reconciliation with AUDIT-F4 (#166)

#166 listed PARENT/OPERATOR identity, public contact phone, demand/support, comments, notifications, reports, and audit events for inventory. Section 4 now covers each of them (categories 2, 6, 9, 12, 13, 14, 15) plus sessions, IP, logs, and backups. As recorded in the LEG-01 record, #166 was closed without any inventory on `main`; this record supplies the inventory only. Legal basis, notice, retention, erasure, and rights handling remain with LEG-02 (bases, section 1), LEG-03, LEG-05, LEG-06, and the APP issues.

## 8. Open questions

| # | Question | Who answers |
|---|---|---|
| P1 | Which KVKK Article 5 condition applies to each category in section 4, and does any category need Article 6 treatment? | Counsel |
| P2 | Is publishing an individual operator's phone (category 6) covered by the operator's own act of publication, or does it need another basis or a separate notice? | Counsel |
| P3 | For each system in section 3, is the vendor a processor, an independent controller, or neither? | Counsel, with LEG-04 |
| P4 | Should free-text fields (section 5) get stronger controls, such as warnings on comments and descriptions or automated detection? This is a product decision; D050 currently defers detection. | Owner |
| P5 | Must moderation snapshots be removed or reduced when the original content is deleted? | Owner + counsel, with LEG-03 |

## 9. Remaining risks

1. No lawful basis is recorded for any category (P1).
2. Special-category data can enter public free text with no preventive control (section 5).
3. Processor relationships and data locations are unknown until LEG-04 (P3).
4. The inventory reflects `main` at the date below; any new table, field, recipient, or vendor makes it stale and must update section 4 in the same PR.

## 10. How to approve

1. Counsel reviews sections 2–6 and supplies P1–P3 and P5; the owner answers P4.
2. The owner fills section 1 and each `[PENDING]` cell, referencing evidence without committing privileged content.
3. In the same PR, the owner adds an approved `D0xx` entry to `docs/01_DECISIONS.md` and removes the matching open question.
4. Issue #195 stays open until its acceptance criteria are met by recorded, reviewed answers.

Inventory verified against `main` at `125f99c` (Flyway V1–V17) on 2026-11-02 by reading migrations, DTOs, security configuration, and documentation.
