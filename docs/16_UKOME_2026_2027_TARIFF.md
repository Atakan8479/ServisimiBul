# İstanbul 2026-2027 school transport tariff verification

## Official source

- Authority: İstanbul Büyükşehir Belediyesi Meclisi
- Decision: 17 July 2026, number 813
- Effective from: 20 July 2026
- Academic year: 2026-2027
- Official TUHİM PDF: `https://tuhim.ibb.gov.tr/media/27492/okul-servis-ta%C5%9F%C4%B1mac%C4%B1l%C4%B1%C4%9F%C4%B1-%C3%BCcret-tarifesi.pdf`
- Verified PDF SHA-256: `E8726703956F82A563E2EE2E163D48C9145473F5DE2EF78ED261272AB4BF4E0E`

The two-page source PDF was downloaded from the URL above, extracted with layout preservation, rendered to PNG, and visually checked. The canonical document is the test resource at `servisimibul-backend/src/test/resources/tariff/official/istanbul-2026-2027.json`. It is review evidence and a contract fixture, not a published tariff volume.

## Verified fixed bands

| Distance | Monthly TRY | Annual TRY |
| --- | ---: | ---: |
| 0-1 km | 4,456.00 | 39,970.00 |
| 1-3 km | 4,772.00 | 42,804.00 |
| 3-5 km | 5,157.00 | 46,258.00 |
| 5-7 km | 5,379.00 | 48,249.00 |
| 7-9 km | 5,671.00 | 50,868.00 |
| 9-11 km | 6,569.00 | 58,923.00 |
| 11-13 km | 7,561.00 | 67,822.00 |
| 13-15 km | 7,942.00 | 71,239.00 |
| 15-17 km | 8,573.00 | 76,899.00 |
| 17-19 km | 9,064.00 | 81,304.00 |
| 19-21 km | 9,645.00 | 86,515.00 |
| 21-23 km | 10,046.00 | 90,112.00 |
| 23-25 km | 10,436.00 | 93,610.00 |

All JSON amounts are integer kuruş. The source does not state an expiration date, so `effectiveTo` is `null` rather than an inferred school-year end.

## Above-25-km rule

The final fixed band ends at 25 km. For each kilometer above 25 km, the document adds TRY 87.99 to the monthly amount. The JSON therefore stores the 23-25 km base separately from `additionalKilometerRule`; it does not create an unbounded fixed-price band.

Boundary examples used by the tests:

- 25 km: TRY 10,436.00 monthly fixed-band amount; no surcharge.
- 26 km: TRY 10,436.00 + TRY 87.99 = TRY 10,523.99 monthly.
- 30 km: TRY 10,436.00 + (5 x TRY 87.99) = TRY 10,875.95 monthly.

These examples only verify the official arithmetic rule. The application must not infer a household's route distance from a selected neighborhood or present a personalized guaranteed price.

## Conditions and publication boundary

The canonical JSON carries concise Turkish explanations for all 17 official conditions, including maximum VAT-inclusive fares, the 8.97-month reference, reduced weekly school-day percentages, cash discount, guide-attendant requirements and conditional surcharge, sibling discounts, distance determination, bridge tolls, holidays, refunds, low-ridership calculation, and model contracts.

This change does not write to `SB_TARIFF_STORAGE_DIR`, shared Supabase, or any production environment. Publishing this verified document remains a separately approved ADMIN/operator action under D033-D034.
