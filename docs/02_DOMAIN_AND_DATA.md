# Domain model and data invariants

## Geography and school
`Province(id BIGINT, code, name)` -> `District(id BIGINT, province_id, name)` -> `Neighborhood(id BIGINT, district_id, name)` -> `School(id UUID, neighborhood_id, name, address?, source_name?, source_code?, is_active, created_at, updated_at)`.

Existing manually created schema is described in `05_REPO_STATE.md`; new migration must reproduce it faithfully or explicitly document reviewed differences. Use `UNIQUE(province_id, district.name)` and `UNIQUE(district_id, neighborhood.name)`; school source code uniqueness is scoped by source, when both provided. No cross-province coverage.

## Identity and operator
`AppUser(id UUID, email UNIQUE, password_hash, role ADMIN|OPERATOR, is_enabled, email_verified_at, timestamps)` is stored in the approved `app_user` SQL table.
`OperatorProfile(id UUID, user_id UNIQUE FK, business_name NOT NULL, contact_phone NOT NULL, optional description, approval_status, is_active, is_publicly_visible, timestamps)`.
A required public phone does NOT mean profile automatically visible; public visibility still needs approval and flags. Keep private authentication email and public contact fields separate.
`EmailVerificationToken(user_id, token_hash, expires_at, consumed_at)`, `PasswordResetToken(user_id, token_hash, expires_at, consumed_at)`, and `OperatorApplicationReview(operator_id, reviewed_by, decision, reason?, timestamp)` are added during the auth/application stage. Tokens are stored only as hashes and are single-use. Review decisions are exactly `APPROVED` and `CHANGES_REQUESTED`; a correction request requires a reason, and the operator may revise/re-submit. Suspension remains separate.

Authentication email is never public in MVP. The mandatory contact phone is the sole public contact channel. Registration accepts email, password, business name, and contact phone and creates only an operator application in `DRAFT`; ADMIN identities are bootstrap-only.

## School/coverage relationships
`OperatorSchool(id UUID, operator_id FK, school_id FK, is_active, UNIQUE(operator_id,school_id))`.
`OperatorSchoolCoverage(id UUID, operator_school_id FK, neighborhood_id FK, UNIQUE(operator_school_id,neighborhood_id))`.
Only neighborhoods belonging to the school province allowed, even if in different district. Enforce at service and test; DB-level strengthening can follow explicit design review.

## Optional detail — not required to find an operator
`Vehicle(id UUID, operator_id FK, plate?, capacity?, is_active)` and `ServiceOffering(id UUID, operator_school_id FK, vehicle_id nullable FK, available_seats nullable >=0, description nullable, is_published)`.
`ServiceOfferingCoverage(service_offering_id FK, operator_school_coverage_id FK, UNIQUE pair)` links each offering to subset of its own general school coverage. Verify offering and chosen general coverage share identical `operator_school_id` transactionally. Consider stronger compound FK only after review. An offering draft may have zero coverage; publishing requires at least one valid coverage and other required conditions. An operator with zero offerings MUST remain discoverable if general rules match.

## Discovery logic
`match operator` iff verified user & enabled account & approved operator & active operator & public visibility true & active school & active OperatorSchool & general coverage matches selected school/neighborhood. Public name and contact phone included. ServiceOffering does NOT appear as mandatory join; optionally load only published offerings whose specific coverage matches school+neighborhood. Paginate DISTINCT operators before fetching offering details. No price estimate if distance is not known.

## Lifecycle
New registration → `DRAFT` with email unverified (no login) → email verified → limited operator dashboard → explicit submission to `PENDING`. Admin approval moves to `APPROVED`; a correction request with an explanation moves to `CHANGES_REQUESTED`; re-submission returns to `PENDING`. There is no permanent `REJECTED` application state in MVP. Suspension is a separate account/profile condition that revokes sessions and removes public visibility.

New operator profiles default `is_publicly_visible` to `true`. This preference alone never publishes a profile: every discovery request still evaluates the complete publication predicate. Validated edits by an approved operator take effect immediately and do not trigger renewed admin review in MVP. Switching public visibility off or on also does not require review. A future moderation/re-review design is deferred until pilot evidence justifies it. Duplicate `isPublished` operator state remains forbidden; derive actual visibility.

## UKOME pricing
MVP stores ONLY official UKOME tariff in admin-editable JSON outside packaged JAR (location not final), with city, authority, academic year, source, effective dates and distance brackets (amounts exact integer kuruş recommended). Backend validates nonnegative prices, valid nonoverlapping intervals, provenance and dates; admin endpoint writes atomically and restricts concurrent edits. Never claim fee in a band is an operator quote or that neighborhood establishes exact km. No fare DB tables; no monthly_price in MVP ServiceOffering.

## Data retention and privacy
Do not collect student identifiers, home addresses, passwords in responses or excessive user PII. FK/unique/check/index constraints protect integrity. All DDL managed by Flyway once baseline strategy chosen. Keep schools and geo catalog separate from user input.
