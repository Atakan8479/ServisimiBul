import { z } from 'zod'
import { apiRequest } from '../../api/client'

const provinceSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  name: z.string(),
})

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
export type SchoolPage = z.infer<typeof schoolPageSchema>
export type SchoolSort = 'name-asc' | 'name-desc'
export type Province = z.infer<typeof provinceSchema>
export type District = z.infer<typeof districtSchema>
export type Neighborhood = z.infer<typeof neighborhoodSchema>
export type PublicOperator = z.infer<typeof operatorSchema>
export type OperatorPage = z.infer<typeof operatorPageSchema>

export function getProvinces(): Promise<Province[]> {
  return apiRequest('/provinces', {
    schema: z.array(provinceSchema),
  })
}

export function getSchools({
  provinceId,
  districtId,
  query,
  sort,
  page,
}: {
  provinceId: number
  districtId?: number
  query?: string
  sort: SchoolSort
  page: number
}): Promise<SchoolPage> {
  const parameters = new URLSearchParams({
    provinceId: String(provinceId),
    sort,
    page: String(page),
    size: '10',
  })
  if (districtId) parameters.set('districtId', String(districtId))
  if (query?.trim()) parameters.set('query', query.trim())

  return apiRequest(`/schools?${parameters.toString()}`, {
    schema: schoolPageSchema,
  }).then((schoolPage) => {
    if (
      schoolPage.content.some(
        (school) =>
          school.provinceId !== provinceId ||
          (districtId !== undefined && school.districtId !== districtId),
      )
    ) {
      throw new Error('School results do not match the requested geography')
    }
    return schoolPage
  })
}

export function getSchool(id: string): Promise<School> {
  return apiRequest(`/schools/${id}`, { schema: schoolSchema })
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
