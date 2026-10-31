import { z } from 'zod'
import { apiRequest } from '../../api/client'
import {
  approvalStatusSchema,
  operatorProfileSchema,
} from '../operator/operator-api'

const reviewSchema = z.object({
  id: z.string().uuid(),
  reviewedById: z.string().uuid(),
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'SUSPENDED']),
  reason: z.string().nullable(),
  reviewedAt: z.string(),
})

const applicationDetailSchema = z.object({
  profile: operatorProfileSchema,
  reviewHistory: z.array(reviewSchema),
})

const applicationPageSchema = z.object({
  content: z.array(operatorProfileSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
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

const provinceSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  name: z.string(),
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

export type ApplicationStatus = z.infer<typeof approvalStatusSchema>
export type ApplicationDetail = z.infer<typeof applicationDetailSchema>
export type ApplicationPage = z.infer<typeof applicationPageSchema>
export type School = z.infer<typeof schoolSchema>
export type SchoolPage = z.infer<typeof schoolPageSchema>
export type Province = z.infer<typeof provinceSchema>
export type District = z.infer<typeof districtSchema>
export type Neighborhood = z.infer<typeof neighborhoodSchema>

export interface SchoolWriteRequest {
  neighborhoodId: number
  name: string
  address: string | null
  sourceName: string | null
  sourceCode: string | null
  active?: boolean
}

export type SchoolPatchRequest = Omit<SchoolWriteRequest, 'active'>

export function getApplications(
  status: ApplicationStatus | undefined,
  page: number,
): Promise<ApplicationPage> {
  const query = new URLSearchParams({ page: String(page), size: '20' })
  if (status) query.set('status', status)
  return apiRequest(`/admin/operators?${query.toString()}`, {
    requiresSession: true,
    schema: applicationPageSchema,
  })
}

export function getApplication(id: string): Promise<ApplicationDetail> {
  return apiRequest(`/admin/operators/${id}`, {
    requiresSession: true,
    schema: applicationDetailSchema,
  })
}

export function approveApplication(id: string): Promise<ApplicationDetail> {
  return applicationAction(id, 'approve')
}

export function requestApplicationRevision(
  id: string,
  reason: string,
): Promise<ApplicationDetail> {
  return apiRequest(`/admin/operators/${id}/request-revision`, {
    method: 'POST',
    json: { reason },
    requiresSession: true,
    schema: applicationDetailSchema,
  })
}

export function suspendOperator(
  id: string,
  reason: string,
): Promise<ApplicationDetail> {
  return apiRequest(`/admin/operators/${id}/suspend`, {
    method: 'POST',
    json: { reason },
    requiresSession: true,
    schema: applicationDetailSchema,
  })
}

function applicationAction(id: string, action: 'approve') {
  return apiRequest(`/admin/operators/${id}/${action}`, {
    method: 'POST',
    requiresSession: true,
    schema: applicationDetailSchema,
  })
}

export function getAdminSchools(
  query: string,
  page: number,
): Promise<SchoolPage> {
  const parameters = new URLSearchParams({ page: String(page), size: '20' })
  if (query.trim()) parameters.set('query', query.trim())
  return apiRequest(`/admin/schools?${parameters.toString()}`, {
    requiresSession: true,
    schema: schoolPageSchema,
  })
}

export function createSchool(request: SchoolWriteRequest): Promise<School> {
  return apiRequest('/admin/schools', {
    method: 'POST',
    json: request,
    requiresSession: true,
    schema: schoolSchema,
  })
}

export function updateSchool(
  id: string,
  request: SchoolPatchRequest,
): Promise<School> {
  return apiRequest(`/admin/schools/${id}`, {
    method: 'PATCH',
    json: request,
    requiresSession: true,
    schema: schoolSchema,
  })
}

export function setSchoolActive(id: string, active: boolean): Promise<School> {
  return apiRequest(
    `/admin/schools/${id}/${active ? 'activate' : 'deactivate'}`,
    {
      method: 'POST',
      requiresSession: true,
      schema: schoolSchema,
    },
  )
}

export function getProvinces(): Promise<Province[]> {
  return apiRequest('/provinces', { schema: z.array(provinceSchema) })
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
