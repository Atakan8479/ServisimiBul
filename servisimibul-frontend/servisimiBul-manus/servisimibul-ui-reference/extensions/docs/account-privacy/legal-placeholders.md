# Hukuk ve Ürün Kararı Bekleyen Metinler

Bu tasarım eki hukuki görüş değildir. Yol haritasındaki LEG-03/05/06/07 kararları onaylanmış varsayılmamıştır. Köşeli parantezli değerler gerçek kullanıcı metni yerine üretimde çözülmesi gereken placeholder’lardır.

| Placeholder | Anlamı / onay sahibi | Gereken ekranlar |
|---|---|---|
| `[LEGAL_COPY_PENDING]` | Aydınlatma metni, veri sorumlusu/işleme amacı/hukuki sebep/alıcılar/aktarım bilgisi, kullanıcıya gösterilecek karar veya başvuru açıklaması; hukuk onayı. | UX01-09, UX01-10, UX02-04/05/06/09/10/11/12, UX03-01/02/08/09; status detail ve başvuru formu. |
| `[RETENTION_POLICY_PENDING]` | Saklama ve imha koşulları; kayıt sınıfı, yasal saklama, üçüncü taraf ve açık taleplerin etkisi. Süre/otomatik silme garantisi değildir. | UX01-09, UX02-01/04/06/07/10/12, UX03-01/02/09. |
| `[ACCOUNT_REACTIVATION_POLICY_PENDING]` | Hesabı devre dışı bırakmanın etkisi, geri açılabilirlik ve izin verilen yeniden etkinleştirme koşulu; LEG-07 ürün/hukuk onayı. | UX01-01/02, UX03-01/02/04/05/06/07. |
| `[CONTACT_CHANNEL_PENDING]` | Gerçekten çalışan ilgili kişi başvuru / destek / sonuç iletişim kanalı. E-posta, KEP veya başka kanal uydurulmaz. | UX01-03/04/09/10, UX02-01/03/04/06/07/08/11/12, UX03-07/08/09. |
| `[REQUEST_RESPONSE_POLICY_PENDING]` | Başvuru yanıt süresi, başlangıç anı ve kullanıcıya izleme bilgisi; LEG-06 hukuk/operasyon onayı. Yol haritasındaki 30 günlük metin ayrıca teyit edilmelidir. | UX02-01/02/03/04/05/06/07/08/09/10/11/12, UX03-09. |
| `[IDENTITY_VERIFICATION_METHOD_PENDING]` | Gerekirse uygulanacak asgari, güvenli ek doğrulama yöntemi; APP-07/LEG-06. T.C. kimlik numarası isteme kararı değildir. | UX02-09 ve UX02-07. |
| `[APPROVED_RESPONSE_PENDING]` | İnsan incelemesi ve hukuk kontrolü tamamlanan, başvuruya özel sonuç/gerekçe. Otomatik ret/karar değildir. | UX02-10/11/12. |
| `[SECURITY_SESSION_POLICY_PENDING]` | Şifre ve oturumların iptali kapsamı, mevcut cihaz davranışı ve tekrar giriş; güvenlik/backend onayı. | UX01-05/06/07/08. |
| `[PASSWORD_POLICY_PENDING]` | Üretimde kabul edilen parola koşulları; backend ve güvenlik kararı. | UX01-05/06. |
| `[ACCOUNT_DEACTIVATION_EFFECTS_PENDING]` | Hesap erişimi, mevcut kayıtlar ve bağımlı işlemlere etki; LEG-07 onayı. | UX03-01/02/04/05/06/07. |
| `[BAŞVURU_REFERANSI]`, `[TARİH_PLACEHOLDER]` | Gerçek kayıtla sunucudan üretilecek; prototipte örnek kişisel kayıt gibi görünmemesi için literal placeholder. | UX02-07/08/09/10/11/12. |
| `[MASKELİ HESAP E-POSTASI]`, `[YENİ E-POSTA]` | Üretimde auth kaydından güvenli biçimde maskelenerek gösterilecek; bu prototipte e-posta kişisel verisi yoktur. | UX01-01/02/03/04/05 ve UX02-04/06. |

## Üretime alınmaması gereken varsayımlar

- Aydınlatma metni veya sözleşme metni olarak bu taslak kopyalanmamalıdır.
- Hukuk/ürün tarafından belirlenmemiş saklama süreleri, sınır ötesi aktarım iddiaları ve kalıcı silme garantisi eklenmemelidir.
- Başvuru alındı ekranı verilerin silindiği veya başvurunun kabul edildiği şeklinde yazılmamalıdır.
- Gerçek çalışan e-posta/KEP/destek kanalı yokken e-posta gönderildi veya başvuru iletildi denmemelidir.
- LEG-07 onayı olmadan hesabı devre dışı bırakma ve reactivation CTA’sı etkinleştirilmemelidir.
- Yönetim tarafından askıya alınmış işletmeciye self-service askıyı aşma/reopen akışı verilmemelidir.
- Cookie bannerı, onay checkbox’ı, öğrenci/T.C. kimlik/sağlık verisi alanı veya backend/API sözleşmesi bu UX teslimine dahil değildir.
