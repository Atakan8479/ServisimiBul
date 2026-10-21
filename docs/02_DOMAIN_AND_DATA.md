# Domain model and data invariants

## Geography and school
`Province(id BIGINT, code, name)` -> `District(id BIGINT, province_id, name)` -> `Neighborhood(id BIGINT, district_id, name)` -> `School(id UUID, neighborhood_id, name, address?, source_name?, source_code?, is_active, created_at, updated_at)`.

Existing manually created schema is described in `05_REPO_STATE.md`; new migration must reproduce it faithfully or explicitly document reviewed differences. Use `UNIQUE(province_id, district.name)` and `UNIQUE(district_id, neighborhood.name)`; school source code uniqueness is scoped by source, when both provided. No cross-province coverage.

## Identity and operator
`AppUser(id UUID, email UNIQUE, password_hash, role ADMIN|OPERATOR|PARENT, is_enabled, email_verified_at, timestamps)` is stored in the approved `app_user` SQL table. A `PARENT` needs no profile record; anonymous discovery remains available without an account.
`OperatorProfile(id UUID, user_id UNIQUE FK, optional business_name, contact_phone NOT NULL, optional description, approval_status, is_active, is_publicly_visible, timestamps)`.
A required public phone does NOT mean profile automatically visible; public visibility still needs the effective approval policy and all independent flags. Keep private authentication email and public contact fields separate.
`EmailVerificationToken(user_id, token_hash, expires_at, consumed_at)`, `PasswordResetToken(user_id, token_hash, expires_at, consumed_at)`, and `OperatorApplicationReview(operator_id, reviewed_by, decision, reason?, timestamp)` are added during the auth/application stage. Tokens are stored only as hashes and are single-use. Review decisions are exactly `APPROVED` and `CHANGES_REQUESTED`; a correction request requires a reason, and the operator may revise/re-submit. Suspension remains separate.

Authentication email is never public in MVP. The mandatory contact phone is the sole public contact channel. Registration accepts email, password, optional business name, and contact phone and creates only an operator application in `DRAFT`; ADMIN identities are bootstrap-only.

## School/coverage relationships
`OperatorSchool(id UUID, operator_id FK, school_id FK, is_active, UNIQUE(operator_id,school_id))`.
`OperatorSchoolCoverage(id UUID, operator_school_id FK, neighborhood_id FK, UNIQUE(operator_school_id,neighborhood_id))`.
Only neighborhoods belonging to the school province allowed, even if in different district. Enforce at service and test; DB-level strengthening can follow explicit design review.

## Optional detail — not required to find an operator
`Vehicle(id UUID, operator_id FK, plate NOT NULL UNIQUE, capacity NOT NULL >0, is_active)` and `ServiceOffering(id UUID, operator_school_id FK, vehicle_id NOT NULL FK, available_seats nullable, description nullable, is_published)`.

Canonicalize every plate by trimming, uppercasing, and removing spaces and hyphens before enforcing global uniqueness. `available_seats`, when present, must be at least zero and no greater than the referenced vehicle capacity. Creating or changing an offering requires an active vehicle owned by the same operator as its OperatorSchool. Vehicles are not hard-deleted in MVP: deactivation transactionally sets every dependent offering to unpublished, and later reactivation never republishes those offerings automatically.

`ServiceOfferingCoverage(service_offering_id FK, operator_school_coverage_id FK, UNIQUE pair)` links each offering to a subset of its own general school coverage. Verify transactionally that the offering and chosen general coverage share the identical `operator_school_id`; a coverage item removed from general coverage cannot remain attached to a published offering. An offering draft may have zero coverage; publishing requires at least one valid coverage entry plus an active owned vehicle. An operator with zero vehicles or offerings MUST remain discoverable if the general publication rules match.

## Discovery logic
`match operator` iff verified user & enabled account & (`approval required = false` OR approved operator) & active operator & public visibility true & active school & active OperatorSchool & general coverage matches selected school/neighborhood. Public name and contact phone included. ServiceOffering does NOT appear as mandatory join; optionally load only published offerings whose specific coverage matches school+neighborhood. Paginate DISTINCT operators before fetching offering details. No price estimate if distance is not known.

## Parent transport demand
`Demand(id UUID, school_id FK, neighborhood_id FK, academic_year, created_by FK, status OPEN|CLOSED|ARCHIVED, timestamps, UNIQUE(school_id,neighborhood_id,academic_year))` identifies one transport need even after it closes or is archived. New demands require an active school and a pickup neighborhood in that school's province; another district in the same province is valid. The backend supplies the creation year from `app.demand.academic-year`, initially `2026-2027`.

`DemandSupport(id UUID, demand_id FK, parent_id FK, needs_morning, needs_afternoon, status ACTIVE|WITHDRAWN, timestamps, UNIQUE(demand_id,parent_id))` is reactivated instead of replaced. `DemandSupportReason(support_id,reason_code, UNIQUE pair)` permits `NO_SUITABLE_SERVICE`, `NO_AVAILABLE_SEATS`, `PRICE_TOO_HIGH`, `ROUTE_TOO_LONG`, `SCHEDULE_UNSUITABLE`, and `OTHER`. Every active support requires at least one direction and one unique reason. Public supporter, direction, and reason counts include only ACTIVE supports whose account remains enabled, email-verified, and `PARENT`; do not cache duplicate counters or expose supporter identities.

## Demand-specific operator response
`DemandServiceResponse(id UUID, demand_id FK, operator_id FK, operator_school_id nullable FK, offers_morning, offers_afternoon, status ACTIVE|WITHDRAWN, publication_version, published_at, withdrawn_at, timestamps, UNIQUE(demand_id,operator_id))` keeps one stable operator-owned response per demand. The stored operator-school reference records the relationship used for the latest publication and may become null if that relationship is deleted; it is not trusted as current eligibility.

`DemandServicePublicationEvent(id UUID, response_id FK, publication_version, offers_morning, offers_afternoon, published_at, UNIQUE(response_id,publication_version))` is append-only history for downstream notification and reporting tasks. The event identifier is deterministic for response + version. The first publication and every reactivation append exactly one event and increment the stable row's publication version; repeating POST while the row is already ACTIVE changes neither directions nor history. Withdrawal preserves both rows and is idempotent.

At every mutation and public read, eligibility is recalculated from the OPEN demand, verified/enabled OPERATOR account, active/public profile, effective approval policy, active school and current active OperatorSchool relationship, and exact general coverage for the demand neighborhood in the school's province. Missing Vehicle or ServiceOffering data never blocks a response. Loss of coverage, visibility, enablement, approval, active relationship/school/profile, or OPEN demand status hides an ACTIVE response without deleting it. Directions are operator-declared availability signals only; no capacity, price, exact route, or guaranteed service is inferred.

## Lifecycle
New registration → `DRAFT` with email unverified (no login) → email verified. When approval is required, `DRAFT` permits profile editing and submission, `PENDING` is read-only, `CHANGES_REQUESTED` permits editing/resubmission, and `APPROVED` permits full operator management. When approval is disabled, those stored states do not restrict ordinary operator management or discovery and are never rewritten automatically; approval workflow writes return 409. There is no permanent `REJECTED` application state. Suspension/disablement is separate, revokes or invalidates access, and removes public visibility in both modes.

New operator profiles default `is_publicly_visible` to `true`. This preference alone never publishes a profile: every discovery request still evaluates the complete publication predicate. Validated edits by an approved operator take effect immediately and do not trigger renewed admin review in MVP. Switching public visibility off or on also does not require review. A future moderation/re-review design is deferred until pilot evidence justifies it. Duplicate `isPublished` operator state remains forbidden; derive actual visibility.

## UKOME pricing
MVP stores ONLY official UKOME tariffs in admin-editable JSON under the backend-only directory configured by `SB_TARIFF_STORAGE_DIR`. Deployment must mount that directory on a persistent writable volume; never store the mutable file in the packaged JAR, classpath, frontend, PostgreSQL fare tables, or Supabase Storage.

Every accepted update writes an immutable version file, then replaces `current.json` through a temp file and same-filesystem atomic move. The request supplies the expected current version; a stale version fails with 409 and writes nothing. Rollback creates a new version whose content comes from a selected historical version, leaving history immutable. MVP supports one tariff-writer backend instance. Horizontal tariff writes require a separately approved distributed lock or storage design. A-09 owns off-volume backup and restoration verification.

Each tariff requires city/province identity, authority, academic year, source title, official source URL, effective dates, and version. Distance bands are sorted, contiguous, and non-overlapping half-open intervals `[minDistanceKm,maxDistanceKm)`: the first begins at zero and only the final band has `maxDistanceKm=null`. Amounts are nonnegative integer kuruş. Never claim a fee band is an operator quote or that a neighborhood establishes exact distance. `monthly_price` is absent from MVP ServiceOffering.

## Data retention and privacy
Do not collect student identifiers, home addresses, passwords in responses or excessive user PII. FK/unique/check/index constraints protect integrity. All DDL managed by Flyway once baseline strategy chosen. Keep schools and geo catalog separate from user input.
