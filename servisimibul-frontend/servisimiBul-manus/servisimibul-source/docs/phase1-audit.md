# ServisimiBul — Phase 1 Ekran Envanteri

**Denetim tarihi:** 29 Ekim 2026
**İncelenen canlı prototip:** https://servisimibul-6xkt9xjz.manus.space/
**Amaç:** Yeni UI referans brief’indeki 25 ekranı mevcut prototiple karşılaştırmak. Bu rapor salt okunur Phase 1 denetimidir; uygulama kodu veya canlı site üzerinde değişiklik yapılmamıştır.

## Yönetici özeti

Canlı uygulamanın `/manus-routes.json` manifestinde yalnızca üç rota bulunuyor: `/` (Ana Sayfa), `/arama` (Servis Arama Sonuçları) ve `/isletmeci` (İşletmeci Paneli). Yeni brief’teki 25 ekranın 7’si **PARTIAL**, 18’i **MISSING** olarak değerlendirildi. Bazı hedef URL’ler HTTP 200 ile aynı SPA kabuğunu döndürse de, örneğin `/register` görsel olarak anasayfayı gösteriyor; bu yanıt, ilgili ekranın uygulandığı anlamına gelmiyor.

Mevcut anasayfa, arama sonuçları ve işletmeci genel bakış ekranları premium tasarım kimliğini ve temel kullanım akışlarını koruyor. Buna karşılık işletmeci menüsündeki Profilim, Okullarım, Hizmet mahalleleri, Araçlarım ve Servis hizmetlerim alt ekranlarının gövdeleri aynı iki alanlı genel işletme adı/e-posta formuna düşüyor. Menü başlığı ile içerik uyuşmuyor; okul/mahalle kapsamı, araç ve hizmet düzenleme arayüzleri gerçek ekranlar olarak tamamlanmamış.

### Kontrol edilen mevcut kanıtlar

- `/manus-routes.json`: yalnızca `/`, `/arama`, `/isletmeci` tanımlı.
- `/`: okul, ilçe, mahalle seçimi; ana sayfa içeriği; UKOME referans alanı; demo işletmeci önizlemeleri.
- `/arama`: filtreli sonuç kartları; iletişim/profil aksiyonları; daha fazla göster; adres garantisi uyarısı; UKOME referans paneli.
- `/isletmeci`: genel bakış, profil görünürlüğü kontrolü, özet sayaçlar, örnek okul listesi.
- İşletmeci alt menülerinin birkaçında başlıklar doğru olsa da içerik aynı genel form ve “bağımsız prototip” açıklamasını gösteriyor.
- `/register` doğrudan denendi ve anasayfayı gösterdi. `/demands` de ayrı talep panosu yerine anasayfa içeriğini gösterdi.
- Üst menüdeki “Giriş Yap” tıklandığında demo işletmeci paneline yönlendiriyor; gerçek giriş ekranı gözlenmedi.
- Desktop görsel denetimi yapıldı. Önceki prototip tesliminde temel üç sayfanın 1440/768/390/320 px görünümleri doğrulanmıştı; bu denetimde yeni/placeholder alt ekranların mobil davranışı bağımsız ekran olarak doğrulanamadı.

## Ekran envanteri

| ID | Ekran | İstenen rota | Phase 1 öncesi | Phase 1 sonrası | Desktop | Mobile | Bulgular / eksikler |
|---|---|---|---|---|---|---|---|
| P01 | Anasayfa ve okul keşfi | `/` | PARTIAL | PARTIAL | Var | Var; önceki prototip doğrulamasında responsive | Premium hero, okul/ilçe/mahalle seçimi, temel CTA ve ana sayfa bölümleri mevcut. Okul seçici sabit seçenekli; arama/sıralama/sayfalama, seçili okul özeti, filtreye bağlı mahalle seçenekleri ve yükleniyor/doğrulama/boş/hata durumları eksik. Talep panosuna görünür navigasyon yok. |
| P02 | İşletmeci arama sonuçları | `/` (sonuç bölümü) | PARTIAL | PARTIAL | Var (`/arama`) | Var; önceki prototip doğrulamasında responsive | Ayrı `/arama` rotası var; sonuç kartları, işletmeci iletişim/profil aksiyonları, bazı araç/hizmet ayrıntıları, filtreler ve “Daha fazla göster” mevcut. Başlıkta 3 uygun seçenek yazarken ilk görünümde 2 kart görünmesi sayım/sonuç hiyerarşisinin doğrulanmasını gerektiriyor. Loading/failure/retry/empty durumları ve tam sıralama/sayfalama akışı görünmüyor. |
| P03 | Resmî UKOME tarife referansı | `/` (tarife bölümü) | PARTIAL | PARTIAL | Var; bölüm/panel | Var; ana sayfa responsive | UKOME referans dili ve 2025–26 etiketi var; mesafe bantları başlık düzeyinde. Resmî kaynak, geçerlilik dönemi açıklaması, aylık/yıllık tutarlar, ek km ücretleri, koşullar ve missing/loading/error/retry durumları görünmüyor. Tutar uydurulmadı. |
| D01 | Talep panosu | `/demands` | MISSING | MISSING | Yok | Yok | Rota manifestinde yok; doğrudan ziyaret anasayfayı gösteriyor. Liste, filtre, lifecycle durumu, destekçi sayısı, talep oluşturma, boş/yükleniyor/hata durumu yok. |
| D02 | Talep ayrıntısı | `/demands/:demandId` | MISSING | MISSING | Yok | Yok | Dinamik talep ayrıntı rotası, katılım/geri bildirim/yorum/moderasyon ve lifecycle durumları yok. |
| A01 | Hesap türü seçimi | `/register` | MISSING | MISSING | Yok | Yok | Doğrudan ziyaret anasayfayı gösteriyor; hesap türü seçimi formu yok. |
| A02 | Ebeveyn kaydı | `/parent/register` | MISSING | MISSING | Yok | Yok | Rota/ekran yok; kayıt formu ve durumları yok. |
| A03 | Ebeveyn girişi | `/parent/login` | MISSING | MISSING | Yok | Yok | Rota/ekran yok; ebeveyn giriş formu yok. |
| A04 | İşletmeci kaydı | `/operator/register` | MISSING | MISSING | Yok | Yok | Ayrı kayıt ekranı ve doğrulama akışı yok. |
| A05 | İşletmeci girişi | `/operator/login` | MISSING | MISSING | Yok | Yok | Ayrı giriş ekranı yok; mevcut “Giriş Yap” demo işletmeci paneline açılıyor. |
| A06 | E-posta doğrulama | `/operator/verify-email` | MISSING | MISSING | Yok | Yok | Doğrulama ekranı ve başarı/hata durumları yok. |
| A07 | Şifre sıfırlama isteği | `/forgot-password` | MISSING | MISSING | Yok | Yok | Rota/ekran ve e-posta gönderim simülasyonu yok. |
| A08 | Şifre yenileme | `/reset-password` | MISSING | MISSING | Yok | Yok | Rota/ekran, token/şifre doğrulaması ve başarı/hata durumları yok. |
| O01 | İşletmeci genel bakış | `/operator` | PARTIAL | PARTIAL | Kısmen var (`/isletmeci`) | Kısmen; mobil alt ekran doğrulanmadı | Mevcut `/isletmeci` overview’da profil görünürlüğü, örnek sayaçlar, okul listesi ve UKOME paneli var. İstenen `/operator` rotası manifestte yok. Profil hazırlık göstergesi, onboarding checklist’i, hızlı aksiyonlar ve kapsamlı hesap/hizmet durumları eksik. |
| O02 | İşletmeci profili | `/operator/profile` | PARTIAL | PARTIAL | Kısmen; panel içi görünüm | Kısmen; mobil alt ekran doğrulanmadı | “Profilim” menüsü çalışıyor, ancak gövde işletme adı/e-posta alanlarından oluşan genel bir prototip formu. Hedef rota yok. Telefon, halka açık iletişim, görünürlük yönetimi, kapsamlı doğrulama ve net başarı/hata durumları eksik. |
| O03 | Okullar ve hizmet kapsamı | `/operator/schools` | PARTIAL | PARTIAL | Kısmen; overview + placeholder | Kısmen; mobil alt ekran doğrulanmadı | Overview’da örnek okullar listeleniyor. “Okullarım” ve “Hizmet mahalleleri” alt sayfaları, kendi başlıklarına rağmen aynı işletme adı/e-posta formunu gösteriyor. Okul arama/seçimi, okul bağlantıları, mahalle kapsamı ekle/düzenle/kaldır ve aktif/pasif durumları yok. Hedef rota yok. |
| O04 | Araçlar ve hizmet teklifleri | `/operator/offerings` | PARTIAL | PARTIAL | Kısmen; placeholder | Kısmen; mobil alt ekran doğrulanmadı | “Araçlarım” ve “Servis hizmetlerim” başlıkları mevcut, fakat ikisi de genel işletme adı/e-posta formuna düşüyor. Araç CRUD, kapasite, okul/mahalle bağlantısı, teklif taslağı/yayını ve etkinleştirme durumları yok. Arama ekranındaki mevcut açıklama araç/hizmet kaydının keşif için zorunlu olmadığını söylüyor; bu kural korunmalı. |
| M01 | İşletmeci yönetimi | `/admin/applications` | MISSING | MISSING | Yok | Yok | Admin workspace/navigasyonu veya operatör listesi, filtre ve durum yönetimi yok. |
| M02 | İşletmeci ayrıntısı | `/admin/applications/:applicationId` | MISSING | MISSING | Yok | Yok | Admin detay rotası, mevcut onay/düzeltme akışı, sebep alanları ve onay diyaloğu yok. |
| M03 | Okul yönetimi | `/admin/schools` | MISSING | MISSING | Yok | Yok | Okul kataloğu, ekle/düzenle, etkinleştir/devre dışı bırak, arama ve sayfalama yok. |
| M04 | UKOME tarife yönetimi | `/admin/tariffs` | MISSING | MISSING | Yok | Yok | JSON yönetimi, önizleme, validasyon, sürüm çakışması ve yayın/kaydetme geri bildirimi yok. |
| M05 | Raporlama ve moderasyon | `/admin/moderation` | MISSING | MISSING | Yok | Yok | Bildirilen içerik listesi, moderasyon vaka durumları ve yönetici aksiyonları yok. |
| N01 | Ebeveyn bildirimleri | `/notifications` | MISSING | MISSING | Yok | Yok | Rol bazlı bildirim ekranı, okundu/okunmadı, unread sayısı ve empty/loading/error durumları yok. |
| N02 | İşletmeci bildirimleri | `/operator/notifications` | MISSING | MISSING | Yok | Yok | Ayrı işletmeci bildirim rotası/ekranı yok. Panelde zil ikonu var, ancak bildirim ekranı doğrulanmadı. |
| N03 | Admin bildirimleri | `/admin/notifications` | MISSING | MISSING | Yok | Yok | Admin bildirim rotası/ekranı yok. |

## Mevcut işlevsel notlar

- İşletmeci genel bakışında görünürlük anahtarı ve “Okul ekle” gibi etkileşimler mevcut demo state’i kullanıyor; gerçek backend işlemi olarak sunulmamalı.
- Mevcut panelin birkaç alt menüsü aynı genel formu tekrar ediyor; menü öğesi ve ekran gövdesi arasında tutarlılık sağlanmalı.
- Anasayfa ve sonuçlar okul/mahalle araması, doğrudan iletişim ve adres garantisi verilmeyeceği uyarısını taşıyor. Bu doğru ürün sınırları yeni ekranlarda da korunmalı.
- Prototipte “Made with Manus” platform rozeti gözleniyor; görsel referans screenshot’larında bu platform arayüzü unsurunun uygulama tasarımıyla karıştırılmaması gerekir.

## Phase 1 sonucu ve Phase 2 durumu

Phase 1 envanteri tamamlandı. Bu aşamada hiçbir kaynak dosyası değiştirilmedi, checkpoint oluşturulmadı ve yeni yayın yapılmadı. Önceki görevden gelen proje referansı bu oturumda WebDev projesi olarak bağlanamadığı için kaynak çalışma kopyasına erişim sağlanamadı; dolayısıyla eksik ekranları uygulama ve gerçek ekranlardan screenshot/ZIP üretme işlemleri başlatılmadı. Phase 2’ye geçebilmek için aynı mevcut WebDev projesinin oturumda erişilebilir/bağlanabilir olması gerekir; yeni bir proje kopyası oluşturulmadı.
