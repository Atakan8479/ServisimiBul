# Security and API contract

## Authentication
Use Spring Security with stateful sessions persisted by Spring Session JDBC. Credential authentication is not Supabase Auth and is not JWT. Rotate the session identifier on login, invalidate the current session on logout, and protect every state-changing browser request against CSRF, including registration, verification, login, password reset, and logout.

The cookie is named `SBSESSION`, is HttpOnly, uses `SameSite=Lax`, path `/`, and no `Domain` attribute. It is `Secure` in every non-local environment; explicit local HTTP development may disable only the Secure flag. The production SPA and `/api/v1` are served from the same browser origin. Development should use a same-origin proxy; if cross-origin development is unavoidable, allow only explicit origins with credentials and a reviewed CSRF design. Never use wildcard credentialed CORS.

Normal login has a 30-minute inactivity timeout and a browser-session cookie. Selecting “Remember me” creates a persistent server-side session and cookie with a non-sliding 90-day absolute lifetime. Remembered activity must not extend that absolute deadline. Allow at most two sessions per account; a third login invalidates the oldest. Password or primary-email changes, password reset, account disablement, operator suspension, and role changes invalidate every session belonging to the identity. Logout invalidates only the current session.

Public registration accepts `email`, `password`, optional `businessName`, and `contactPhone`, always assigns `OPERATOR`, and creates a `DRAFT` application. Normalize email consistently. Passwords are 12–64 characters and at most 72 UTF-8 bytes; do not require arbitrary character classes. Email verification is required before login. Verified operators may log in; their operator permissions follow the effective approval policy described below, while account enablement and suspension remain independent in both modes.

For the current local testing period only, `dev.ps1` explicitly disables the delivery step and newly registered accounts receive a verification timestamp in the registration transaction. The safe default and `prod` profile still require email verification; production startup rejects the disabled setting. Existing unverified accounts are not rewritten. The verification endpoint, token lifecycle, resend behavior, and production contract remain implemented for later activation.

Registration validation uses a trimmed, case-normalized email of at most 254 characters; an optional trimmed business name of 2–120 characters when present; and a contact phone stored in E.164 form (`+` followed by 8–15 digits). Missing, explicit `null`, or blank business-name input is stored as `NULL`. The frontend may accept and format familiar Turkish input, but the API persists and returns the canonical phone form.

Verification tokens are random, stored only as hashes, single-use, and valid for 24 hours. Issuing a new token invalidates earlier unconsumed tokens. Resend has a 60-second per-account cooldown and rolling limits of 5/account/hour and 20/IP/hour. The link opens a frontend GET route; that page submits the token to the API with POST. Registration and resend return a generic result that does not disclose account existence.

Password recovery uses the same non-enumerating response rule. Reset tokens are random, hashed, single-use, and valid for 30 minutes. A successful reset revokes all sessions without changing verification or operator-approval state.

Exactly two initial admins are created by an explicitly enabled, one-shot backend bootstrap command using temporary environment credentials. It is not exposed over HTTP, refuses any public ADMIN registration path, requires exactly two configured admin identities, does not log secrets, and does not replace an existing admin password when rerun.

`PARENT` is a distinct authenticated role with no operator or admin authority. REQ-01 introduced no public parent-registration endpoint. Issue #100 adds `POST /api/v1/auth/parent/register`, accepting only `email` and `password` and assigning `PARENT` server-side. It reuses the operator registration email normalization, password policy, generic duplicate response, CSRF protection, registration-IP rate limit, and BCrypt storage, but creates no operator profile.

Parent enrollment and verification are separate policies. `SB_PARENT_REGISTRATION_ENABLED` defaults to `false`; `SB_PARENT_EMAIL_VERIFICATION_REQUIRED` defaults to `true`. When parent verification is required, registration uses the existing hashed, single-use 24-hour verification-token and email flow, and unverified parents cannot authenticate. When it is explicitly disabled, registration generates no token, sends no email, leaves `email_verified_at` NULL, and permits only enabled PARENT accounts to authenticate. OPERATOR and ADMIN verification behavior is unchanged. If verification is later enabled, an unverified persisted parent principal is rejected on the next request and its session is invalidated; the parent must complete verification and sign in again.

The controlled no-email pilot configuration is exactly `SB_PARENT_REGISTRATION_ENABLED=true`, `SB_PARENT_EMAIL_VERIFICATION_REQUIRED=false`, and `SB_MAIL_ENABLED=false`. For Windows isolated development, set those process variables before running `dev.ps1`. For persistent shared-data development, put them in the ignored `servisimibul-backend/.env` before running `dev-supabase.ps1`; that launcher writes real application data to shared Supabase but does not migrate it. Never commit the real `.env`, and do not change `SB_EMAIL_VERIFICATION_REQUIRED` as part of the PARENT policy.

The frontend exposes PARENT authentication only at `/parent/register` and `/parent/login`; OPERATOR and ADMIN authentication remains at `/operator/login`. Unauthenticated parent demand, support, comment, report, and notification actions return to `/parent/login` with only validated local demand or notification destinations. External and cross-role return targets are rejected. A parent login that resolves to another role immediately logs that session out instead of granting access through the parent surface.

An unverified parent email is a login identifier only, not evidence that the user owns the mailbox. Someone may register another person's address, and the rightful owner may be unable to claim it while generic duplicate responses prevent enumeration. Existing password recovery deliberately serves only verified accounts, so an unverified parent who loses the password has no email recovery path. Do not send personal information or security decisions to these addresses. Before broader launch, configure and review email delivery, enable parent verification, require existing unverified parents to complete the normal verification flow, and retain the request-time session enforcement during the transition.

The temporary synthetic parent bootstrap remains available only under the `local` profile and must verify both an explicit disposable-database flag and the isolated test-harness database marker before writing a hashed, email-verified account.

Demand list/detail reads are anonymous and return aggregate participation plus only the signed-in parent's own support when the principal is a `PARENT`. They never return creator/supporter identities, emails, student data, or pickup addresses. Demand, support, and feedback mutations require a `PARENT` session and CSRF; parent identity always comes from the authenticated session.

Demand-response list reads are also anonymous and must not create a session. They return only currently eligible ACTIVE response declarations with the public business name, contact phone, morning/afternoon directions, stable publication event identifier/version, and timestamp. Operator response reads and mutations require an OPERATOR session; POST/DELETE require CSRF, and ownership always comes from the principal. Every write and public read re-evaluates current eligibility. No request accepts an operator, response, vehicle, or offering identifier to establish authority.

Anonymous public endpoints should not persist a session unnecessarily; verify behavior in tests. Use environment variables and minimal session attributes. Implement account ownership checks server-side. Rate limit login, registration, verification, password recovery, and public search as appropriate. Suspension must deny future authentication, revoke existing sessions, and immediately remove the operator from public discovery.

## Operator application contract
Application states are exactly `DRAFT`, `PENDING`, `CHANGES_REQUESTED`, and `APPROVED` for MVP. Suspension is separate from application status, and there is no permanent `REJECTED` state. Submission/resubmission moves the application to `PENDING`; requesting corrections requires a reason and moves it to `CHANGES_REQUESTED`.

`app.operator-approval.required` defaults to `true`. In required mode, `DRAFT` may edit/submit, `PENDING` may read but not edit or manage resources, `CHANGES_REQUESTED` may edit/resubmit, and `APPROVED` may fully manage owned resources. Disabled or suspended operators cannot manage operator data. In explicitly disabled pilot mode, application state is preserved but does not gate management, eligible offering publication, or public discovery. Approval submit/resubmit/approve/request-correction writes return 409 Problem Details with code `approval_workflow_disabled`; administrator listing, history, moderation, and suspension remain available. `GET /api/v1/auth/me` exposes only the effective boolean and the authenticated operator's own status so the frontend does not infer deployment mode.

Validated profile edits by an approved operator take effect immediately without another admin review during MVP. `is_publicly_visible` defaults to `true` for new profiles and may be disabled or re-enabled without review, but publication remains derived from every approved visibility condition. Under approved decision D043, registration explicitly discloses before submission that an eligible public profile, its contact phone, and shared business information may be visible to anonymous visitors. No separate acknowledgement checkbox or pre-publication confirmation is required. D043 is a product decision, not a complete legal or KVKK assessment; independent legal review remains separate. Moderation or re-review after profile edits is deferred until pilot feedback establishes a concrete need.

Authentication email remains private. Public contact email is not part of MVP; the required contact phone is the only public contact channel.

## Vehicle and offering contract
Vehicle and ServiceOffering data are optional details and never gate the base operator discovery result. A ServiceOffering nevertheless requires an active vehicle owned by the same operator as its OperatorSchool. The API canonicalizes a vehicle plate by trimming, uppercasing, and removing spaces/hyphens before applying global uniqueness. Capacity is mandatory and greater than zero; nullable `availableSeats` must be between zero and that vehicle's capacity.

Vehicle hard deletion is not available in MVP. Deactivation transactionally unpublishes all dependent offerings, and reactivation does not publish them again. An offering draft may have no coverage, but publication requires at least one coverage item from the same OperatorSchool's general coverage plus an active owned vehicle. Removing general coverage must not leave an invalid published offering.

Vehicle create accepts `{plate,capacity}`. Vehicle PATCH accepts any non-empty subset of `{plate,capacity,active}`; either PATCH with `active=false` or the explicit deactivate endpoint performs the same transactional unpublish operation, while `active=true` reactivates only the vehicle. Offering create accepts `{operatorSchoolId,vehicleId,availableSeats?,description?}` and PATCH accepts any non-empty subset of those fields; explicit `null` clears the optional seat/description value. Relationship changes make an offering a draft, and changing its OperatorSchool clears its now-invalid offering coverage. Offering coverage replacement accepts `{neighborhoodIds:[...]}` and resolves only general coverage rows owned by the offering's OperatorSchool; an empty list is valid for a draft and unpublishes a currently published offering. Publication remains fail-closed unless coverage, active-owned-vehicle, active-school, and active-relationship checks all pass.

## Public endpoints (draft; refine before coding)
- `GET /api/v1/provinces`
- `GET /api/v1/districts?provinceId=...`
- `GET /api/v1/neighborhoods?districtId=...`
- `GET /api/v1/schools?query=...&provinceId=...&districtId=...&sort=name-asc&page=0&size=20`
- `GET /api/v1/schools/{id}`
- `GET /api/v1/operators?schoolId=...&neighborhoodId=...&page=0&size=20`
- `GET /api/v1/operators/{id}`
- `GET /api/v1/tariffs?provinceCode=...` (official JSON only)
- `GET /api/v1/demands?schoolId=...&neighborhoodId=...&academicYear=...&sort=newest&page=0&size=20`
- `GET /api/v1/demands/{id}`
- `GET /api/v1/demands/{id}/responses?page=0&size=20`

Demand listing returns only OPEN rows and accepts `sort=newest|most-supported`; both orders use creation timestamp and demand UUID tie-breakers. Omitting `academicYear` selects the configured current year. Detail reads may expose a non-open row so duplicate creation can return its canonical identity. Both reads expose aggregate supporter, morning, afternoon, and all six reason counts; an authenticated parent additionally receives only their own nullable support.

`POST /api/v1/demands` accepts `{schoolId,neighborhoodId,needsMorning,needsAfternoon,reasons}` and never accepts an academic year or parent identifier. It returns `{created,demand}` with 201 for a new row or 200 for an existing exact row; the latter never creates/reactivates support. `POST /api/v1/demands/{id}/support` creates or reactivates the caller's stable support row and is idempotent for an already-participating row. It may reopen only a demand closed for `INACTIVE`; `FULFILLED`, `ADMIN`, and `ARCHIVED` rows remain closed. Under D055, a parent without a support row may also reopen such a demand when it belongs to the configured current academic year and its school is active; otherwise the request returns 409 with `demand_not_reopenable` or `school_inactive`. `PUT` atomically replaces directions/reasons, and `DELETE` withdraws without deleting.

Demand response listing has stable `publishedAt DESC, response UUID DESC` ordering and includes only an OPEN demand's currently eligible ACTIVE rows. It exposes no authentication email, school-relationship identifier, vehicle, offering, seat, or price data. Responses are explicitly operator-declared and not platform-verified or guaranteed.

### Parent service feedback

- `GET /api/v1/demands/{demandId}/feedback` returns only the authenticated parent's own publication opportunities and history.
- `POST /api/v1/demands/{demandId}/feedback/open` records the first feedback-screen open idempotently and establishes the configured reminder/expiry timestamps. CSRF is required.
- `PUT /api/v1/demands/{demandId}/feedback/{publicationEventId}` accepts only `{satisfied:boolean}`, requires CSRF, and resolves only an awaiting opportunity owned by the caller.

All feedback routes require a `PARENT` session. No route accepts a parent/support identifier for authority. The scheduler locks and rechecks current state before reminders or expiry, so an explicit answer, newer publication, withdrawal, or reactivation wins over stale work. Reminder state is in-app only; REQ-06 sends no email or push.

### Demand comments

- `GET /api/v1/demands/{demandId}/comments?page=0&size=20` is anonymous, newest-first, stable, and returns only `PUBLISHED` comments; maximum size is 50.
- `POST /api/v1/demands/{demandId}/comments` accepts only `{body}` and derives the author from the authenticated session. An ACTIVE or AWAITING_FEEDBACK supporting `PARENT`, or an enabled/verified/active operator allowed by the effective approval policy, may post only while the demand is OPEN. CSRF is required.
- `DELETE /api/v1/demands/{demandId}/comments/{commentId}` hard-deletes only the caller's own comment and requires CSRF. Another user's comment is exposed as not found.

Bodies are trimmed plain text of 2–1000 characters. The same author/demand/exact body is rejected for 10 minutes; a configurable single-instance limit defaults to 5 attempts/account/10 minutes and returns 429 with `Retry-After`. Parent output is always `Veli` and contains no parent identifier. Operator output exposes a business name and operator-profile ID only when the existing public-discovery predicate matches the demand; otherwise it uses `Servis işletmecisi` with no link.

### Reporting and administrator moderation

- `POST /api/v1/reports` accepts `{targetType,targetId,reason,explanation?}` for enabled authenticated PARENT or OPERATOR accounts and requires CSRF. The principal supplies reporter identity and role; the body cannot select them. The default account limit is 5 attempts per 10 minutes. A duplicate contribution to the same active case returns 409. Missing, hidden, withdrawn, or closed targets use the same not-found response.
- `GET /api/v1/admin/moderation/cases` is ADMIN-only and supports zero-based pagination plus optional `status`, `targetType`, `reason`, `reportedFrom`, and exclusive `reportedTo` filters. Results expose immutable content context, current visibility, reason counts, and distinct reporter count, never reporter identity.
- `GET /api/v1/admin/moderation/cases/{caseId}` returns the bounded report explanations and append-only action history without reporter identities.
- `POST /api/v1/admin/moderation/cases/{caseId}/actions` accepts `{action,reason}`, requires ADMIN and CSRF, serializes the case/target mutation, and writes an audit event. Actions are `MARK_IN_REVIEW`, `DISMISS`, `RESOLVE_NO_ACTION`, `HIDE_COMMENT`, `RESTORE_COMMENT`, `WITHDRAW_SERVICE_RESPONSE`, `SUSPEND_OPERATOR`, and `CLOSE_DEMAND` subject to target/status compatibility.

Creating a report never changes target visibility or lifecycle. Only an explicit administrator action may hide/restore a comment, withdraw a response, close a demand, or suspend an operator. Suspension reuses the existing account-disable/session-revocation path. No AI moderation, universal administrator preapproval, automatic takedown threshold, or notification delivery is part of REQ-08; issue #90 owns notifications.

### In-app notifications

- `GET /api/v1/notifications` and `GET /api/v1/notifications/unread-count` require an authenticated PARENT, OPERATOR, or ADMIN and return only rows whose `recipient_user_id` is the current principal. Pagination is bounded and newest-first.
- `PUT /api/v1/notifications/{notificationId}/read` requires the same authenticated ownership plus CSRF. A notification owned by another account is exposed as not found.
- Delivery is part of the originating business transaction and uses a unique deterministic event key with conflict-safe insertion. Repeated demand, publication, lifecycle, or report handling therefore cannot create duplicate recipient/event rows.
- Notification links are backend-generated local application paths. The frontend validates that every link begins with `/`, polls the unread count only while visible at a bounded interval, and cancels obsolete requests during navigation or unmount.

Notifications never change demand, response, feedback, report, moderation, or account state. REQ-07 activates no SMTP, SMS, push, WebSocket, or inference service.

## Auth endpoints (draft)
- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register` — `{email,password,businessName?,contactPhone}`; generic `202 Accepted`
- `POST /api/v1/auth/parent/register` — `{email,password}`; role-fixed `PARENT`, generic `202 Accepted`, separately configuration-gated
- `POST /api/v1/auth/verify-email` — `{token}`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password` — `{email}`; generic `202 Accepted`
- `POST /api/v1/auth/reset-password` — `{token,newPassword}`
- `POST /api/v1/auth/login` — `{email,password,rememberMe}` where `rememberMe` defaults to `false`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Operator endpoints (draft)
- `GET/PATCH /api/v1/operator/profile`
- `GET /api/v1/operator/discovery-readiness`
- `GET/POST /api/v1/operator/schools`
- `PATCH/DELETE /api/v1/operator/schools/{id}`
- `PUT /api/v1/operator/schools/{id}/coverage`
- `GET/POST /api/v1/operator/vehicles`
- `GET/PATCH /api/v1/operator/vehicles/{id}`
- `POST /api/v1/operator/vehicles/{id}/deactivate`
- `GET/POST /api/v1/operator/offerings`
- `GET/PATCH /api/v1/operator/offerings/{id}`
- `PUT /api/v1/operator/offerings/{id}/coverage`
- `POST /api/v1/operator/offerings/{id}/publish`
- `POST /api/v1/operator/offerings/{id}/unpublish`
- `GET /api/v1/operator/demands/{id}/response`
- `POST /api/v1/operator/demands/{id}/response`
- `DELETE /api/v1/operator/demands/{id}/response`
- `POST /api/v1/operator/application/submit`
- `POST /api/v1/operator/application/resubmit`

## Admin endpoints (draft)
- `GET /api/v1/admin/operators?status=PENDING`
- `POST /api/v1/admin/operators/{id}/approve`
- `POST /api/v1/admin/operators/{id}/request-revision`
- `POST /api/v1/admin/operators/{id}/suspend` (requires a non-blank `{reason}`; D056)
- `GET /api/v1/admin/schools` (paginated active and inactive pilot catalog)
- `POST /api/v1/admin/schools`
- `PATCH /api/v1/admin/schools/{id}`
- `POST /api/v1/admin/schools/{id}/activate`
- `POST /api/v1/admin/schools/{id}/deactivate`
- `PUT /api/v1/admin/tariffs/{provinceCode}` (persistent validated JSON; request includes expected current version)

Public school list/detail responses expose only active schools. Geography lists and school results use deterministic name/id ordering. School create/patch fields are `neighborhoodId`, `name`, optional `address`, optional `sourceName`, optional `sourceCode`, and `active`; supplying `sourceCode` requires `sourceName`, and the source pair remains unique. PATCH is partial and explicit `null` clears optional fields. School CSV import is deferred by D019 and is not part of the current pilot API.

Public school browsing applies `query`, `provinceId`, and `districtId` before pagination. `sort` accepts only `name-asc` (the default) or `name-desc`; both directions use the normalized school name plus the school UUID as a deterministic tie-breaker, so paging cannot sort only a truncated frontend page. School-name search normalizes Turkish dotted/dotless I and Turkish diacritics in both the request text and the query-time school-name expression without changing stored names. The anonymous frontend keeps school-location filters visible after results render, resets to page zero when a filter or sort changes, and treats the later pickup district/neighborhood as a separate same-province choice.

Operator-school self-management never accepts an `operatorId`; ownership comes from the authenticated session. Create accepts `{schoolId,active?}` with `active` defaulting to `true`, and the school must currently be active. PATCH accepts exactly the mutable lifecycle field `{active}`. DELETE removes the owned relationship and its general coverage; future offering migrations must preserve their own integrity when they begin referencing this relationship.

`GET /api/v1/operator/discovery-readiness` is an authenticated, read-only view for the current session operator. It accepts no operator identifier and remains readable in both approval modes, including while an approval-required application is awaiting review; it does not grant school, coverage, vehicle, or offering management permission. The response reports `discoveryEligible`, account/email, profile-active, public-visibility, effective approval, active-school, and eligible-school-coverage gates plus per-school relationship activity, underlying school activity, valid general-coverage count, and whether that school contributes to discovery. A valid count includes only coverage in the school's province. The overall value means the operator is eligible for at least one configured school/neighborhood combination; it does not promise a match for every parent search.

The readiness result and anonymous discovery share the same publication conditions: verified enabled OPERATOR account, active and publicly visible profile, approval only when the effective policy requires it, and at least one active operator-school relationship to an active school with matching same-province general coverage. Integration tests exercise both approval modes and compare readiness with the actual anonymous search result. Vehicles and ServiceOfferings are optional enrichment and never contribute to this base eligibility result.

The demand-response eligibility read returns the current blockers and the caller's own nullable stable response. Publishing accepts only `{offersMorning,offersAfternoon}` and requires at least one direction. It succeeds immediately when the same full publication predicate matches the demand's exact active school and neighborhood coverage. An already-ACTIVE response returns `published=false` without changing directions, version, or event identity; reactivation updates directions, increments the version, and appends one publication event. DELETE withdraws the owned row without deleting history and is idempotent after the first withdrawal. There is no response-specific admin review step and no Vehicle or ServiceOffering prerequisite.

General coverage replacement accepts `{neighborhoodIds:[...]}`. An empty list clears coverage, repeated neighborhood IDs are rejected, and every referenced neighborhood must exist in the attached school's province; another district in that province is valid. The backend locks the owned operator-school row and replaces the entire set in one transaction. Another operator's relationship is returned as not found rather than disclosed.

General coverage replacement retains unchanged coverage rows so offering-specific references remain stable. Removed rows cascade only their dependent offering-coverage links; a published offering is automatically unpublished only when no valid coverage remains. Public operator discovery still paginates the distinct base operator result first, then fetches matching published offerings for only that page. A missing matching offering never removes a generally matching operator. Each public offering item contains `offeringId`, mandatory `vehicleCapacity`, nullable `availableSeats`, and nullable `description`; vehicle identifiers and plates are not public. Clients may render availability as `availableSeats/vehicleCapacity` (for example, `7/16`) when `availableSeats` is present and omit the availability indicator when it is absent.

## Tariff storage and write contract
Only the backend reads or writes the persistent filesystem directory configured by `SB_TARIFF_STORAGE_DIR`; the deployment mounts it on a writable persistent volume. Tariff content is never a classpath/JAR/frontend asset or a PostgreSQL fare table, and Supabase Storage is excluded for MVP. Do not expose storage credentials or filesystem paths to the browser.

An accepted admin update writes a new immutable version file and atomically replaces `current.json` using a temp file on the same filesystem. The client must send the version it read; a stale version returns 409 Problem Details with stable code `tariff_version_conflict` and changes no file. A rollback is another versioned write, not history mutation. Only one tariff-writer backend instance is supported until a distributed concurrency design is approved. Tariff files must satisfy D035's provenance, effective-date, interval, and integer-kuruş rules. A-09 must define and verify off-volume backup and restore.

The A-05 update body is `{expectedVersion, tariff}`. `expectedVersion` is explicitly `null` only for the first tariff of a province; every replacement supplies the current version returned by the public read. The tariff document fields are `provinceCode`, `provinceName`, `authority`, `academicYear`, `currency` (`TRY`), `effectiveFrom`, nullable `effectiveTo`, `sourceTitle`, `officialSourceUrl` (absolute HTTPS), `version`, optional `additionalKilometerRule`, optional bounded `notes`, and `bands`. Each band contains `minDistanceKm`, nullable `maxDistanceKm`, the legacy monthly `amountKurus`, and optional `annualAmountKurus`. If any annual amount or an additional-kilometer rule is present, every band supplies an annual amount. Without an additional-kilometer rule the final band remains unbounded; with one, the final fixed-band maximum is required and must equal `additionalKilometerRule.startsAfterDistanceKm`. The rule's `monthlyAmountPerKilometerKurus` and every band amount are nonnegative integer kuruş. The path and document province codes must match, versions are immutable, and a new version must differ from the current version. A-05 exposes only the current public read and ADMIN replacement; history selection and rollback endpoints remain outside its scope.

Storage is partitioned below the configured root as `<provinceCode>/current.json` and `<provinceCode>/versions/version-<version>.json`. Missing configuration returns safe `tariff_storage_unavailable` Problem Details without exposing a path. Missing province tariff data returns `tariff_not_found`; an invalid stored current document is never served.

## API standards
Use DTOs and never return entities containing password or token hashes. Errors use RFC Problem Details (`application/problem+json`) with `type`, `title`, `status`, `detail`, `instance`, a stable application `code`, optional `fieldErrors`, and an optional safe `traceId`. Never include credentials, tokens, cookie values, stack traces, or account-enumerating details.

Use 400 for validation/syntax, 401 for unauthenticated, 403 for unauthorized, 404 where resource privacy matters, 409 for state/uniqueness conflicts, and 429 for explicit rate-limit responses with `Retry-After`. Authentication and recovery endpoints may intentionally return the same generic success response for existing and nonexistent accounts.

Pagination uses a zero-based nonnegative `page`, `size` defaulting to 20 and limited to 1–50, deterministic stable ordering, and a response containing `content`, `page`, `size`, `totalElements`, and `totalPages`. Never let a client supply an arbitrary `operatorId` for self-management endpoints.

## B-10 rate limiting contract

The single-instance pilot uses validated, configurable in-memory policies. Limiter keys are salted SHA-256 fingerprints; plaintext emails, tokens, credentials, or cookie/session values are not retained. Client IP identity is the actual servlet network peer. `Forwarded` and `X-Forwarded-For` are ignored until a specific trusted-proxy topology is approved and tested.

Established values remain: login 10/account/15 minutes and 100/IP/15 minutes; registration, resend, and password recovery 20/IP/hour; eligible resend/recovery 5/account/hour plus the existing 60-second cooldown. Provisional values pending staging measurements are verification 60/IP and 5/token per 15 minutes, reset 30/IP and 5/token per 15 minutes, and anonymous operator search 120/IP/minute. Login limits count validly shaped attempts before credential success or failure. Endpoint IP limits count requests reaching the service after request validation. Eligible account limits count known eligible accounts without exposing whether an identity exists; cooldown short-circuits do not consume the account window. Token rules count attempts before token lookup. Search counts each validated controller request before the domain query.

Storage is divided into per-rule budgets so churn in one endpoint cannot consume every rule. Each budget reserves a protected tier for identities that repeat and a bounded least-recently-used probation tier for first attempts. A first attempt is admitted through probation even when the same rule is saturated; a second attempt is promoted when protected capacity exists. Protected multi-attempt entries are never evicted while live. When protected capacity is full, repeats move to a secret-hashed, constant-memory fixed-window overflow bucket that conservatively accounts for both attempts. This prevents one-shot identity churn from filling overflow buckets and indiscriminately denying every new identity on the same rule.

The bounded compromise is not collision-free. Probation eviction can forget a single earlier attempt, so companion IP/token rules remain essential. Sustained distributed identities that each repeat can fill the protected tier and overflow buckets; subsequent repeats sharing a bucket may be false positives, although their first attempt remains available. A process-secret hash makes targeted bucket selection impractical but cannot stop untargeted high-volume or botnet churn. Aggregate active-key, probation-eviction, and saturation metrics expose pressure without identities. State resets at restart, is not shared across instances, and overlapping deployments have independent limits. Multi-instance deployment requires a reviewed edge or distributed design.

## Frontend contract
Use Node.js 24 LTS with npm and commit `package-lock.json`. The frontend is a Vite React+TypeScript SPA with strict TypeScript, ESLint, and Prettier. Routing uses React Router Data Mode rather than Framework/SSR mode. Forms use React Hook Form with Zod; browser validation improves usability but never replaces backend validation. Tests use Vitest, React Testing Library, and MSW.

Production browser calls use the relative same-origin `/api/v1` path, and production serves the SPA and API from the same browser origin. Local Vite development proxies `/api` to Spring Boot so session cookies and CSRF behavior remain same-origin; do not enable permissive credentialed CORS as a shortcut. Browser-visible `VITE_*` values contain no secrets, database credentials, service-role keys, session secrets, or admin tokens.

## LinkedIn-Clone adaptation
Past security review identified risks: mutable token in singleton JwtService; broad/misordered matchers; direct User serialization; stale/disabled-user token behavior; unsafe localStorage JWT; overly broad CORS. Since ServisimiBul uses sessions, do NOT copy JwtService/JwtAuthFilter; reuse carefully reviewed password/identity/email patterns only. Independently inspect versions and source if attempting reuse; nothing from legacy repository is production-ready by assumption.
