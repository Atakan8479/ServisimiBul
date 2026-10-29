import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Brand } from '../../components/Shells';
import { DemoSwitcher } from '../../components/DemoSwitcher';
import { Button, Field, InlineMessage } from '../../components/ui';

const HERO = '/assets/servisimibul-hero.webp';

function AuthLayout({ children, title, subtitle, tag = 'GÜVENLİ VE AÇIK' }: { children: ReactNode; title: string; subtitle: string; tag?: string }) {
  return <div className="auth-page"><DemoSwitcher/><div className="auth-layout"><aside className="auth-visual"><div className="auth-visual-image" style={{ backgroundImage: `linear-gradient(180deg,rgba(16,37,63,.06),rgba(16,37,63,.82)),url(${HERO})` }}/><div className="auth-visual-top"><Brand light/><span className="auth-pilot-pill"><span/>PROTOTİP</span></div><div className="auth-visual-copy"><span className="eyebrow">SERVİSİMİBUL’A KATIL</span><h2>Okul servisi keşfi, daha anlaşılır.</h2><p>Aramanı okul ve mahalle kapsamına göre yap; hizmeti işletmeciyle doğrudan teyit et.</p><div className="auth-trust-line"><ShieldCheck size={15}/>Örnek bilgiler · Gerçek hesap oluşturulmaz</div></div></aside><main className="auth-main"><div className="auth-card-wrap"><div className="auth-mobile-brand"><Brand/></div><div className="auth-card-heading"><span className="eyebrow">{tag}</span><h1>{title}</h1><p>{subtitle}</p></div>{children}<div className="auth-bottom"><span>ServisimiBul · MVP UI referans prototipi</span><Link to="/">Ana sayfaya dön</Link></div></div></main></div></div>;
}

export function AccountTypePage() {
  return <AuthLayout title="Nasıl katılmak istersin?" subtitle="Sana uygun hesap türünü seç. Bu prototipte kayıt işlemi gerçek hesap oluşturmaz.">
    <div className="account-type-options"><Link className="account-type-card" to="/parent/register"><span className="account-type-icon parent-type">A</span><div><strong>Ebeveyn olarak</strong><small>Okul servisi seçeneklerini keşfet ve ortak talep oluştur.</small></div><ArrowRight size={18}/></Link><Link className="account-type-card" to="/operator/register"><span className="account-type-icon operator-type">İ</span><div><strong>İşletmeci olarak</strong><small>İşletme profilini ve hizmet kapsamını paylaş.</small></div><ArrowRight size={18}/></Link></div>
    <div className="auth-separator"><span>veya</span></div><div className="auth-link-row"><span>Zaten hesabın var mı?</span><Link to="/parent/login">Giriş yap <ArrowRight size={14}/></Link></div><div className="auth-demo-note"><Sparkles size={15}/><span>Bu prototipte formlar yerel örnek akışla çalışır.</span></div>
  </AuthLayout>;
}

type AuthScreen = 'parent-register' | 'parent-login' | 'operator-register' | 'operator-login' | 'verify-email' | 'forgot-password' | 'reset-password';
type FieldSpec = { name: string; label: string; placeholder: string; type?: string; autoComplete?: string; required?: boolean };
const screenCopy: Record<AuthScreen, { title: string; subtitle: string; tag: string; fields: FieldSpec[]; submit: string; success: string }> = {
  'parent-register': { title: 'Ebeveyn hesabı oluştur', subtitle: 'Okul ve mahalle aramalarını tek yerden yönet.', tag: 'EBEVEYN KAYDI', fields: [{ name: 'name', label: 'Ad soyad', placeholder: 'Adın ve soyadın', autoComplete: 'name', required: true }, { name: 'email', label: 'E-posta', placeholder: 'ornek@eposta.com', type: 'email', autoComplete: 'email', required: true }, { name: 'phone', label: 'Telefon', placeholder: '+90 (5__) ___ __ __', type: 'tel', autoComplete: 'tel', required: true }, { name: 'password', label: 'Şifre', placeholder: 'En az 8 karakter', type: 'password', autoComplete: 'new-password', required: true }], submit: 'Demo kaydı başlat', success: 'Ebeveyn kayıt örneği tamamlandı. Gerçek hesap oluşturulmadı.' },
  'parent-login': { title: 'Yeniden hoş geldin.', subtitle: 'Ebeveyn hesabına giriş yap.', tag: 'EBEVEYN GİRİŞİ', fields: [{ name: 'email', label: 'E-posta', placeholder: 'ornek@eposta.com', type: 'email', autoComplete: 'email', required: true }, { name: 'password', label: 'Şifre', placeholder: 'Şifren', type: 'password', autoComplete: 'current-password', required: true }], submit: 'Demo giriş', success: 'Giriş akışı prototipte tamamlandı; kullanıcı doğrulanmadı.' },
  'operator-register': { title: 'İşletmeni tanıtalım.', subtitle: 'Hizmet verdiğin okul ve mahalle kapsamını paylaş.', tag: 'İŞLETMECİ KAYDI', fields: [{ name: 'business', label: 'İşletme adı', placeholder: 'Örn. Mavi Rota Taşımacılık', required: true }, { name: 'email', label: 'İletişim e-postası', placeholder: 'iletisim@isletme.example', type: 'email', required: true }, { name: 'phone', label: 'İletişim telefonu', placeholder: '+90 (212) ___ __ __', type: 'tel', required: true }, { name: 'password', label: 'Şifre', placeholder: 'En az 8 karakter', type: 'password', autoComplete: 'new-password', required: true }], submit: 'Demo işletmeci kaydı', success: 'Kayıt örneği tamamlandı. Gerçek e-posta gönderilmedi.' },
  'operator-login': { title: 'İşletmeci paneline giriş', subtitle: 'Profilini, okul kapsamını ve bildirimlerini yönet.', tag: 'İŞLETMECİ GİRİŞİ', fields: [{ name: 'email', label: 'İletişim e-postası', placeholder: 'iletisim@isletme.example', type: 'email', autoComplete: 'email', required: true }, { name: 'password', label: 'Şifre', placeholder: 'Şifren', type: 'password', autoComplete: 'current-password', required: true }], submit: 'Demo giriş', success: 'Demo giriş tamamlandı. Kimlik doğrulaması yapılmadı.' },
  'verify-email': { title: 'E-posta adresini doğrula', subtitle: 'Gerçek üründe profil yayını için e-posta doğrulaması gerekir. Bu ekranda kod gönderilmez.', tag: 'E-POSTA DOĞRULAMA', fields: [{ name: 'code', label: 'Doğrulama kodu', placeholder: '6 haneli kodu gir', required: true }], submit: 'Demo kodu kontrol et', success: 'Kod örneği kontrol edildi. Gerçek doğrulama yapılmadı.' },
  'forgot-password': { title: 'Şifreni sıfırlayalım.', subtitle: 'Hesabınla ilişkili e-posta adresini gir. Bu demo gerçek e-posta göndermez.', tag: 'ŞİFRE YENİLEME', fields: [{ name: 'email', label: 'E-posta', placeholder: 'ornek@eposta.com', type: 'email', required: true }], submit: 'Demo bağlantı iste', success: 'Bağlantı isteği örneği tamamlandı. E-posta gönderilmedi.' },
  'reset-password': { title: 'Yeni bir şifre belirle.', subtitle: 'Şifren en az 8 karakter olmalı. Bu prototipte şifre kaydedilmez.', tag: 'YENİ ŞİFRE', fields: [{ name: 'password', label: 'Yeni şifre', placeholder: 'En az 8 karakter', type: 'password', required: true }, { name: 'confirm', label: 'Yeni şifreyi tekrar gir', placeholder: 'Şifreni tekrar yaz', type: 'password', required: true }], submit: 'Demo şifreyi yenile', success: 'Şifre yenileme örneği tamamlandı. Şifre kaydedilmedi.' },
};

export function AuthPage({ screen }: { screen: AuthScreen }) {
  const copy = screenCopy[screen];
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isOperator = screen.startsWith('operator') || screen === 'verify-email';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setStatus('');
    const data = new FormData(event.currentTarget);
    const missing = copy.fields.find((field) => field.required && !String(data.get(field.name) || '').trim());
    if (missing) { setError(`${missing.label} alanı zorunludur.`); return; }
    const email = String(data.get('email') || '');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Geçerli bir e-posta adresi gir.'); return; }
    if (screen === 'parent-register' && !data.get('terms')) { setError('Devam etmek için demo koşullarını kabul et.'); return; }
    if (screen === 'verify-email' && !/^\d{6}$/.test(String(data.get('code') || ''))) { setError('Doğrulama kodu 6 rakamdan oluşmalı.'); return; }
    const password = String(data.get('password') || '');
    if (password && password.length < 8) { setError('Şifre en az 8 karakter olmalı.'); return; }
    if (screen === 'reset-password' && password !== String(data.get('confirm'))) { setError('Şifre alanları eşleşmiyor.'); return; }
    setBusy(true); setTimeout(() => { setBusy(false); setStatus(copy.success); }, 650);
  };
  return <AuthLayout title={copy.title} subtitle={copy.subtitle} tag={copy.tag}>
    <form className="auth-form" onSubmit={submit} noValidate>
      {copy.fields.map((field) => {
        const password = field.type === 'password';
        const show = field.name === 'confirm' ? showConfirm : showPassword;
        return <div className="auth-field-wrap" key={field.name}><Field label={field.label} name={field.name} type={password && show ? 'text' : field.type ?? 'text'} placeholder={field.placeholder} autoComplete={field.autoComplete} required={field.required} onChange={() => setError('')}/>{password && <button type="button" className="password-toggle" onClick={() => field.name === 'confirm' ? setShowConfirm((v) => !v) : setShowPassword((v) => !v)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button>}</div>;
      })}
      {screen === 'parent-register' && <label className="auth-checkbox"><input type="checkbox" name="terms" value="accepted" required/><span>Demo koşullarını okudum ve kabul ediyorum.</span></label>}
      {screen === 'operator-register' && <p className="auth-form-hint"><ShieldCheck size={15}/>Profil yayını için gerçek üründe e-posta doğrulaması gerekir; admin onayı zorunlu değildir.</p>}
      {screen === 'verify-email' && <p className="auth-form-hint"><Mail size={15}/>Gerçek doğrulama kodu gönderilmemiştir. Demo kod olarak herhangi bir 6 haneli değer kullanabilirsin.</p>}
      {error && <InlineMessage kind="error">{error}</InlineMessage>}{status && <InlineMessage kind="success">{status}</InlineMessage>}
      <Button className="btn-block auth-submit" type="submit" disabled={busy}>{busy ? 'İşlem sürüyor…' : copy.submit}{!busy && <ArrowRight size={16}/>}</Button>
    </form>
    <div className="auth-link-stack">{screen === 'parent-login' && <Link to="/forgot-password">Şifremi unuttum</Link>}{screen === 'operator-login' && <Link to="/forgot-password">Şifremi unuttum</Link>}{screen === 'forgot-password' && <><Link to={isOperator ? '/operator/login' : '/parent/login'}><ArrowLeft size={14}/>Giriş ekranına dön</Link><Link to="/reset-password">Demo yeni parola ekranı <ArrowRight size={14}/></Link></>}{screen === 'reset-password' && <Link to="/forgot-password"><ArrowLeft size={14}/>Yeni bağlantı iste</Link>}{screen === 'operator-register' && <Link to="/operator/verify-email">E-posta doğrulama ekranını görüntüle <ArrowRight size={14}/></Link>}</div>
    <div className="auth-switch"><span>{isOperator ? 'Ebeveyn misin?' : 'İşletmeci misin?'}</span><Link to={isOperator ? '/parent/login' : '/operator/login'}>{isOperator ? 'Ebeveyn girişi' : 'İşletmeci girişi'}</Link></div>
  </AuthLayout>;
}
