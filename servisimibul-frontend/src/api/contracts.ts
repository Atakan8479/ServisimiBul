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
  emailChangeAvailable?: boolean
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
  CURRENT_PASSWORD_INVALID: 'Mevcut şifre doğrulanamadı.',
  PARENT_REGISTRATION_UNAVAILABLE: 'Şu anda veli hesabı oluşturulamıyor.',
  EMAIL_UNAVAILABLE: 'Bu işlem şu anda tamamlanamıyor.',
  TOKEN_INVALID_OR_EXPIRED:
    'Doğrulama bağlantısı geçersiz, süresi dolmuş veya daha önce kullanılmış.',
  AUTH_SERVICE_UNAVAILABLE:
    'İşlem şu anda tamamlanamıyor. Lütfen tekrar deneyin.',
  RATE_LIMITED: 'Çok sık denediniz. Biraz sonra tekrar deneyin.',
  RATE_LIMIT_EXCEEDED: 'Çok sık denediniz. Biraz sonra tekrar deneyin.',
  AUTHENTICATION_REQUIRED: 'Devam etmek için giriş yapın.',
  UNAUTHENTICATED: 'Devam etmek için giriş yapın.',
  CSRF_INVALID: 'Oturumunuzun süresi dolmuş olabilir. Sayfayı yenileyin.',
  ACCESS_DENIED: 'Bu işlem için yetkiniz yok.',
  VALIDATION_FAILED: 'Girilen bilgileri kontrol edin.',
  demand_update_conflict:
    'Talep bu sırada değişti. Sayfayı yenileyip tekrar deneyin.',
  offering_data_conflict:
    'Araç veya servis bilgilerini kontrol edip tekrar deneyin.',
  offering_update_conflict:
    'Servis bilgileri değişti. Sayfayı yenileyip tekrar deneyin.',
  operator_school_conflict: 'Okul bağlantısını kontrol edip tekrar deneyin.',
  coverage_update_conflict:
    'Mahalle seçimi değişti. Sayfayı yenileyip tekrar deneyin.',
  validation_error: 'Girilen bilgileri kontrol edin.',
  // Demand, support, comment and feedback rules.
  duplicate_comment: 'Bu yorumu kısa süre önce gönderdiniz.',
  active_support_required: 'Bu talebe yorum yapmak için etkin destek gerekir.',
  demand_not_open: 'Bu talep artık açık değil.',
  demand_not_reopenable: 'Bu talep yeniden açılamaz.',
  support_withdrawn: 'Düzenlemek için önce talebe yeniden destek verin.',
  comment_author_ineligible:
    'Yorum yapmak için e-postası doğrulanmış etkin bir hesap gerekir.',
  comment_role_forbidden:
    'Bu talebe yalnızca destek veren veliler ve işletmeciler yorum yapabilir.',
  demand_feedback_not_pending:
    'Bu servis duyurusu için değerlendirme artık yapılamıyor.',
  demand_feedback_stale:
    'Bu servis duyurusu güncel değil. Sayfayı yenileyip tekrar deneyin.',
  school_inactive: 'Bu okul şu anda kullanılamıyor.',
  // Content reports and moderation.
  report_already_open: 'Bu içerik için açık bir bildiriminiz zaten var.',
  reporter_ineligible:
    'İçerik bildirmek için etkin bir veli veya işletmeci hesabı gerekir.',
  moderation_case_closed: 'Bu içerik bildirimi zaten sonuçlandırıldı.',
  comment_already_hidden: 'Yorum zaten gizlenmiş.',
  comment_already_visible: 'Yorum zaten görünür.',
  demand_already_closed: 'Talep zaten kapatılmış.',
  service_response_already_withdrawn: 'Servis duyurusu zaten geri çekilmiş.',
  // Operator account, service announcements, offerings and vehicles.
  operator_approval_required: 'Bu işlem için yönetici onayı gerekir.',
  operator_email_unverified: 'Bu işlem için e-posta adresinizi doğrulayın.',
  operator_suspended: 'İşletmeci hesabınız askıya alınmış.',
  operator_account_disabled: 'İşletmeci hesabınız devre dışı.',
  operator_already_suspended: 'İşletmeci zaten askıya alınmış.',
  operator_profile_required:
    'Bu işlem için etkin bir işletmeci profili gerekir.',
  operator_profile_hidden:
    'Servis duyurusu paylaşmak için profilinizi aramalarda görünür yapın.',
  operator_school_required:
    'Servis duyurusu paylaşmak için önce bu okulu profilinize ekleyin.',
  operator_school_inactive: 'Önce bu okulu hizmet listenizde etkinleştirin.',
  operator_coverage_required:
    'Servis duyurusu paylaşmak için talebin mahallesini bu okulun mahallelerine ekleyin.',
  operator_school_duplicate: 'Bu okul zaten listenizde.',
  operator_application_read_only:
    'İnceleme bitene kadar bilgilerinizi değiştiremezsiniz.',
  operator_application_conflict:
    'Başvuru durumu değişmiş olabilir. Sayfayı yenileyip tekrar deneyin.',
  operator_application_update_conflict:
    'Başvuru bu sırada değişti. Sayfayı yenileyip tekrar deneyin.',
  coverage_duplicate: 'Aynı mahalleyi birden fazla kez seçemezsiniz.',
  offering_coverage_duplicate: 'Aynı mahalleyi birden fazla kez seçemezsiniz.',
  offering_coverage_invalid:
    'Yalnızca bu okul için hizmet verdiğiniz mahalleleri seçin.',
  offering_coverage_required: 'Yayınlamak için en az bir mahalle seçin.',
  vehicle_plate_conflict: 'Bu plakayla kayıtlı bir aracınız zaten var.',
  vehicle_capacity_in_use:
    'Kapasite, servis tekliflerindeki boş koltuk sayısından az olamaz.',
  vehicle_inactive: 'Servis teklifi için etkin bir araç seçin.',
  // Admin school catalog.
  school_conflict: 'Okul bilgileri mevcut bir kayıtla çakışıyor.',
  school_source_conflict: 'Bu okul zaten kayıtlı.',
  school_province_change_conflict:
    'Hizmet verilen mahalleleri olan bir okulun ili değiştirilemez.',
}

// Exact backend validation messages (AuthInputValidator and auth handlers).
const localizedFieldMessages: Record<string, string> = {
  'Enter a valid email address': 'Geçerli bir e-posta adresi girin.',
  'Password must be 12-64 characters and at most 72 UTF-8 bytes':
    'Şifre 12-64 karakter olmalı ve UTF-8 olarak 72 baytı aşmamalıdır.',
  'Business name must be 2-120 characters':
    'İşletme adı 2-120 karakter olmalıdır.',
  'Enter a valid international phone number':
    'Geçerli bir telefon numarası girin.',
  'Current password is incorrect': 'Mevcut şifre doğrulanamadı.',
}

function displayProblemDetail(code: string): string {
  return Object.hasOwn(localizedProblems, code)
    ? localizedProblems[code]
    : 'İşlem tamamlanamadı. Tekrar deneyin.'
}

function displayFieldMessage(message: string): string {
  return Object.hasOwn(localizedFieldMessages, message)
    ? localizedFieldMessages[message]
    : 'Bu alanı kontrol edin.'
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
  const fieldErrors =
    raw.fieldErrors &&
    Object.fromEntries(
      (Array.isArray(raw.fieldErrors)
        ? raw.fieldErrors.map(({ field, message }) => [field, message])
        : Object.entries(raw.fieldErrors)
      ).map(([field, message]) => [field, displayFieldMessage(message)]),
    )

  return {
    type: raw.type,
    title: raw.title || 'İşlem tamamlanamadı',
    status: raw.status || status,
    detail: displayProblemDetail(raw.code || `HTTP_${status}`),
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
