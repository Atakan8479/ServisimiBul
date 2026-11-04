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

export type NotificationReadState = 'ALL' | 'UNREAD' | 'READ'

export function listNotifications(
  page = 0,
  readState: NotificationReadState = 'ALL',
  signal?: AbortSignal,
) {
  // ALL is the server default, so the original request shape stays unchanged.
  const filter = readState === 'ALL' ? '' : `&readState=${readState}`
  return apiRequest(`/notifications?page=${page}&size=20${filter}`, {
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

export function markAllNotificationsRead() {
  return apiRequest('/notifications/read-all', {
    method: 'PUT',
    requiresSession: true,
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

const preferenceSchema = z.object({
  type: z.enum(notificationTypes),
  enabled: z.boolean(),
})

export type NotificationPreference = z.infer<typeof preferenceSchema>

// The backend lists only the optional types the current role may control.
export function listNotificationPreferences(signal?: AbortSignal) {
  return apiRequest('/notifications/preferences', {
    requiresSession: true,
    signal,
    schema: z.array(preferenceSchema),
  })
}

export function updateNotificationPreference(
  type: NotificationPreference['type'],
  enabled: boolean,
) {
  return apiRequest(`/notifications/preferences/${type}`, {
    method: 'PUT',
    requiresSession: true,
    json: { enabled },
    schema: preferenceSchema,
  })
}
