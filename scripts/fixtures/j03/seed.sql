INSERT INTO province (id, code, name)
OVERRIDING SYSTEM VALUE
VALUES (34, '34', 'İstanbul');

INSERT INTO district (id, province_id, name)
OVERRIDING SYSTEM VALUE
VALUES
    (3401, 34, 'Kadıköy'),
    (3402, 34, 'Üsküdar');

INSERT INTO neighborhood (id, district_id, name)
OVERRIDING SYSTEM VALUE
VALUES
    (340101, 3401, 'Moda'),
    (340201, 3402, 'Acıbadem');

INSERT INTO school (id, neighborhood_id, name, address, source_name, source_code)
VALUES (
    '10000000-0000-4000-8000-000000000001',
    340101,
    'J03 Gerçek Okulu',
    'Kadıköy, İstanbul',
    'J03 synthetic fixture',
    'J03-SCHOOL-1'
);
