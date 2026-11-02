# Hesap, Gizlilik ve KVKK UX — Ekran Envanteri

| ID | Türkçe ekran / durum | Rol | Amaç | Önerilen rota / giriş | Roadmap / LEG bağımlılığı | Görsel kanıt |
|---|---|---|---|---|---|---|
| UX01-01 | Hesap ve gizlilik | Veli | Hesap özeti, güvenlik, gizlilik, başvuru ve yaşam döngüsü bölümlerini tek yerde sunmak. | `/parent/account` | UX-01 · LEG-05/06/07 | `UX01-01-parent-settings-{desktop,mobile}.png` |
| UX01-02 | Hesap ve gizlilik | İşletmeci | Aynı hesap/güvenlik temelini sunmak; işletme profilini ayrı tutmak. | `/operator/account` | UX-01 · LEG-05/06/07 | `UX01-02-operator-settings-{desktop,mobile}.png` |
| UX01-03 | E-posta doğrulaması bekliyor | Veli | Yalnızca e-posta altyapısı etkinleşirse kullanılabilecek pending görünümü; e-posta gönderildiğini iddia etmez. | `/parent/account/email?state=pending` | UX-01 · LEG-05 · APP-04 | `UX01-03-email-pending-{desktop,mobile}.png` |
| UX01-04 | E-posta değişikliği kullanılamıyor | İşletmeci | Etkin olmayan e-posta kanalında CTA’yı kapalı ve gerekçeli göstermek. | `/operator/account/email?state=unavailable` | UX-01 · LEG-05 · APP-04 | `UX01-04-email-unavailable-{desktop,mobile}.png` |
| UX01-05 | Şifreyi değiştir | Veli | Mevcut şifre doğrulama ve yeni şifre alanlarının hiyerarşisini göstermek. | `/parent/account/password` | UX-01 · LEG-05 · APP-04 | `UX01-05-password-form-{desktop,mobile}.png` |
| UX01-06 | Şifre doğrulama hatası | Veli | Alan düzeyinde hata ve tekrar deneme görünümü. | `/parent/account/password?state=wrong-password` | UX-01 · LEG-05 · APP-04 | `UX01-06-password-error-{desktop,mobile}.png` |
| UX01-07 | Tüm oturumları kapat onayı | Veli | Oturum etkisini açıklayan onay diyaloğu; gerçek oturum işlemi yoktur. | `/parent/account/sessions?state=confirmation` | UX-01 · LEG-05 · APP-04 | `UX01-07-sessions-confirmation-{desktop,mobile}.png` |
| UX01-08 | Oturumlar sona erdi | Veli | Yalnızca örnek sonuç durumu; üretim oturum politikası ve sunucu yanıtı gerekir. | `/parent/account/sessions?state=ended` | UX-01 · LEG-05 · APP-04 | `UX01-08-sessions-ended-{desktop,mobile}.png` |
| UX01-09 | Gizlilik ve kişisel veriler | Herkes | Hukuken onaylanmış aydınlatma metni için herkese açık yerleşim. | `/privacy/notice` | UX-01/02 · LEG-05/06 | `UX01-09-privacy-notice-{desktop,mobile}.png` |
| UX01-10 | Giriş yapmamış kullanıcı için başvuru yolu | Ziyaretçi | Çalışan e-posta/KEP uydurmadan mevcut giriş akışına yönlendirmek ve kanal kararını görünür kılmak. | `/privacy/requests` | UX-01/02 · LEG-05/06 · APP-06 | `UX01-10-public-request-entry-{desktop,mobile}.png` |
| UX01-11 | Veli mobil navigasyonu açık | Veli | Mevcut workspace menüsünün mobil drawer davranışını göstermek. | `/parent/account` + menü açık | UX-01 | `UX01-11-parent-mobile-navigation.png` |
| UX01-12 | İşletmeci mobil navigasyonu açık | İşletmeci | Aynı shell içinde hesap ayarının bulunabilirliğini göstermek. | `/operator/account` + menü açık | UX-01 | `UX01-12-operator-mobile-navigation.png` |
| UX02-01 | Başvuru listesi boş | Veli | Henüz başvuru bulunmadığında anlaşılır empty state ve yeni başvuru CTA’sı. | `/parent/privacy/requests?state=empty` | UX-02 · LEG-05/06/07 · UX-01 | `UX02-01-requests-empty-{desktop,mobile}.png` |
| UX02-02 | Başvuru listesi yükleniyor | Veli | Başvuru geçmişi için erişilebilir loading iskeleti. | `/parent/privacy/requests?state=loading` | UX-02 · LEG-06 · UX-01 | `UX02-02-requests-loading-{desktop,mobile}.png` |
| UX02-03 | Başvuru listesi hata | Veli | Liste yüklenemediğinde hata ve yeniden deneme yolu. | `/parent/privacy/requests?state=error` | UX-02 · LEG-06 · UX-01 | `UX02-03-requests-error-{desktop,mobile}.png` |
| UX02-04 | Yeni kişisel veri başvurusu | Veli | Bilgi/erişim, düzeltme, silme ve onaylı diğer başvuru kategorilerini minimal formda toplamak. | `/parent/privacy/requests/new` | UX-02 · LEG-05/06 · APP-06/07 · UX-01 | `UX02-04-request-form-{desktop,mobile}.png` |
| UX02-05 | Başvuru formu doğrulama hatası | Veli | Başvuru konusu alanında etiketli ve açıklayıcı doğrulama hatası göstermek. | `/parent/privacy/requests/new?state=validation` | UX-02 · LEG-05/06 · UX-01 | `UX02-05-request-validation-{desktop,mobile}.png` |
| UX02-06 | İşletmeci veri silme talebi formu | İşletmeci | Silme talebini diğer başvuru türlerinden ayırmak; silme garantisi vermemek. | `/operator/privacy/requests/new?type=erasure` | UX-02/03 · LEG-03/05/06/07 · APP-06/07 · UX-01 | `UX02-06-operator-erasure-form-{desktop,mobile}.png` |
| UX02-07 | Başvuru alındı | Veli | Alındı durumunu tamamlanma/silme sonucundan ayırmak; referans ve yanıt süresi için placeholder kullanmak. | `/parent/privacy/requests/received` | UX-02 · LEG-06/07 · APP-07 · UX-01 | `UX02-07-request-received-{desktop,mobile}.png` |
| UX02-08 | Başvuru inceleniyor | Veli | “İnceleniyor” durumunu kabul/sonuç olarak sunmamak. | `/parent/privacy/requests/status/under-review` | UX-02 · LEG-06/07 · APP-07 · UX-01 | `UX02-08-request-under-review-{desktop,mobile}.png` |
| UX02-09 | Ek kimlik doğrulaması gerekebilir | Veli | Yöntem uydurmadan ek doğrulama gereksinimini göstermek; T.C. kimlik numarası istememek. | `/parent/privacy/requests/status/additional-verification` | UX-02 · LEG-06/07 · APP-07 · UX-01 | `UX02-09-additional-verification-{desktop,mobile}.png` |
| UX02-10 | Başvuru yanıtlandı | Veli | Onaylı yanıtın geleceği yeri göstermek; her verinin silindiğini söylememek. | `/parent/privacy/requests/status/completed` | UX-02/03 · LEG-06/07 · APP-07 · UX-01 | `UX02-10-request-completed-{desktop,mobile}.png` |
| UX02-11 | Başvuru sonuçlandırılamadı | Veli | Ret gerekçesi ve sonraki yol için hukuk onaylı metin alanı. | `/parent/privacy/requests/status/rejected` | UX-02 · LEG-06/07 · APP-07 · UX-01 | `UX02-11-request-rejected-{desktop,mobile}.png` |
| UX02-12 | Başvuru kısmen yanıtlandı | Veli | Karşılanan ve karşılanmayan bölümlerin açıklamasına yer ayırmak. | `/parent/privacy/requests/status/partially-fulfilled` | UX-02/03 · LEG-06/07 · APP-07 · UX-01 | `UX02-12-request-partial-{desktop,mobile}.png` |
| UX03-01 | Veli hesap yaşam döngüsü | Veli | Hesap devre dışı bırakma ile kişisel veri başvurusunu ayırmak. | `/parent/lifecycle` | UX-03 · LEG-03/07 · UX-01 | `UX03-01-parent-lifecycle-{desktop,mobile}.png` |
| UX03-02 | İşletmeci hesap yaşam döngüsü | İşletmeci | Profil gizleme, kullanıcı devre dışı bırakması, admin askısı ve silme başvurusunu ayrı göstermek. | `/operator/lifecycle` | UX-03 · LEG-03/07 · UX-01 | `UX03-02-operator-lifecycle-{desktop,mobile}.png` |
| UX03-03 | Mevcut işletme profili (sınır referansı) | İşletmeci | Görünürlük ayarının mevcut profile ait olduğunu kanıtlamak; bu ekranı kopyalamamak. | `/operator/profile` | UX-03 · LEG-03/07; mevcut ekran, yeniden tasarlanmadı | `UX03-03-existing-operator-profile-{desktop,mobile}.png` |
| UX03-04 | Devre dışı bırakma onay açıklaması | Veli | Sonuçlar ve politika kararlarını açıklayıp LEG-07 onayı gelmeden gerçek işlem sunmamak. | `/parent/lifecycle/deactivate?state=confirm` | UX-03 · LEG-07 · UX-01 | `UX03-04-deactivation-confirm-{desktop,mobile}.png` |
| UX03-05 | Devre dışı bırakma işleniyor | Veli | Yalnızca örnek işlem aşaması; hesap durumu değiştiğini iddia etmez. | `/parent/lifecycle/deactivate?state=processing` | UX-03 · LEG-07 · UX-01 | `UX03-05-deactivation-processing-{desktop,mobile}.png` |
| UX03-06 | Devre dışı bırakma başarı örneği | Veli | Koşullu sonuç UI’ı; yalnızca LEG-07 ve doğrulanmış server yanıtı sonrası kullanılabilir. | `/parent/lifecycle/deactivate?state=success` | UX-03 · LEG-07 · UX-01 | `UX03-06-deactivation-success-{desktop,mobile}.png` |
| UX03-07 | Devre dışı bırakma hata örneği | Veli | Hesap durumunu doğrulayamadığında güvenli retry ve iletişim placeholder’ı. | `/parent/lifecycle/deactivate?state=error` | UX-03 · LEG-07 · UX-01 | `UX03-07-deactivation-error-{desktop,mobile}.png` |
| UX03-08 | Yönetici tarafından askıya alınmış işletmeci | İşletmeci | Yönetici askısını gönüllü devre dışı bırakmadan ayırmak; self-service reactivation sunmamak. | `/operator/lifecycle/suspended` | UX-03 · LEG-03/07 | `UX03-08-admin-suspended-{desktop,mobile}.png` |
| UX03-09 | Veri silme talebi açıklaması | Veli | Silme sürecinin başvuru/inceleme olduğunu, otomatik veya kalıcı silme garantisi vermediğini anlatmak. | `/parent/lifecycle/erasure` → form | UX-03 · LEG-03/06/07 · APP-06/07 | `UX03-09-erasure-entry-{desktop,mobile}.png` |

## Görsel ölçüleri ve durum kapsamı

Masaüstü görüntüler 1440 px genişlikte, 900 px viewport ile; mobil görüntüler 390 px genişlikte, 844 px viewport ile gerçek React uygulamasından alınır. PNG’ler ekranın tamamını gösterecek şekilde sayfa yüksekliğine uzar; bu nedenle resimlerin piksel yüksekliği 900/844’ten büyük olabilir. 768 px tablet ve 320 px kompakt mobil davranışı ayrıca yatay taşma açısından denetlenir. Mobil navigasyon açık durumları yalnız mobil PNG olarak listelenmiştir.

Bu ekranlar mevcut local ServisimiBul UI referans uygulamasının route uzantısıdır. Üretim API’si, kalıcı veri, gerçek kullanıcı bilgisi veya GitHub değişikliği içermez. Herhangi bir LEG kararı onaylanmış gibi sunulmamıştır.

## Screenshot ve viewport segment teslimi

- UX-01/02/03 için 31 route/state görünümünün her birinde desktop 1440 px ve mobile 390 px tam sayfa PNG vardır: toplam 62 görsel.
- UX01-11 veli drawer’ı ve UX01-12 işletmeci drawer’ı ayrıca 390×844 viewport PNG’si olarak alınmıştır. İki drawer da yakalama raporunda `drawerOpened: true` ile doğrulanmıştır; extension klasöründeki toplam PNG sayısı 64’tür.
- 25 ana ürün ekranı ile bu 31 hesap/gizlilik state’inin 1440×900 ve 390×844 viewport segmentleri `../../exports/screen-segments/` altında tutulur. Ardışık parçalar 80 px örtüşür; toplam bölüm sayısı ve her parçanın dosya yolu/scroll koordinatı [segment indeksinde](../../exports/screen-segments/index.md) listelenir.
- Rota/state başına ölçüler, mobil drawer sonucu ve 768/320 responsive overflow özeti [`capture-results.json`](../../exports/account-privacy/capture-results.json) içindedir.
