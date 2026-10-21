# A-08 database and performance evidence

Verified on 2026-10-15 against the isolated PostgreSQL 17 service in Backend workflow `38788568472`. This document records the representative pilot workload, measurable acceptance targets, query-plan findings, index decisions, database-security audit, and migration replay. It does not authorize or perform a shared Supabase migration.

## Pilot dataset and lifecycle

`src/test/resources/db/performance/a08_pilot_dataset.sql` creates a deterministic synthetic workload with 2,000 operators, 4,000 operator-school relationships, 20,000 general coverage rows, 2,000 vehicles, 4,000 offerings, and 12,000 offering-coverage rows, plus representative geography. It includes 120 matching public operators, nullable and duplicate business names, 500 pending applications, and optional/off-path data.

The fixture is a test resource, not a Flyway migration or production seed. `DatabasePerformanceTests` loads it inside a test transaction and Spring rolls that transaction back after the test. GitHub Actions then destroys its isolated PostgreSQL service with the job. Local use must likewise target a disposable database. The fixture must never be loaded into shared Supabase, staging, or production; it remains in the repository only as repeatable regression evidence and may be revised when measured pilot scale changes.

## Performance and query-shape targets

These are regression budgets for the representative fixture, not production latency promises:

- Each recorded `EXPLAIN (ANALYZE, BUFFERS)` execution—discovery page, discovery count, offering enrichment, admin queue page, and admin queue count—must remain below 500 ms in PostgreSQL 17 CI.
- A populated discovery request must execute exactly five SQL statements: active school, requested neighborhood with province, paginated operator page, operator count, and one page-scoped offering enrichment query. Page size must not change this count.
- An admin application queue request must execute exactly two SQL statements: page and count.
- Re-reading every discovery page at size 25 must produce the same ordered 120 unique operator IDs, with no duplicates or omissions. Ordering remains `businessName`, then immutable operator UUID; PostgreSQL places null names last for ascending order.
- Operators are paginated before optional offering enrichment. Vehicle or offering rows must never be required for the base operator result.

## Query-plan results

The original discovery predicate compared the coverage and school provinces inside the per-operator correlated subquery. Workflow `38786531568` showed a 944.482 ms discovery page plan with 1,285,954 intermediate shared-buffer hits and 552,120 repeated operator-school probes. This failed the 500 ms ceiling and established the bottleneck before optimization.

The optimized service fetches the requested school and neighborhood geography once, returns an empty page immediately for different provinces, and leaves only exact school/neighborhood coverage membership in the paginated operator query. This preserves same-province cross-district behavior and all publication rules while avoiding repeated geography traversal.

Workflow `38788568472` measured:

| Query | Execution time | Material plan evidence |
|---|---:|---|
| Discovery page | 5.575 ms | publication index, unique operator-school pair, unique coverage pair, primary keys; 35 kB in-memory sort |
| Discovery count | 4.724 ms | same indexed semi-join path |
| Offering enrichment for 50 operators | 1.184 ms | school FK index, general-coverage unique pair, offering FK index, offering-coverage unique pair, vehicle primary key |
| Admin application page | 0.548 ms | approval/visibility index plus 31 kB top-N in-memory sort |
| Admin application count | 0.205 ms | approval/visibility bitmap index scan |

The discovery page improved by about 169 times, from 944.482 ms to 5.575 ms. All five plans are comfortably inside the 500 ms safety ceiling.

## Index decision

No A-08 migration or new index is justified by the measured plans. PostgreSQL uses the existing `operator_profile_approval_visibility_idx`, `operator_school_operator_school_unique`, `operator_school_coverage_pair_unique`, `operator_school_school_id_idx`, `service_offering_operator_school_id_idx`, `service_offering_coverage_pair_unique`, and primary-key indexes. The remaining sorts operate on 120 or 500 rows and consume at most 35 kB; indexing them would add write/storage cost without a demonstrated bottleneck.

Revisit indexes only with new `EXPLAIN ANALYZE` evidence from materially larger or differently distributed data. In particular, do not add a nullable business-name ordering index or an admin queue timestamp index solely on intuition.

## RLS and grant audit

The PostgreSQL integration suite now enumerates all 22 application tables (including V10 demand data, V11 demand-response history, and V12 demand comments) and all three application sequences and fails when the catalog contains an unaudited object. It verifies:

- every application table has RLS enabled and is not owned by the runtime role;
- every table has exactly one permissive `ALL` policy restricted to `servisimibul_app`, with `USING (true)` and `WITH CHECK (true)`;
- `servisimibul_app` has table `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, but not `TRUNCATE`, `REFERENCES`, `TRIGGER`, or grant options;
- the runtime role has only `USAGE` and `SELECT` on the three identity sequences;
- `anon`, `authenticated`, and PostgreSQL `PUBLIC` have no direct table or sequence privileges;
- the runtime role is non-superuser, cannot create databases or roles, does not inherit, and cannot bypass RLS;
- application roles cannot access Flyway history.

## Migration replay

Backend CI starts with an empty PostgreSQL 17 database, provisions only the required restricted roles, and applies Flyway V1 through V12 using the migration identity. The application then starts through `servisimibul_app` with Hibernate `ddl-auto=validate`. The suite asserts every resolved V1–V12 migration is in `SUCCESS` state and that a second `flyway.migrate()` executes zero migrations.

Workflow `38788568472` passed 93 tests with zero failures, errors, or skips. No Docker daemon is required by the project or for ordinary development; GitHub Actions uses its own isolated PostgreSQL service for this database-dependent verification.
