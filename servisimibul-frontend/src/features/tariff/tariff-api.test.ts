import { describe, expect, it } from 'vitest'
import { tariffSchema } from './tariff-api'

const metadata = {
  provinceCode: '34',
  provinceName: 'İstanbul',
  authority: 'İstanbul Büyükşehir Belediyesi Meclisi',
  academicYear: '2026-2027',
  currency: 'TRY' as const,
  effectiveFrom: '2026-07-20',
  sourceTitle: 'Official tariff',
  officialSourceUrl: 'https://tuhim.ibb.gov.tr/tariff.pdf',
  version: '2026-2027-ibb-813',
}

describe('tariff schema', () => {
  it('keeps legacy unbounded monthly-only documents readable', () => {
    expect(
      tariffSchema.safeParse({
        ...metadata,
        effectiveTo: '2027-08-31',
        additionalKilometerRule: null,
        notes: [],
        bands: [
          {
            minDistanceKm: 0,
            maxDistanceKm: null,
            amountKurus: 445_600,
            annualAmountKurus: null,
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('accepts annual amounts and a separate additional-kilometer rule', () => {
    expect(
      tariffSchema.safeParse({
        ...metadata,
        effectiveTo: null,
        additionalKilometerRule: {
          startsAfterDistanceKm: 25,
          monthlyAmountPerKilometerKurus: 8_799,
        },
        notes: ['KDV dahil azami tarifedir.'],
        bands: [
          {
            minDistanceKm: 0,
            maxDistanceKm: 1,
            amountKurus: 445_600,
            annualAmountKurus: 3_997_000,
          },
          {
            minDistanceKm: 1,
            maxDistanceKm: 25,
            amountKurus: 1_043_600,
            annualAmountKurus: 9_361_000,
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects partial annual tables and a surcharge threshold outside the fixed table', () => {
    const result = tariffSchema.safeParse({
      ...metadata,
      effectiveTo: null,
      additionalKilometerRule: {
        startsAfterDistanceKm: 26,
        monthlyAmountPerKilometerKurus: 8_799,
      },
      bands: [
        {
          minDistanceKm: 0,
          maxDistanceKm: 1,
          amountKurus: 445_600,
          annualAmountKurus: 3_997_000,
        },
        {
          minDistanceKm: 1,
          maxDistanceKm: 25,
          amountKurus: 1_043_600,
        },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining([
          'bands.1.annualAmountKurus',
          'additionalKilometerRule.startsAfterDistanceKm',
        ]),
      )
    }
  })
})
