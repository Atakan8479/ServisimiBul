import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, ChevronRight, FileText, Flag, MapPin, MessageCircle, RefreshCw, School, Users, UserRound, BusFront, ArrowRight } from 'lucide-react';
import { WorkspaceShell } from '../../components/Shells';
import { Badge, Button, Card, DemoNotice, EmptyState, PageHeader } from '../../components/ui';
import { initialNotifications } from '../../data/mockData';

type Role = 'parent' | 'operator' | 'admin';
type Notification = { id: string; title: string; detail: string; time: string; read: boolean; icon: string };
const roleCopy: Record<Role, { title: string; eyebrow: string; description: string }> = {
  parent: { title: 'Bildirimler', eyebrow: 'EBEVEYN HESABI', description: 'Talep ve servis keşfiyle ilgili güncellemeleri burada gör.' },
  operator: { title: 'Bildirimler', eyebrow: 'İŞLETMECİ PANELİ', description: 'Profil, okul kapsamı ve aile talepleriyle ilgili güncellemeler.' },
  admin: { title: 'Yönetim bildirimleri', eyebrow: 'YÖNETİM PANELİ', description: 'Moderasyon, tarife ve okul kataloğu bildirimleri.' },
};
const iconMap: Record<string, typeof Bell> = { users: Users, message: MessageCircle, refresh: RefreshCw, check: Check, profile: UserRound, route: MapPin, school: School, flag: Flag, file: FileText };
const destination: Record<Role, string> = { parent: '/demands/d-1042', operator: '/operator/schools', admin: '/admin/moderation' };

export function NotificationsPage({ role }: { role: Role }) {
  const [items, setItems] = useState<Notification[]>(initialNotifications[role]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notice, setNotice] = useState('');
  const unreadCount = items.filter((item) => !item.read).length;
  const filtered = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'unread' ? !item.read : item.read)), [items, filter]);
  const title = roleCopy[role];
  const markRead = (id: string) => { setItems((list) => list.map((item) => item.id === id ? { ...item, read: true } : item)); setNotice('Bildirim okundu olarak işaretlendi.'); setTimeout(() => setNotice(''), 2800); };
  const markAll = () => { setItems((list) => list.map((item) => ({ ...item, read: true }))); setNotice('Tüm bildirimler okundu olarak işaretlendi.'); setTimeout(() => setNotice(''), 2800); };
  const Workspace = role === 'parent' ? ({ children }: { children: React.ReactNode }) => <div className="parent-notification-shell">{children}</div> : ({ children }: { children: React.ReactNode }) => <WorkspaceShell role={role}>{children}</WorkspaceShell>;
  const content = <><PageHeader eyebrow={title.eyebrow} title={title.title} description={title.description} actions={unreadCount > 0 ? <Button variant="outline" size="sm" onClick={markAll}><CheckCheck size={15}/>Tümünü okundu işaretle</Button> : <Badge tone="green">Hepsi okundu</Badge>}/><DemoNotice>Bildirimler örnek içerik ve local demo state’i kullanır.</DemoNotice>{notice && <div className="form-success"><Check size={15}/>{notice}</div>}<div className="notification-count-row"><div className="unread-summary"><span className="notification-bell-icon"><Bell size={18}/></span><div><strong>{unreadCount} okunmamış bildirim</strong><small>{items.length} toplam bildirim · {role === 'parent' ? 'ebeveyn' : role === 'operator' ? 'işletmeci' : 'yönetici'} hesabı</small></div></div><div className="notification-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü <span>{items.length}</span></button><button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Okunmamış <span>{unreadCount}</span></button><button className={filter === 'read' ? 'active' : ''} onClick={() => setFilter('read')}>Okunmuş</button></div></div><div className="notification-group-label">SON GÜNCELLEMELER</div><div className="notification-list">{filtered.map((item) => { const Icon = iconMap[item.icon] ?? Bell; return <Card key={item.id} className={`notification-card ${item.read ? 'is-read' : 'is-unread'}`}><div className={`notification-icon notification-${item.icon}`}><Icon size={18}/></div><div className="notification-copy"><div className="notification-title-row"><strong>{item.title}</strong>{!item.read && <span className="unread-dot"/>}</div><p>{item.detail}</p><small>{item.time}</small></div><div className="notification-actions"><Link to={destination[role]} className="notification-open-link">İncele <ChevronRight size={15}/></Link>{!item.read && <button className="mark-read-button" onClick={() => markRead(item.id)} aria-label="Okundu olarak işaretle"><Check size={15}/></button>}</div></Card>; })}{filtered.length === 0 && <EmptyState title={filter === 'unread' ? 'Okunmamış bildirim yok' : 'Bildirim bulunamadı'} description="Yeni bir güncelleme olduğunda burada görünecek." icon={<Bell size={23}/>} action={filter !== 'all' ? <Button variant="outline" size="sm" onClick={() => setFilter('all')}>Tüm bildirimleri gör</Button> : undefined}/>}</div><div className="notification-footer"><span>Bildirimler demo içeriktir ve e-posta göndermez.</span><Link to={role === 'parent' ? '/' : role === 'operator' ? '/operator' : '/admin/applications'}>Panele dön <ArrowRight size={14}/></Link></div></>;
  return role === 'parent' ? <div className="parent-notifications"><div className="parent-notifications-top"><Link to="/" className="brand"><img src="/assets/servisimibul-mark.png" alt=""/><span>servisimi<span>bul</span></span></Link><Link to="/" className="parent-back-link">Ana sayfa <ArrowRight size={14}/></Link></div><main className="parent-notifications-content">{content}</main></div> : <Workspace>{content}</Workspace>;
}
