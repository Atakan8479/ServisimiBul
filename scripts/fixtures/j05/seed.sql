INSERT INTO province (id, code, name)
OVERRIDING SYSTEM VALUE
VALUES (34, '34', 'İstanbul');

INSERT INTO district (id, province_id, name)
OVERRIDING SYSTEM VALUE
VALUES
    (3401, 34, 'Kadıköy'),
    (3402, 34, 'Üsküdar'),
    (3403, 34, 'Ataşehir');

INSERT INTO neighborhood (id, district_id, name)
OVERRIDING SYSTEM VALUE
VALUES
    (340101, 3401, 'Moda'),
    (340102, 3401, 'Koşuyolu'),
    (340201, 3402, 'Acıbadem'),
    (340301, 3403, 'İçerenköy');

INSERT INTO school (id, neighborhood_id, name, address, source_name, source_code)
VALUES
    ('50000000-0000-4000-8000-000000000001', 340101,
     'J05 Moda Deneme Okulu', 'Kadıköy, İstanbul', 'J05 synthetic fixture', 'J05-SCHOOL-1'),
    ('50000000-0000-4000-8000-000000000002', 340201,
     'J05 Acıbadem Deneme Okulu', 'Üsküdar, İstanbul', 'J05 synthetic fixture', 'J05-SCHOOL-2'),
    ('50000000-0000-4000-8000-000000000003', 340301,
     'J05 İçerenköy Deneme Okulu', 'Ataşehir, İstanbul', 'J05 synthetic fixture', 'J05-SCHOOL-3');
