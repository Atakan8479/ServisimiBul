import { z } from 'zod'
import { apiRequest } from '../../api/client'

const requestStatusSchema = z.enum([
  'RECEIVED',
  'UNDER_REVIEW',
  'AWAITING_VERIFICATION',
  'RESPONDED',
  'PARTIALLY_RESPONDED',
  'REJECTED',
])

const dataRightsRequestSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['ACCESS', 'CORRECTION', 'ERASURE', 'OBJECTION', 'OTHER']),
  status: requestStatusSchema,
  receivedAt: z.iso.datetime({ offset: true }),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
  responseDelivered: z.boolean(),
})

const dataRightsRequestsSchema = z.array(dataRightsRequestSchema)

export type DataRightsRequest = z.infer<typeof dataRightsRequestSchema>
export type DataRightsRequestStatus = z.infer<typeof requestStatusSchema>

export function listErasureRequests(signal?: AbortSignal) {
  return apiRequest('/data-rights-requests?type=ERASURE', {
    requiresSession: true,
    schema: dataRightsRequestsSchema,
    signal,
  })
}

export function submitErasureRequest(details: string) {
  return apiRequest('/data-rights-requests', {
    method: 'POST',
    json: { type: 'ERASURE', details },
    requiresSession: true,
    schema: dataRightsRequestSchema,
  })
}
