# ServisimiBul — Ekran Görüntüsü ve Kod Referans Dizini

Bu paket, güncel React/TypeScript uygulama kodunu ve aynı koddan alınmış görsel referansları birlikte sunar. Uygulamadaki yeni logo, kullanıcının verdiği SVG’den şeffaf 512×512 PNG olarak türetilmiştir; orijinal SVG de kaynak olarak pakette korunur.

## Görsel dosya türleri

- `exports/screenshots/`: 25 ana rotanın tam sayfa masaüstü ve mobil PNG’leri ile önemli etkileşim/state ekranları.
- `exports/screen-segments/`: her ana rotanın viewport boyutunda, kaydırma sırasıyla ayrılmış PNG parçaları. Masaüstü 1440×900 px, mobil 390×844 px; ardışık görüntüler arasında 80 px örtüşme bulunur.
- `exports/screen-segments/index.md` ve `index.json`: her ekranın gerçek parça sayısı, rota, viewport ölçüsü, dosya yolu ve scrollY başlangıç koordinatları.
- `src/` ve `public/`: aynı görünümü oluşturan uygulama kodu ve kullanılan hafif logo/hero asset’leri.
- `assets/brand-source/servisimibul-logo-original.svg`: kullanıcının yüklediği logo dosyasının orijinali.

## 25 ana ekran

| ID | Ekran | Rota | Parça klasörü |
|---|---|---|---|
| P01 | Anasayfa ve okul keşfi | `/` | `P01-anasayfa/` |
| P02 | İşletmeci arama sonuçları | `/arama` | `P02-isletmeci_arama_sonuclari/` |
| P03 | Resmî UKOME tarife referansı | `/tarife` | `P03-ukome_tarife_referansi/` |
| D01 | Talep panosu | `/demands` | `D01-talep_panosu/` |
| D02 | Talep ayrıntısı | `/demands/d-1042` | `D02-talep_ayrintisi/` |
| A01 | Hesap türü seçimi | `/register` | `A01-hesap_turu_secimi/` |
| A02 | Ebeveyn kaydı | `/parent/register` | `A02-ebeveyn_kaydi/` |
| A03 | Ebeveyn girişi | `/parent/login` | `A03-ebeveyn_girisi/` |
| A04 | İşletmeci kaydı | `/operator/register` | `A04-isletmeci_kaydi/` |
| A05 | İşletmeci girişi | `/operator/login` | `A05-isletmeci_girisi/` |
| A06 | E-posta doğrulama | `/operator/verify-email` | `A06-eposta_dogrulama/` |
| A07 | Şifremi unuttum | `/forgot-password` | `A07-sifre_unuttum/` |
| A08 | Şifre yenileme | `/reset-password` | `A08-sifre_yenileme/` |
| O01 | İşletmeci genel bakış | `/operator` | `O01-isletmeci_genel_bakis/` |
| O02 | İşletmeci profili | `/operator/profile` | `O02-isletmeci_profili/` |
| O03 | İşletmeci okul/mahalle kapsamı | `/operator/schools` | `O03-isletmeci_okul_kapsami/` |
| O04 | İşletmeci araç/servis teklifleri | `/operator/offerings` | `O04-isletmeci_servis_teklifleri/` |
| M01 | Yönetim — işletmeci listesi | `/admin/applications` | `M01-yonetim_isletmeci_listesi/` |
| M02 | Yönetim — işletmeci ayrıntısı | `/admin/applications/op1` | `M02-yonetim_isletmeci_detayi/` |
| M03 | Yönetim — okul kataloğu | `/admin/schools` | `M03-yonetim_okul_yonetimi/` |
| M04 | Yönetim — UKOME tarife | `/admin/tariffs` | `M04-yonetim_ukome_tarife/` |
| M05 | Yönetim — raporlama/moderasyon | `/admin/moderation` | `M05-yonetim_moderasyon/` |
| N01 | Ebeveyn bildirimleri | `/notifications` | `N01-ebeveyn_bildirimleri/` |
| N02 | İşletmeci bildirimleri | `/operator/notifications` | `N02-isletmeci_bildirimleri/` |
| N03 | Yönetim bildirimleri | `/admin/notifications` | `N03-yonetim_bildirimleri/` |

Her parça klasöründe `masaustu/` ve `mobil/` alt klasörleri vardır. Dosya adları ekran slug’ı ve sıra numarasını kullanır; örneğin `P01-anasayfa/masaustu/anasayfa_01.png`, `..._02.png`. Tam sayfa ve state görüntüleri de pakette tutulur; böylece hem bütün sayfanın genel kompozisyonu hem de okunabilir bölümlerin ayrıntıları karşılaştırılabilir.

## Kod referansı

- Rota/ekran bileşenleri: `src/features/`.
- Ortak marka kabukları ve bileşenler: `src/components/`.
- Renkler ve genel responsive stiller: `src/styles/tokens.css`, `src/styles/global.css`.
- Rota listesi: `public/manus-routes.json`.
- Tam sayfa/state yakalama: `scripts/capture_screenshots.mjs`.
- Bölümlü viewport yakalama: `scripts/capture_screen_segments.mjs`.

Bu bir görsel referans prototipidir; demo içerikleri kurgusaldır ve kalıcı backend verisi içermez. Yerel çalıştırma ve ürün sınırları için `README.md` dosyasına bakın.
