# Architecture decision register — approved vs unresolved

Approval state is important: never turn a proposal into a settled decision without developer confirmation.

## APPROVED decisions
| ID | Decision | Rationale/consequence |
|---|---|---|
| D001 | Java 21 source/bytecode compatibility; JDK 25 developer toolchain; Spring Boot; Maven; React + TypeScript; PostgreSQL via Supabase; modular monolith | Existing backend is the base. JDK 25 may run Maven and IntelliJ, but Maven must continue compiling with Java 21 compatibility. |
| D002 | Flyway owns schema migrations; Hibernate `ddl-auto=validate` | Avoid manual database drift. |
| D003 | Supabase provides PostgreSQL, NOT Supabase Auth | Spring Security is responsible for identity. |
| D004 | Server-side sessions + HttpOnly cookie, NOT JWT | CSRF protection and secure session lifecycle needed. Spring Session JDBC is recommended, still inspect compatibility. |
| D005 | Email verification must precede login | Account enabled/suspension state is separate from email verification. |
| D006 | Same province coverage allowed across districts | Validate school province equals coverage neighborhood province. |
| D007 | Admin CRUD and bulk CSV import were originally approved for the school catalog | Superseded for pilot sequencing by D019; retained here as decision history. |
| D008 | Operator automatically appears once ALL publication requirements are satisfied | Derive visibility at query time; no second manual public approval. |
| D009 | Operator business name and public contact phone REQUIRED | Contact phone shown on public operator profile; no contact-publish-toggle field. Can hide entire public profile. |
| D010 | Admin refusal of correctable operator application sends operator to editing/resubmission path | Reasons/audit retained; correction is not permanent ban. |
| D011 | ServiceOffering optional; each offering has independent neighborhood coverage | OfferingCoverage must be subset of OperatorSchoolCoverage. |
| D012 | UKOME official distance price bands as JSON, updated from admin panel | No UKOME PostgreSQL fare tables. Persistent writable storage required. |
| D013 | Price model C: MVP shows official UKOME tariff only; operator-specific prices deferred | Do not add `monthly_price` to MVP ServiceOffering, do not assign exact distance using neighborhood alone. |
| D014 | Costs monitored manually initially; Supabase Free preferred for development | Do not opt into paid plan without approval. |
| D015 | Parents anonymous; students have no personal records | Preserve zero-account public discovery. |
| D016 | Secure bootstrap for two ADMIN accounts | Public registration creates OPERATOR only. |
| D017 | Adopt Flyway through a controlled drop and recreation of the four existing empty geography tables | Read-only inspection on 2026-10-12 verified `province`, `district`, `neighborhood`, and `school` have zero rows and no Flyway or Supabase migration history. Destructive execution still requires a separately reviewed plan and explicit approval. |
| D018 | Gate 2 schema/security contract: V1 retains `province.created_at`, reproduces the inspected geography schema, keeps RLS enabled, removes `anon`/`authenticated` table and sequence access (including Flyway-owner defaults), and leaves `service_role` unchanged | `postgres` is used only for controlled migrations/administration. A separately provisioned `servisimibul_app` login receives only explicit object grants and table-scoped backend RLS policies; it is not a Data API role and does not receive `BYPASSRLS`. Approved 2026-10-12. |
| D019 | Pilot school catalog is curated manually through admin CRUD and initially contains only schools the team is actively testing with | Do not scrape, synchronize, bulk import, or attempt to preload all Istanbul schools now. Bulk CSV import is deferred, not permanently rejected, and requires a new explicit decision before implementation. Approved 2026-10-12. |
| D020 | Public registration accepts email, password, business name, and contact phone; it creates only an `OPERATOR` in `DRAFT` | Email verification is required before login. Registration, resend, and password-recovery responses must not reveal whether an account exists. Passwords are 12–64 characters and at most 72 UTF-8 bytes, without composition rules. Approved 2026-10-13. |
| D021 | Verification and password-reset links are finalized by a frontend GET page that POSTs the token to the API | Verification tokens are hashed, single-use, expire after 24 hours, and a resend invalidates earlier tokens. Resend has a 60-second cooldown and limits of 5/account/hour and 20/IP/hour. Password-reset tokens are hashed, single-use, expire after 30 minutes, and a successful reset revokes every session. Approved 2026-10-13. |
| D022 | Spring Session JDBC stores server-side sessions; production frontend and `/api/v1` are same-origin | Normal login uses a 30-minute inactivity session. “Remember me” is optional and gives a persistent session with a non-sliding 90-day absolute lifetime. At most two sessions may exist per account; a third login removes the oldest. Password/primary-email changes, password reset, account disablement, suspension, or role change revoke all sessions. Approved 2026-10-13. |
| D023 | Session cookie contract: `SBSESSION`, HttpOnly, `SameSite=Lax`, path `/`, and no `Domain` attribute | `Secure=true` everywhere except explicit local HTTP development. CSRF applies to every state-changing browser request, including authentication endpoints. No JWT or browser token storage. Approved 2026-10-13. |
| D024 | Operator application states are `DRAFT`, `PENDING`, `CHANGES_REQUESTED`, and `APPROVED`; suspension is separate | Verified operators may use a limited dashboard. Submit/resubmit moves to `PENDING`; correction requests require a reason. There is no permanent `REJECTED` state in MVP. Approved operators' validated profile edits take effect immediately without renewed admin approval; moderation/re-review may be reconsidered later. Approved 2026-10-13. |
| D025 | Two admins are created only through an explicitly enabled, one-shot backend bootstrap command | It reads temporary environment credentials, is unavailable over HTTP, requires exactly two admin identities, never logs secrets, and does not change existing admin passwords on rerun. Approved 2026-10-13. |
| D026 | APIs use RFC Problem Details plus stable application error codes; pagination is zero-based with default size 20 and maximum size 50 | Validation may include field errors; sensitive details are omitted. Use 400/401/403/404/409/429 consistently and `Retry-After` for explicit rate-limit responses. Results require stable ordering. Approved 2026-10-13. |
| D027 | Public contact email is excluded from MVP | Mandatory public contact phone is the sole public contact channel. Authentication email remains private. Approved 2026-10-13. |
| D028 | New operator profiles default `is_publicly_visible` to `true` | This does not bypass publication rules: the operator appears only when every derived publication condition is satisfied. The operator may hide the profile at any time. Approved 2026-10-13. |

## PROPOSED (not yet approved)
- `ServiceOfferingCoverage` referencing `OperatorSchoolCoverage` plus transactional consistency validation.

## DEFERRED (not current scope)
- School CSV import, full-catalog ingestion, and automated school synchronization. Revisit only after pilot usage demonstrates a need; approve the source, duplicate rules, preview/commit behavior, and error policy before implementation.

## OPEN questions requiring explicit resolution before relevant implementation
1. **Deferred by D019:** source of Istanbul school/neighborhood reference data and import duplicate/error policy. This is not a blocker for pilot admin CRUD.
2. Where admin-editable tariff JSON is persistently stored (volume/object storage), backup, concurrency, versioning, UKOME source and effective-date rules.
3. Whether/when operator-specific prices may be added after MVP and their legal/display policy.
4. Whether post-approval profile moderation or re-review is needed after pilot feedback; MVP edits take effect immediately under D024.

## Decision change procedure
When an approved decision changes: update this document, related domain/API/roadmap files, acceptance tests and task scope in the same reviewed PR. Never silently overwrite the old rule.
