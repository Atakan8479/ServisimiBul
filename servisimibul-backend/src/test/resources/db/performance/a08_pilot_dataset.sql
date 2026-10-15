-- Synthetic A-08 performance fixture. It is loaded only by transactional tests and is never
-- part of Flyway, shared Supabase, staging, or production data.

INSERT INTO province (id, code, name)
OVERRIDING SYSTEM VALUE
VALUES (990000, '99', 'A08 Performance Province');

INSERT INTO district (id, province_id, name)
OVERRIDING SYSTEM VALUE
SELECT 990000 + value, 990000, 'A08 District ' || lpad(value::text, 2, '0')
FROM generate_series(1, 20) AS value;

INSERT INTO neighborhood (id, district_id, name)
OVERRIDING SYSTEM VALUE
SELECT 991000 + value,
       990000 + (((value - 1) % 20) + 1),
       'A08 Neighborhood ' || lpad(value::text, 3, '0')
FROM generate_series(1, 400) AS value;

INSERT INTO school (id, neighborhood_id, name, is_active, created_at, updated_at)
SELECT md5('a08-school-' || value)::uuid,
       991000 + (((value - 1) % 400) + 1),
       'A08 School ' || lpad(value::text, 3, '0'),
       true,
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second',
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second'
FROM generate_series(1, 100) AS value;

INSERT INTO app_user (
    id, email, password_hash, role, is_enabled, email_verified_at, created_at, updated_at
)
SELECT md5('a08-user-' || value)::uuid,
       'a08-operator-' || value || '@example.invalid',
       'synthetic-performance-hash',
       'OPERATOR',
       true,
       TIMESTAMPTZ '2026-01-01 00:00:00+00',
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second',
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second'
FROM generate_series(1, 2000) AS value;

INSERT INTO operator_profile (
    id, user_id, business_name, contact_phone, description,
    approval_status, is_active, is_publicly_visible, created_at, updated_at
)
SELECT md5('a08-profile-' || value)::uuid,
       md5('a08-user-' || value)::uuid,
       CASE
           WHEN value % 20 = 0 THEN NULL
           ELSE 'A08 Operator ' || lpad((value % 20)::text, 2, '0')
       END,
       '+90555' || lpad(value::text, 7, '0'),
       'Synthetic A-08 operator',
       CASE WHEN value <= 1500 THEN 'APPROVED' ELSE 'PENDING' END,
       true,
       true,
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second',
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second'
FROM generate_series(1, 2000) AS value;

INSERT INTO operator_school (id, operator_id, school_id, is_active)
SELECT md5('a08-operator-school-' || value)::uuid,
       md5('a08-profile-' || CASE WHEN value <= 2000 THEN value ELSE value - 2000 END)::uuid,
       md5(
           'a08-school-' || CASE
               WHEN value <= 120 THEN 1
               WHEN value <= 2000 THEN 2 + ((value - 121) % 49)
               ELSE 51 + ((value - 2001) % 50)
           END
       )::uuid,
       true
FROM generate_series(1, 4000) AS value;

INSERT INTO operator_school_coverage (
    id, operator_school_id, neighborhood_id
)
SELECT md5('a08-coverage-' || (((relationship.value - 1) * 5) + item.value))::uuid,
       md5('a08-operator-school-' || relationship.value)::uuid,
       CASE
           WHEN relationship.value <= 120 AND item.value = 1 THEN 991001
           ELSE 991002 + ((relationship.value * 17 + item.value * 23) % 399)
       END
FROM generate_series(1, 4000) AS relationship(value)
CROSS JOIN generate_series(1, 5) AS item(value);

INSERT INTO vehicle (
    id, operator_id, plate, capacity, is_active, created_at, updated_at
)
SELECT md5('a08-vehicle-' || value)::uuid,
       md5('a08-profile-' || value)::uuid,
       'A08' || lpad(value::text, 5, '0'),
       12 + (value % 5),
       true,
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second',
       TIMESTAMPTZ '2026-01-01 00:00:00+00' + value * INTERVAL '1 second'
FROM generate_series(1, 2000) AS value;

INSERT INTO service_offering (
    id, operator_school_id, vehicle_id, available_seats, description,
    is_published, created_at, updated_at
)
SELECT md5('a08-offering-' || value)::uuid,
       md5('a08-operator-school-' || value)::uuid,
       md5('a08-vehicle-' || CASE WHEN value <= 2000 THEN value ELSE value - 2000 END)::uuid,
       CASE WHEN value % 3 = 0 THEN NULL ELSE 5 + (value % 5) END,
       'Synthetic A-08 offering',
       value % 4 <> 0,
       TIMESTAMPTZ '2026-02-01 00:00:00+00' + value * INTERVAL '1 second',
       TIMESTAMPTZ '2026-02-01 00:00:00+00' + value * INTERVAL '1 second'
FROM generate_series(1, 4000) AS value;

INSERT INTO service_offering_coverage (
    id, service_offering_id, operator_school_coverage_id
)
SELECT md5('a08-offering-coverage-' || (((offering.value - 1) * 3) + item.value))::uuid,
       md5('a08-offering-' || offering.value)::uuid,
       md5('a08-coverage-' || (((offering.value - 1) * 5) + item.value))::uuid
FROM generate_series(1, 4000) AS offering(value)
CROSS JOIN generate_series(1, 3) AS item(value);

ANALYZE;
