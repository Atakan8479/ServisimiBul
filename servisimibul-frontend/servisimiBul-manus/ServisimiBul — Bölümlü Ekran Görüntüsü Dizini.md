# ServisimiBul — Bölümlü Ekran Görüntüsü Dizini

Kaynak: `http://127.0.0.1:3000` · 25 ana ekran · 98 viewport-parçası PNG.
Her rota masaüstünde 1440×900 px, mobilde 390×844 px olarak yakalandı. Ardışık parçalar arasında 80 px örtüşme vardır; parça sırası dosya adındaki `_01`, `_02` biçimindedir.

| ID | Ekran | Rota | Masaüstü parçaları | Mobil parçaları |
|---|---|---|---:|---:|
| P01 | Anasayfa ve okul keşfi | `/` | 5 | 7 |
| P02 | İşletmeci arama sonuçları | `/arama` | 2 | 3 |
| P03 | Resmî UKOME tarife referansı | `/tarife` | 2 | 3 |
| D01 | Talep panosu | `/demands` | 3 | 4 |
| D02 | Talep ayrıntısı | `/demands/d-1042` | 2 | 3 |
| A01 | Hesap türü seçimi | `/register` | 1 | 1 |
| A02 | Ebeveyn kaydı | `/parent/register` | 1 | 2 |
| A03 | Ebeveyn girişi | `/parent/login` | 1 | 1 |
| A04 | İşletmeci kaydı | `/operator/register` | 1 | 2 |
| A05 | İşletmeci girişi | `/operator/login` | 1 | 1 |
| A06 | E-posta doğrulama | `/operator/verify-email` | 1 | 1 |
| A07 | Şifremi unuttum | `/forgot-password` | 1 | 1 |
| A08 | Şifre yenileme | `/reset-password` | 1 | 1 |
| O01 | İşletmeci genel bakış | `/operator` | 2 | 3 |
| O02 | İşletmeci profili | `/operator/profile` | 2 | 2 |
| O03 | İşletmeci okul ve mahalle kapsamı | `/operator/schools` | 1 | 2 |
| O04 | İşletmeci araç ve servis teklifleri | `/operator/offerings` | 2 | 2 |
| M01 | Yönetim — işletmeci listesi | `/admin/applications` | 2 | 2 |
| M02 | Yönetim — işletmeci ayrıntısı | `/admin/applications/op1` | 2 | 2 |
| M03 | Yönetim — okul kataloğu | `/admin/schools` | 2 | 2 |
| M04 | Yönetim — UKOME tarife | `/admin/tariffs` | 2 | 2 |
| M05 | Yönetim — raporlama ve moderasyon | `/admin/moderation` | 2 | 2 |
| N01 | Ebeveyn bildirimleri | `/notifications` | 2 | 2 |
| N02 | İşletmeci bildirimleri | `/operator/notifications` | 1 | 2 |
| N03 | Yönetim bildirimleri | `/admin/notifications` | 1 | 2 |

## Dosya düzeni

- Her ekranın klasörü `ID-ekran_adi/masaustu/` ve `ID-ekran_adi/mobil/` alt dizinlerini içerir.
- Her parça, örneğin `P01-anasayfa/masaustu/anasayfa_01.png` biçiminde numaralandırılmıştır.
- Tam sayfa sürümler ve etkileşim durumları ayrıca `../screenshots/` içinde bulunur.
- Ayrıntılı scrollY koordinatları ve dosya boyutları `index.json` içindedir.
