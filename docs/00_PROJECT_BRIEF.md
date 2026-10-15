# ServisimiBul — Project brief

## Mission and users
ServisimiBul is a Turkish school transportation operator discovery web platform. Start with an Istanbul pilot, leave room for expansion to other provinces. Parents anonymously select school, district, and neighborhood; view potential operator matches and contact them directly. Neighborhood match is NOT a guarantee that pickup from a precise address is possible.

Registered roles: `ADMIN` and `OPERATOR`. Parents do NOT register for MVP. No student records. Two initial admins must be bootstrapped securely, never through public registration. An operator may own vehicles and serve several schools; operator and driver need not be the same person.

## MVP mandatory capabilities
- PostgreSQL persistence, JPA/Hibernate, Flyway migrations, stable dev/test configuration.
- Reference location hierarchy: Province -> District -> Neighborhood, School located in a Neighborhood.
- Admin school CRUD for a deliberately small pilot catalog containing schools the team is actively testing with. Bulk import and a complete Istanbul catalog are deferred until there is demonstrated need.
- Operator email registration and verification before login; role-based authentication and server-side sessions; two securely created admins.
- Admin approval, request-for-revision with explanation, operator edits/resubmission, and account suspension handling.
- Operator profile includes an optional business name and a mandatory publicly reachable phone; operator can control whether the entire profile is shown.
- OperatorSchool linkage and per-school OperatorSchoolCoverage. Different districts of the same province are valid coverage for a school.
- Anonymous parent search by school + neighborhood; operator contact view; pagination; responsive public and admin/operator UIs.
- Price reference: official UKOME fee bands from editable persistent JSON; only verified official tariffs, no price estimates based on neighborhood.

## Optional-detail capability; not required for discovery
- Vehicle records and ServiceOffering details are optional, but every offering references an active vehicle owned by the same operator. Vehicle plate and capacity are required; available seats remain optional and cannot exceed capacity. Each offering can have independent ServiceOfferingCoverage constrained to the general coverage of the same OperatorSchool.
- No ServiceOffering must be necessary for operator search visibility.

## Not MVP
Bookings, payments, live GPS tracking, mapped routes/optimization, parent or student accounts, internal chat, ratings/reviews, native mobile app.

## Quality constraints
Modular monolith; clear controller/service/repository/entity/DTO/security separation or feature modules. Tests for ownership, authorization, duplicate relationships, publication conditions, school/coverage validity, migration integrity. Avoid collecting home addresses or children's personal data. Consider KVKK and accessible, mobile-first UI. No microservices, Redis or PostGIS without demonstrated need.

## Team workflow
Two developers, each using their own Codex session. Share decisions and verified progress through committed repository files, GitHub Issues and PRs. Separate feature branches, mutual review, CI. Codex does not share session memory or uncommitted work across developers.
