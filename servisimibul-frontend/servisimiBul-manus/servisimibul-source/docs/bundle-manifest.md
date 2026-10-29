# ServisimiBul UI Referans Paketi — İçerik Manifesti

Bu çalışma, mevcut canlı prototipe dokunmayan bağımsız UI referans projesidir. Ekranlar React + TypeScript ile geliştirilmiştir; veri ve etkileşimler yerel demo state’idir, üretim backend’i veya kalıcı kayıt içermez. D02 raporu aynı SPA oturumunda M05 kuyruğuna aktarılır; tam sayfa yenileme başlangıç demo verisini yükler.

## Paketler

- `exports/servisimibul-ui-reference.zip`: güncel uygulama kodu, orijinal/yayımlanan logo varlıkları, dokümantasyon, tam sayfa/state görselleri ve tüm numaralı viewport parçaları.
- `exports/servisimibul-source.zip`: güncel uygulama kaynakları, dokümantasyon ve gerekli logo/hero asset’leri; ekran görüntüsü PNG’leri dahil değildir.

## İçerik

- 25 birincil ürün ekranı; `public/manus-routes.json` içindeki 26 rota girdisi (25 ekran + eski `/isletmeci` yönlendirmesi).
- `exports/screenshots/` içinde 50 ana tam sayfa PNG: her ekran için 1440 px desktop ve 390 px mobile.
- Aynı klasörde 38 ek UI-state PNG: okul kataloğu ve işletmeci araması yükleniyor/boş/hata; tarife bulunamadı/hata; talep panosu/detay yaşam döngüleri ve moderasyona rapor aktarımı; auth doğrulaması; işletmeci/admin okul ve araç düzenleme, silme onayı ve teklif yayını; yönetim moderasyon durum filtreleri/kararları; mobil navigasyon ve diğer önemli durumlar.
- `exports/screen-segments/` içinde 25 ana rotanın masaüstü 1440×900 px ve mobil 390×844 px viewport parça görüntüleri; toplam 98 parça vardır. Her parça sıralı dosya adıyla kaydedilir ve ardışık görüntüler arasında 80 px örtüşme bulunur. Her dosyanın yolu ve scrollY koordinatı `index.json`/`index.md` içinde yazılıdır.
- Yeni kullanıcı logosunun özgün SVG’si `assets/brand-source/servisimibul-logo-original.svg` olarak aynen korunur. Site başlığı ve favicon `public/assets/servisimibul-mark.png` adlı 512×512, alfa kanallı, optimize PNG türevini kullanır; platform logo metadata’sı da bu küçük görselin kalıcı HTTPS URL’sini kullanır.
- Tam referans ZIP’inde 88 tam sayfa/state screenshot PNG’si + 98 segment PNG’si + hero ve optimize logo PNG’si bulunur: toplam 188 PNG. Kaynak ZIP’inde hero/logo PNG’leri ve orijinal SVG bulunur; screenshot PNG’si bulunmaz.
- `docs/screen-inventory.md`: Phase 1’deki 7 PARTIAL / 18 MISSING ekranın başlangıç durumu, yeni rota ve ekran görsel bağlantıları.
- `docs/design-tokens.md`, `docs/navigation-map.md`, `docs/screen-reference-index.md`, `docs/phase1-audit.md`, `docs/tariff-research.md`, `docs/ukome-notes.md`.
- `src/` (M03/M05 için ayrı modüller ve `moderationStore.ts` dahil), `public/`, `assets/brand-source/`, `scripts/capture_screenshots.mjs`, `scripts/capture_screen_segments.mjs`, `package.json`, lockfile ve yapılandırma dosyaları.

## Responsive ve kaynak kapsamı

Tam sayfa yakalama betiği 25 ekran için desktop/mobile görüntüler alır, rota manifestini kaynak rotalarla karşılaştırır ve 768 px tablet ile 320 px dar mobil genişlikte yatay taşma arar. Bölümlü yakalama betiği her route’u 1440×900 ve 390×844 px viewport’larda kaydırma parçalarına böler. Güncel uygulama kodunda yatay taşma bulgusu: 0.

Paketler `node_modules/`, `dist/`, `.git/`, `.env` ve üretim backend kodu içermez. Kurulum ve yerel çalıştırma README’de açıklanır. Bu kaynaklar görsel prototip/referanstır; üretime hazır ServisimiBul uygulaması değildir.
