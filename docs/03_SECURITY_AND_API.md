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

Anonymous public endpoints should not persist a session unnecessarily; verify behavior in tests. Use environment variables and minimal session attributes. Implement account ownership checks server-side. Rate limit login, registration, verification, password recovery, and public search as appropriate. Suspension must deny future authentication, revoke existing sessions, and immediately remove the operator from public discovery.

## Operator application contract
Application states are exactly `DRAFT`, `PENDING`, `CHANGES_REQUESTED`, and `APPROVED` for MVP. Suspension is separate from application status, and there is no permanent `REJECTED` state. Submission/resubmission moves the application to `PENDING`; requesting corrections requires a reason and moves it to `CHANGES_REQUESTED`.

`app.operator-approval.required` defaults to `true`. In required mode, `DRAFT` may edit/submit, `PENDING` may read but not edit or manage resources, `CHANGES_REQUESTED` may edit/resubmit, and `APPROVED` may fully manage owned resources. Disabled or suspended operators cannot manage operator data. In explicitly disabled pilot mode, application state is preserved but does not gate management, eligible offering publication, or public discovery. Approval submit/resubmit/approve/request-correction writes return 409 Problem Details with code `approval_workflow_disabled`; administrator listing, history, moderation, and suspension remain available. `GET /api/v1/auth/me` exposes only the effective boolean and the authenticated operator's own status so the frontend does not infer deployment mode.

Validated profile edits by an approved operator take effect immediately without another admin review during MVP. `is_publicly_visible` defaults to `true` for new profiles and may be disabled or re-enabled without review, but publication remains derived from every approved visibility condition. The registration form identifies the required phone as public, but there is currently no separate acknowledgement or pre-publication confirmation. D028 remains unchanged; whether the approval-disabled pilot needs an additional explicit disclosure/confirmation is an open product/legal decision. Moderation or re-review after profile edits is deferred until pilot feedback establishes a concrete need.

Authentication email remains private. Public contact email is not part of MVP; the required contact phone is the only public contact channel.

## Vehicle and offering contract
Vehicle and ServiceOffering data are optional details and never gate the base operator discovery result. A ServiceOffering nevertheless requires an active vehicle owned by the same operator as its OperatorSchool. The API canonicalizes a vehicle plate by trimming, uppercasing, and removing spaces/hyphens before applying global uniqueness. Capacity is mandatory and greater than zero; nullable `availableSeats` must be between zero and that vehicle's capacity.

Vehicle hard deletion is not available in MVP. Deactivation transactionally unpublishes all dependent offerings, and reactivation does not publish them again. An offering draft may have no coverage, but publication requires at least one coverage item from the same OperatorSchool's general coverage plus an active owned vehicle. Removing general coverage must not leave an invalid published offering.

Vehicle create accepts `{plate,capacity}`. Vehicle PATCH accepts any non-empty subset of `{plate,capacity,active}`; either PATCH with `active=false` or the explicit deactivate endpoint performs the same transactional unpublish operation, while `active=true` reactivates only the vehicle. Offering create accepts `{operatorSchoolId,vehicleId,availableSeats?,description?}` and PATCH accepts any non-empty subset of those fields; explicit `null` clears the optional seat/description value. Relationship changes make an offering a draft, and changing its OperatorSchool clears its now-invalid offering coverage. Offering coverage replacement accepts `{neighborhoodIds:[...]}` and resolves only general coverage rows owned by the offering's OperatorSchool; an empty list is valid for a draft and unpublishes a currently published offering. Publication remains fail-closed unless coverage, active-owned-vehicle, active-school, and active-relationship checks all pass.

## Public endpoints (draft; refine before coding)
- `GET /api/v1/provinces`
- `GET /api/v1/districts?provinceId=...`
- `GET /api/v1/neighborhoods?districtId=...`
- `GET /api/v1/schools?query=...&provinceId=...&districtId=...&page=0&size=20`
- `GET /api/v1/schools/{id}`
- `GET /api/v1/operators?schoolId=...&neighborhoodId=...&page=0&size=20`
- `GET /api/v1/operators/{id}`
- `GET /api/v1/tariffs?provinceCode=...` (official JSON only)

## Auth endpoints (draft)
- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register` — `{email,password,businessName?,contactPhone}`; generic `202 Accepted`
- `POST /api/v1/auth/verify-email` — `{token}`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password` — `{email}`; generic `202 Accepted`
- `POST /api/v1/auth/reset-password` — `{token,newPassword}`
- `POST /api/v1/auth/login` — `{email,password,rememberMe}` where `rememberMe` defaults to `false`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Operator endpoints (draft)
- `GET/PATCH /api/v1/operator/profile`
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
- `POST /api/v1/operator/application/submit`
- `POST /api/v1/operator/application/resubmit`

## Admin endpoints (draft)
- `GET /api/v1/admin/operators?status=PENDING`
- `POST /api/v1/admin/operators/{id}/approve`
- `POST /api/v1/admin/operators/{id}/request-revision`
- `POST /api/v1/admin/operators/{id}/suspend`
- `GET /api/v1/admin/schools` (paginated active and inactive pilot catalog)
- `POST /api/v1/admin/schools`
- `PATCH /api/v1/admin/schools/{id}`
- `POST /api/v1/admin/schools/{id}/activate`
- `POST /api/v1/admin/schools/{id}/deactivate`
- `PUT /api/v1/admin/tariffs/{provinceCode}` (persistent validated JSON; request includes expected current version)

Public school list/detail responses expose only active schools. Geography lists and school results use deterministic name/id ordering. School create/patch fields are `neighborhoodId`, `name`, optional `address`, optional `sourceName`, optional `sourceCode`, and `active`; supplying `sourceCode` requires `sourceName`, and the source pair remains unique. PATCH is partial and explicit `null` clears optional fields. School CSV import is deferred by D019 and is not part of the current pilot API.

Operator-school self-management never accepts an `operatorId`; ownership comes from the authenticated session. Create accepts `{schoolId,active?}` with `active` defaulting to `true`, and the school must currently be active. PATCH accepts exactly the mutable lifecycle field `{active}`. DELETE removes the owned relationship and its general coverage; future offering migrations must preserve their own integrity when they begin referencing this relationship.

General coverage replacement accepts `{neighborhoodIds:[...]}`. An empty list clears coverage, repeated neighborhood IDs are rejected, and every referenced neighborhood must exist in the attached school's province; another district in that province is valid. The backend locks the owned operator-school row and replaces the entire set in one transaction. Another operator's relationship is returned as not found rather than disclosed.

General coverage replacement retains unchanged coverage rows so offering-specific references remain stable. Removed rows cascade only their dependent offering-coverage links; a published offering is automatically unpublished only when no valid coverage remains. Public operator discovery still paginates the distinct base operator result first, then fetches matching published offerings for only that page. A missing matching offering never removes a generally matching operator. Each public offering item contains `offeringId`, mandatory `vehicleCapacity`, nullable `availableSeats`, and nullable `description`; vehicle identifiers and plates are not public. Clients may render availability as `availableSeats/vehicleCapacity` (for example, `7/16`) when `availableSeats` is present and omit the availability indicator when it is absent.

## Tariff storage and write contract
Only the backend reads or writes the persistent filesystem directory configured by `SB_TARIFF_STORAGE_DIR`; the deployment mounts it on a writable persistent volume. Tariff content is never a classpath/JAR/frontend asset or a PostgreSQL fare table, and Supabase Storage is excluded for MVP. Do not expose storage credentials or filesystem paths to the browser.

An accepted admin update writes a new immutable version file and atomically replaces `current.json` using a temp file on the same filesystem. The client must send the version it read; a stale version returns 409 Problem Details with stable code `tariff_version_conflict` and changes no file. A rollback is another versioned write, not history mutation. Only one tariff-writer backend instance is supported until a distributed concurrency design is approved. Tariff files must satisfy D035's provenance, effective-date, interval, and integer-kuruş rules. A-09 must define and verify off-volume backup and restore.

The A-05 update body is `{expectedVersion, tariff}`. `expectedVersion` is explicitly `null` only for the first tariff of a province; every replacement supplies the current version returned by the public read. The tariff document fields are `provinceCode`, `provinceName`, `authority`, `academicYear`, `currency` (`TRY`), `effectiveFrom`, `effectiveTo`, `sourceTitle`, `officialSourceUrl` (absolute HTTPS), `version`, and `bands`. Each band contains `minDistanceKm`, nullable `maxDistanceKm`, and nonnegative integer `amountKurus`. The path and document province codes must match, versions are immutable, and a new version must differ from the current version. A-05 exposes only the current public read and ADMIN replacement; history selection and rollback endpoints remain outside its scope.

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
