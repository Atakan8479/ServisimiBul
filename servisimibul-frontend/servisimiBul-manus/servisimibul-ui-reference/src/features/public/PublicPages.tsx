import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, ArrowRight, ArrowUpRight, BusFront, Check, ChevronDown, ChevronRight, Clock3, Filter, Heart, MapPin, Phone, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { Card, Button, Badge, DemoNotice, EmptyState, Field, Modal, PageHeader, SearchInput, SelectField } from '../../components/ui';
import { PublicLayout } from '../../components/Shells';
import { initialDemands, operators, schools } from '../../data/mockData';
import { TariffCard } from './TariffTable';

const HERO = '/assets/servisimibul-hero.webp';
const districts = [...new Set(schools.map((school) => school.district))];

export function HomePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ school: '', district: '', neighborhood: '' });
  const [error, setError] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolSort, setSchoolSort] = useState<'name' | 'district'>('name');
  const [schoolPage, setSchoolPage] = useState(1);
  const [schoolCatalogState, setSchoolCatalogState] = useState<'results' | 'loading' | 'empty' | 'error'>('results');
  const filteredSchools = useMemo(() => schools.filter((school) => {
    const term = schoolQuery.trim().toLocaleLowerCase('tr-TR');
    return !term || `${school.name} ${school.district} ${school.neighborhood}`.toLocaleLowerCase('tr-TR').includes(term);
  }), [schoolQuery]);
  const sortedSchools = useMemo(() => [...filteredSchools].sort((a, b) => schoolSort === 'district' ? a.district.localeCompare(b.district, 'tr-TR') || a.name.localeCompare(b.name, 'tr-TR') : a.name.localeCompare(b.name, 'tr-TR')), [filteredSchools, schoolSort]);
  const schoolPageCount = Math.max(1, Math.ceil(sortedSchools.length / 6));
  const visibleSchools = sortedSchools.slice((schoolPage - 1) * 6, schoolPage * 6);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!form.school) { setError('Aramaya başlamak için okulunu seç.'); return; }
    setError('');
    const query = new URLSearchParams({ school: form.school, district: form.district, neighborhood: form.neighborhood });
    navigate(`/arama?${query.toString()}`);
  };
  return <PublicLayout>
    <main>
      <section className="hero-section">
        <div className="container hero-layout">
          <div className="hero-copy"><span className="hero-kicker"><span className="kicker-dot"/>İSTANBUL’DA OKUL SERVİSİ KEŞFİ</span><h1>Okul servisini<br/><em>birlikte bulalım.</em></h1><p className="hero-lede">Okulunu ve mahalleni seç. Kapsama uyan işletmecileri gör, hizmet ayrıntılarını doğrudan teyit et.</p><div className="hero-actions"><a className="btn btn-primary btn-lg" href="#okul-ara">Okulunu seç <ArrowRight size={17}/></a><Link to="/demands" className="hero-secondary">Talep panosunu keşfet <ArrowUpRight size={16}/></Link></div><div className="hero-assurance"><span><Check size={14}/>Ücretsiz keşif</span><span><Check size={14}/>Doğrudan iletişim</span><span><Check size={14}/>Adres garantisi yok</span></div></div>
          <div className="hero-visual"><div className="hero-image-wrap"><img src={HERO} alt="İstanbul’da bir okul servis minibüsü"/><div className="image-gradient"/><div className="hero-image-caption"><span className="caption-icon"><MapPin size={17}/></span><div><strong>Mahalle kapsamını gör</strong><small>Okuluna uygun seçenekler</small></div><ArrowUpRight size={17}/></div></div><div className="hero-float-card"><div className="float-icon"><RouteIcon/></div><div><strong>İhtiyacına göre ara</strong><small>Okul · ilçe · mahalle</small></div></div><div className="hero-sun"/></div>
        </div>
        <div className="hero-route-line" aria-hidden="true"><span/><span/><span/><span/></div>
      </section>
      <section className="search-dock container" id="okul-ara"><div className="search-dock-heading"><div><span className="eyebrow">ARAMANI KİŞİSELLEŞTİR</span><h2>Hangi okula servis arıyorsun?</h2></div><div className="step-number"><span>01</span><i/><span>02</span><i/><span>03</span></div></div>
        <form className="search-form" onSubmit={submitSearch} noValidate><SelectField label="Okul" name="school" value={form.school} error={error && !form.school ? error : undefined} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}><option value="">Okulunu seç</option>{schools.map((school) => <option key={school.id} value={school.name}>{school.name}</option>)}</SelectField><SelectField label="İlçe" name="district" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value, neighborhood: '' }))}><option value="">Tüm ilçeler</option>{districts.map((district) => <option key={district}>{district}</option>)}</SelectField><SelectField label="Mahalle" name="neighborhood" value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}><option value="">Mahalle seç</option>{schools.filter((s) => !form.district || s.district === form.district).map((school) => <option key={`${school.id}-n`} value={school.neighborhood}>{school.neighborhood}</option>)}</SelectField><Button type="submit" className="search-submit"><Search size={17}/>Servisleri göster</Button></form><p className="search-form-note"><ShieldCheck size={15}/>Mahalle eşleşmesi, belirli bir adresten alım garantisi vermez.</p>
      </section>
      <section className="section container school-discovery" id="okullar">
        <div className="section-heading"><div><span className="eyebrow">İSTANBUL’DA OKULLAR</span><h2>Okulunu bul, seçenekleri gör.</h2><p>Örnek okul kataloğunda arama yapabilir, okul ve mahalle kapsamını inceleyebilirsin.</p></div></div>
        <div className="school-controls"><div className="school-search"><SearchInput placeholder="Okul, ilçe veya mahalle ara" value={schoolQuery} onChange={(e) => { setSchoolQuery(e.target.value); setSchoolPage(1); setSchoolCatalogState('results'); }}/></div><label className="school-sort"><span>Sıralama</span><select aria-label="Okulları sırala" value={schoolSort} onChange={(e) => { setSchoolSort(e.target.value as 'name' | 'district'); setSchoolPage(1); setSchoolCatalogState('results'); }}><option value="name">Okul adına göre</option><option value="district">İlçeye göre</option></select></label></div>
        <div className="school-demo-state"><DemoNotice>Okul kataloğu · demo görünüm durumu</DemoNotice><div className="demo-state-tabs" role="group" aria-label="Okul kataloğu demo durumu"><button className={schoolCatalogState === 'results' ? 'selected' : ''} onClick={() => setSchoolCatalogState('results')}>Sonuçlar</button><button className={schoolCatalogState === 'loading' ? 'selected' : ''} onClick={() => setSchoolCatalogState('loading')}>Yükleniyor</button><button className={schoolCatalogState === 'empty' ? 'selected' : ''} onClick={() => setSchoolCatalogState('empty')}>Boş</button><button className={schoolCatalogState === 'error' ? 'selected' : ''} onClick={() => setSchoolCatalogState('error')}>Hata</button></div></div>
        {schoolCatalogState === 'loading' ? <div className="school-grid school-loading-grid" role="status" aria-live="polite">{Array.from({ length: 6 }, (_, index) => <div className="school-skeleton-card" key={index}><span/><span/><span/></div>)}</div> : schoolCatalogState === 'error' ? <Card className="error-panel school-catalog-error"><div className="error-icon"><X size={18}/></div><h3>Okul kataloğu şu an yüklenemedi</h3><p>Bu bağlantı hatası prototipte gösterilir. Yeniden deneyebilir veya arama ölçütlerini değiştirebilirsin.</p><Button variant="outline" onClick={() => setSchoolCatalogState('results')}>Yeniden dene</Button></Card> : schoolCatalogState === 'empty' || filteredSchools.length === 0 ? <EmptyState title="Okul bulunamadı" description="Arama kelimelerini değiştirip yeniden dene."/> : <>
          <div className="school-grid">{visibleSchools.map((school, index) => <Link to={`/arama?school=${encodeURIComponent(school.name)}&district=${encodeURIComponent(school.district)}&neighborhood=${encodeURIComponent(school.neighborhood)}`} key={school.id} className="school-card"><div className={`school-card-icon school-icon-${index % 4}`}><span>{school.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span></div><div className="school-card-content"><Badge tone="outline">{school.type}</Badge><h3>{school.name}</h3><p><MapPin size={14}/>{school.district} · {school.neighborhood}</p></div><ArrowUpRight className="school-arrow" size={18}/></Link>)}</div>
          {filteredSchools.length > 6 && <div className="school-pagination"><Button variant="outline" size="sm" disabled={schoolPage <= 1} onClick={() => setSchoolPage((page) => Math.max(1, page - 1))}>Önceki</Button><span aria-live="polite">Sayfa {schoolPage} / {schoolPageCount} · {sortedSchools.length} okul</span><Button variant="outline" size="sm" disabled={schoolPage >= schoolPageCount} onClick={() => setSchoolPage((page) => Math.min(schoolPageCount, page + 1))}>Sonraki <ArrowRight size={14}/></Button></div>}
        </>}
        <div className="section-footnote"><span className="demo-dot"/>Bu prototipte okul kayıtları örnek amaçlıdır; gerçek katalog değildir.</div>
      </section>
      <section className="how-section" id="nasil-calisir"><div className="container"><div className="section-heading centered"><span className="eyebrow">BASİT VE AÇIK</span><h2>Üç adımda servis keşfi</h2><p>ServisimiBul işletmecilerle doğrudan iletişim kurmanı kolaylaştırır.</p></div><div className="how-grid"><div className="how-step"><div className="how-number">01</div><div className="how-icon"><Search size={21}/></div><h3>Okulunu seç</h3><p>Aramanı okul, ilçe ve mahalle kapsamıyla daralt.</p></div><div className="how-connector"/><div className="how-step"><div className="how-number">02</div><div className="how-icon"><BusFront size={21}/></div><h3>Seçenekleri incele</h3><p>İşletmecilerin paylaştığı okul ve mahalle kapsamını gör.</p></div><div className="how-connector"/><div className="how-step"><div className="how-number">03</div><div className="how-icon"><Phone size={21}/></div><h3>Doğrudan teyit et</h3><p>Hizmet koşullarını işletmeciyle doğrudan konuş.</p></div></div></div></section>
      <section className="section demand-promo"><div className="container demand-promo-inner"><div className="demand-promo-icon"><Users size={22}/></div><div><span className="eyebrow">BİRLİKTE DAHA GÖRÜNÜR</span><h2>Okulunda servis seçeneği bulamadın mı?</h2><p>Mahallendeki ailelerle ortak bir servis talebi oluştur. Bu bir rezervasyon değildir; talebini görünür kılar.</p></div><Link className="btn btn-outline" to="/demands">Talep panosuna git <ArrowRight size={16}/></Link></div></section>
      <section className="section tariff-section container" id="tarife"><div className="section-heading"><div><span className="eyebrow">RESMÎ REFERANS</span><h2>UKOME servis tarifesi</h2><p>Mesafe kademelerine göre azami referans tutarlar. İşletmecinin kişiye özel fiyat teklifi değildir.</p></div><a className="tariff-date-pill" href="https://tuhim.ibb.gov.tr/media/27498/2027servisucretler.pdf" target="_blank" rel="noreferrer"><span className="date-dot"/>20 Temmuz 2026’dan itibaren <ArrowUpRight size={14}/></a></div><TariffCard compact/><div className="tariff-legal-note"><ShieldCheck size={16}/><span>Resmî tarife bağlantısı ve eğitim yılı bilgisi her zaman önceliklidir. Değerler, kişisel güzergâh fiyatı değildir.</span></div></section>
      <section className="closing-cta"><div className="container closing-cta-inner"><div><Sparkles size={20}/><span>İlk adım okulunu seçmek.</span></div><Link to="#okul-ara" className="btn btn-yellow">Aramaya başla <ArrowRight size={16}/></Link></div></section>
    </main>
  </PublicLayout>;
}

export function TariffPage() {
  const [tariffState, setTariffState] = useState<'ready' | 'loading' | 'missing' | 'error'>('ready');
  const retryTariff = () => { setTariffState('loading'); window.setTimeout(() => setTariffState('ready'), 700); };
  return <PublicLayout><main className="tariff-page container">
    <div className="results-breadcrumb"><Link to="/">Ana sayfa</Link><ChevronRight size={14}/><span>Resmî UKOME tarifesi</span></div>
    <PageHeader eyebrow="RESMÎ REFERANS · 2026–2027" title="İstanbul okul servis tarifesi" description="17 Temmuz 2026 tarihli, 813 sayılı karar kapsamında yayımlanan azami referans ücretleri." actions={<a className="tariff-date-pill" href="https://tuhim.ibb.gov.tr/media/27498/2027servisucretler.pdf" target="_blank" rel="noreferrer">Resmî PDF’i aç <ArrowUpRight size={14}/></a>}/>
    <div className="tariff-demo-controls"><DemoNotice>Tarife ekranı durumları yalnızca bu prototipte simüle edilir.</DemoNotice><div className="demo-state-tabs" role="group" aria-label="Tarife demo durumu"><button className={tariffState === 'ready' ? 'selected' : ''} onClick={() => setTariffState('ready')}>Tarife</button><button className={tariffState === 'loading' ? 'selected' : ''} onClick={() => setTariffState('loading')}>Yükleniyor</button><button className={tariffState === 'missing' ? 'selected' : ''} onClick={() => setTariffState('missing')}>Bulunamadı</button><button className={tariffState === 'error' ? 'selected' : ''} onClick={() => setTariffState('error')}>Hata</button></div></div>
    {tariffState === 'ready' && <TariffCard/>}
    {tariffState === 'loading' && <Card className="tariff-loading-state" role="status" aria-live="polite"><strong>Resmî tarife bilgisi yükleniyor…</strong><span className="tariff-skeleton-line wide"/><span className="tariff-skeleton-line"/><span className="tariff-skeleton-line short"/><span className="tariff-skeleton-line wide"/></Card>}
    {tariffState === 'missing' && <EmptyState title="Bu dönem için tarife görüntülenemiyor" description="Doğrulanmış tarife kaydı olmadığında tutar gösterilmez. Güncel bilgi için resmî kaynağı kontrol et." action={<a className="btn btn-outline" href="https://tuhim.ibb.gov.tr/media/27498/2027servisucretler.pdf" target="_blank" rel="noreferrer">Resmî TUHİM PDF’ini aç <ArrowUpRight size={14}/></a>}/>}
    {tariffState === 'error' && <Card className="error-panel"><div className="error-icon"><X size={18}/></div><h3>Tarife bilgisi şu an yüklenemedi</h3><p>Bu, bağlantı hatasının prototip görünümüdür. Tutarlar gösterilmez; doğrulama için resmî kaynağa başvurabilirsin.</p><Button variant="outline" onClick={retryTariff}>Yeniden dene</Button></Card>}
    <div className="tariff-legal-note tariff-page-note"><ShieldCheck size={16}/><span>Bu, UKOME azami referans tarifesidir; işletmecinin kişiye özel fiyat teklifi değildir. Mesafe ve hizmet ayrıntılarını resmî kaynakla kontrol edin.</span></div>
    <Card className="tariff-source-card"><ShieldCheck size={18}/><div><strong>Kaynak ve yürürlük</strong><p>İBB TUHİM’in 17.07.2026 tarihli, 813 sayılı kararı. Tarife 20 Temmuz 2026’dan itibaren geçerlidir. MEB okul duyurusundaki PDF bağlantısı ve koşullar kaynak notlarında kayıtlıdır.</p><a href="https://tokisehiteryilmazozdemir.meb.k12.tr/icerikler/20262027egitimogretimyiliokulservisucretleribilgilendirmesi_17651476.html" target="_blank" rel="noreferrer">MEB bilgilendirmesini aç <ArrowUpRight size={14}/></a></div></Card>
  </main></PublicLayout>;
}

function RouteIcon() { return <MapPin size={18}/>; }

function OperatorCard({ operator, onDetails, onContact }: { operator: typeof operators[number]; onDetails: () => void; onContact: () => void }) {
  return <Card className="operator-card"><div className={`operator-avatar operator-${operator.color}`}>{operator.initials}</div><div className="operator-card-main"><div className="operator-card-top"><div><h3>{operator.name}</h3><div className="operator-meta"><Badge tone="green" dot>{operator.status}</Badge><span>İşletmeci profili</span></div></div><button className="text-icon-button" onClick={onDetails}>Profili incele <ChevronRight size={15}/></button></div><p className="operator-description">{operator.description}</p><div className="operator-coverage"><span><SchoolIcon/> {operator.schools.length} okul kapsamı</span><span><MapPin size={14}/> {operator.neighborhoods.slice(0, 2).join(', ')}{operator.neighborhoods.length > 2 ? ` +${operator.neighborhoods.length - 2}` : ''}</span></div><div className="operator-card-footer"><div className="operator-optional-data">{operator.vehicles > 0 ? <><BusFront size={15}/><span>{operator.vehicles} araç · {operator.seats} kişilik</span></> : <><InfoIcon/><span>Araç bilgisi paylaşılmamış</span></>}</div><Button variant="outline" size="sm" onClick={onContact}><Phone size={14}/>İletişim bilgisi</Button></div></div></Card>;
}
function SchoolIcon() { return <BusFront size={14}/>; }
function InfoIcon() { return <Sparkles size={14}/>; }

export function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const [schoolFilter, setSchoolFilter] = useState(params.get('school') ?? '');
  const [districtFilter, setDistrictFilter] = useState(params.get('district') ?? '');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState(params.get('neighborhood') ?? '');
  const [sort, setSort] = useState('match');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [screenState, setScreenState] = useState<'results' | 'loading' | 'empty' | 'error'>('results');
  const [selected, setSelected] = useState<typeof operators[number] | null>(null);
  const [modalMode, setModalMode] = useState<'detail' | 'contact' | null>(null);
  const [vehiclesOnly, setVehiclesOnly] = useState(false);
  const [offeringsOnly, setOfferingsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const selectedSchool = params.get('school') ?? 'Okul seçilmedi';
  const filtered = useMemo(() => {
    let list = operators.filter((operator) => {
      const districtMatch = !districtFilter || operator.schools.some((schoolName) => schools.some((school) => school.name === schoolName && school.district === districtFilter));
      const schoolMatch = !schoolFilter || operator.schools.includes(schoolFilter);
      const neighborhoodMatch = !neighborhoodFilter || operator.neighborhoods.includes(neighborhoodFilter);
      const vehicleMatch = !vehiclesOnly || operator.vehicles > 0;
      const offeringMatch = !offeringsOnly || operator.hasOfferings;
      return districtMatch && schoolMatch && neighborhoodMatch && vehicleMatch && offeringMatch;
    });
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return list;
  }, [schoolFilter, districtFilter, neighborhoodFilter, vehiclesOnly, offeringsOnly, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 3));
  const applyFilters = () => { setParams({ school: schoolFilter, district: districtFilter, neighborhood: neighborhoodFilter }); setPage(1); };
  const clearFilters = () => { setSchoolFilter(''); setDistrictFilter(''); setNeighborhoodFilter(''); setVehiclesOnly(false); setOfferingsOnly(false); setPage(1); setParams({}); };
  const openModal = (operator: typeof operators[number], mode: 'detail' | 'contact') => { setSelected(operator); setModalMode(mode); };
  return <PublicLayout><main className="results-page container">
    <div className="results-breadcrumb"><Link to="/">Ana sayfa</Link><ChevronRight size={14}/><span>Servis arama</span></div>
    <div className="results-intro"><div><span className="eyebrow">OKUL SERVİSİ KEŞFİ</span><h1>Okuluna uygun seçenekleri incele.</h1><p><strong>{selectedSchool}</strong> için paylaşılan işletmeci profilleri ve mahalle kapsamı.</p></div><div className="results-summary"><span className="summary-icon"><Users size={18}/></span><div><strong>{filtered.length} işletmeci</strong><small>seçili filtrelere göre</small></div></div></div>
    <div className="results-searchbar"><div className="results-search-item"><SchoolIcon/><div><small>Okul</small><strong>{schoolFilter || selectedSchool}</strong></div></div><div className="results-search-divider"/><div className="results-search-item"><MapPin size={17}/><div><small>Mahalle</small><strong>{neighborhoodFilter || 'Tüm mahalleler'}</strong></div></div><Button variant="outline" onClick={() => setMobileFilters((v) => !v)}><Filter size={16}/><span className="filter-button-label">Filtreler</span></Button><Button onClick={applyFilters}><Search size={16}/>Sonuçları güncelle</Button></div>
    <div className="results-demo-controls"><DemoNotice>Örnek sonuçlar · durum görünümünü değiştirebilirsin</DemoNotice><div className="demo-state-tabs" aria-label="Demo durum görünümü"><button className={screenState === 'results' ? 'selected' : ''} onClick={() => setScreenState('results')}>Sonuçlar</button><button className={screenState === 'loading' ? 'selected' : ''} onClick={() => setScreenState('loading')}>Yükleniyor</button><button className={screenState === 'empty' ? 'selected' : ''} onClick={() => setScreenState('empty')}>Boş durum</button><button className={screenState === 'error' ? 'selected' : ''} onClick={() => setScreenState('error')}>Hata durumu</button></div></div>
    <div className={`results-layout ${mobileFilters ? 'filters-open' : ''}`}>
      <aside className="filter-panel"><div className="filter-panel-head"><div><h3>Arama ölçütleri</h3><p>Seçenekleri daralt</p></div><button className="clear-link" onClick={clearFilters}>Temizle</button></div><SelectField label="Okul" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}><option value="">Tüm okullar</option>{schools.map((school) => <option key={school.id}>{school.name}</option>)}</SelectField><SelectField label="İlçe" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}><option value="">Tüm ilçeler</option>{districts.map((d) => <option key={d}>{d}</option>)}</SelectField><SelectField label="Mahalle" value={neighborhoodFilter} onChange={(e) => setNeighborhoodFilter(e.target.value)}><option value="">Tüm mahalleler</option>{[...new Set(schools.map((s) => s.neighborhood))].map((n) => <option key={n}>{n}</option>)}</SelectField><div className="filter-group"><span className="filter-label">İşletmeci bilgileri</span><label className="checkbox-row"><input type="checkbox" checked={vehiclesOnly} onChange={(e) => { setVehiclesOnly(e.target.checked); setPage(1); }}/><span>Araç bilgisi paylaşılmış</span></label><label className="checkbox-row"><input type="checkbox" checked={offeringsOnly} onChange={(e) => { setOfferingsOnly(e.target.checked); setPage(1); }}/><span>Servis teklifi paylaşılmış</span></label></div><div className="filter-hint"><ShieldCheck size={15}/><span>Araç ve detaylı hizmet bilgisi olmayan işletmeciler de keşifte yer alabilir.</span></div><Button className="filter-apply" onClick={() => { applyFilters(); setMobileFilters(false); }}>Filtreleri uygula</Button></aside>
      <div className="results-main"><div className="results-list-head"><div><h2>İşletmeci profilleri</h2><p>Paylaşılan kapsamı doğrudan teyit et.</p></div><label className="sort-control"><ArrowDownUp size={15}/><span className="visually-hidden">Sırala</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="match">En uygun eşleşme</option><option value="name">İşletme adına göre</option></select></label></div>
        {screenState === 'error' ? <Card className="error-panel"><div className="error-icon"><X size={18}/></div><h3>Sonuçlar yüklenemedi</h3><p>Bağlantını kontrol edip yeniden deneyebilirsin. Bu bir demo hata durumudur.</p><Button variant="outline" size="sm" onClick={() => setScreenState('results')}>Yeniden dene</Button></Card> : screenState === 'loading' ? <div className="operator-results-loading" role="status" aria-live="polite">{Array.from({ length: 3 }, (_, index) => <Card className="operator-loading-card" key={index}><span/><div><span/><span/><span/></div></Card>)}</div> : screenState === 'empty' || filtered.length === 0 ? <EmptyState title="Bu ölçütlerle işletmeci bulunamadı" description="Okul veya mahalle seçimini değiştirip yeniden arayabilirsin." action={<Button variant="outline" onClick={clearFilters}>Filtreleri temizle</Button>}/> : <div className="operator-results-list">{filtered.slice((page - 1) * 3, page * 3).map((operator) => <OperatorCard key={operator.id} operator={operator} onDetails={() => openModal(operator, 'detail')} onContact={() => openModal(operator, 'contact')}/>)}</div>}
        {screenState === 'results' && filtered.length > 3 && <div className="results-pagination"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))}><ArrowRight className="pagination-back" size={14}/>Önceki</Button><span>Sayfa <strong>{page}</strong> / {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((n) => Math.min(pageCount, n + 1))}>Sonraki <ChevronRight size={14}/></Button></div>}
        <div className="results-footer-note"><ShieldCheck size={15}/><span>Mahalle eşleşmesi belirli bir adres için alım garantisi değildir. Hizmet kapsamı, güzergâh ve uygunluğu işletmeciyle doğrudan teyit et.</span></div>
      </div>
    </div>
  </main>
  <Modal open={Boolean(selected && modalMode)} title={modalMode === 'contact' ? 'İşletmeciyle iletişim' : selected?.name ?? 'İşletmeci profili'} description="Bu prototipte kullanılan işletme ve iletişim bilgileri kurgusaldır." onClose={() => setModalMode(null)}>
    {selected && <div className="operator-modal-content"><div className="modal-profile-row"><div className={`operator-avatar operator-${selected.color}`}>{selected.initials}</div><div><h3>{selected.name}</h3><Badge tone="green" dot>Profil yayında</Badge></div></div><div className="modal-info-grid"><div><span>Telefon</span><strong>{selected.phone}</strong></div><div><span>E-posta</span><strong>{selected.email}</strong></div><div><span>Okul kapsamı</span><strong>{selected.schools.join(' · ')}</strong></div><div><span>Hizmet mahalleleri</span><strong>{selected.neighborhoods.join(' · ')}</strong></div></div><p className="modal-disclaimer">Aramadan önce okul saatini, mahalle kapsamını ve uygunluğu işletmeciyle teyit et. Bu ekran rezervasyon oluşturmaz.</p></div>}
  </Modal>
  </PublicLayout>;
}
