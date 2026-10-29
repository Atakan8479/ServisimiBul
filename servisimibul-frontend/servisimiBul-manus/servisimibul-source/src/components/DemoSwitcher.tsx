import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const groups = [
  { label: 'Kamu', to: '/', match: (path: string) => path === '/' || path === '/arama' || path === '/tarife' || path.startsWith('/demands') },
  { label: 'Ebeveyn', to: '/notifications', match: (path: string) => path.startsWith('/parent') || path === '/notifications' },
  { label: 'İşletmeci', to: '/operator', match: (path: string) => path.startsWith('/operator') || path === '/isletmeci' },
  { label: 'Yönetim', to: '/admin/applications', match: (path: string) => path.startsWith('/admin') },
];

export function DemoSwitcher() {
  const { pathname } = useLocation();
  return <div className="demo-switcher"><span className="demo-switcher-label">Prototip alanı</span><div className="demo-switcher-links">{groups.map((group) => <Link key={group.label} to={group.to} className={group.match(pathname) ? 'active' : ''}>{group.label}<ArrowUpRight size={12}/></Link>)}</div></div>;
}
