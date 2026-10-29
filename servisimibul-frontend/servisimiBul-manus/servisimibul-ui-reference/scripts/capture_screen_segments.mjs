import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SERVISIMIBUL_BASE_URL ?? 'http://127.0.0.1:3000';
const debugPort = 9231;
const outDir = path.resolve('exports/screen-segments');
const userDir = `/tmp/servisimibul-segments-${process.pid}`;
const overlap = 80;
const screens = [
  ['P01', 'anasayfa', '/', 'Anasayfa ve okul keşfi'],
  ['P02', 'isletmeci_arama_sonuclari', '/arama', 'İşletmeci arama sonuçları'],
  ['P03', 'ukome_tarife_referansi', '/tarife', 'Resmî UKOME tarife referansı'],
  ['D01', 'talep_panosu', '/demands', 'Talep panosu'],
  ['D02', 'talep_ayrintisi', '/demands/d-1042', 'Talep ayrıntısı'],
  ['A01', 'hesap_turu_secimi', '/register', 'Hesap türü seçimi'],
  ['A02', 'ebeveyn_kaydi', '/parent/register', 'Ebeveyn kaydı'],
  ['A03', 'ebeveyn_girisi', '/parent/login', 'Ebeveyn girişi'],
  ['A04', 'isletmeci_kaydi', '/operator/register', 'İşletmeci kaydı'],
  ['A05', 'isletmeci_girisi', '/operator/login', 'İşletmeci girişi'],
  ['A06', 'eposta_dogrulama', '/operator/verify-email', 'E-posta doğrulama'],
  ['A07', 'sifre_unuttum', '/forgot-password', 'Şifremi unuttum'],
  ['A08', 'sifre_yenileme', '/reset-password', 'Şifre yenileme'],
  ['O01', 'isletmeci_genel_bakis', '/operator', 'İşletmeci genel bakış'],
  ['O02', 'isletmeci_profili', '/operator/profile', 'İşletmeci profili'],
  ['O03', 'isletmeci_okul_kapsami', '/operator/schools', 'İşletmeci okul ve mahalle kapsamı'],
  ['O04', 'isletmeci_servis_teklifleri', '/operator/offerings', 'İşletmeci araç ve servis teklifleri'],
  ['M01', 'yonetim_isletmeci_listesi', '/admin/applications', 'Yönetim — işletmeci listesi'],
  ['M02', 'yonetim_isletmeci_detayi', '/admin/applications/op1', 'Yönetim — işletmeci ayrıntısı'],
  ['M03', 'yonetim_okul_yonetimi', '/admin/schools', 'Yönetim — okul kataloğu'],
  ['M04', 'yonetim_ukome_tarife', '/admin/tariffs', 'Yönetim — UKOME tarife'],
  ['M05', 'yonetim_moderasyon', '/admin/moderation', 'Yönetim — raporlama ve moderasyon'],
  ['N01', 'ebeveyn_bildirimleri', '/notifications', 'Ebeveyn bildirimleri'],
  ['N02', 'isletmeci_bildirimleri', '/operator/notifications', 'İşletmeci bildirimleri'],
  ['N03', 'yonetim_bildirimleri', '/admin/notifications', 'Yönetim bildirimleri'],
];

const viewports = [
  { key: 'masaustu', label: 'Masaüstü', width: 1440, height: 900 },
  { key: 'mobil', label: 'Mobil', width: 390, height: 844 },
];

await mkdir(outDir, { recursive: true });
const manifestResponse = await fetch(`${baseUrl}/manus-routes.json`);
if (!manifestResponse.ok) throw new Error(`Route manifest HTTP ${manifestResponse.status}`);
const routeManifest = await manifestResponse.json();
for (const [, , route] of screens) {
  const pattern = route.replace(/\/d-1042$/, '/:demandId').replace(/\/op1$/, '/:applicationId');
  if (!routeManifest.routes.some((item) => item.path === route || item.path === pattern)) {
    throw new Error(`Route manifest is missing ${route}`);
  }
}
console.log(`Rota manifesti doğrulandı (${routeManifest.routes.length} kayıt; ${screens.length} ana ekran).`);

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
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000).unref?.();
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }
}

async function waitForDebugger() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await delay(250);
  }
  throw new Error('Chromium remote debugging endpoint did not start.');
}

async function createPage() {
  const response = await fetch(`${`http://127.0.0.1:${debugPort}`}/json/new?${encodeURIComponent(`${baseUrl}/`)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create DevTools page: ${response.status}`);
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return new DevTools(socket);
}

async function setViewport(cdp, viewport) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
}

async function navigate(cdp, route) {
  await cdp.send('Page.navigate', { url: `${baseUrl}${route}` });
  let ready = false;
  for (let i = 0; i < 80; i += 1) {
    await delay(200);
    const state = await cdp.evaluate(`({ready:document.readyState,root:!!document.querySelector('#root')&&document.querySelector('#root').innerText.length>0})`);
    if (state?.ready === 'complete' && state?.root) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error(`UI did not become ready for ${route}`);
  await cdp.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true');
  await cdp.evaluate('Promise.all([...document.images].map((image) => image.decode().catch(() => null)))');
  await delay(300);
}

async function captureViewport(cdp, file) {
  const image = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const buffer = Buffer.from(image.data, 'base64');
  await writeFile(file, buffer);
  return buffer.length;
}

const records = [];
let totalParts = 0;
try {
  await waitForDebugger();
  const cdp = await createPage();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const [id, slug, route, title] of screens) {
    for (const viewport of viewports) {
      await setViewport(cdp, viewport);
      await navigate(cdp, route);
      const metrics = await cdp.evaluate(`({
        pageHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        viewportHeight: window.innerHeight,
        width: window.innerWidth,
        title: document.title
      })`);
      const maxTop = Math.max(0, metrics.pageHeight - viewport.height);
      const step = Math.max(360, viewport.height - overlap);
      const scrollTops = [0];
      while (scrollTops.at(-1) < maxTop) {
        const nextTop = Math.min(scrollTops.at(-1) + step, maxTop);
        if (nextTop === scrollTops.at(-1)) break;
        scrollTops.push(nextTop);
      }

      const folder = path.join(outDir, `${id}-${slug}`, viewport.key);
      await mkdir(folder, { recursive: true });
      const parts = [];
      for (let index = 0; index < scrollTops.length; index += 1) {
        const requestedTop = scrollTops[index];
        await cdp.evaluate(`window.scrollTo(0, ${requestedTop})`);
        await delay(180);
        const actualTop = await cdp.evaluate('window.scrollY');
        const name = `${slug}_${String(index + 1).padStart(2, '0')}.png`;
        const relativePath = path.posix.join(`${id}-${slug}`, viewport.key, name);
        const fileSize = await captureViewport(cdp, path.join(folder, name));
        parts.push({ index: index + 1, file: relativePath, scrollY: actualTop, bytes: fileSize });
        totalParts += 1;
      }
      records.push({ id, slug, title, route, viewport: viewport.label, width: viewport.width, height: viewport.height, documentHeight: metrics.pageHeight, overlapPx: overlap, parts });
      console.log(`${id} ${viewport.label}: ${metrics.pageHeight}px, ${parts.length} parça`);
    }
  }

  const screenshotIndex = {
    createdAt: new Date().toISOString(),
    source: baseUrl,
    primaryScreens: screens.length,
    viewportDefinitions: viewports,
    overlapPx: overlap,
    totalSegmentScreenshots: totalParts,
    screens: records,
  };
  await writeFile(path.join(outDir, 'index.json'), `${JSON.stringify(screenshotIndex, null, 2)}\n`);

  const lines = [
    '# ServisimiBul — Bölümlü Ekran Görüntüsü Dizini',
    '',
    `Kaynak: \`${baseUrl}\` · ${screens.length} ana ekran · ${totalParts} viewport-parçası PNG.`,
    'Her rota masaüstünde 1440×900 px, mobilde 390×844 px olarak yakalandı. Ardışık parçalar arasında 80 px örtüşme vardır; parça sırası dosya adındaki `_01`, `_02` biçimindedir.',
    '',
    '| ID | Ekran | Rota | Masaüstü parçaları | Mobil parçaları |',
    '|---|---|---|---:|---:|',
  ];
  for (const screen of screens) {
    const desktop = records.find((item) => item.id === screen[0] && item.viewport === 'Masaüstü');
    const mobile = records.find((item) => item.id === screen[0] && item.viewport === 'Mobil');
    lines.push(`| ${screen[0]} | ${screen[3]} | \`${screen[2]}\` | ${desktop.parts.length} | ${mobile.parts.length} |`);
  }
  lines.push('', '## Dosya düzeni', '', '- Her ekranın klasörü `ID-ekran_adi/masaustu/` ve `ID-ekran_adi/mobil/` alt dizinlerini içerir.', '- Her parça, örneğin `P01-anasayfa/masaustu/anasayfa_01.png` biçiminde numaralandırılmıştır.', '- Tam sayfa sürümler ve etkileşim durumları ayrıca `../screenshots/` içinde bulunur.', '- Ayrıntılı scrollY koordinatları ve dosya boyutları `index.json` içindedir.', '');
  await writeFile(path.join(outDir, 'index.md'), lines.join('\n'));
  await writeFile(path.join(outDir, 'README.md'), [
    '# Ekran parçası PNG’leri',
    '',
    'Bu klasör 25 ana ürün rotasının masaüstü ve mobil görünümünü kaydırma sırasıyla, okunabilir viewport parçalarına ayırır.',
    'Her parça PNG dosyası sırasıyla isimlendirilmiştir; devamlılığı korumak için parçalar arasında 80 px örtüşme bırakılmıştır.',
    'Rota, viewport, parça sayısı ve scroll koordinatları için `index.md` veya `index.json` dosyasına bakın.',
    '',
  ].join('\n'));
  cdp.socket.close();
} finally {
  chrome.kill('SIGTERM');
  await delay(300);
  await rm(userDir, { recursive: true, force: true });
}
console.log(`Toplam viewport parçası: ${totalParts}`);
