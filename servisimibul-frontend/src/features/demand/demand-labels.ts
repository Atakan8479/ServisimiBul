import type { SupportReason } from './demand-api'

const reasonLabels: Record<SupportReason, string> = {
  NO_SUITABLE_SERVICE: 'Uygun servis bulamıyorum',
  NO_AVAILABLE_SEATS: 'Mevcut servislerde yer yok',
  PRICE_TOO_HIGH: 'Mevcut seçeneklerin ücreti yüksek',
  ROUTE_TOO_LONG: 'Mevcut güzergâh çok uzun',
  SCHEDULE_UNSUITABLE: 'Saatler ihtiyacıma uymuyor',
  OTHER: 'Başka bir neden',
}

export function reasonLabel(reason: SupportReason): string {
  return reasonLabels[reason]
}
