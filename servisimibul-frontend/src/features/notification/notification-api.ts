import { z } from 'zod'
import { apiRequest } from '../../api/client'

export const notificationTypes = [
  'DEMAND_CREATED',
  'SERVICE_PUBLISHED',
  'FEEDBACK_REMINDER',
  'SUPPORT_EXPIRED',
  'SERVICE_WITHDRAWN',
  'CONTENT_REPORTED',
] as const

const timestampSchema = z.string().datetime({ offset: true })
const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(notificationTypes),
  demandId: z.string().uuid().nullable(),
  serviceResponseId: z.string().uuid().nullable(),
  publicationEventId: z.string().uuid().nullable(),
  feedbackId: z.string().uuid().nullable(),
  moderationCaseId: z.string().uuid().nullable(),
  title: z.string(),
  message: z.string(),
  href: z.string().startsWith('/'),
  createdAt: timestampSchema,
  readAt: timestampSchema.nullable(),
})

const notificationPageSchema = z.object({
  content: z.array(notificationSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

const unreadCountSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
})

export type NotificationItem = z.infer<typeof notificationSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>

export const unreadCountChangedEvent = 'servisimibul:unread-count-changed'

export function listNotifications(page = 0, signal?: AbortSignal) {
  return apiRequest(`/notifications?page=${page}&size=20`, {
    requiresSession: true,
    signal,
    schema: notificationPageSchema,
  })
}

export function unreadNotificationCount(signal?: AbortSignal) {
  return apiRequest('/notifications/unread-count', {
    requiresSession: true,
    signal,
    schema: unreadCountSchema,
  })
}

export function markNotificationRead(id: string) {
  return apiRequest(`/notifications/${id}/read`, {
    method: 'PUT',
    requiresSession: true,
    schema: notificationSchema,
  })
}
