import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight,
  CircleAlert, Clock3, EyeOff, FileText, KeyRound, LockKeyhole, LogOut,
  Mail, ShieldCheck, UserRound, X,
} from 'lucide-react';
import {
  Badge, Button, Card, DemoNotice, EmptyState, Field, InlineMessage,
  PageHeader, SelectField, Modal,
} from '../../components/ui';
import { PublicLayout, WorkspaceShell } from '../../components/Shells';
import './accountPrivacy.css';

type AccountRole = 'parent' | 'operator';
const roleBase = (role: AccountRole) => role === 'operator' ? '/operator' : '/parent';
const roleName = (role: AccountRole) => role === 'operator' ? 'İşletmeci hesabı' : 'Veli hesabı';
const prototypeNotice = 'Görsel referans · Bu prototip gerçek e-posta göndermez, başvuru kaydetmez ve hesap/parola durumunu değiştirmez.';

function ActionLink({ to, children, variant = 'primary', size = 'md', className = '' }: {
  to: string; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'quiet'; size?: 'sm' | 'md' | 'lg'; className?: string;
}) {
  return <Button asChild variant={variant} size={size} className={className}><Link to={to}>{children}</Link></Button>;
}

function PageFrame({ role, children }: { role: AccountRole; children: React.ReactNode }) {
  return <WorkspaceShell role={role}><div className="account-privacy-page">{children}</div></WorkspaceShell>;
}

function PageDemoNote() {
  return <DemoNotice>{prototypeNotice}</DemoNotice>;
}

function SectionCard({ icon, title, description, children, className = '' }: {
  icon: React.ReactNode; title: string; description?: string; children?: React.ReactNode; className?: string;
}) {
  return <Card className={`ap-card ${className}`}>
    <div className="ap-section-head"><span className="ap-icon" aria-hidden="true">{icon}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>
    {children}
  </Card>;
}

function SettingsPage({ role }: { role: AccountRole }) {
  const base = roleBase(role);
  return <>
    <PageHeader eyebrow="HESAP VE GİZLİLİK" title="Hesap ve gizlilik" description="Hesap bilgilerini, güvenlik ayarlarını ve kişisel verilerinle ilgili seçenekleri tek yerde gör." actions={<Badge tone="blue">{roleName(role)}</Badge>} />
    <PageDemoNote />
    <div className="ap-settings-stack">
      <Card className="ap-account-summary">
        <div className="ap-account-mark"><UserRound size={22}/></div>
        <div className="ap-account-main"><span className="ap-label">HESAP BİLGİSİ</span><h2>{roleName(role)}</h2><p>Hesap e-postası</p><strong className="ap-placeholder">[MASKELİ HESAP E-POSTASI]</strong></div>
        <div className="ap-account-side"><Badge tone="teal" dot>Hesap sahibi</Badge><ActionLink to={`${base}/account/email`} variant="outline" size="sm">E-postayı yönet</ActionLink></div>
      </Card>

      <div className="ap-two-column">
        <SectionCard icon={<LockKeyhole size={18}/>} title="Güvenlik" description="Giriş bilgileri ve oturumlar.">
          <div className="ap-link-list">
            <Link className="ap-action-row" to={`${base}/account/password`}><span><strong>Şifreyi değiştir</strong><small>Mevcut şifreni doğrulaman gerekir.</small></span><ChevronRight size={17}/></Link>
            <Link className="ap-action-row" to={`${base}/account/sessions?state=confirmation`}><span><strong>Tüm cihazlardan çıkış yap</strong><small>Açık oturumlar ve yeniden giriş hakkında bilgi al.</small></span><ChevronRight size={17}/></Link>
          </div>
        </SectionCard>
        <SectionCard icon={<ShieldCheck size={18}/>} title="Gizlilik ve kişisel veriler" description="Aydınlatma ve başvuruların.">
          <div className="ap-link-list">
            <Link className="ap-action-row" to="/privacy/notice"><span><strong>Gizlilik bilgileri</strong><small>Onaylanmış metin yayımlanmadan önce hukuk kontrolü gerekir.</small></span><ChevronRight size={17}/></Link>
            <Link className="ap-action-row" to={`${base}/privacy/requests`}><span><strong>Kişisel verilerimle ilgili başvurular</strong><small>Yeni başvuru oluştur veya mevcut durumları görüntüle.</small></span><ChevronRight size={17}/></Link>
          </div>
        </SectionCard>
      </div>

      {role === 'operator' && <SectionCard icon={<EyeOff size={18}/>} title="İşletme profili ayrı yönetilir" description="Herkese açık işletme profilinin görünürlüğü, hesap ayarlarından farklıdır.">
        <div className="ap-profile-link"><div><strong>Profil görünürlüğü</strong><p>Mevcut işletme profili ekranından yönetilir; bu sayfa profil düzenleme işlevini tekrarlamaz.</p></div><ActionLink to="/operator/profile" variant="outline">İşletme profiline git <ArrowRight size={15}/></ActionLink></div>
      </SectionCard>}

      <div className="ap-lifecycle-intro"><div><span className="ap-label">HESAP YÖNETİMİ</span><h2>Birbirinden farklı iki işlem</h2></div><p>Hesabı devre dışı bırakma ve kişisel verilerin silinmesini isteme aynı şey değildir.</p></div>
      <div className="ap-two-column ap-lifecycle-grid">
        <Card className="ap-lifecycle-card"><span className="ap-icon ap-icon-muted"><UserRound size={18}/></span><Badge tone="yellow">Ürün politikası onayı gerekli</Badge><h3>Hesabı geçici olarak devre dışı bırak</h3><p>Erişim, kayıtlar ve yeniden etkinleştirme koşulları [ACCOUNT_REACTIVATION_POLICY_PENDING] onayı olmadan belirlenmiş sayılmaz.</p><ActionLink to={`${base}/lifecycle/deactivate`} variant="outline">Akış bilgisini görüntüle <ArrowRight size={15}/></ActionLink></Card>
        <Card className="ap-lifecycle-card"><span className="ap-icon ap-icon-muted"><FileText size={18}/></span><Badge tone="blue">KVKK başvurusu</Badge><h3>Kişisel verilerimin silinmesini iste</h3><p>Başvuru oluşturmak verilerin silindiği anlamına gelmez; sonuç inceleme ve onaylı saklama politikasına bağlıdır.</p><ActionLink to={`${base}/lifecycle/erasure`} variant="outline">Süreç bilgisini görüntüle <ArrowRight size={15}/></ActionLink></Card>
      </div>
    </div>
  </>;
}

function EmailPage({ role, state }: { role: AccountRole; state: string }) {
  const base = roleBase(role);
  return <>
    <PageHeader eyebrow="HESAP VE GİZLİLİK" title="E-posta adresi" description="Hesap e-postası ve değişiklik doğrulamasının durumu." />
    <PageDemoNote />
    <Card className="ap-narrow-card">
      <div className="ap-inline-title"><span className="ap-icon"><Mail size={18}/></span><div><span className="ap-label">MEVCUT ADRES</span><h2>[MASKELİ HESAP E-POSTASI]</h2></div></div>
      {state === 'pending' ? <>
        <div className="ap-state-heading"><Badge tone="yellow" dot>Doğrulama bekliyor</Badge><h3>Yeni adres henüz doğrulanmadı</h3><p>Bu, doğrulama altyapısı etkinleştirilirse kullanılabilecek görsel durum örneğidir. Prototip e-posta göndermedi ve yeni adres kaydetmedi.</p></div>
        <div className="ap-detail-row"><span>Yeni adres</span><strong>[YENİ E-POSTA]</strong></div>
        <InlineMessage kind="warning">E-posta teslimi şu anda etkin değil. Bu nedenle kod gönderildiği veya doğrulama bağlantısı çalıştığı varsayılmamalıdır.</InlineMessage>
        <div className="ap-card-actions"><ActionLink to={`${base}/account/email?state=unavailable`} variant="outline">Şimdilik kullanılamıyor durumunu gör</ActionLink><ActionLink to={`${base}/account`} variant="quiet">Hesap ayarlarına dön</ActionLink></div>
      </> : <>
        <InlineMessage kind="info">E-posta değişikliği şu anda başlatılamaz. Gerçek doğrulama yöntemi ve iletişim kanalı onaylanıp etkinleştirilene kadar yeni adres kaydedilmez.</InlineMessage>
        <div className="ap-placeholder-note"><span className="ap-label">GEREKLİ KARAR</span><strong>[CONTACT_CHANNEL_PENDING]</strong><small>Doğrulama bekliyor durumu yalnızca tasarım referansıdır; gerçek teslimat anlamına gelmez.</small></div>
        <div className="ap-card-actions"><Button variant="outline" disabled aria-describedby="email-change-unavailable">E-posta değişikliği kullanılamıyor</Button><ActionLink to={`${base}/account/email?state=pending`} variant="quiet">Bekliyor durum örneği</ActionLink><ActionLink to={`${base}/account`} variant="quiet">Hesap ayarlarına dön</ActionLink></div>
        <span id="email-change-unavailable" className="visually-hidden">Doğrulama kanalı henüz etkin değil; gerçek e-posta gönderilmez.</span>
      </>}
    </Card>
  </>;
}

function PasswordPage({ role, state }: { role: AccountRole; state: string }) {
  const base = roleBase(role);
  const navigate = useNavigate();
  if (state === 'session-ended') return <>
    <PageHeader eyebrow="GÜVENLİK" title="Oturum sona erdi" description="Şifre güncelleme sonrasında gösterilebilecek örnek durum." />
    <PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-state-center"><span className="ap-result-icon ap-result-success"><CheckCircle2 size={24}/></span><Badge tone="green">Örnek durum</Badge><h2>Tekrar giriş yapman gerekebilir</h2><p>Bu görsel, parola işleminin ve oturum politikasının sunucu tarafında tamamlandığını varsaymaz. Gerçek oturum davranışı APP-04 ve güvenlik incelemesine bağlıdır.</p><ActionLink to={role === 'operator' ? '/operator/login' : '/parent/login'}>Giriş ekranına dön <ArrowRight size={15}/></ActionLink></div></Card>
  </>;
  return <>
    <PageHeader eyebrow="GÜVENLİK" title="Şifreyi değiştir" description="Mevcut şifreni doğrula ve yeni şifreni iki kez gir." />
    <PageDemoNote />
    <Card className="ap-narrow-card">
      {state === 'wrong-password' && <InlineMessage kind="error">Mevcut şifre doğrulanamadı. Bilgini kontrol et ve tekrar dene.</InlineMessage>}
      <form className="ap-form" onSubmit={(event) => { event.preventDefault(); navigate(`${base}/account/password?state=wrong-password`); }}>
        <Field label="Mevcut şifre" name="currentPassword" type="password" autoComplete="current-password" required error={state === 'wrong-password' ? 'Mevcut şifre doğrulanamadı.' : undefined}/>
        <Field label="Yeni şifre" name="newPassword" type="password" autoComplete="new-password" required hint="Güçlü bir parola seç. Ayrıntılı kurallar [PASSWORD_POLICY_PENDING]."/>
        <Field label="Yeni şifreyi tekrar gir" name="confirmPassword" type="password" autoComplete="new-password" required/>
        <InlineMessage kind="info">Kaydetme, mevcut şifreyi doğrulama, oturum iptali ve CSRF koruması yalnızca üretim uygulamasında uygulanmalıdır. Bu ekran hiçbir parola göndermez.</InlineMessage>
        <div className="ap-card-actions"><Button type="submit">Şifreyi güncelle</Button><ActionLink to={`${base}/account`} variant="outline">Vazgeç</ActionLink></div>
      </form>
    </Card>
  </>;
}

function SessionsPage({ role, state }: { role: AccountRole; state: string }) {
  const base = roleBase(role);
  const navigate = useNavigate();
  if (state === 'ended') return <>
    <PageHeader eyebrow="GÜVENLİK" title="Oturumlar sona erdirildi" description="Başarılı sonuç için örnek görsel durum." />
    <PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-state-center"><span className="ap-result-icon ap-result-success"><CheckCircle2 size={24}/></span><Badge tone="green">Örnek başarı durumu</Badge><h2>Diğer oturumlar kapatıldı</h2><p>Üretimde hangi oturumların geçersiz kılınacağı ve yeniden giriş gerekip gerekmediği güvenlik politikasıyla belirlenmelidir. Burada herhangi bir oturum kapatılmadı.</p><ActionLink to={`${base}/account`}>Hesap ayarlarına dön <ArrowRight size={15}/></ActionLink></div></Card>
  </>;
  return <>
    <PageHeader eyebrow="GÜVENLİK" title="Tüm cihazlardan çıkış yap" description="Açık oturumların sonlandırılmasıyla ilgili onay örneği." />
    <PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-inline-title"><span className="ap-icon ap-icon-warning"><LogOut size={18}/></span><div><span className="ap-label">OTURUM GÜVENLİĞİ</span><h2>Bu işlem diğer oturumları kapatabilir</h2></div></div><p className="ap-body-copy">İşleme devam edersen diğer cihazlarda yeniden giriş istenebilir. Mevcut cihazın ve devam eden işlemlerin nasıl etkileneceği üretim güvenlik politikasında netleştirilmelidir.</p><InlineMessage kind="warning">Bu, yalnızca onay ekranı taslağıdır. Prototip hiçbir oturumu sonlandırmaz.</InlineMessage><div className="ap-card-actions"><ActionLink to={`${base}/account/sessions?state=confirmation`} variant="danger">Onay ekranını göster</ActionLink><ActionLink to={`${base}/account`} variant="outline">Vazgeç</ActionLink></div></Card>
    <Modal open={state === 'confirmation'} title="Tüm cihazlardan çıkış yapılsın mı?" description="Oturumların etkisi ve tekrar giriş gereksinimi gerçek güvenlik kuralıyla doğrulanmalıdır." onClose={() => navigate(`${base}/account`)} footer={<div className="modal-actions"><ActionLink to={`${base}/account`} variant="outline">Vazgeç</ActionLink><ActionLink to={`${base}/account/sessions?state=ended`} variant="danger">Onay örneğini gör</ActionLink></div>}>
      <InlineMessage kind="warning">[SECURITY_SESSION_POLICY_PENDING] — Bu düğme yalnızca tasarım örneğine ilerler; gerçek oturumları kapatmaz.</InlineMessage>
    </Modal>
  </>;
}

function PrivacyNoticePage() {
  return <PublicLayout showSwitcher={false}><main className="container ap-public-page">
    <PageHeader eyebrow="GİZLİLİK" title="Gizlilik ve kişisel veriler" description="Bu sayfa, ServisimiBul’un aydınlatma bilgisinin yer alacağı tasarım alanıdır." actions={<Badge tone="yellow">Hukuk onayı bekleniyor</Badge>} />
    <InlineMessage kind="warning">Nihai aydınlatma metni ve veri sorumlusu bilgileri hukuk tarafından sağlanıp onaylanmalıdır. Bu referans hukuki metin değildir.</InlineMessage>
    <div className="ap-two-column ap-notice-grid">
      <SectionCard icon={<UserRound size={18}/>} title="Hangi bilgiler işlenir?" description="[LEGAL_COPY_PENDING]"><p>Bu alana, onaylanmış ürün kapsamı ve gerçek veri envanteriyle eşleşen açıklama eklenecek.</p></SectionCard>
      <SectionCard icon={<ShieldCheck size={18}/>} title="Neden ve nasıl kullanılır?" description="[LEGAL_COPY_PENDING]"><p>İşleme amacı, hukuki sebep, alıcılar ve aktarım bilgileri onaylı metin olmadan doldurulmaz.</p></SectionCard>
      <SectionCard icon={<Clock3 size={18}/>} title="Ne kadar süre tutulur?" description="[RETENTION_POLICY_PENDING]"><p>Herhangi bir saklama süresi veya otomatik silme garantisi bu taslakta belirtilmez.</p></SectionCard>
      <SectionCard icon={<FileText size={18}/>} title="Haklar ve başvuru kanalı" description="[CONTACT_CHANNEL_PENDING]"><p>İşleyen e-posta, KEP veya destek adresi varsayılmaz. Onaylı kanal ve başvuru süreci yayımlanmadan önce eklenmelidir.</p><ActionLink to="/privacy/requests" variant="outline">Başvuru yolunu görüntüle <ArrowRight size={15}/></ActionLink></SectionCard>
    </div>
    <div className="ap-public-footnote">Yol haritasındaki LEG kararları imzalanana kadar bu ekran yalnızca yerleşim referansıdır.</div>
  </main></PublicLayout>;
}

function PublicRequestEntryPage() {
  return <PublicLayout showSwitcher={false}><main className="container ap-public-page">
    <PageHeader eyebrow="KİŞİSEL VERİLER" title="Veri hakları başvuruları" description="Başvuru kategorileri ve kullanılabilir kanal, onaylı politika doğrultusunda burada açıklanır." />
    <div className="ap-public-entry-layout"><Card className="ap-card"><div className="ap-section-head"><span className="ap-icon"><FileText size={18}/></span><div><h2>Başvuru yolu</h2><p>Bilgi/erişim, düzeltme, silme talebi ve onaylı diğer haklar.</p></div></div><InlineMessage kind="warning">[CONTACT_CHANNEL_PENDING] · Gerçek başvuru adresi veya gönderim kanalı henüz eklenmemiştir. Bu sayfa başvuru iletmez.</InlineMessage><p className="ap-body-copy">Hesap üzerinden talep takibi için mevcut giriş akışını kullan. Hesabı olmayan kullanıcılar için izlenecek yöntem [LEGAL_COPY_PENDING] ile kesinleştirilmelidir.</p></Card>
      <Card className="ap-card ap-login-card"><span className="ap-icon"><LockKeyhole size={18}/></span><h2>Hesabınla devam et</h2><p>Başvuru geçmişini görmek için uygun hesap türünü seç.</p><div className="ap-login-actions"><ActionLink to="/parent/login" variant="outline">Veli girişi</ActionLink><ActionLink to="/operator/login" variant="outline">İşletmeci girişi</ActionLink></div></Card>
    </div>
  </main></PublicLayout>;
}

function RequestListPage({ role, state }: { role: AccountRole; state: string }) {
  const base = roleBase(role);
  const newRequest = `${base}/privacy/requests/new`;
  return <>
    <PageHeader eyebrow="KİŞİSEL VERİLER" title="Başvurularım" description="Kişisel verilerinle ilgili başvuru oluştur veya mevcut durumunu görüntüle." actions={<ActionLink to={newRequest}>Yeni başvuru <ArrowRight size={15}/></ActionLink>} />
    <PageDemoNote />
    <Card className="ap-card ap-request-explainer"><div><Badge tone="blue">Başvuru ≠ tamamlanma</Badge><h2>Başvurunun durumu ayrı izlenir</h2><p>Başvurunun alınması, kabul edilmesi veya verilerin silindiği anlamına gelmez. Sonuç, ek doğrulama ve uygulanabilir politika onayı sonrasında gösterilir.</p></div><div className="ap-legal-placeholder"><span className="ap-label">BAŞVURU KANALI</span><strong>[CONTACT_CHANNEL_PENDING]</strong><small>Yanıt süresi: [REQUEST_RESPONSE_POLICY_PENDING]</small></div></Card>
    {state === 'loading' ? <Card className="ap-state-card" aria-busy="true"><div className="ap-loading-bars"><i/><i/><i/></div><span className="visually-hidden">Başvurular yükleniyor</span></Card> : state === 'error' ? <Card className="ap-state-card"><InlineMessage kind="error">Başvuru durumu yüklenemedi. Daha sonra yeniden deneyebilirsin.</InlineMessage><div className="ap-card-actions"><ActionLink to={`${base}/privacy/requests`} variant="outline">Yeniden dene</ActionLink></div></Card> : <EmptyState title="Henüz listelenecek başvuru yok" description="Yeni başvuru oluşturduğunda süreç durumu bu alanda görünür. Başvuru gönderimi ve sonuçlandırma ayrı adımlardır." icon={<FileText size={22}/>} action={<ActionLink to={newRequest}>Yeni başvuru oluştur</ActionLink>} />}
    <div className="ap-state-switches" aria-label="Ekran durumu referansları"><span>Görsel durum:</span><Link to={`${base}/privacy/requests?state=loading`}>Yükleniyor</Link><Link to={`${base}/privacy/requests?state=empty`}>Boş</Link><Link to={`${base}/privacy/requests?state=error`}>Hata</Link></div>
  </>;
}

function RequestFormPage({ role, type, state }: { role: AccountRole; type: string; state: string }) {
  const base = roleBase(role);
  const received = `${base}/privacy/requests/received`;
  const navigate = useNavigate();
  return <>
    <PageHeader eyebrow="KİŞİSEL VERİLER" title="Yeni başvuru" description="Talebinin anlaşılması için yalnızca gerekli bilgileri paylaş." />
    <PageDemoNote />
    <Card className="ap-narrow-card ap-form-card"><InlineMessage kind="warning">Başvuru kanalı ve doğrulama yöntemi [CONTACT_CHANNEL_PENDING]. Bu prototip formu iletmez veya veri kaydetmez.</InlineMessage>
      {state === 'validation' && <InlineMessage kind="error">Başvuru konusunu seç. Gerçek gönderim kanalı henüz etkin değildir.</InlineMessage>}
      <form className="ap-form" onSubmit={(event) => { event.preventDefault(); navigate(received + (type === 'erasure' ? '?type=erasure' : '')); }}>
        <div className="ap-account-context"><span className="ap-label">HESAP</span><strong>{roleName(role)}</strong><small>[MASKELİ HESAP E-POSTASI]</small></div>
        <SelectField label="Başvuru konusu" name="requestType" defaultValue={type === 'erasure' ? 'erasure' : ''} required error={state === 'validation' ? 'Başvuru konusunu seç.' : undefined}>
          <option value="" disabled>Bir konu seç</option>
          <option value="access">Kişisel verilerim hakkında bilgi / erişim</option>
          <option value="correction">Yanlış veya eksik bilginin düzeltilmesi</option>
          <option value="erasure">Kişisel verilerimin silinmesi talebi</option>
          <option value="other">Diğer ilgili kişi başvurusu · [LEGAL_COPY_PENDING]</option>
        </SelectField>
        <div className="field"><label htmlFor="requestDetail">Talebini açıkla</label><textarea id="requestDetail" name="requestDetail" rows={4} placeholder="Talebinin anlaşılması için gerekli bilgileri yaz." aria-describedby="requestDetail-hint"/><small id="requestDetail-hint" className="field-hint">T.C. kimlik numarası, öğrenci adı/adresi veya sağlık bilgisi gibi gerekmeyen hassas bilgileri ekleme.</small></div>
        {type === 'erasure' && <InlineMessage kind="warning">Silme talebi göndermek verilerin silindiği anlamına gelmez. Saklama yükümlülükleri, üçüncü taraf kayıtları ve açık talepler sonucu etkileyebilir: [RETENTION_POLICY_PENDING].</InlineMessage>}
        <div className="ap-form-meta"><span>Yanıt süresi: [REQUEST_RESPONSE_POLICY_PENDING]</span><Link to="/privacy/notice">Gizlilik bilgileri <ArrowRight size={13}/></Link></div>
        <div className="ap-card-actions"><Button type="submit">Başvuru örneğini görüntüle <ArrowRight size={15}/></Button><ActionLink to={`${base}/privacy/requests`} variant="outline">Vazgeç</ActionLink></div>
      </form>
    </Card>
  </>;
}

function RequestReceivedPage({ role }: { role: AccountRole }) {
  const base = roleBase(role);
  return <>
    <PageHeader eyebrow="KİŞİSEL VERİLER" title="Başvuru alındı" description="Bu ekran yalnızca başvuru alındı durumunun görsel referansıdır." />
    <PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-state-center"><span className="ap-result-icon ap-result-success"><CheckCircle2 size={24}/></span><Badge tone="teal">Alındı · inceleme bekliyor</Badge><h2>Başvurun kayda alınmış olsaydı bu ekranı görürdün</h2><p>Bu prototipte gerçek başvuru gönderilmedi. Başvurunun alınması, kabul edilmesi ya da kişisel verilerin silindiği anlamına gelmez.</p></div>
      <div className="ap-detail-row"><span>Başvuru referansı</span><strong>[BAŞVURU_REFERANSI]</strong></div><div className="ap-detail-row"><span>Yanıt süresi</span><strong>[REQUEST_RESPONSE_POLICY_PENDING]</strong></div>
      <InlineMessage kind="info">Takip yöntemi ve onaylı kanal [CONTACT_CHANNEL_PENDING]. Sonuç, başvuru incelendikten ve gerekirse onaylı kimlik doğrulaması tamamlandıktan sonra gösterilir.</InlineMessage>
      <div className="ap-card-actions"><ActionLink to={`${base}/privacy/requests/status/under-review`} variant="outline">İnceleniyor durum örneği</ActionLink><ActionLink to={`${base}/privacy/requests`} variant="quiet">Başvurulara dön</ActionLink></div>
    </Card>
  </>;
}

const requestStatus: Record<string, { title: string; badge: string; tone: 'blue' | 'yellow' | 'green' | 'red'; detail: string; note: string }> = {
  'under-review': { title: 'Başvuru inceleniyor', badge: 'İnceleniyor', tone: 'blue', detail: 'Talebin değerlendirme aşamasında. Bu durum başvurunun kabul edildiği veya tamamlandığı anlamına gelmez.', note: 'Yanıt süresi ve takip kanalı: [REQUEST_RESPONSE_POLICY_PENDING] · [CONTACT_CHANNEL_PENDING].' },
  'additional-verification': { title: 'Ek doğrulama gerekebilir', badge: 'Ek doğrulama', tone: 'yellow', detail: 'Kimlik doğrulama gerekiyorsa, izlenecek yöntem onaylı süreçte ayrıca açıklanır. Bu taslak T.C. kimlik numarası istemez.', note: 'Doğrulama yöntemi: [IDENTITY_VERIFICATION_METHOD_PENDING]. E-posta gönderildiği varsayılmaz.' },
  completed: { title: 'Başvuru yanıtlandı', badge: 'Yanıtlandı', tone: 'green', detail: 'Talebin için yanıt hazırlanmış olsaydı onaylı cevap burada gösterilirdi. Yanıtın içeriği ve kapsamı hukuk/operasyon onayı gerektirir.', note: 'Yanıt içeriği: [APPROVED_RESPONSE_PENDING]. Bu durum, her verinin silindiği anlamına gelmez.' },
  rejected: { title: 'Başvuru sonuçlandırılamadı', badge: 'Açıklama gerekli', tone: 'red', detail: 'Ret veya kısmi karşılanma gerekçesi, insan tarafından incelenip onaylanmış açıklamayla gösterilmelidir.', note: 'Gerekçe ve sonraki başvuru yolu: [LEGAL_COPY_PENDING]. Otomatik karar verildiği varsayılmaz.' },
  'partially-fulfilled': { title: 'Başvurunun bir kısmı yanıtlandı', badge: 'Kısmen yanıtlandı', tone: 'yellow', detail: 'Karşılanabilen bölüm ve karşılanamayan bölüm ayrı, açık ve anlaşılır biçimde açıklanmalıdır.', note: 'Sonuç ve gerekçe: [APPROVED_RESPONSE_PENDING] · [LEGAL_COPY_PENDING].' },
};

function RequestStatusPage({ role, status }: { role: AccountRole; status: string }) {
  const base = roleBase(role);
  const item = requestStatus[status] ?? requestStatus['under-review'];
  const done = status === 'completed';
  return <>
    <PageHeader eyebrow="KİŞİSEL VERİLER" title="Başvuru durumu" description="Görsel durum örneği · [BAŞVURU_REFERANSI]" actions={<Badge tone={item.tone} dot>{item.badge}</Badge>} />
    <PageDemoNote />
    <div className="ap-status-layout"><Card className="ap-card ap-status-main"><div className="ap-status-header"><span className={`ap-result-icon ${done ? 'ap-result-success' : 'ap-result-info'}`}>{done ? <CheckCircle2 size={22}/> : status === 'additional-verification' ? <ShieldCheck size={22}/> : <Clock3 size={22}/>}</span><div><Badge tone={item.tone}>{item.badge}</Badge><h2>{item.title}</h2><p>{item.detail}</p></div></div>
      <div className="ap-status-steps" role="list" aria-label="Başvuru durum aşamaları"><div className="is-complete" role="listitem"><i/><span><strong>Alındı</strong><small>Başvuru kaydı · [TARİH_PLACEHOLDER]</small></span></div><div className={status === 'under-review' || status === 'additional-verification' ? 'is-current' : 'is-complete'} role="listitem"><i/><span><strong>İnceleniyor</strong><small>İnsan incelemesi ve gerekirse ek doğrulama</small></span></div><div className={done || status === 'rejected' || status === 'partially-fulfilled' ? 'is-current' : ''} role="listitem"><i/><span><strong>Yanıt</strong><small>Sonuç ve gerekçe, onaylı metinle gösterilir</small></span></div></div>
      <InlineMessage kind={status === 'rejected' ? 'warning' : 'info'}>{item.note}</InlineMessage>
      {(status === 'rejected' || status === 'partially-fulfilled') && <div className="ap-placeholder-note"><span className="ap-label">İNSAN TARAFINDAN ONAYLANMIŞ AÇIKLAMA</span><strong>[APPROVED_RESPONSE_PENDING]</strong></div>}
      <div className="ap-card-actions"><ActionLink to={`${base}/privacy/requests`} variant="outline">Başvurulara dön</ActionLink><ActionLink to="/privacy/notice" variant="quiet">Gizlilik bilgileri</ActionLink></div>
    </Card><aside className="ap-status-side"><Card className="ap-card"><span className="ap-label">ÖNEMLİ</span><h3>Başvuru durumu silme onayı değildir</h3><p>İşlem sonucu ve saklanması gereken veriler, onaylı politika ve başvuruya özel incelemeye bağlıdır.</p><Link className="ap-text-link" to={`${base}/lifecycle/erasure`}>Silme süreci bilgisi <ArrowRight size={14}/></Link></Card></aside></div>
  </>;
}

function LifecyclePage({ role }: { role: AccountRole }) {
  const base = roleBase(role);
  return <>
    <PageHeader eyebrow="HESAP YÖNETİMİ" title="Hesap yaşam döngüsü" description="Görünürlük, erişim kısıtı ve veri hakları farklı amaçlara hizmet eder." />
    <PageDemoNote />
    <InlineMessage kind="warning">Hesap devre dışı bırakma davranışı [ACCOUNT_REACTIVATION_POLICY_PENDING] onaylanana kadar etkinleştirilmemelidir.</InlineMessage>
    <div className="ap-lifecycle-list">
      {role === 'operator' && <Card className="ap-lifecycle-row"><span className="ap-icon"><EyeOff size={19}/></span><div><Badge tone="teal">İşletmeci profili</Badge><h2>Herkese açık profili gizle</h2><p>İşletme profilinin arama sonuçlarındaki görünürlüğünü yönetir; hesabı devre dışı bırakmaz ve kişisel veri silmez.</p></div><ActionLink to="/operator/profile" variant="outline">Mevcut profile git <ArrowRight size={15}/></ActionLink></Card>}
      <Card className="ap-lifecycle-row"><span className="ap-icon ap-icon-warning"><UserRound size={19}/></span><div><Badge tone="yellow">Hesap erişimi</Badge><h2>Hesabı geçici olarak devre dışı bırak</h2><p>Hesaba erişim, kayıtlar ve geri açma koşulları [ACCOUNT_REACTIVATION_POLICY_PENDING] kararına bağlıdır.</p></div><ActionLink to={`${base}/lifecycle/deactivate`} variant="outline">Akış bilgisi <ArrowRight size={15}/></ActionLink></Card>
      {role === 'operator' && <Card className="ap-lifecycle-row"><span className="ap-icon ap-icon-danger"><LockKeyhole size={19}/></span><div><Badge tone="red">Yönetim kararı</Badge><h2>Yönetici tarafından askıya alma</h2><p>Bu işlem kullanıcı tarafından başlatılmaz. Askıya alınmış operatöre self-service yeniden etkinleştirme sunulmaz.</p></div><ActionLink to="/operator/lifecycle/suspended" variant="outline">Askıya alınmış durum örneği</ActionLink></Card>}
      <Card className="ap-lifecycle-row"><span className="ap-icon ap-icon-muted"><FileText size={19}/></span><div><Badge tone="blue">Kişisel veri başvurusu</Badge><h2>Verilerin silinmesini talep et</h2><p>Bu, inceleme gerektiren bir başvurudur; gönderim anında hesap veya tüm kayıtlar silinmiş sayılmaz.</p></div><ActionLink to={`${base}/lifecycle/erasure`} variant="outline">Süreç bilgisi <ArrowRight size={15}/></ActionLink></Card>
    </div>
  </>;
}

function DeactivationPage({ role, state }: { role: AccountRole; state: string }) {
  const base = roleBase(role);
  if (state === 'processing') return <>
    <PageHeader eyebrow="HESAP YÖNETİMİ" title="İstek işleniyor" description="Devre dışı bırakma akışı için örnek geçiş durumu." /><PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-state-center"><span className="ap-result-icon ap-result-info"><Clock3 size={24}/></span><Badge tone="blue">Örnek · beklemede</Badge><h2>Hesap durumu henüz değişmiş sayılmaz</h2><p>Bu referans ekranı işlem aşamasını gösterir. Üretimde tamamlanma sonucu yalnızca sunucu yanıtı doğrulandıktan sonra sunulmalıdır.</p></div><InlineMessage kind="warning">[ACCOUNT_REACTIVATION_POLICY_PENDING] — yeniden açma koşulu onaylanmamıştır.</InlineMessage></Card>
  </>;
  if (state === 'success') return <>
    <PageHeader eyebrow="HESAP YÖNETİMİ" title="Hesap devre dışı bırakıldı" description="Başarılı sonuç için koşullu UI örneği." /><PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-state-center"><span className="ap-result-icon ap-result-success"><CheckCircle2 size={24}/></span><Badge tone="yellow">Yalnız LEG-07 onayı sonrası</Badge><h2>Durum onaylı sunucu yanıtıyla gösterilmelidir</h2><p>Bu prototip hesabı devre dışı bırakmadı. Erişim, saklama ve yeniden etkinleştirme koşulları ürün/hukuk kararı olmadan kesinleştirilemez.</p></div><div className="ap-placeholder-note"><span className="ap-label">YENİDEN ETKİNLEŞTİRME</span><strong>[ACCOUNT_REACTIVATION_POLICY_PENDING]</strong></div></Card>
  </>;
  if (state === 'error') return <>
    <PageHeader eyebrow="HESAP YÖNETİMİ" title="İşlem tamamlanamadı" description="Hata ve güvenli yeniden deneme için örnek UI durumu." /><PageDemoNote />
    <Card className="ap-narrow-card"><InlineMessage kind="error">Hesap durumunun değiştiği doğrulanamadı. Yeni bir işlem başlatmadan önce güncel durum kontrol edilmelidir.</InlineMessage><div className="ap-placeholder-note"><span className="ap-label">DESTEK / İLETİŞİM</span><strong>[CONTACT_CHANNEL_PENDING]</strong></div><div className="ap-card-actions"><ActionLink to={`${base}/lifecycle/deactivate?state=confirm`} variant="outline">Onay ekranına dön</ActionLink><ActionLink to={`${base}/lifecycle`} variant="quiet">Hesap yönetimine dön</ActionLink></div></Card>
  </>;
  return <>
    <PageHeader eyebrow="HESAP YÖNETİMİ" title="Hesabı geçici olarak devre dışı bırak" description="Devam etmeden önce hesabın görünürlüğü ve erişimi arasındaki farkı incele." /><PageDemoNote />
    <Card className="ap-narrow-card"><Badge tone="yellow" dot>LEG-07 ürün/hukuk onayı bekleniyor</Badge><h2>Bu işlem diğer seçeneklerden farklıdır</h2><ul className="ap-check-list"><li>İşletme profili görünürlüğünü değiştirmekten farklıdır.</li><li>KVKK kapsamında veri silme başvurusu değildir.</li><li>Hesap erişimi ve kayıtların durumu [ACCOUNT_DEACTIVATION_EFFECTS_PENDING] ile netleşmelidir.</li><li>Yeniden etkinleştirme koşulları [ACCOUNT_REACTIVATION_POLICY_PENDING] onayı olmadan vaat edilemez.</li></ul><InlineMessage kind="warning">Ürün ve hukuk kararı verilmeden bu işlem üretimde etkinleştirilmemelidir. Aşağıdaki link yalnızca tasarım geçişini gösterir.</InlineMessage><div className="ap-card-actions"><ActionLink to={`${base}/lifecycle/deactivate?state=processing`} variant="danger">İşlem durumu örneğine geç</ActionLink><ActionLink to={`${base}/lifecycle`} variant="outline">Vazgeç</ActionLink></div></Card>
  </>;
}

function ErasureInfoPage({ role }: { role: AccountRole }) {
  const base = roleBase(role);
  return <>
    <PageHeader eyebrow="KİŞİSEL VERİLER" title="Veri silme başvurusu" description="Hesap kapatma ile kişisel veriler hakkında başvuru arasındaki fark." />
    <PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-inline-title"><span className="ap-icon"><FileText size={18}/></span><div><span className="ap-label">KVKK İLGİLİ KİŞİ BAŞVURUSU</span><h2>Başvurunun alınması silme işlemi değildir</h2></div></div><p className="ap-body-copy">Silme talebinin sonucu; yasal saklama gereklilikleri, üçüncü taraf kayıtları ve açık başvurular dikkate alınarak incelenmelidir. Bu arayüz herhangi bir veriyi silmez ve kalıcı silme garantisi vermez.</p><div className="ap-placeholder-note"><span className="ap-label">ONAY BEKLEYEN POLİTİKALAR</span><strong>[LEGAL_COPY_PENDING]</strong><small>[RETENTION_POLICY_PENDING] · Başvuru kanalı: [CONTACT_CHANNEL_PENDING]</small></div><InlineMessage kind="info">Talep konusu, kimlik kontrolü ve sonuç bildirimi için yalnızca onaylanmış hukuk/ürün akışı kullanılmalıdır. Gereksiz T.C. kimlik numarası veya öğrenci verisi istenmez.</InlineMessage><div className="ap-card-actions"><ActionLink to={`${base}/privacy/requests/new?type=erasure`}>Silme talebi formunu aç <ArrowRight size={15}/></ActionLink><ActionLink to={`${base}/lifecycle`} variant="outline">Hesap yaşam döngüsüne dön</ActionLink></div></Card>
  </>;
}

function SuspendedPage() {
  return <>
    <PageHeader eyebrow="İŞLETMECİ HESABI" title="Hesap yönetim incelemesinde" description="Bu durum, gönüllü hesap devre dışı bırakma veya veri silme talebi değildir." />
    <PageDemoNote />
    <Card className="ap-narrow-card"><div className="ap-state-center"><span className="ap-result-icon ap-result-danger"><LockKeyhole size={24}/></span><Badge tone="red">Yönetici tarafından askıya alınmış</Badge><h2>Hesabın için self-service yeniden açma seçeneği yok</h2><p>İşletmeci, yönetim kısıtını atlayarak kendini yeniden etkinleştiremez. İnceleme, gerekçe ve iletişim süreci [LEGAL_COPY_PENDING] ile onaylanmalıdır.</p></div><div className="ap-placeholder-note"><span className="ap-label">ONAYLI İLETİŞİM YOLU</span><strong>[CONTACT_CHANNEL_PENDING]</strong></div><ActionLink to="/operator/login" variant="outline">Giriş ekranına dön</ActionLink></Card>
  </>;
}

export function AccountPrivacyPage() {
  const { pathname, search } = useLocation();
  const role: AccountRole = pathname.startsWith('/operator/') ? 'operator' : 'parent';
  const params = new URLSearchParams(search);
  const state = params.get('state') ?? '';
  const type = params.get('type') ?? '';

  if (pathname === '/privacy/notice') return <PrivacyNoticePage/>;
  if (pathname === '/privacy/requests') return <PublicRequestEntryPage/>;

  let content: React.ReactNode;
  if (pathname.endsWith('/account/email')) content = <EmailPage role={role} state={state}/>;
  else if (pathname.endsWith('/account/password')) content = <PasswordPage role={role} state={state}/>;
  else if (pathname.endsWith('/account/sessions')) content = <SessionsPage role={role} state={state}/>;
  else if (pathname.endsWith('/privacy/requests/new')) content = <RequestFormPage role={role} type={type} state={state}/>;
  else if (pathname.endsWith('/privacy/requests/received')) content = <RequestReceivedPage role={role}/>;
  else if (pathname.includes('/privacy/requests/status/')) {
    const status = pathname.split('/').at(-1) ?? 'under-review';
    content = <RequestStatusPage role={role} status={status}/>;
  } else if (pathname.endsWith('/privacy/requests')) content = <RequestListPage role={role} state={state}/>;
  else if (pathname.endsWith('/lifecycle/deactivate')) content = <DeactivationPage role={role} state={state || 'confirm'}/>;
  else if (pathname.endsWith('/lifecycle/erasure')) content = <ErasureInfoPage role={role}/>;
  else if (pathname.endsWith('/lifecycle/suspended')) content = <SuspendedPage/>;
  else if (pathname.endsWith('/lifecycle')) content = <LifecyclePage role={role}/>;
  else content = <SettingsPage role={role}/>;

  return <PageFrame role={role}>{content}</PageFrame>;
}
