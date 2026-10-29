# ServisimiBul — MVP UI Referans Prototipi

Bu bağımsız Manus WebDev projesi, Phase 1 envanterinde bulunan 25 ekranın tasarım ve etkileşim referansıdır. Mevcut canlı prototipe ve üretim uygulamasına bağlı değildir; hiçbir üretim kaydını değiştirmez.

## Teknoloji

- React 19 + TypeScript + Vite
- React Router 7, Lucide React, CSS design tokens
- Node.js 22+, pnpm 11.25.0
- Demo state’i tarayıcıda çalışır; server, managed database, auth provider, e-posta gönderimi veya gerçek form kalıcılığı yoktur. D02 içerik bildirimi M05 moderasyon kuyruğuna yalnızca aynı SPA oturumunda aktarılır; tam sayfa yenilenince demo başlangıç verisi geri yüklenir.

## Yerel çalıştırma

```bash
pnpm install --frozen-lockfile
pnpm run dev -- --host 0.0.0.0 --port 3000
pnpm run build
```

Projede dil tanılamaları Manus WebDev TypeScript diagnostics tarafından sağlanır. Dev server, WebDev Preview’ın kullandığı 3000 portuna dinler.

## Ana ekranlar

| Alan | Route’lar |
|---|---|
| Kamu keşfi | `/`, `/arama`, `/tarife` |
| Talep panosu | `/demands`, `/demands/:demandId` |
| Kimlik ekranları | `/register`, `/parent/register`, `/parent/login`, `/operator/register`, `/operator/login`, `/operator/verify-email`, `/forgot-password`, `/reset-password` |
| İşletmeci | `/operator`, `/operator/profile`, `/operator/schools`, `/operator/offerings`, `/operator/notifications` |
| Yönetim | `/admin/applications`, `/admin/applications/:applicationId`, `/admin/schools`, `/admin/tariffs`, `/admin/moderation`, `/admin/notifications` |
| Ebeveyn bildirimleri | `/notifications` |

Eski `/isletmeci` girişi `/operator` yoluna yönlenir. Sayfa manifesti `public/manus-routes.json` içindedir. Ekran bazlı referans `docs/screen-inventory.md` dosyasındadır.

## Kaynak ve tarife

UKOME 2026–2027 İstanbul referans tarifesi, 17 Temmuz 2026 tarihli 813 sayılı karar ve TUHİM kaynak PDF’i üzerinden araştırılmıştır: [resmî TUHİM PDF](https://tuhim.ibb.gov.tr/media/27498/2027servisucretler.pdf). Tarife tutarları azami/resmî referans niteliğindedir; kullanıcıya/mahalleye özel teklif değildir. Kaynak, dönem ve koşullar `docs/tariff-research.md` ve `docs/ukome-notes.md` içinde kayıtlıdır.

## Prototip sınırları

Demo okullar, işletmeler, telefonlar ve kişiler kurgusaldır. Prototip rezervasyon, sipariş, ödeme, GPS takibi, rota optimizasyonu, özel mesajlaşma, değerlendirme/puan, gerçek doğrulama rozeti, öğrenci profili veya AI moderasyonu sunmaz. Mahalle eşleşmesi belirli bir adresten alım garantisi değildir. İşletmeci araçları ve ayrıntılı servis teklifleri olmadan da keşifte listelenebilir. Görsel onay/işlem geri bildirimleri yalnızca demo state’ini etkiler; gerçek backend’e yazma yapmaz. Bu kaynaklar görsel referans/prototip kodudur, production-ready uygulama değildir.

## Görsel teslim dosyaları

- 25 ana route’un tam sayfa 1440 px masaüstü ve 390 px mobil PNG’leri ile önemli demo durumları: `exports/screenshots/`.
- Her rotanın okunabilir viewport parçaları: `exports/screen-segments/`; masaüstü 1440×900 px, mobil 390×844 px ve ardışık parçalarda 80 px örtüşme.
- Gerçek parça sayıları, dosya yolları ve scroll koordinatları: `exports/screen-segments/index.md` ve `index.json`; ana kod/görsel eşlemesi: `docs/screen-reference-index.md`.
- Tam sayfa/state yakalama betiği: `scripts/capture_screenshots.mjs`; viewport parça yakalama betiği: `scripts/capture_screen_segments.mjs`.
- Güncel kod, logo kaynağı, ekran görüntüleri ve parçalardan oluşan tam tasarım referans ZIP’i: `exports/servisimibul-ui-reference.zip`.
- Güncel uygulama kaynakları ve dokümantasyon, ekran görüntüleri hariç: `exports/servisimibul-source.zip`.

Yeni logo için kullanıcının yüklediği SVG, `assets/brand-source/servisimibul-logo-original.svg` içinde orijinal haliyle korunur. Web arayüzü ve favicon, şeffaf arka planlı 512×512 PNG türevini kullanır. Screenshot’lar çalışan Vite/React UI’ından CDP ile alınır; 25 ana route route manifestiyle karşılaştırılır ve 768 px ile 320 px ekranlarda yatay taşma kontrol edilir.
