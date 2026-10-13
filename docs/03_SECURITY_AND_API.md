# Security and API contract

## Authentication
Use Spring Security with stateful sessions persisted by Spring Session JDBC. Credential authentication is not Supabase Auth and is not JWT. Rotate the session identifier on login, invalidate the current session on logout, and protect every state-changing browser request against CSRF, including registration, verification, login, password reset, and logout.

The cookie is named `SBSESSION`, is HttpOnly, uses `SameSite=Lax`, path `/`, and no `Domain` attribute. It is `Secure` in every non-local environment; explicit local HTTP development may disable only the Secure flag. The production SPA and `/api/v1` are served from the same browser origin. Development should use a same-origin proxy; if cross-origin development is unavoidable, allow only explicit origins with credentials and a reviewed CSRF design. Never use wildcard credentialed CORS.

Normal login has a 30-minute inactivity timeout and a browser-session cookie. Selecting “Remember me” creates a persistent server-side session and cookie with a non-sliding 90-day absolute lifetime. Remembered activity must not extend that absolute deadline. Allow at most two sessions per account; a third login invalidates the oldest. Password or primary-email changes, password reset, account disablement, operator suspension, and role changes invalidate every session belonging to the identity. Logout invalidates only the current session.

Public registration accepts `email`, `password`, `businessName`, and `contactPhone`, always assigns `OPERATOR`, and creates a `DRAFT` application. Normalize email consistently. Passwords are 12–64 characters and at most 72 UTF-8 bytes; do not require arbitrary character classes. Email verification is required before login. Verified but unapproved operators may log in only to the limited operator workflow allowed by their application state.

Registration validation uses a trimmed, case-normalized email of at most 254 characters; a trimmed business name of 2–120 characters; and a contact phone stored in E.164 form (`+` followed by 8–15 digits). The frontend may accept and format familiar Turkish input, but the API persists and returns the canonical phone form.

Verification tokens are random, stored only as hashes, single-use, and valid for 24 hours. Issuing a new token invalidates earlier unconsumed tokens. Resend has a 60-second per-account cooldown and rolling limits of 5/account/hour and 20/IP/hour. The link opens a frontend GET route; that page submits the token to the API with POST. Registration and resend return a generic result that does not disclose account existence.

Password recovery uses the same non-enumerating response rule. Reset tokens are random, hashed, single-use, and valid for 30 minutes. A successful reset revokes all sessions without changing verification or operator-approval state.

Exactly two initial admins are created by an explicitly enabled, one-shot backend bootstrap command using temporary environment credentials. It is not exposed over HTTP, refuses any public ADMIN registration path, requires exactly two configured admin identities, does not log secrets, and does not replace an existing admin password when rerun.

Anonymous public endpoints should not persist a session unnecessarily; verify behavior in tests. Use environment variables and minimal session attributes. Implement account ownership checks server-side. Rate limit login, registration, verification, password recovery, and public search as appropriate. Suspension must deny future authentication, revoke existing sessions, and immediately remove the operator from public discovery.

## Operator application contract
Application states are exactly `DRAFT`, `PENDING`, `CHANGES_REQUESTED`, and `APPROVED` for MVP. Suspension is separate from application status, and there is no permanent `REJECTED` state. Submission/resubmission moves the application to `PENDING`; requesting corrections requires a reason and moves it to `CHANGES_REQUESTED`.

Validated profile edits by an approved operator take effect immediately without another admin review during MVP. `is_publicly_visible` defaults to `true` for new profiles and may be disabled or re-enabled without review, but publication remains derived from every approved visibility condition. Moderation or re-review after profile edits is deferred until pilot feedback establishes a concrete need.

Authentication email remains private. Public contact email is not part of MVP; the required contact phone is the only public contact channel.

## Public endpoints (draft; refine before coding)
- `GET /api/v1/provinces`
- `GET /api/v1/districts?provinceId=...`
- `GET /api/v1/neighborhoods?districtId=...`
- `GET /api/v1/schools?query=...`
- `GET /api/v1/operators?schoolId=...&neighborhoodId=...&page=0&size=20`
- `GET /api/v1/operators/{id}`
- `GET /api/v1/tariffs?provinceId=...` (official JSON only)

## Auth endpoints (draft)
- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register` — `{email,password,businessName,contactPhone}`; generic `202 Accepted`
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
- `PUT /api/v1/operator/schools/{id}/coverage`
- `GET/POST/PATCH /api/v1/operator/offerings[/{id}]`
- `PUT /api/v1/operator/offerings/{id}/coverage`
- `POST /api/v1/operator/application/submit`
- `POST /api/v1/operator/application/resubmit`

## Admin endpoints (draft)
- `GET /api/v1/admin/operators?status=PENDING`
- `POST /api/v1/admin/operators/{id}/approve`
- `POST /api/v1/admin/operators/{id}/request-revision`
- `POST /api/v1/admin/operators/{id}/suspend`
- `GET/POST/PATCH /api/v1/admin/schools[/{id}]`
- `PUT /api/v1/admin/tariffs/{provinceCode}` (persistent validated JSON)

School CSV import is deferred by D019 and is not part of the current pilot API.

## API standards
Use DTOs and never return entities containing password or token hashes. Errors use RFC Problem Details (`application/problem+json`) with `type`, `title`, `status`, `detail`, `instance`, a stable application `code`, optional `fieldErrors`, and an optional safe `traceId`. Never include credentials, tokens, cookie values, stack traces, or account-enumerating details.

Use 400 for validation/syntax, 401 for unauthenticated, 403 for unauthorized, 404 where resource privacy matters, 409 for state/uniqueness conflicts, and 429 for explicit rate-limit responses with `Retry-After`. Authentication and recovery endpoints may intentionally return the same generic success response for existing and nonexistent accounts.

Pagination uses a zero-based nonnegative `page`, `size` defaulting to 20 and limited to 1–50, deterministic stable ordering, and a response containing `content`, `page`, `size`, `totalElements`, and `totalPages`. Never let a client supply an arbitrary `operatorId` for self-management endpoints.

## LinkedIn-Clone adaptation
Past security review identified risks: mutable token in singleton JwtService; broad/misordered matchers; direct User serialization; stale/disabled-user token behavior; unsafe localStorage JWT; overly broad CORS. Since ServisimiBul uses sessions, do NOT copy JwtService/JwtAuthFilter; reuse carefully reviewed password/identity/email patterns only. Independently inspect versions and source if attempting reuse; nothing from legacy repository is production-ready by assumption.
