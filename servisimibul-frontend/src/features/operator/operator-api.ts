import { z } from 'zod'
import { apiRequest } from '../../api/client'

export const approvalStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'CHANGES_REQUESTED',
  'APPROVED',
])

export const operatorProfileSchema = z.object({
  id: z.string().uuid(),
  businessName: z.string().nullable(),
  contactPhone: z.string(),
  description: z.string().nullable(),
  approvalStatus: approvalStatusSchema,
  active: z.boolean(),
  publiclyVisible: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
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

const schoolPageSchema = z.object({
  content: z.array(schoolSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

const coverageSchema = z.object({
  neighborhoodId: z.number().int().positive(),
  neighborhoodName: z.string(),
  districtId: z.number().int().positive(),
  districtName: z.string(),
  provinceId: z.number().int().positive(),
  provinceCode: z.string(),
  provinceName: z.string(),
})

export const operatorSchoolSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  schoolName: z.string(),
  schoolNeighborhoodId: z.number().int().positive(),
  schoolDistrictId: z.number().int().positive(),
  schoolProvinceId: z.number().int().positive(),
  schoolProvinceCode: z.string(),
  schoolProvinceName: z.string(),
  active: z.boolean(),
  coverage: z.array(coverageSchema),
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

export type ApprovalStatus = z.infer<typeof approvalStatusSchema>
export type OperatorProfile = z.infer<typeof operatorProfileSchema>
export type OperatorSchool = z.infer<typeof operatorSchoolSchema>
export type School = z.infer<typeof schoolSchema>
export type District = z.infer<typeof districtSchema>
export type Neighborhood = z.infer<typeof neighborhoodSchema>

export interface ProfilePatch {
  businessName: string
  contactPhone: string
  description: string | null
  publiclyVisible: boolean
}

export function getProfile(): Promise<OperatorProfile> {
  return apiRequest('/operator/profile', {
    requiresSession: true,
    schema: operatorProfileSchema,
  })
}

export function updateProfile(request: ProfilePatch): Promise<OperatorProfile> {
  return apiRequest('/operator/profile', {
    method: 'PATCH',
    json: request,
    requiresSession: true,
    schema: operatorProfileSchema,
  })
}

export function submitApplication(): Promise<OperatorProfile> {
  return apiRequest('/operator/application/submit', {
    method: 'POST',
    requiresSession: true,
    schema: operatorProfileSchema,
  })
}

export function resubmitApplication(): Promise<OperatorProfile> {
  return apiRequest('/operator/application/resubmit', {
    method: 'POST',
    requiresSession: true,
    schema: operatorProfileSchema,
  })
}

export function getOperatorSchools(): Promise<OperatorSchool[]> {
  return apiRequest('/operator/schools', {
    requiresSession: true,
    schema: z.array(operatorSchoolSchema),
  })
}

export function searchSchools(query: string): Promise<School[]> {
  // shortcut: the curated catalog fits one API page; add paging when it grows past 50 schools.
  const parameters = new URLSearchParams({ page: '0', size: '50' })
  if (query.trim()) {
    parameters.set('query', query.trim())
  }
  return apiRequest(`/schools?${parameters.toString()}`, {
    schema: schoolPageSchema,
  }).then((page) => page.content)
}

export function addOperatorSchool(schoolId: string): Promise<OperatorSchool> {
  return apiRequest('/operator/schools', {
    method: 'POST',
    json: { schoolId },
    requiresSession: true,
    schema: operatorSchoolSchema,
  })
}

export function setOperatorSchoolActive(
  id: string,
  active: boolean,
): Promise<OperatorSchool> {
  return apiRequest(`/operator/schools/${id}`, {
    method: 'PATCH',
    json: { active },
    requiresSession: true,
    schema: operatorSchoolSchema,
  })
}

export function removeOperatorSchool(id: string): Promise<void> {
  return apiRequest(`/operator/schools/${id}`, {
    method: 'DELETE',
    requiresSession: true,
  })
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

export function replaceCoverage(
  operatorSchoolId: string,
  neighborhoodIds: number[],
): Promise<OperatorSchool> {
  return apiRequest(`/operator/schools/${operatorSchoolId}/coverage`, {
    method: 'PUT',
    json: { neighborhoodIds },
    requiresSession: true,
    schema: operatorSchoolSchema,
  })
}
