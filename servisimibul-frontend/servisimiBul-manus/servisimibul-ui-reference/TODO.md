# ServisimiBul — Teslimat TODO

## 1. Kamu sitesi, okul keşfi ve UKOME tarife referansı

- [x] **P01 `/` — Anasayfa ve okul keşfi.** Premium hero ve okul taşımacılığı için açık değer önerisi; okul arama/seçimi; il ve ilçe kapsamı filtreleri; aranabilir, sıralanabilir ve sayfalanabilir okul kataloğu; seçili okul özeti; servis aranan ilçe/mahalle seçimi; ana arama CTA’sı; talep panosuna yönlendirme; yükleniyor, doğrulama, boş ve hata durumları.
- [x] **P02 `/arama` — İşletmeci sonuçları.** İşletmeci sonuç kartları; varsa ticari unvan; kamuya açık telefon; okul ve mahalle kapsamı; isteğe bağlı araç/kapasite ve yayımlanmış servis ayrıntıları; filtreler, sıralama ve sayfalama; boş, yükleniyor, hata/yeniden dene durumları; responsive masaüstü/mobil sunum. Puan, doğrulama rozeti, uydurma fiyat veya hizmet garantisi gösterilmiyor.
- [x] **P03 `/tarife` — Resmî UKOME referansı.** Resmî eğitim yılı tarifesi; mesafe kademeleri; aylık/yıllık referans tutarları; uygulanıyorsa ek kilometre ücretleri; resmî kaynak ve yürürlük dönemi; koşul/notlar; yükleniyor, tarife bulunamadı, hata ve yeniden dene durumları. Mahalle seçimine göre kişiye özel taşıma fiyatı hesaplanmıyor.
- [x] Var olan başarılı tasarım dili korunuyor; yeni ekranlar ServisimiBul’un premium/minimal, çağdaş ve güvenilir ürün görünümünden kopuk biçimde baştan tasarlanmıyor.

## 2. Taşıma talebi deneyimi

- [x] **D01 `/demands` — Talep panosu.** Herkese açık talep listesi; okul/konum arama ve filtreleri; talep yaşam döngüsü durumları; destekçi sayıları; sabah/öğleden sonra ihtiyaçları; talep nedenleri; talep oluşturma akışı; ayrıntı ekranına yönlendirme; liste, yükleniyor, boş ve hata/yeniden dene durumları.
- [x] **D02 `/demands/:demandId` — Talep ayrıntısı.** Okul/mahalle ve yaşam döngüsü bilgisi; katılım özeti ve ebeveyn destek yönetimi; sabah/öğleden sonra gereksinimleri; işletmeci hizmet yanıtları; yayın/güncelleme bilgisi ve tarihler; ebeveyn geri bildirimi; herkese açık yorumlar; içerik bildirme kontrolü. Açık, kapanmış/karşılanmış, desteği geri çekilmiş, ebeveyn geri bildirimi bekleyen, karşılandı/karşılanmadı geri bildirimi, yeniden açılmış ve moderasyon işlemi bekleyen/tamamlanmış görsel durumları mevcut.
- [x] Ebeveyn/işletmeci/yönetim rol sınırları ve mevcut ürün davranışları korunuyor; rezervasyon, adres garantisi veya desteklenmeyen geçiş kurgulanmıyor.

## 3. Kimlik doğrulama ekranları

- [x] **A01 `/register`** hesap türü seçimi; **A02 `/parent/register`** ebeveyn kaydı; **A03 `/parent/login`** ebeveyn girişi; **A04 `/operator/register`** işletmeci kaydı; **A05 `/operator/login`** işletmeci girişi; **A06 `/operator/verify-email`** e-posta doğrulama; **A07 `/forgot-password`** şifremi unuttum; **A08 `/reset-password`** şifre yenileme ekranları oluşturuldu.
- [x] Uygun ekranlarda tutarlı formlar, alan açıklamaları, doğrulama mesajları, uygun parola görünürlüğü, yükleniyor/başarı/hata durumları, ekranlar arası açık geçişler, erişilebilir focus ve hata iletileri ile mobil uyum bulunuyor. E-posta doğrulaması gerçek ürün için gerekli olarak belirtiliyor; prototip gerçek e-posta göndermiyor.
- [x] Sosyal giriş, yeni kimlik doğrulama yöntemi veya desteklenmeyen hesap yönetimi eklenmiyor; demo durumu gerçek backend işlemiymiş gibi sunulmuyor.

## 4. İşletmeci çalışma alanı

- [x] **O01 `/operator` — Genel bakış.** Dashboard navigasyonu, profil hazırlık durumu, herkese açıklık/görünürlük, onboarding checklist’i, hızlı aksiyonlar ve hesap/hizmet durumları.
- [x] **O02 `/operator/profile` — Profil.** İşletme ve kamu iletişim bilgileri; profil görünürlüğü; doğrulama ve kayıt başarı/hata geri bildirimi.
- [x] **O03 `/operator/schools` — Okul ve mahalle kapsamı.** Okul arama/seçimi, bağlı okullar, mahalle kapsamı; aktif/pasif durumu; ekleme, düzenleme, kaldırma onayı; boş/hata durumları.
- [x] **O04 `/operator/offerings` — Araç ve servis teklifleri.** Araç listesi, araç ekleme/düzenleme; servis teklifi oluşturma; okul/mahalle kapsamı; taslak/yayında durumları; etkinleştirme/devre dışı bırakma; doğrulama ve hata geri bildirimi.
- [x] Araç ve ayrıntılı servis teklifi işletmeci keşif görünürlüğü için isteğe bağlıdır; arayüz bunları zorunluymuş gibi göstermiyor.

## 5. Yönetim çalışma alanı

- [x] **M01 `/admin/applications`** işletmeci listesi, hesap durumları, arama/filtre ve yönetim aksiyonları; askıya alma/geri yükleme durumları.
- [x] **M02 `/admin/applications/:applicationId`** işletmeci ve hesap/başvuru bilgileri; yalnızca var olan ürün akışında etkinse onay/düzeltme; gerekçe alanları, onay diyalogları ve işlem geri bildirimi.
- [x] **M03 `/admin/schools`** okul kataloğu; okul ekle/düzenle; etkin/pasif durumu; arama/filtre/sayfalama; doğrulama/hata durumları.
- [x] **M04 `/admin/tariffs`** resmî tarife JSON yönetimi ve önizlemesi; doğrulama hataları; mevcut sürüm bilgisi ve sürüm çakışması; kaydetme/yayın geri bildirimi.
- [x] **M05 `/admin/moderation`** bildirilmiş içerik listesi ve önizlemesi; moderasyon vaka durumları; admin aksiyonları; gerekçeler; onay diyalogları; çözüm/geri bildirim.
- [x] Yapay zekâ moderasyonu, otomatik içerik silme veya zorunlu işletmeci onayı eklenmiyor.

## 6. Bildirimler

- [x] **N01 `/notifications`** ebeveyn, **N02 `/operator/notifications`** işletmeci ve **N03 `/admin/notifications`** admin bildirim ekranları.
- [x] Her rolde okundu/okunmadı görünümü, okunmamış sayısı, bildirim gruplama/hiyerarşisi, role uygun yönlendirme, boş/yükleniyor/hata durumları, okundu işaretleme geri bildirimi ve mobil uyumlu kartlar.

## 7. Ortak tasarım sistemi, responsive ve ürün sınırları

- [x] Mevcut ServisimiBul görsel kimliği korunuyor: premium/minimal, modern ve güvenilir SaaS; derin lacivert, teal, ölçülü sarı, açık zemin; tutarlı tipografi/boşluk; buton, form, kart, tablo, rozet, navigasyon ve durum bileşenleri; erişilebilir kontrast ve görünür klavye focus’u; doğal Türkçe mikro kopya.
- [x] Paylaşılan tasarım sistemi renk/semantic tokenları, tipografi ölçeği, spacing, radius, shadow, buton/form bileşenleri, durum göstergeleri, navigasyon ve boş/yükleniyor/hata görünümlerini kapsıyor.
- [x] Birincil 25 ekran için masaüstü 1440 px ve mobil 390 px tam sayfa PNG sağlandı; 768 px tablet ve 320 px dar mobil genişliklerinde taşma denetimi 0 bulgu verdi.
- [x] Mobil navigasyon, filtre panelleri, uzun formlar, tablolar, dialog/onay pencereleri, kartlar/sayfalama, yatay taşma ve dokunma hedefleri kontrol edildi.
- [x] Ürün okul/mahalle bazlı işletmeci keşfi ve taşıma talep platformu olarak kalıyor. Taşıma rezervasyonu/siparişi, çevrimiçi ödeme, GPS takibi, rota optimizasyonu, özel mesajlaşma, işletmeci puanı/değerlendirmesi, uydurma doğrulama rozeti, yapay zekâ moderasyonu veya öğrenci/hassas öğrenci profili eklenmiyor.
- [x] Tüm kişi, işletme, okul ve iletişim demo bilgileri kurgusal; prototip etkileşimleri yerel UI state’iyle sınırlı ve desteklenmeyen backend işlevleri gerçekmiş gibi sunulmuyor.
- [x] Mahalle eşleşmesi belirli adresten alım garantisi değil. Resmî UKOME ücretleri kişiye özel işletmeci fiyat teklifi değil. İşletmeci, araç veya ayrıntılı servis teklifi olmadan da aramada yer alabilir.

## 8. Ekran envanteri, screenshot, dokümantasyon ve ZIP

- [x] Ekran envanteri her ekran için ID/ad, rota, önceki canlı prototip durumu (Phase 1 denetimindeki 7 PARTIAL / 18 MISSING), yeni UI durumu ve masaüstü/mobil PNG bağlantılarını içeriyor.
- [x] 25 birincil ekranın gerçek uygulama arayüzünden alınan 50 tam sayfa PNG’si standart dosya adlarıyla üretildi; gerekli doğrulama, boş, arama hatası/yeniden dene, onay, yayın/taslak, kapanmış talep, geri bildirim, moderasyon ve mobil navigasyon durumları için ek PNG’ler eklendi.
- [x] Tasarım tokenları ve ortak bileşen özeti; public/ebeveyn/işletmeci/admin rotalarının navigasyon haritası; resmî tarife araştırma kaydı ve önceki Phase 1 envanteri proje dokümantasyonunda bulunuyor.
- [x] Tam UI ZIP’i düzenlenmiş ekran görüntüleri, envanter, tokenlar, navigasyon haritası, tarife kaynakları, proje kaynakları ve demo sınırları içeriyor; kaynaklar açıkça üretim uygulaması değil UI prototip/referansı olarak etiketli. Güncel pakette 88 tam sayfa/state screenshot’ı + 98 bölüm PNG’si + hero/logo varlığı olmak üzere 188 PNG bulunuyor. Kaynak ZIP’i ekran görüntülerini dışarıda bırakıp hero/logo PNG’leri ve orijinal logo SVG’sini içeriyor.
- [x] Son denetim 25 ana route ve 26 manifest girdisini, 50 ana ve 38 state screenshot’ını, 98 viewport bölümünü, ZIP bütünlüğünü, yeni logo görünümünü, M03 düzenleme formunu, M05 korunan durum filtrelerini ve D02’den M05’e oturum içi rapor aktarımını doğruladı. Screenshot envanterinde bir görsel iki kez linklendiği için 89 bağlantı / 88 benzersiz tam sayfa-state PNG’si vardır. 768/320 px yatay taşma: 0. Sınır: demo verileri backend’e yazılmaz ve yenilemede başlangıç verisi geri gelir.
- [x] Final rapor; önceki Phase 1 durumunu (7 PARTIAL, 18 MISSING), 25 tamamlanmış ana ekranı, kalan prototip sınırlamalarını, ekran envanterini ve doğrulanmış indirilebilir UI/source ZIP bağlantılarını kapsıyor.

## 9. Yeni logo ve bölümlü ekran arşivi

- [x] Kullanıcının verdiği yeni ServisimiBul logo SVG’si UI başlığı, çalışma alanı başlıkları, ebeveyn bildirimleri ve favicon için kullanıldı; platform proje logo metadata’sı da güncellendi.
- [x] Özgün SVG `assets/brand-source/servisimibul-logo-original.svg` içinde saklandı; uygulama için şeffaf arka planlı 512×512 PNG türevi üretildi ve yeni tasarım ölçülerine uyarlandı.
- [x] 25 ana ekranın ve önemli etkileşim durumlarının tam sayfa masaüstü/mobil görüntüleri yeni logo ile yeniden üretildi.
- [x] Her ekran 1440×900 px masaüstü ve 390×844 px mobil viewport’ta, tam sığmayan sayfalar sıralı parçalara bölünerek kaydedildi; ardışık görüntülerde 80 px örtüşme var. Toplam 98 parça; dosya yolları ve scroll koordinatları indekslerde yer alıyor.
- [x] Güncel kaynak kodu, özgün/optimize logo, 88 tam sayfa/state screenshot’ı ve 98 bölüm PNG’si tek tam referans ZIP’inde toplandı; güncel kaynak ZIP’i yenilendi; arşiv bütünlüğü ve PNG sayısı doğrulandı.
