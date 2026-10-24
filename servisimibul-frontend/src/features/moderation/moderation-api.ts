import { z } from 'zod'
import { apiRequest } from '../../api/client'

export const moderationTargetTypes = [
  'COMMENT',
  'DEMAND',
  'SERVICE_RESPONSE',
] as const
export const reportReasons = [
  'ABUSE_HARASSMENT',
  'HATE_DISCRIMINATION',
  'PERSONAL_DATA',
  'SPAM_ADVERTISING',
  'MISLEADING_SERVICE',
  'OTHER',
] as const
export const moderationCaseStatuses = [
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'DISMISSED',
] as const
export const moderationActions = [
  'MARK_IN_REVIEW',
  'DISMISS',
  'RESOLVE_NO_ACTION',
  'HIDE_COMMENT',
  'RESTORE_COMMENT',
  'WITHDRAW_SERVICE_RESPONSE',
  'SUSPEND_OPERATOR',
  'CLOSE_DEMAND',
] as const

const targetTypeSchema = z.enum(moderationTargetTypes)
const reportReasonSchema = z.enum(reportReasons)
const caseStatusSchema = z.enum(moderationCaseStatuses)
const moderationActionSchema = z.enum(moderationActions)
const timestampSchema = z.string().datetime({ offset: true })

const targetContextSchema = z.object({
  title: z.string(),
  snapshot: z.string(),
  currentlyVisible: z.boolean(),
  operatorProfileId: z.string().uuid().nullable(),
})

const caseSummarySchema = z.object({
  id: z.string().uuid(),
  targetType: targetTypeSchema,
  targetId: z.string().uuid(),
  status: caseStatusSchema,
  target: targetContextSchema,
  reporterCount: z.number().int().positive(),
  reasonCounts: z.partialRecord(
    reportReasonSchema,
    z.number().int().positive(),
  ),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  resolvedAt: timestampSchema.nullable(),
})

const reportReceiptSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  targetType: targetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  status: caseStatusSchema,
  createdAt: timestampSchema,
})

const caseDetailSchema = z.object({
  summary: caseSummarySchema,
  moderatedById: z.string().uuid().nullable(),
  decisionReason: z.string().nullable(),
  reports: z.array(
    z.object({
      id: z.string().uuid(),
      reason: reportReasonSchema,
      explanation: z.string().nullable(),
      createdAt: timestampSchema,
    }),
  ),
  audit: z.array(
    z.object({
      id: z.string().uuid(),
      moderatorId: z.string().uuid(),
      action: moderationActionSchema,
      reason: z.string(),
      createdAt: timestampSchema,
    }),
  ),
})

const casePageSchema = z.object({
  content: z.array(caseSummarySchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

export type ModerationTargetType = (typeof moderationTargetTypes)[number]
export type ReportReason = (typeof reportReasons)[number]
export type ModerationCaseStatus = (typeof moderationCaseStatuses)[number]
export type ModerationAction = (typeof moderationActions)[number]
export type ModerationCaseSummary = z.infer<typeof caseSummarySchema>
export type ModerationCaseDetail = z.infer<typeof caseDetailSchema>
export type ModerationCasePage = z.infer<typeof casePageSchema>

export function reportContent(request: {
  targetType: ModerationTargetType
  targetId: string
  reason: ReportReason
  explanation: string | null
}) {
  return apiRequest('/reports', {
    method: 'POST',
    json: request,
    requiresSession: true,
    schema: reportReceiptSchema,
  })
}

export function listModerationCases(filters: {
  status?: ModerationCaseStatus
  targetType?: ModerationTargetType
  reason?: ReportReason
  reportedFrom?: string
  reportedTo?: string
  page: number
}) {
  const query = new URLSearchParams({ page: String(filters.page), size: '20' })
  if (filters.status) query.set('status', filters.status)
  if (filters.targetType) query.set('targetType', filters.targetType)
  if (filters.reason) query.set('reason', filters.reason)
  if (filters.reportedFrom) query.set('reportedFrom', filters.reportedFrom)
  if (filters.reportedTo) query.set('reportedTo', filters.reportedTo)
  return apiRequest(`/admin/moderation/cases?${query.toString()}`, {
    requiresSession: true,
    schema: casePageSchema,
  })
}

export function getModerationCase(id: string) {
  return apiRequest(`/admin/moderation/cases/${id}`, {
    requiresSession: true,
    schema: caseDetailSchema,
  })
}

export function moderateCase(
  id: string,
  action: ModerationAction,
  reason: string,
) {
  return apiRequest(`/admin/moderation/cases/${id}/actions`, {
    method: 'POST',
    json: { action, reason },
    requiresSession: true,
    schema: caseDetailSchema,
  })
}
