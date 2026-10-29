import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Filter, Shield } from 'lucide-react';
import { WorkspaceShell } from '../../components/Shells';
import { Badge, Button, Card, DemoNotice, EmptyState, Modal, PageHeader, SelectField } from '../../components/ui';
import { getModerationReports, subscribeModerationReports, updateModerationReport, type ModerationReport } from '../../data/moderationStore';

export function AdminModerationPage() {
  const [reports, setReports] = useState<ModerationReport[]>(() => getModerationReports());
  const [statusFilter, setStatusFilter] = useState<'Tümü' | 'İnceleniyor' | 'Tamamlanan'>('Tümü');
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'resolve' | 'dismiss'>('resolve');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeModerationReports(() => setReports(getModerationReports()));
    return () => { unsubscribe(); };
  }, []);

  const current = reports.find((report) => report.id === selected);
  const visibleReports = useMemo(
    () => reports.filter((report) => statusFilter === 'Tümü' || (statusFilter === 'İnceleniyor' ? report.status === 'İnceleniyor' : report.status !== 'İnceleniyor')),
    [reports, statusFilter],
  );

  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim() || !selected) return;
    updateModerationReport(selected, action === 'resolve' ? 'Çözüldü' : 'İşlem gerekmiyor');
    setSelected(null);
    setReason('');
    setNotice('Moderasyon durumu bu prototip oturumunda güncellendi.');
  };

  const reviewingCount = reports.filter((report) => report.status === 'İnceleniyor').length;
  const completedCount = reports.length - reviewingCount;

  return (
    <WorkspaceShell role="admin">
      <PageHeader eyebrow="YÖNETİM PANELİ" title="Raporlama ve moderasyon" description="İçerik bildirimlerini incele ve gerekçeli işlem kaydı oluştur."/>
      <DemoNotice>Kararlar insan tarafından verilir. Raporlar yalnızca bu tarayıcı oturumundaki demo kuyruğuna eklenir; AI moderasyonu veya otomatik silme yoktur.</DemoNotice>
      {notice && <div className="form-success"><CheckCircle2 size={15}/>{notice}</div>}
      <div className="moderation-summary">
        <Card><span>Bekleyen bildirim</span><strong>{reviewingCount}</strong></Card>
        <Card><span>Çözülen</span><strong>{completedCount}</strong></Card>
        <Card className="moderation-guidance"><Shield size={17}/><p>İçerik otomatik kaldırılmaz. Gerekçe gir, kaydı incele ve uygun aksiyonu seç.</p></Card>
      </div>
      <div className="admin-filters">
        <div className="admin-filter-tabs">
          <button className={statusFilter === 'Tümü' ? 'active' : ''} onClick={() => setStatusFilter('Tümü')}>Tüm bildirimler <span>{reports.length}</span></button>
          <button className={statusFilter === 'İnceleniyor' ? 'active' : ''} onClick={() => setStatusFilter('İnceleniyor')}>İnceleniyor <span>{reviewingCount}</span></button>
          <button className={statusFilter === 'Tamamlanan' ? 'active' : ''} onClick={() => setStatusFilter('Tamamlanan')}>Tamamlanan <span>{completedCount}</span></button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setStatusFilter('Tümü')}><Filter size={14}/>Filtreyi sıfırla</Button>
      </div>
      <div className="report-list">
        {visibleReports.map((report) => (
          <Card key={report.id} className="report-card">
            <div className="report-card-icon"><Shield size={18}/></div>
            <div className="report-card-main">
              <div className="report-card-meta"><Badge tone={report.status === 'İnceleniyor' ? 'yellow' : report.status === 'Çözüldü' ? 'green' : 'neutral'} dot>{report.status}</Badge><span>{report.id} · {report.time}</span></div>
              <h3>{report.type}</h3>
              <p>{report.content}</p>
              <small>{report.context}</small>
            </div>
            <div className="report-actions"><Button variant="outline" size="sm" onClick={() => { setSelected(report.id); setAction('resolve'); }}>İncele</Button></div>
          </Card>
        ))}
        {visibleReports.length === 0 && <EmptyState title="Bu görünümde bildirim yok" description="Diğer durum sekmelerini seçebilir veya filtreyi sıfırlayabilirsin."/>}
      </div>
      <Modal open={Boolean(current)} title={`Bildirim ${current?.id ?? ''}`} description={current?.context} onClose={() => setSelected(null)}>
        <div className="report-preview"><Badge tone="yellow">{current?.type}</Badge><p>{current?.content}</p><small>Gerçek ürün kararları mevcut rol izinleri ve süreçlerine tabidir.</small></div>
        <form onSubmit={apply} className="form-grid">
          <div className="field field-full"><label htmlFor="moderation-reason">İşlem gerekçesi</label><textarea id="moderation-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nedenini kısaca yaz…" required/></div>
          <SelectField label="Karar" value={action} onChange={(event) => setAction(event.target.value as 'resolve' | 'dismiss')}><option value="resolve">Çözüldü</option><option value="dismiss">İşlem gerekmiyor</option></SelectField>
          <div className="modal-actions field-full"><Button type="button" variant="outline" onClick={() => setSelected(null)}>Vazgeç</Button><Button type="submit" disabled={!reason.trim()}>Kararı kaydet</Button></div>
        </form>
      </Modal>
    </WorkspaceShell>
  );
}
