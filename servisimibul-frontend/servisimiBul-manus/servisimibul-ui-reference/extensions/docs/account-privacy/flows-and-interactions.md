# Akış ve Etkileşim Haritası

Bu belge tasarım referansıdır; route isimleri öneridir, API sözleşmesi veya hukuki süreç olarak kabul edilmemelidir.

## UX-01 — Hesap ve gizlilik ayarları

Veli `/parent/account`, işletmeci `/operator/account` sayfasını mevcut role-based workspace kabuğundan açar. Her iki sayfada da hesap e-postası, rol, şifre ve oturum güvenliği, gizlilik bildirimi ve başvuru geçmişi aynı bilgi hiyerarşisindedir. Güvenlik ve privacy kartları görsel olarak eşit ancak taranabilir gruplardır; hesap devre dışı bırakma ve silme başvurusu daha aşağıda ve ayrı sunulur.

İşletmecinin kamuya açık işletme profili hesap bilgilerinden ayrıdır. Görünürlük bağlantısı mevcut `/operator/profile` ekranına gider; yeni bir profil düzenleyicisi oluşturulmaz. Veli kabuğunda mevcut `/demands` ve `/notifications` bağlantıları korunur. Mobil menü aynı role-specific route’ları drawer içinde gösterir; yeni dashboard tasarlanmamıştır.

E-posta değişikliği akışı iki koşullu görünüm taşır: doğrulama altyapısı gelecekte çalışırsa “bekliyor” durumu; bugün e-posta teslimi etkin olmadığı için “kullanılamıyor” durumu. Taslak hiçbir e-posta göndermez veya doğrulama kodu teslim edildiğini varsaymaz. Şifre formu ve oturum sonlandırma diyaloğu yalnızca görsel geçiştir; sunucuya istek yapılmaz. Diyalogda üretim için Esc ile kapanma, odak tuzağı, ilk odağa alma ve kapatıldığında odağı çağıran kontrole geri verme küçük erişilebilirlik genişletmesi olarak belirtilir.

## UX-02 — Kişisel veri hakları başvurusu

```text
Gizlilik bildirimi /privacy/notice
        └─ Başvuru yolu /privacy/requests
             ├─ Mevcut veli girişi /parent/login → Veli başvuru listesi /parent/privacy/requests
             └─ Mevcut işletmeci girişi /operator/login → İşletmeci başvuru listesi /operator/privacy/requests
                  ├─ Yeni başvuru /{role}/privacy/requests/new
                  │    └─ Başvuru alındı (görsel örnek) /{role}/privacy/requests/received
                  └─ Durum /{role}/privacy/requests/status/:status
                       ├─ under-review
                       ├─ additional-verification
                       ├─ completed
                       ├─ rejected
                       └─ partially-fulfilled
```

Kullanıcı formunda yalnızca başvuru konusu seçilir ve talebi anlamak için gerekli açıklama alanı bulunur. T.C. kimlik numarası, öğrenci adı/adresi veya sağlık verisi istenmez. “Başvuru alındı” sonucu, tamamlanma veya silme değildir. Durum zaman çizelgesi alındı → inceleme → yanıt aşamalarını gösterir; ek kimlik doğrulaması gerekiyorsa onaylı yöntem ayrıca tanımlanır.

Giriş yapmamış kullanıcı için `/privacy/requests` mevcut iki giriş ekranına yönlendirir. Kullanıcı hesabı olmayan kişilerin izleyeceği kanal ve çalışan e-posta/KEP adresi mevcut değil; bu nedenle `[CONTACT_CHANNEL_PENDING]` ve `[LEGAL_COPY_PENDING]` görünür placeholder’dır. APP-06/APP-07 akışı ile LEG kararları gelmeden form gerçek başvuru kanalı olarak yayımlanamaz.

Liste ekranında boş, yükleniyor ve ağ hatası/retry görünümleri vardır. Bu görsel varyantlar `?state=empty|loading|error` query parametresiyle yalnızca screenshot referansında açılır; gerçek backend durumu veya API çağrısı oluşturmaz.

## UX-03 — Hesap devre dışı bırakma ve veri silme talebi

Hesap yaşam döngüsü sayfaları (`/{role}/lifecycle`) dört kavramı ayırır:

1. İşletmeci kamu profilini gizleme: yalnız mevcut `/operator/profile` ekranındaki profil görünürlüğü.
2. Kullanıcının hesabını geçici olarak devre dışı bırakması: etkiler ve yeniden açma koşulları `[ACCOUNT_REACTIVATION_POLICY_PENDING]` ile beklemede.
3. Yönetici tarafından askıya alma: yalnız yönetim kararı; işletmeciye self-service kısıt atlama yolu sunulmaz.
4. Kişisel verilerin silinmesini isteme: başvuru ve inceleme akışı; başvuru göndermek hesap veya tüm verileri silmez.

Devre dışı bırakma görsel state’leri `?state=confirm|processing|success|error` ile ayrılır. Mevcut prototipte bunlar route’lar arası görsel geçiştir ve gerçek hesap durumu değiştirmez. LEG-07 ürün/hukuk onayı gelene kadar üretim uygulamasında destructive CTA disabled olmalıdır; reactivation linki yalnız onaylı politika izin verirse eklenir.

Silme başvurusu `/parent/lifecycle/erasure` veya `/operator/lifecycle/erasure` açıklama ekranından ilgili role ait `privacy/requests/new?type=erasure` formuna gider. İstek alındı, ek doğrulama, inceleme, yanıt, ret veya kısmi karşılanma durumları UX-02 durum sayfalarını paylaşır. Saklama yükümlülükleri, üçüncü taraf kayıtları ve bekleyen talepler sonucu etkileyebilir; süre, kalıcı silme garantisi veya otomatik sonuç uydurulmaz.

## Responsive ve etkileşim ilkeleri

Desktop’ta mevcut sol nav ve üst breadcrumb korunur. 768 px civarında kart grupları tek sütuna iner; 390 px ve 320 px’te action sırası dikeyleşir, uzun placeholder’lar satıra kırılır, tablolu bir ekran eklenmez. Mobil drawer yalnız mevcut shell’i kullanır. Form hata metni alanla programatik olarak ilişkilidir; hata `aria-invalid` ve `aria-describedby` ile, genel durumlar mevcut `InlineMessage` semantiğiyle sunulur. Butonlar mobilde en az 46 px yüksekliğe çıkarılır.

Dialog ve drawer için geliştirme tesliminde klavye odağı, Escape/close davranışı, arka planın pasifleştirilmesi, odak dönüşü ve screen-reader status duyuruları production shell davranışıyla doğrulanmalıdır. Renk kontrastı ve WCAG 2.2 AA uyumu için bu görseller başlangıç noktasıdır; sertifikasyon/otomatik uygunluk iddiası değildir.