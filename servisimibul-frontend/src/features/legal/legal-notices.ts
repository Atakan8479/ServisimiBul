/**
 * Safe-by-default gate for user-facing legal/privacy notice content.
 *
 * Publishing real notice or terms text, controller/contact details, or
 * request-channel claims requires legal sign-off (LEG-05/LEG-08,
 * docs/25_LEGAL_APPROVAL_TRACKER.md). No approved content exists yet, so the
 * approved documents stay `null` regardless of this flag; the flag only
 * controls whether future approved content may render once it is added here.
 */
export function legalNoticesPublished(): boolean {
  return import.meta.env.VITE_LEGAL_NOTICES_PUBLISHED === 'true'
}

export const APPROVED_NOTICE: { body: string } | null = null
export const APPROVED_TERMS: { body: string } | null = null

export function noticeAvailable(): boolean {
  return legalNoticesPublished() && APPROVED_NOTICE !== null
}

export function termsAvailable(): boolean {
  return legalNoticesPublished() && APPROVED_TERMS !== null
}
