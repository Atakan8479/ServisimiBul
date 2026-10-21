import { z } from 'zod'
import { apiRequest } from '../../api/client'

export const supportReasons = [
  'NO_SUITABLE_SERVICE',
  'NO_AVAILABLE_SEATS',
  'PRICE_TOO_HIGH',
  'ROUTE_TOO_LONG',
  'SCHEDULE_UNSUITABLE',
  'OTHER',
] as const

const supportReasonSchema = z.enum(supportReasons)
const demandStatusSchema = z.enum(['OPEN', 'CLOSED', 'ARCHIVED'])
const supportStatusSchema = z.enum(['ACTIVE', 'WITHDRAWN'])

const supportSchema = z.object({
  id: z.string().uuid(),
  status: supportStatusSchema,
  needsMorning: z.boolean(),
  needsAfternoon: z.boolean(),
  reasons: z.array(supportReasonSchema),
})

const demandSchema = z.object({
  id: z.string().uuid(),
  status: demandStatusSchema,
  academicYear: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  school: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  neighborhood: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    districtId: z.number().int().positive(),
    districtName: z.string(),
    provinceId: z.number().int().positive(),
    provinceCode: z.string(),
    provinceName: z.string(),
  }),
  supporterCount: z.number().int().nonnegative(),
  morningCount: z.number().int().nonnegative(),
  afternoonCount: z.number().int().nonnegative(),
  reasonCounts: z.array(
    z.object({
      reason: supportReasonSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
  currentUserSupport: supportSchema.nullable(),
})

const demandPageSchema = z.object({
  content: z.array(demandSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

const createResponseSchema = z.object({
  created: z.boolean(),
  demand: demandSchema,
})

const commentSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  author: z.object({
    role: z.enum(['PARENT', 'OPERATOR']),
    displayName: z.string(),
    operatorProfileId: z.string().uuid().nullable(),
  }),
  canDelete: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
})

const commentPageSchema = z.object({
  content: z.array(commentSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

const demandServiceResponseStatusSchema = z.enum(['ACTIVE', 'WITHDRAWN'])

const publicServiceResponseSchema = z.object({
  id: z.string().uuid(),
  publicationEventId: z.string().uuid(),
  publicationVersion: z.number().int().positive(),
  operatorId: z.string().uuid(),
  businessName: z.string().nullable(),
  contactPhone: z.string(),
  offersMorning: z.boolean(),
  offersAfternoon: z.boolean(),
  publishedAt: z.string().datetime({ offset: true }),
})

const publicServiceResponsePageSchema = z.object({
  content: z.array(publicServiceResponseSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

const operatorServiceResponseSchema = z.object({
  id: z.string().uuid(),
  status: demandServiceResponseStatusSchema,
  offersMorning: z.boolean(),
  offersAfternoon: z.boolean(),
  publicationVersion: z.number().int().positive(),
  publicationEventId: z.string().uuid(),
  publishedAt: z.string().datetime({ offset: true }),
  withdrawnAt: z.string().datetime({ offset: true }).nullable(),
  currentlyPublic: z.boolean(),
})

export const serviceResponseBlockers = [
  'ACCOUNT_EMAIL_UNVERIFIED',
  'ACCOUNT_DISABLED',
  'PROFILE_INACTIVE',
  'PROFILE_HIDDEN',
  'APPROVAL_REQUIRED',
  'DEMAND_NOT_OPEN',
  'SCHOOL_INACTIVE',
  'SCHOOL_NOT_LINKED',
  'SCHOOL_RELATIONSHIP_INACTIVE',
  'COVERAGE_MISSING',
] as const

const serviceResponseEligibilitySchema = z.object({
  demandId: z.string().uuid(),
  eligible: z.boolean(),
  blockers: z.array(z.enum(serviceResponseBlockers)),
  response: operatorServiceResponseSchema.nullable(),
})

const publishServiceResponseSchema = z.object({
  published: z.boolean(),
  response: operatorServiceResponseSchema,
})
export type SupportReason = z.infer<typeof supportReasonSchema>
export type Demand = z.infer<typeof demandSchema>
export type DemandPage = z.infer<typeof demandPageSchema>
export type DemandSupport = z.infer<typeof supportSchema>
export type DemandComment = z.infer<typeof commentSchema>
export type DemandCommentPage = z.infer<typeof commentPageSchema>
export type PublicServiceResponse = z.infer<typeof publicServiceResponseSchema>
export type PublicServiceResponsePage = z.infer<
  typeof publicServiceResponsePageSchema
>
export type OperatorServiceResponse = z.infer<
  typeof operatorServiceResponseSchema
>
export type ServiceResponseEligibility = z.infer<
  typeof serviceResponseEligibilitySchema
>
export type ServiceResponseBlocker = (typeof serviceResponseBlockers)[number]

export interface SupportValues {
  needsMorning: boolean
  needsAfternoon: boolean
  reasons: SupportReason[]
}

export interface DemandFilters {
  schoolId?: string
  neighborhoodId?: number
  academicYear?: string
  sort: 'newest' | 'most-supported'
  page: number
}

export interface ServiceResponseValues {
  offersMorning: boolean
  offersAfternoon: boolean
}

export function listDemands(filters: DemandFilters): Promise<DemandPage> {
  const parameters = new URLSearchParams({
    sort: filters.sort,
    page: String(filters.page),
    size: '10',
  })
  if (filters.schoolId) parameters.set('schoolId', filters.schoolId)
  if (filters.neighborhoodId) {
    parameters.set('neighborhoodId', String(filters.neighborhoodId))
  }
  if (filters.academicYear?.trim()) {
    parameters.set('academicYear', filters.academicYear.trim())
  }
  return apiRequest(`/demands?${parameters.toString()}`, {
    schema: demandPageSchema,
  })
}

export function getDemand(id: string): Promise<Demand> {
  return apiRequest(`/demands/${id}`, { schema: demandSchema })
}

export function createDemand(
  schoolId: string,
  neighborhoodId: number,
  values: SupportValues,
  academicYear?: string,
) {
  return apiRequest('/demands', {
    method: 'POST',
    requiresSession: true,
    json: {
      schoolId,
      neighborhoodId,
      ...values,
      ...(academicYear ? { academicYear } : {}),
    },
    schema: createResponseSchema,
  })
}

export function joinDemand(id: string, values: SupportValues) {
  return apiRequest(`/demands/${id}/support`, {
    method: 'POST',
    requiresSession: true,
    json: values,
    schema: demandSchema,
  })
}

export function updateDemandSupport(id: string, values: SupportValues) {
  return apiRequest(`/demands/${id}/support`, {
    method: 'PUT',
    requiresSession: true,
    json: values,
    schema: demandSchema,
  })
}

export function withdrawDemandSupport(id: string) {
  return apiRequest(`/demands/${id}/support`, {
    method: 'DELETE',
    requiresSession: true,
  })
}

export function listDemandComments(id: string, page: number) {
  return apiRequest(`/demands/${id}/comments?page=${page}&size=10`, {
    schema: commentPageSchema,
  })
}

export function createDemandComment(id: string, body: string) {
  return apiRequest(`/demands/${id}/comments`, {
    method: 'POST',
    requiresSession: true,
    json: { body },
    schema: commentSchema,
  })
}

export function deleteDemandComment(demandId: string, commentId: string) {
  return apiRequest(`/demands/${demandId}/comments/${commentId}`, {
    method: 'DELETE',
    requiresSession: true,
  })
}

export function listDemandServiceResponses(
  demandId: string,
  page = 0,
): Promise<PublicServiceResponsePage> {
  return apiRequest(`/demands/${demandId}/responses?page=${page}&size=20`, {
    schema: publicServiceResponsePageSchema,
  })
}

export function getServiceResponseEligibility(
  demandId: string,
): Promise<ServiceResponseEligibility> {
  return apiRequest(`/operator/demands/${demandId}/response`, {
    requiresSession: true,
    schema: serviceResponseEligibilitySchema,
  })
}

export function publishDemandServiceResponse(
  demandId: string,
  values: ServiceResponseValues,
) {
  return apiRequest(`/operator/demands/${demandId}/response`, {
    method: 'POST',
    requiresSession: true,
    json: values,
    schema: publishServiceResponseSchema,
  })
}

export function withdrawDemandServiceResponse(demandId: string) {
  return apiRequest(`/operator/demands/${demandId}/response`, {
    method: 'DELETE',
    requiresSession: true,
    schema: operatorServiceResponseSchema,
  })
}
