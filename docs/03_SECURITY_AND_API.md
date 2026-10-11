# Security and API contract — design direction

## Authentication
Use Spring Security with stateful session, HttpOnly cookie, HTTPS+Secure in production, SameSite strategy based on deployment, Spring Session JDBC proposed for persistence. Protect mutating methods against CSRF (including login/logout). Rotate session identifier upon login; invalidate session on logout; terminate access after suspension. Email verification must happen before any login. Credential auth is not Supabase Auth and is not JWT.

Prefer SPA served under same origin as `/api/v1`. Any cross-origin cookie setup needs explicit allowed origins + credentials and CSRF design. No wildcard credentialed CORS. Anonymous public endpoints should not persist a session unnecessarily; verify behavior in tests. Use environment variables and minimal session attributes. Implement account ownership checks server-side. Rate limit login, register, email verification and public search as appropriate.

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
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Operator endpoints (draft)
- `GET/PATCH /api/v1/operator/profile`
- `GET/POST /api/v1/operator/schools`
- `PUT /api/v1/operator/schools/{id}/coverage`
- `GET/POST/PATCH /api/v1/operator/offerings[/{id}]`
- `PUT /api/v1/operator/offerings/{id}/coverage`
- `POST /api/v1/operator/application/resubmit`

## Admin endpoints (draft)
- `GET /api/v1/admin/operators?status=PENDING`
- `POST /api/v1/admin/operators/{id}/approve`
- `POST /api/v1/admin/operators/{id}/request-revision`
- `POST /api/v1/admin/operators/{id}/suspend`
- `GET/POST/PATCH /api/v1/admin/schools[/{id}]`
- `POST /api/v1/admin/schools/imports?dryRun=...`
- `PUT /api/v1/admin/tariffs/{provinceCode}` (persistent validated JSON)

## API standards
Use DTOs (never return entities containing password hash), validation, stable pagination, `ProblemDetail` or equivalent structured errors, 401 unauthenticated vs 403 unauthorized; 404 where resource privacy matters; 409 conflicts. Propose HTTP contract revisions for human approval before code. Never let a client supply arbitrary operator_id for self-management endpoints.

## LinkedIn-Clone adaptation
Past security review identified risks: mutable token in singleton JwtService; broad/misordered matchers; direct User serialization; stale/disabled-user token behavior; unsafe localStorage JWT; overly broad CORS. Since ServisimiBul uses sessions, do NOT copy JwtService/JwtAuthFilter; reuse carefully reviewed password/identity/email patterns only. Independently inspect versions and source if attempting reuse; nothing from legacy repository is production-ready by assumption.
