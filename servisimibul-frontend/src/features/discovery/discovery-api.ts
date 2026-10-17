import { z } from 'zod'
import { apiRequest } from '../../api/client'

const schoolSchema = z.object({
  id: z.string().uuid(),
  neighborhoodId: z.number().int().positive(),
  neighborhoodName: z.string(),
  districtId: z.number().int().positive(),
  districtName: z.string(),
  provinceId: z.number().int().positive(),
  provinceCode: z.string(),
  provinceName: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  sourceName: z.string().nullable(),
  sourceCode: z.string().nullable(),
  active: z.boolean(),
})

const districtSchema = z.object({
  id: z.number().int().positive(),
  provinceId: z.number().int().positive(),
  name: z.string(),
})

const neighborhoodSchema = z.object({
  id: z.number().int().positive(),
  districtId: z.number().int().positive(),
  name: z.string(),
})

const publishedOfferingSchema = z.object({
  offeringId: z.string().uuid(),
  availableSeats: z.number().int().nonnegative().nullable(),
  vehicleCapacity: z.number().int().positive(),
  description: z.string().nullable(),
})

const operatorSchema = z.object({
  operatorId: z.string().uuid(),
  businessName: z.string().nullable(),
  contactPhone: z.string().min(1),
  description: z.string().nullable(),
  matchingSchool: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  publishedOfferings: z.array(publishedOfferingSchema),
})

function pageSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    content: z.array(itemSchema),
    page: z.number().int().nonnegative(),
    size: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
}

const schoolPageSchema = pageSchema(schoolSchema)
const operatorPageSchema = pageSchema(operatorSchema)

export type School = z.infer<typeof schoolSchema>
export type District = z.infer<typeof districtSchema>
export type Neighborhood = z.infer<typeof neighborhoodSchema>
export type PublicOperator = z.infer<typeof operatorSchema>
export type OperatorPage = z.infer<typeof operatorPageSchema>

export function getSchools(): Promise<School[]> {
  // shortcut: D019 keeps the curated catalog deliberately small; add server paging when it exceeds 50 schools.
  return apiRequest('/schools?page=0&size=50', {
    schema: schoolPageSchema,
  }).then((page) => page.content)
}

export function getDistricts(provinceId: number): Promise<District[]> {
  return apiRequest(`/districts?provinceId=${provinceId}`, {
    schema: z.array(districtSchema),
  })
}

export function getNeighborhoods(districtId: number): Promise<Neighborhood[]> {
  return apiRequest(`/neighborhoods?districtId=${districtId}`, {
    schema: z.array(neighborhoodSchema),
  })
}

export function findOperators(
  schoolId: string,
  neighborhoodId: number,
  page: number,
): Promise<OperatorPage> {
  const parameters = new URLSearchParams({
    schoolId,
    neighborhoodId: String(neighborhoodId),
    page: String(page),
    size: '10',
  })
  return apiRequest(`/operators?${parameters.toString()}`, {
    schema: operatorPageSchema,
  })
}
