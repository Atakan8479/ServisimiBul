import { z } from 'zod'
import { apiRequest } from '../../api/client'

const tariffBandSchema = z
  .object({
    minDistanceKm: z.number().nonnegative(),
    maxDistanceKm: z.number().positive().nullable(),
    amountKurus: z.number().int().nonnegative(),
    annualAmountKurus: z.number().int().nonnegative().nullish(),
  })
  .strict()

const additionalKilometerRuleSchema = z
  .object({
    startsAfterDistanceKm: z.number().positive(),
    monthlyAmountPerKilometerKurus: z.number().int().nonnegative(),
  })
  .strict()

export const tariffSchema = z
  .object({
    provinceCode: z.string().regex(/^\d{2}$/),
    provinceName: z.string().trim().min(1),
    authority: z.string().trim().min(1),
    academicYear: z.string().trim().min(1),
    currency: z.literal('TRY'),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    sourceTitle: z.string().trim().min(1),
    officialSourceUrl: z.url().refine((value) => value.startsWith('https://')),
    version: z.string().trim().min(1),
    additionalKilometerRule: additionalKilometerRuleSchema.nullish(),
    notes: z.array(z.string().trim().min(1).max(1000)).max(50).optional(),
    bands: z.array(tariffBandSchema).min(1),
  })
  .strict()
  .superRefine((tariff, context) => {
    const provinceNumber = Number(tariff.provinceCode)
    if (provinceNumber < 1 || provinceNumber > 81) {
      context.addIssue({
        code: 'custom',
        message: 'İl kodu 01 ile 81 arasında olmalıdır.',
        path: ['provinceCode'],
      })
    }
    if (
      tariff.effectiveTo !== null &&
      tariff.effectiveTo < tariff.effectiveFrom
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Bitiş tarihi başlangıç tarihinden önce olamaz.',
        path: ['effectiveTo'],
      })
    }
    if (tariff.bands[0]?.minDistanceKm !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'İlk mesafe aralığı 0 km ile başlamalıdır.',
        path: ['bands', 0, 'minDistanceKm'],
      })
    }

    const requiresAnnualAmounts =
      tariff.additionalKilometerRule != null ||
      tariff.bands.some((band) => band.annualAmountKurus != null)

    tariff.bands.forEach((band, index) => {
      const finalBand = index === tariff.bands.length - 1
      if (
        finalBand &&
        tariff.additionalKilometerRule == null &&
        band.maxDistanceKm !== null
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Ek kilometre kuralı yoksa son aralığın üst sınırı null olmalıdır.',
          path: ['bands', index, 'maxDistanceKm'],
        })
      }
      if (
        finalBand &&
        tariff.additionalKilometerRule != null &&
        band.maxDistanceKm === null
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Ek kilometre kuralı varsa son sabit aralığın üst sınırı belirtilmelidir.',
          path: ['bands', index, 'maxDistanceKm'],
        })
      }
      if (!finalBand && band.maxDistanceKm === null) {
        context.addIssue({
          code: 'custom',
          message: 'Yalnızca son sabit aralığın üst sınırı null olabilir.',
          path: ['bands', index, 'maxDistanceKm'],
        })
      }
      if (
        band.maxDistanceKm !== null &&
        band.maxDistanceKm <= band.minDistanceKm
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Üst sınır alt sınırdan büyük olmalıdır.',
          path: ['bands', index, 'maxDistanceKm'],
        })
      }
      const previousMaximum = tariff.bands[index - 1]?.maxDistanceKm
      if (index > 0 && previousMaximum !== band.minDistanceKm) {
        context.addIssue({
          code: 'custom',
          message: 'Mesafe aralıkları kesintisiz olmalıdır.',
          path: ['bands', index, 'minDistanceKm'],
        })
      }
      if (requiresAnnualAmounts && band.annualAmountKurus == null) {
        context.addIssue({
          code: 'custom',
          message: 'Tüm aralıkların yıllık tutarı belirtilmelidir.',
          path: ['bands', index, 'annualAmountKurus'],
        })
      }
    })

    const finalMaximum = tariff.bands.at(-1)?.maxDistanceKm
    if (
      tariff.additionalKilometerRule != null &&
      finalMaximum !== null &&
      finalMaximum !== undefined &&
      tariff.additionalKilometerRule.startsAfterDistanceKm !== finalMaximum
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Ek kilometre eşiği son sabit aralığın üst sınırı olmalıdır.',
        path: ['additionalKilometerRule', 'startsAfterDistanceKm'],
      })
    }
  })

export type Tariff = z.infer<typeof tariffSchema>

export function getTariff(provinceCode: string): Promise<Tariff> {
  return apiRequest(
    `/tariffs?provinceCode=${encodeURIComponent(provinceCode)}`,
    { schema: tariffSchema },
  )
}

export function replaceTariff(
  provinceCode: string,
  expectedVersion: string | null,
  tariff: Tariff,
): Promise<Tariff> {
  return apiRequest(`/admin/tariffs/${encodeURIComponent(provinceCode)}`, {
    method: 'PUT',
    json: { expectedVersion, tariff },
    requiresSession: true,
    schema: tariffSchema,
  })
}

export function formatKurus(amountKurus: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amountKurus / 100)
}
