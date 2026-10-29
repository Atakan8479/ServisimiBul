# ServisimiBul — MVP UI Referans Prototipi Planı

## Kapsam ve uygulama yaklaşımı

Bu proje, Phase 1 envanterindeki 25 ekranı kapsayan **ayrı bir görsel ürün prototipi** olacaktır. Mevcut canlı prototip `https://servisimibul-6xkt9xjz.manus.space/` sadece tasarım referansı olarak kullanılacak; ona veya üretim sistemine bağlanılmayacak ve mevcut yayın değiştirilmeyecektir. Tüm örnek kayıtlar kurgusal olacak. Oturum, form, filtre, katılım, bildirim ve yönetim aksiyonları yalnızca yerel demo state’inde simüle edilecek; gerçek backend, e-posta, telefon, ödeme ya da veri saklama iddiası olmayacaktır.

React + TypeScript + Vite tabanlı istemci uygulaması; sayfa rotaları için React Router, ikonlar için Lucide ve ortak token/bileşenler için proje içi CSS kullanacaktır. Server ve veritabanı servisleri kapalı kalacaktır. Üretim uygulamasının React/TypeScript/Spring Boot/PostgreSQL mimarisi ayrı olduğundan, bu prototip üretim kodu olarak sunulmayacaktır. Eski `/isletmeci` girişi yeni `/operator` genel bakışına yönlendirilir; arama akışı `/arama` rotasıyla mevcut isimlendirmeyi korur. P03, anasayfadaki kısa tarife özetinden `/tarife` ayrıntı sayfasına gider; admin yönetimi `/admin/tariffs` altındadır.

Kapsam, kamu keşif/tarife sayfalarını (P01–P03), talep panosu ve detayını (D01–D02), kimlik doğrulama akışlarını (A01–A08), işletmeci çalışma alanını (O01–O04), admin ekranlarını (M01–M05) ve rol bazlı bildirim ekranlarını (N01–N03) içerir. Her ekranın kendi başlığına, gerçek içerik hiyerarşisine ve bağlantılı eylemlerine sahip olması gerekir; menü bağlantıları genel/aynı forma düşmemelidir. State örnekleri, ilgili ekran içinde açıkça etiketli demo kontrolleriyle gösterilebilir.

Kapsam sınırları korunacaktır: rezervasyon/sipariş, ödeme, GPS/rota optimizasyonu, özel mesaj, puan/yorum, gerçek sertifika/doğrulama rozeti, AI moderasyonu, otomatik silme veya öğrenci profili eklenmeyecek. UKOME değerleri uydurulmayacak; kaynak ve geçerlilik bilgisi doğrulanamadığında tutar yerine açıkça işaretlenmiş referans/örnek durumu gösterilecek. Mahalle eşleşmesi belirli adresten alım garantisi olarak sunulmayacak. Araçlar ve ayrıntılı teklifler isteğe bağlı kalacak; bunlar olmadan da işletmeci keşfi mümkün olmalıdır. Admin onayı zorunluymuş gibi bir akış eklenmeyecek; askıya alma/geri yükleme ile varsa koşullu düzeltme yönetimi, yalnızca prototipte açıkça demo olarak gösterilecektir.

## Tasarım sistemi

**Tasarım hareketi:** Mevcut ürün kimliğinden türetilen “Sakin transit arayüzü”; modern SaaS sadeliği ile İstanbul okul taşımacılığı bağlamını birleştirir.

**Temel ilkeler:** Bilgi ve eylem netliği; iddia yerine doğru ve ölçülü bilgilendirme; ortak desenlerde tutarlılık; küçük ama görünür etkileşim geri bildirimi.

**Renk felsefesi:** Lacivert güven ve hiyerarşiyi, teal keşif ve ana eylemleri, sıcak sarı rota/önem vurgularını taşır. Açık zeminler uzun okuma ve veri yoğun ekranları rahatlatır. Marka değerleri: `#10253F`, `#087F83`, `#F5BD42`, `#FAFBFC`; semantik success/warning/error tokenları bu palette erişilebilir kontrastla türetilir.

**Yerleşim paradigması:** Kamu sayfalarında geniş editorial alanlar, solda metin ve sağda okul servisi görseli olan hero ve belirgin arama akışı; sonuçlarda arama bağlamı üstte, sonuç listesi ile UKOME referans paneli iki ritimli; işletmeci/admin alanlarında sabit ya da daralabilen rol navigasyonu, üst bağlam çubuğu ve ana çalışma alanı. Mobilde navigasyon çekmecesi/alt navigasyon ve kartlaşan tablolar.

**İmza öğeleri:** Teal durum noktaları ve küçük kapsül etiketleri; sarı rota çizgisi/işaretçi vurguları; hafif şehir/rota çizgisi motifleri. Bunlar dekorasyon olarak değil yön ve durum anlatımı için kullanılır.

**Etkileşim ve animasyon:** Form seçimi, filtre, durum değişimi ve demo kayıtları local state’te görünür geri bildirim üretir. Kritik/silme/askıya alma işlemlerinde gerekçe ve onay diyaloğu kullanılır; ekran okuyucuya uygun açıklamalar sağlanır. Geçişler genellikle 160–220 ms; hover lift sınırlı; `prefers-reduced-motion` için hareket azaltılır. Demo işlemlerde gerçek backend’e kayıt yapılmadığı belirtilir.

**Tipografi:** Başlıklarda Manrope, gövdede DM Sans; ikisi için Türkçe karakter desteği ve sistem sans-serif fallback. Display, bölüm, gövde, etiket ve tablo metinleri ayrı ölçekte tanımlanır; mobilde başlık ölçüleri ve satır uzunlukları küçültülür.

**Marka özü:** İstanbul’da okul servisi arayan aileleri, uygun okul ve mahalle bölgesinde hizmet veren işletmecilerle doğrudan buluşturan keşif ve talep platformu. Kişilik: güvenilir, sakin, pratik.

**Marka dili:** Kısa, anlaşılır, nazik ve gerçekçi. Örnek: “Okulunu ve mahalleni seç, seçenekleri gör.” / “Mahalle eşleşmesi belirli bir adres için alım garantisi değildir.”

**Wordmark/logo:** Mevcut ServisimiBul wordmark ve sembolü korunur; yeni bir logo yönü icat edilmez. Önceki kullanıcı çalışmasında oluşturulan beyaz/lacivert okul servis minibüsü görseli erişilebilir durumdaysa ana sayfa hero’sunda kullanılır; ürün içi tablolara dekoratif fotoğraf eklenmez.

**İmza marka rengi:** `#087F83` premium teal.

## Proje yapısı

- `src/main.tsx` ve `src/App.tsx` — React başlangıç noktası, ortak stillerin yüklenmesi ve React Router sayfaları/dinamik rotalar.
- `src/components/ui.tsx` — buton, input, select, badge, kart, modal, empty ve bildirim bileşenleri.
- `src/components/Shells.tsx` ve `src/components/DemoSwitcher.tsx` — public/operator/admin kabukları, marka, navigasyon ve rol simülatörü.
- `src/features/public/` — P01 anasayfa/keşif, P02 sonuçlar, P03 tarife referansı.
- `src/features/demands/` — D01 talep listesi/oluşturma akışı ve D02 detay/yaşam döngüsü durumları.
- `src/features/auth/` — A01–A08 kimlik doğrulama görsel akışları.
- `src/features/operator/` — O01–O04 işletmeci alanları.
- `src/features/admin/AdminPages.tsx` — M01 işletmeci yönetimi, M02 işletmeci ayrıntısı ve M04 tarife yönetimi; `AdminSchoolsPage.tsx` M03 okul CRUD’unu, `AdminModerationPage.tsx` M05 filtreli moderasyon kuyruğunu yürütür.
- `src/features/notifications/` — N01–N03 rol bazlı bildirimler.
- `src/data/mockData.ts` — kurgusal okullar, işletmeciler, talepler, bildirimler ve doğrulanmış tarife örnekleri; `moderationStore.ts` D02 raporları ile M05 aksiyonlarını aynı SPA oturumundaki in-memory demo kuyruğunda paylaşır.
- `src/styles/tokens.css` ve `src/styles/global.css` — görsel tokenlar, ortak bileşen stilleri ve responsive kurallar.
- `public/assets/` — marka SVG’si ve onaylı okul servisi hero görseli.
- `public/manus-routes.json` — tüm gerçek sayfa rotalarının manifesti.
- `docs/` — ekran envanteri, Phase 1 denetimi, tasarım tokenları, rota haritası ve tarife kaynakları.
- `scripts/capture_screenshots.mjs` — çalışan uygulamadan tam sayfa PNG ve responsive kontrolleri.
- `exports/screenshots/` ve `exports/servisimibul-ui-reference.zip` — gerçek uygulamadan alınmış ekran/durum görselleri ve düzenlenmiş teslim paketi.

## Uygulama sırası ve teslim biçimi

1. Ortak marka, navigasyon, responsive kabuklar, tokenlar ve tekrar kullanılabilir durum/form/tablo/dialog bileşenleri oluşturulur.
2. P01–P03 kamu keşif ekranları; D01–D02 talep ekranları ve ilgili yerel demo geçişleri eklenir.
3. A01–A08 kimlik doğrulama ekranları; O01–O04 işletmeci alanı oluşturulur.
4. M01–M05 yönetim ve N01–N03 bildirim alanları eklenir; tüm rotalar kullanıcıya açık navigasyonla birbirine bağlanır.
5. Ekran envanteri, token dokümanı ve navigasyon haritası kaynakla eşleştirilir. Her birincil ekranın 1440 px desktop ve 390 px mobile tam sayfa görüntüsü ile önemli durum görüntüleri dışa aktarılır; 768 px ve 320 px davranışı gözden geçirilir. Son paket, ekran görüntülerini, dokümanları ve erişilebilir prototip kaynaklarını içeren ZIP olarak hazırlanır. Kaynak dışa aktarımı görsel referans/prototip kodu olarak etiketlenir.

## Altyapı ve sınırlar

Yeni proje ayrı bir Manus WebDev sitesi olarak kalır. React + TypeScript + Vite istemcisi statik preview/deployment için çalışır. Server, managed database, gerçek kullanıcı hesabı, e-posta sağlayıcısı ve üçüncü taraf üretim entegrasyonu kullanılmaz. Uygulama verileri yalnızca kurgusal başlangıç verisi ve tarayıcı içi demo state’idir; sayfa yenilenince kalıcılık garantisi verilmez. Üretim uygulamasına adaptasyon gerektiğinde bu çalışma kaynak referansı olarak değerlendirilmelidir.
