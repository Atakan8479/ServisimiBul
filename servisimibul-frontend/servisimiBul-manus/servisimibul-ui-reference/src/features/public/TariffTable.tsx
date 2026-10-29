import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Info, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui';
import { formatTL, tariffBands } from '../../data/mockData';

const officialPdf = 'https://tuhim.ibb.gov.tr/media/27498/2027servisucretler.pdf';
const mebNotice = 'https://tokisehiteryilmazozdemir.meb.k12.tr/icerikler/20262027egitimogretimyiliokulservisucretleribilgilendirmesi_17651476.html';

export function TariffTable({ compact = false }: { compact?: boolean }) {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [showAll, setShowAll] = useState(false);
  const rows = compact && !showAll ? tariffBands.slice(0, 5) : tariffBands;
  return <div className="tariff-module">
    <div className="tariff-topline"><div><span className="eyebrow">2026–27 · İSTANBUL</span><h3>UKOME azami servis tarifesi</h3></div><div className="period-switch" role="group" aria-label="Tarife dönemi">{(['monthly', 'annual'] as const).map((value) => <button type="button" key={value} onClick={() => setPeriod(value)} className={period === value ? 'selected' : ''}>{value === 'monthly' ? 'Aylık' : 'Yıllık'}</button>)}</div></div>
    <div className="tariff-table-wrap"><table className="tariff-table"><thead><tr><th>Tek yön mesafe</th><th>{period === 'monthly' ? 'Aylık azami' : 'Yıllık azami'}</th></tr></thead><tbody>{rows.map((band, index) => <tr key={band.distance} className={index === 0 ? 'first-row' : ''}><td><span className="distance-mark"/>{band.distance}</td><td>{formatTL(band[period])}</td></tr>)}</tbody></table></div>
    {!compact && <div className="tariff-extra"><span>25 km üzeri</span><strong>Her km için +87,99 TL</strong></div>}
    {compact && <button type="button" className="inline-link tariff-expand" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>{showAll ? 'Daha az kademe göster' : 'Tüm mesafe kademeleri'}{showAll ? <ArrowDownRight size={15}/> : <ArrowUpRight size={15}/>}</button>}
    {compact && showAll && <div className="tariff-extra"><span>25 km üzeri</span><strong>Her km için +87,99 TL</strong></div>}
    <div className="tariff-footnote"><Info size={16}/><p>Ücretler KDV dahil azami referans tutarlardır; mesafe tek yön km üzerinden belirlenir ve tarife gidiş-dönüş hizmetini kapsar. Anaokulu, ilkokul ve ortaokul için rehber personel ücreti %35 eklenir.</p></div>
    <div className="tariff-source"><ShieldCheck size={15}/><span>17 Temmuz 2026 tarihli, 813 sayılı karar · 20 Temmuz 2026’dan itibaren yürürlükte</span><a href={officialPdf} target="_blank" rel="noreferrer">Resmî PDF <ArrowUpRight size={13}/></a><a href={mebNotice} target="_blank" rel="noreferrer">MEB duyurusu <ArrowUpRight size={13}/></a></div>
  </div>;
}

export function TariffCard({ compact = false }: { compact?: boolean }) {
  return <Card className={`tariff-card ${compact ? 'tariff-card-compact' : ''}`}><TariffTable compact={compact}/></Card>;
}
