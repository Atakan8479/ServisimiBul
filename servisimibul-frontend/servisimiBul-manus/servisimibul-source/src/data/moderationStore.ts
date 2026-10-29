export type CaseStatus = 'İnceleniyor' | 'Çözüldü' | 'İşlem gerekmiyor';

export type ModerationReport = {
  id: string;
  type: string;
  content: string;
  context: string;
  time: string;
  status: CaseStatus;
  sourceId?: string;
  reason?: string;
};

export const initialModerationReports: ModerationReport[] = [
  {
    id: 'R-204',
    type: 'Talep yorumu',
    content: 'Açık yorumda kişisel bilgi olabilir.',
    context: 'Koşuyolu sabah servisi talebi',
    time: '18 dk önce',
    status: 'İnceleniyor',
  },
  {
    id: 'R-198',
    type: 'İşletmeci kapsamı',
    content: 'Okul/mahalle bilgisi güncelliğini yitirmiş olabilir.',
    context: 'Marmara Işık İlkokulu · Acıbadem',
    time: 'Dün, 15.10',
    status: 'İnceleniyor',
  },
  {
    id: 'R-191',
    type: 'Talep açıklaması',
    content: 'Uygunsuz veya yanıltıcı içerik bildirimi.',
    context: 'Atakent servis talebi',
    time: '3 gün önce',
    status: 'Çözüldü',
  },
];

let reports = [...initialModerationReports];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getModerationReports(): ModerationReport[] {
  return reports;
}

export function addModerationReport(report: ModerationReport): ModerationReport[] {
  reports = [report, ...reports];
  notify();
  return reports;
}

export function updateModerationReport(id: string, status: CaseStatus): ModerationReport[] {
  reports = reports.map((report) => (report.id === id ? { ...report, status } : report));
  notify();
  return reports;
}

export function subscribeModerationReports(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
