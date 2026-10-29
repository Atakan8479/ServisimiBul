import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, Home, LayoutDashboard, Menu, Route, School, Settings2, Shield, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DemoSwitcher } from './DemoSwitcher';
import { IconButton } from './ui';

const MARK = '/assets/servisimibul-mark.png';

export function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label="ServisimiBul ana sayfa"><img src={MARK} alt=""/><span>servisimi<span>bul</span></span></Link>;
}

export function PublicLayout({ children, showSwitcher = true }: { children: ReactNode; showSwitcher?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="public-site">
    {showSwitcher && <DemoSwitcher/>}
    <header className="public-header"><div className="container public-header-inner"><Brand/><nav className={`public-nav ${open ? 'open' : ''}`} aria-label="Ana navigasyon"><Link to="/#nasil-calisir" onClick={() => setOpen(false)}>Nasıl çalışır?</Link><Link to="/tarife" onClick={() => setOpen(false)}>UKOME tarifesi</Link><Link to="/demands" onClick={() => setOpen(false)}>Talep panosu</Link><Link to="/notifications" onClick={() => setOpen(false)}>Bildirimler</Link><Link to="/operator/register" onClick={() => setOpen(false)}>İşletmeciler için</Link></nav><div className="public-header-actions"><Link className="login-link" to="/parent/login">Giriş yap</Link><Link className="btn btn-primary btn-sm" to="/register">Hesap oluştur</Link></div><IconButton className="mobile-menu-toggle" label={open ? 'Menüyü kapat' : 'Menüyü aç'} onClick={() => setOpen((value) => !value)}>{open ? <X size={20}/> : <Menu size={20}/>}</IconButton></div></header>
    {children}
    <footer className="public-footer"><div className="container footer-main"><Brand/><p>Okulunu ve mahalleni seç. Seçenekleri gör, kapsamı doğrudan teyit et.</p><div className="footer-links"><Link to="/demands">Talep panosu</Link><Link to="/tarife">UKOME tarifesi</Link><Link to="/notifications">Ebeveyn bildirimleri</Link><Link to="/operator/login">İşletmeci girişi</Link><Link to="/admin/applications">Demo yönetim alanı</Link></div></div><div className="container footer-bottom"><span>© 2026 ServisimiBul · Prototip</span><span>Örnek içerik · Gerçek taşıma teklifi değildir</span></div></footer>
  </div>;
}

const operatorNav = [
  { label: 'Genel bakış', to: '/operator', icon: LayoutDashboard },
  { label: 'Profilim', to: '/operator/profile', icon: Home },
  { label: 'Okullarım', to: '/operator/schools', icon: School },
  { label: 'Araçlarım ve hizmetler', to: '/operator/offerings', icon: Route },
  { label: 'Bildirimler', to: '/operator/notifications', icon: Bell },
];
const adminNav = [
  { label: 'İşletmeciler', to: '/admin/applications', icon: LayoutDashboard },
  { label: 'Okullar', to: '/admin/schools', icon: School },
  { label: 'UKOME tarifesi', to: '/admin/tariffs', icon: Route },
  { label: 'Moderasyon', to: '/admin/moderation', icon: Shield },
  { label: 'Bildirimler', to: '/admin/notifications', icon: Bell },
];

export function WorkspaceShell({ role, children }: { role: 'operator' | 'admin'; children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const nav = role === 'operator' ? operatorNav : adminNav;
  const roleLabel = role === 'operator' ? 'İşletmeci hesabı' : 'Yönetici hesabı';
  const entity = role === 'operator' ? 'Rota İstanbul' : 'ServisimiBul Yönetim';
  return <div className={`workspace ${role === 'admin' ? 'workspace-admin' : ''}`}>
    <DemoSwitcher/>
    <aside className={`workspace-sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand-row"><Brand/><IconButton className="sidebar-close" label="Menüyü kapat" onClick={() => setMobileNav(false)}><X size={18}/></IconButton></div>
      <div className="workspace-account"><span className="avatar avatar-dark">{role === 'operator' ? 'RK' : 'SB'}</span><div><strong>{entity}</strong><small>{roleLabel}</small></div><ChevronDown size={14}/></div>
      <nav className="workspace-nav" aria-label={role === 'operator' ? 'İşletmeci menüsü' : 'Yönetim menüsü'}>{nav.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileNav(false)} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}><Icon size={17}/><span>{label}</span>{label === 'Bildirimler' && <i className="unread-dot"/>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><Link to="/" className="workspace-nav-link"><Home size={17}/><span>Ana sayfaya dön</span></Link><button className="workspace-nav-link" type="button"><Settings2 size={17}/><span>Ayarlar</span></button><Link to={role === 'operator' ? '/operator/login' : '/admin/applications'} className="workspace-nav-link"><X size={17}/><span>Oturumu kapat</span></Link></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Menüyü kapat" onClick={() => setMobileNav(false)}/>}
    <div className="workspace-main"><header className="workspace-topbar"><div className="topbar-left"><IconButton className="sidebar-open" label="Menüyü aç" onClick={() => setMobileNav(true)}><Menu size={20}/></IconButton><div className="breadcrumbs"><Link to={role === 'operator' ? '/operator' : '/admin/applications'}>{role === 'operator' ? 'İşletmeci paneli' : 'Yönetim paneli'}</Link><span>/</span><span>{nav.find((item) => location.pathname === item.to)?.label ?? 'İşlem detayı'}</span></div></div><div className="topbar-right"><Link className="topbar-bell" to={role === 'operator' ? '/operator/notifications' : '/admin/notifications'} aria-label="Bildirimler"><Bell size={19}/><i/></Link><div className="topbar-user"><span className="avatar">{role === 'operator' ? 'RK' : 'SB'}</span><span>{entity}</span></div></div></header><main className="workspace-content">{children}<div className="workspace-demo-footnote">Bu, kurgusal veriler kullanan etkileşimli bir ürün prototipidir.</div></main></div>
  </div>;
}
