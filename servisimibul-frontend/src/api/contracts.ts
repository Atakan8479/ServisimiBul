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

export type UserRole = 'ADMIN' | 'OPERATOR' | 'PARENT'

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

// API codes remain unchanged. Only user-facing descriptions are localized.
const localizedProblems: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-posta veya şifre yanlış.',
  PARENT_REGISTRATION_UNAVAILABLE: 'Şu anda veli hesabı oluşturulamıyor.',
  EMAIL_UNAVAILABLE: 'Bu işlem şu anda tamamlanamıyor.',
  RATE_LIMIT_EXCEEDED: 'Çok sık denediniz. Biraz sonra tekrar deneyin.',
  AUTHENTICATION_REQUIRED: 'Devam etmek için giriş yapın.',
  UNAUTHENTICATED: 'Devam etmek için giriş yapın.',
  CSRF_INVALID: 'Oturumunuzun süresi dolmuş olabilir. Sayfayı yenileyin.',
  ACCESS_DENIED: 'Bu işlem için yetkiniz yok.',
  VALIDATION_FAILED: 'Girilen bilgileri kontrol edin.',
  demand_update_conflict: 'Talep bu sırada değişti. Sayfayı yenileyip tekrar deneyin.',
  offering_data_conflict: 'Araç veya servis bilgilerini kontrol edip tekrar deneyin.',
  offering_update_conflict: 'Servis bilgileri değişti. Sayfayı yenileyip tekrar deneyin.',
  operator_school_conflict: 'Okul bağlantısını kontrol edip tekrar deneyin.',
  coverage_update_conflict: 'Mahalle seçimi değişti. Sayfayı yenileyip tekrar deneyin.',
}

function displayProblemDetail(code: string, original: string): string {
  return localizedProblems[code] ?? original
}

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
    title: raw.title || 'İşlem tamamlanamadı',
    status: raw.status || status,
    detail: displayProblemDetail(raw.code || `HTTP_${status}`, raw.detail || 'İşlem tamamlanamadı. Tekrar deneyin.'),
    instance: raw.instance,
    code: raw.code || `HTTP_${status}`,
    fieldErrors,
    traceId: raw.traceId,
  }
}

function fallbackProblem(status: number): ApiProblem {
  return {
    title: 'İşlem tamamlanamadı',
    status,
    detail: 'İşlem tamamlanamadı. Tekrar deneyin.',
    code: `HTTP_${status}`,
  }
}
