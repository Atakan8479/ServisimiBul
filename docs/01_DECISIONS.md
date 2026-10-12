# Architecture decision register — approved vs unresolved

Approval state is important: never turn a proposal into a settled decision without developer confirmation.

## APPROVED decisions
| ID | Decision | Rationale/consequence |
|---|---|---|
| D001 | Java 21; Spring Boot; Maven; React + TypeScript; PostgreSQL via Supabase; modular monolith | Existing backend is the base. |
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

## PROPOSED (not yet approved)
- Spring Session JDBC implementation for production-like server sessions (chosen design direction, assess compatibility and resource budget).
- Initial operator `is_publicly_visible` defaults to `false` until explicitly enabled.
- Verified-but-not-approved operators may access a limited dashboard to prepare/correct applications; email not verified still cannot log in.
- Application status details: `PENDING`, `CHANGES_REQUESTED`, `REVISION_IN_PROGRESS`, `APPROVED`; whether permanent `REJECTED`/suspension is a separate state is unresolved.
- `ServiceOfferingCoverage` referencing `OperatorSchoolCoverage` plus transactional consistency validation.
- Same-origin production frontend/API deployment to simplify cookies/CORS.

## DEFERRED (not current scope)
- School CSV import, full-catalog ingestion, and automated school synchronization. Revisit only after pilot usage demonstrates a need; approve the source, duplicate rules, preview/commit behavior, and error policy before implementation.

## OPEN questions requiring explicit resolution before relevant implementation
1. Session timeout, session revocation rules on suspension, frontend/API hosting origin and cookie deployment policy.
2. Email token TTL, resend rate limit, verification link finalization (GET view + POST consume proposed).
3. Final operator application states, effects of post-approval profile changes, whether admin has to review profile changes.
4. **Deferred by D019:** source of Istanbul school/neighborhood reference data and import duplicate/error policy. This is not a blocker for pilot admin CRUD.
5. Where admin-editable tariff JSON is persistently stored (volume/object storage), backup, concurrency, versioning, UKOME source and effective-date rules.
6. Whether/when operator-specific prices may be added after MVP and their legal/display policy.
7. Whether fields such as public contact email are optional and how displayed.

## Decision change procedure
When an approved decision changes: update this document, related domain/API/roadmap files, acceptance tests and task scope in the same reviewed PR. Never silently overwrite the old rule.
