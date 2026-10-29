import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'http://127.0.0.1:3000';
const debugPort = 9223;
const outDir = path.resolve('exports/screenshots');
const userDir = `/tmp/servisui-chrome-${process.pid}`;
const screens = [
  ['P01', 'home', '/'],
  ['P02', 'search-results', '/arama'],
  ['P03', 'ukome-tariff', '/tarife'],
  ['D01', 'demand-board', '/demands'],
  ['D02', 'demand-detail', '/demands/d-1042'],
  ['A01', 'account-type', '/register'],
  ['A02', 'parent-register', '/parent/register'],
  ['A03', 'parent-login', '/parent/login'],
  ['A04', 'operator-register', '/operator/register'],
  ['A05', 'operator-login', '/operator/login'],
  ['A06', 'verify-email', '/operator/verify-email'],
  ['A07', 'forgot-password', '/forgot-password'],
  ['A08', 'reset-password', '/reset-password'],
  ['O01', 'operator-overview', '/operator'],
  ['O02', 'operator-profile', '/operator/profile'],
  ['O03', 'operator-schools', '/operator/schools'],
  ['O04', 'operator-offerings', '/operator/offerings'],
  ['M01', 'admin-applications', '/admin/applications'],
  ['M02', 'admin-application-detail', '/admin/applications/op1'],
  ['M03', 'admin-schools', '/admin/schools'],
  ['M04', 'admin-tariffs', '/admin/tariffs'],
  ['M05', 'admin-moderation', '/admin/moderation'],
  ['N01', 'parent-notifications', '/notifications'],
  ['N02', 'operator-notifications', '/operator/notifications'],
  ['N03', 'admin-notifications', '/admin/notifications'],
];

await mkdir(outDir, { recursive: true });
const routeResponse = await fetch(`${baseUrl}/manus-routes.json`);
if (!routeResponse.ok) throw new Error(`Route manifest HTTP ${routeResponse.status}`);
const manifest = await routeResponse.json();
const expected = screens.map(([, , route]) => route);
for (const route of expected) {
  const pattern = route.replace(/\/d-1042$/, '/:demandId').replace(/\/op1$/, '/:applicationId');
  if (!manifest.routes.some((item) => item.path === route || item.path === pattern)) {
    throw new Error(`Route manifest is missing ${route}`);
  }
}
console.log(`Route manifest OK (${manifest.routes.length} entries; ${screens.length} primary screens).`);

const chrome = spawn('chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${debugPort}`, '--remote-allow-origins=*',
  `--user-data-dir=${userDir}`, '--no-first-run', '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

class DevTools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000).unref?.();
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }
}

async function waitForDebugger() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await delay(250);
  }
  throw new Error('Chromium remote debugging endpoint did not start.');
}

async function createPage() {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${baseUrl}/`)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create DevTools page: ${response.status}`);
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return new DevTools(socket);
}

async function setViewport(cdp, width, height = 900) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600,
    screenWidth: width, screenHeight: height,
  });
}

async function navigate(cdp, route) {
  await cdp.send('Page.navigate', { url: `${baseUrl}${route}` });
  for (let i = 0; i < 60; i += 1) {
    await delay(200);
    const state = await cdp.evaluate(`({ready:document.readyState,root:!!document.querySelector('#root')&&document.querySelector('#root').innerText.length>0})`);
    if (state?.ready === 'complete' && state?.root) break;
  }
  await cdp.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true');
  await delay(500);
}

async function capture(cdp, file, width) {
  await cdp.evaluate('window.scrollTo(0,0)');
  await delay(120);
  const metrics = await cdp.send('Page.getLayoutMetrics');
  const content = metrics.cssContentSize ?? metrics.contentSize;
  const height = Math.max(720, Math.ceil(content.height));
  const actualWidth = Math.max(width, Math.ceil(content.width));
  const image = await cdp.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: actualWidth, height, scale: 1 },
  });
  await writeFile(file, Buffer.from(image.data, 'base64'));
  return { width: actualWidth, height };
}

const overflows = [];
try {
  await waitForDebugger();
  const cdp = await createPage();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const [id, slug, route] of screens) {
    await setViewport(cdp, 1440, 900);
    await navigate(cdp, route);
    const desktop = await capture(cdp, path.join(outDir, `${id}-${slug}-desktop.png`), 1440);

    await setViewport(cdp, 390, 844);
    await navigate(cdp, route);
    const mobile = await capture(cdp, path.join(outDir, `${id}-${slug}-mobile.png`), 390);

    for (const width of [768, 320]) {
      await setViewport(cdp, width, 900);
      await delay(120);
      const metrics = await cdp.evaluate(`({viewport:window.innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})`);
      const layout = await cdp.send('Page.getLayoutMetrics');
      const contentWidth = (layout.cssContentSize ?? layout.contentSize).width;
      if (metrics.document > metrics.viewport + 1 || metrics.body > metrics.viewport + 1 || contentWidth > width + 1) {
        overflows.push({ route, width, contentWidth, ...metrics });
      }
    }
    console.log(`${id} ${route}: desktop ${desktop.width}x${desktop.height}; mobile ${mobile.width}x${mobile.height}`);
  }

  const variants = [
    { id: 'state-P01-home-validation', route: '/', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Servisleri göster')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P01-school-loading', route: '/', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.school-demo-state button')].find(x=>x.innerText.trim()==='Yükleniyor'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P01-school-empty', route: '/', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.school-demo-state button')].find(x=>x.innerText.trim()==='Boş'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P01-school-error-retry', route: '/', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.school-demo-state button')].find(x=>x.innerText.trim()==='Hata'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P01-school-page-2', route: '/', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.school-pagination button')].find(x=>x.innerText.includes('Sonraki')); if(!b) return 'not-found'; b.click(); return 'page-2'; })()` },
    { id: 'state-P01-school-sort-district', route: '/', width: 1440, action: `(() => { const s=document.querySelector('select[aria-label="Okulları sırala"]'); if(!s) return 'not-found'; s.value='district'; s.dispatchEvent(new Event('change',{bubbles:true})); return 'district-sort'; })()` },
    { id: 'state-P02-results-empty', route: '/arama', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Boş durum'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P02-results-error', route: '/arama', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Hata durumu'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P02-results-loading', route: '/arama', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.results-demo-controls button')].find(x=>x.innerText.trim()==='Yükleniyor'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P02-mobile-filters-open', route: '/arama', width: 390, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Filtreler')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P03-tariff-loading', route: '/tarife', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Yükleniyor'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P03-tariff-missing', route: '/tarife', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Bulunamadı'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-P03-tariff-error', route: '/tarife', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Hata'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D01-board-empty', route: '/demands', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Boş'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D01-board-loading', route: '/demands', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.board-demo-state button')].find(x=>x.innerText.trim()==='Yükleniyor'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D01-create-demand-modal', route: '/demands', width: 390, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Yeni talep oluştur')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D02-demand-closed', route: '/demands/d-1042', width: 1440, action: `(() => { const s=document.querySelector('select[aria-label="Demo talep durumu"]'); if(!s) return 'not-found'; s.value='Kapalı'; s.dispatchEvent(new Event('change',{bubbles:true})); return 'changed'; })()` },
    { id: 'state-D02-feedback-pending', route: '/demands/d-1042', width: 1440, action: `(() => { const s=document.querySelector('select[aria-label="Demo talep durumu"]'); if(!s) return 'not-found'; s.value='Geri bildirim bekliyor'; s.dispatchEvent(new Event('change',{bubbles:true})); return 'changed'; })()` },
    { id: 'state-D02-feedback-satisfied', route: '/demands/d-1042', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Evet, karşılandı')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D02-feedback-unsatisfied', route: '/demands/d-1042', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Henüz değil')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D02-demand-reopened', route: '/demands/d-1042', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Talebi yeniden aç')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D02-support-withdrawal-available', route: '/demands/d-1042', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Ben de destekliyorum')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-D02-report-modal', route: '/demands/d-1042', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Bildir')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-A02-parent-register-validation', route: '/parent/register', width: 390, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Demo kaydı başlat')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-M02-suspend-confirmation', route: '/admin/applications/op1', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('askıya al')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-M03-admin-school-edit-modal', route: '/admin/schools', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.data-table button')].find(x=>x.innerText.trim()==='Düzenle'); if(!b) return 'not-found'; b.click(); return 'edit-open'; })()` },
    { id: 'state-M05-filter-reviewing', route: '/admin/moderation', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.admin-filter-tabs button')].find(x=>x.innerText.includes('İnceleniyor')); if(!b) return 'not-found'; b.click(); return new Promise(resolve=>setTimeout(()=>resolve('visible-cases-'+document.querySelectorAll('.report-card').length),120)); })()` },
    { id: 'state-M05-filter-completed', route: '/admin/moderation', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.admin-filter-tabs button')].find(x=>x.innerText.includes('Tamamlanan')); if(!b) return 'not-found'; b.click(); return new Promise(resolve=>setTimeout(()=>resolve('visible-cases-'+document.querySelectorAll('.report-card').length),120)); })()` },
    { id: 'state-M05-moderation-review', route: '/admin/moderation', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='İncele'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-M05-moderation-resolved', route: '/admin/moderation', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='İncele'); if(!b) return Promise.resolve('not-found'); b.click(); return new Promise(resolve=>setTimeout(()=>{const t=document.querySelector('#moderation-reason'); if(!t) return resolve('textarea-not-found'); const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(t,'Demo inceleme tamamlandı.'); t.dispatchEvent(new Event('input',{bubbles:true})); setTimeout(()=>{const save=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Kararı kaydet')); if(!save) return resolve('save-not-found'); save.click(); resolve('resolved');},250);},250)); })()` },
    { id: 'state-O03-school-edit-modal', route: '/operator/schools', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.data-table button')].find(x=>x.innerText.includes('Düzenle')); if(!b) return 'not-found'; b.click(); return 'edit-open'; })()` },
    { id: 'state-O03-school-remove-confirmation', route: '/operator/schools', width: 1440, action: `(() => { const b=[...document.querySelectorAll('.data-table button')].find(x=>x.innerText.includes('Kaldır')); if(!b) return 'not-found'; b.click(); return 'confirmation-open'; })()` },
    { id: 'state-O04-vehicle-edit-modal', route: '/operator/offerings', width: 1440, action: `(() => { const b=document.querySelector('button[aria-label$="bilgilerini düzenle"]'); if(!b) return 'not-found'; b.click(); return 'edit-open'; })()` },
    { id: 'state-O04-offering-published', route: '/operator/offerings', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Yayımla'); if(!b) return 'not-found'; b.click(); return 'published'; })()` },
    { id: 'state-O04-offering-draft', route: '/operator/offerings', width: 1440, action: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Taslağa al'); if(!b) return 'not-found'; b.click(); return 'draft'; })()` },
    { id: 'state-O01-mobile-navigation', route: '/operator', width: 390, action: `(() => { const b=document.querySelector('button[aria-label="Menüyü aç"]'); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-N01-unread-empty', route: '/notifications', width: 390, action: `(() => { const all=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Tümünü okundu işaretle')); if(all) all.click(); const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Okunmamış')); if(!b) return 'not-found'; b.click(); return 'clicked'; })()` },
    { id: 'state-M05-report-from-D02', route: '/demands/d-1042', width: 1440, action: `(() => { const open=document.querySelector('.report-button'); if(!open) return Promise.resolve('report-button-not-found'); open.click(); return new Promise(resolve=>setTimeout(()=>{const reason=document.querySelector('.report-form select[name="reason"]'); const description=document.querySelector('.report-form input[name="description"]'); if(!reason||!description) return resolve('form-fields-not-found'); reason.value='Kişisel bilgi içeriyor'; reason.dispatchEvent(new Event('change',{bubbles:true})); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(description,'Demo içerik bildirimi'); description.dispatchEvent(new Event('input',{bubbles:true})); setTimeout(()=>{const submit=document.querySelector('.report-form button[type="submit"]'); if(!submit) return resolve('submit-not-found'); submit.click(); setTimeout(()=>{history.pushState({},'', '/admin/moderation'); window.dispatchEvent(new PopStateEvent('popstate')); setTimeout(()=>resolve('report-visible-in-admin-moderation'),350);},250);},200);},250)); })()` },
  ];
  for (const variant of variants) {
    await setViewport(cdp, variant.width, variant.width < 600 ? 844 : 900);
    await navigate(cdp, variant.route);
    const action = await cdp.evaluate(variant.action);
    if (action === 'not-found') console.warn(`State control not found: ${variant.id}`);
    await delay(450);
    await capture(cdp, path.join(outDir, `${variant.id}.png`), variant.width);
    console.log(`${variant.id}: ${action}`);
  }

  const manifestCheck = await cdp.evaluate(`({broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src),title:document.title})`);
  if (manifestCheck.broken.length) console.warn('Broken images on final state page:', manifestCheck.broken);
  cdp.socket.close();
} finally {
  chrome.kill('SIGTERM');
  await delay(300);
  await rm(userDir, { recursive: true, force: true });
}

console.log(`Responsive overflow findings: ${overflows.length}`);
for (const issue of overflows) console.log(JSON.stringify(issue));
if (overflows.length) process.exitCode = 2;
