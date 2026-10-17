import { z } from 'zod'

export type FieldErrorMap = Record<string, string>

export interface ApiProblem {
  type?: string
  title: string
  status: number
  detail: string
  instance?: string
  code: string
  fieldErrors?: FieldErrorMap
  traceId?: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type UserRole = 'ADMIN' | 'OPERATOR'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  operatorApprovalRequired: boolean
  approvalStatus: 'DRAFT' | 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED' | null
}

export interface CsrfToken {
  headerName: string
  parameterName: string
  token: string
}

export const csrfTokenSchema: z.ZodType<CsrfToken> = z.object({
  headerName: z.string().min(1),
  parameterName: z.string().min(1),
  token: z.string().min(1),
})

const rawProblemSchema = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    status: z.number().int().optional(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: z.string().optional(),
    traceId: z.string().optional(),
    fieldErrors: z
      .union([
        z.record(z.string(), z.string()),
        z.array(z.object({ field: z.string(), message: z.string() })),
      ])
      .optional(),
  })
  .passthrough()

export function normalizeApiProblem(
  value: unknown,
  status: number,
): ApiProblem {
  const parsed = rawProblemSchema.safeParse(value)
  if (!parsed.success) {
    return fallbackProblem(status)
  }

  const raw = parsed.data
  const fieldErrors = Array.isArray(raw.fieldErrors)
    ? Object.fromEntries(
        raw.fieldErrors.map(({ field, message }) => [field, message]),
      )
    : raw.fieldErrors

  return {
    type: raw.type,
    title: raw.title || 'Request failed',
    status: raw.status || status,
    detail: raw.detail || 'The request could not be completed.',
    instance: raw.instance,
    code: raw.code || `HTTP_${status}`,
    fieldErrors,
    traceId: raw.traceId,
  }
}

function fallbackProblem(status: number): ApiProblem {
  return {
    title: 'Request failed',
    status,
    detail: 'The request could not be completed.',
    code: `HTTP_${status}`,
  }
}
