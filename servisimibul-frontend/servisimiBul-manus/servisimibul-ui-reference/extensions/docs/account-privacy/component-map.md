# Component Reuse ve React + TypeScript Uygulama Notları

## Kullanılabilecek mevcut bileşenler

| Var olan bileşen | Kullanım |
|---|---|
| `WorkspaceShell` | Veli/işletmeci role-based account sayfaları; mevcut mobil drawer, üst breadcrumb ve ana nav. Yeni dashboard yerine aynı shell kullanılır. |
| `PublicLayout` | Anonim `/privacy/notice` ve `/privacy/requests` bilgi/giriş yönlendirmesi. |
| `Button` | Birincil/ikincil/outline/danger/quiet eylemler; onaysız destructive CTA için disabled varyant. |
| `FormField` / mevcut `Field` ve `SelectField` | E-posta ve parola alanları; hata, ipucu, required ve autocomplete. Başvuru formunda var olan field stiliyle etiketli textarea kullanılır. |
| `SurfaceCard` / mevcut `Card` | Hesap özeti, güvenlik, gizlilik, talep ve durum panelleri. |
| `StatusBadge` / mevcut `Badge` | İnceleniyor, ek doğrulama, yanıtlandı, kısmen yanıtlandı ve ret durumları. Renk tek başına anlam taşımaz; etiket de vardır. |
| `StatePanel` / mevcut `InlineMessage` ve `EmptyState` | Yükleniyor/boş/hata/başarı; hata `alert`, güncelleme durumu `status` rolü alır. |
| `Modal` | Tüm oturumlardan çıkış onayı. Mevcut modal yapısına production’da focus trap, ilk odak, Escape ve odak geri verme eklenmelidir. |
| Mevcut `DemoNotice` | Screenshot referansının gerçek e-posta, parola, başvuru veya hesap işlemi yapmadığını açık eder. |

Pinned production design system’de Button, FormField, SurfaceCard, SectionShell, StatusBadge ve StatePanel isimleri kullanılır. Mevcut local prototipteki isimler (`Button`, `Field`, `Card`, `Badge`, `InlineMessage`) karşılıklarına görsel davranış örneği sağlar; production implementasyonu isimleri birebir bu prototipten kopyalamak zorunda değildir.

## Önerilen bileşen ağacı

```text
AppRouter
├─ PublicLayout
│  ├─ PrivacyNoticePage
│  └─ PrivacyRequestEntryPage (anonim kullanıcı → mevcut login route’ları)
└─ WorkspaceShell(role: 'parent' | 'operator')
   └─ AccountPrivacyRoute
      ├─ AccountSettingsPage(role)
      │  ├─ AccountSummaryCard
      │  ├─ SecuritySection → ChangePasswordPage / SessionsConfirmDialog
      │  ├─ PrivacySection → NoticeLink / PrivacyRequestsPage
      │  ├─ OperatorProfileVisibilityLink (mevcut /operator/profile)
      │  └─ AccountLifecycleSection → DeactivationEntry / ErasureRequestEntry
      ├─ PrivacyRequestForm(role, requestType)
      ├─ PrivacyRequestListState(loading | empty | error | data)
      ├─ PrivacyRequestStatusPage(status)
      ├─ DeactivationFlowPage(state)
      ├─ ErasureProcessInfoPage
      └─ AdminSuspensionState (yalnız işletmeciye bilgi; reactivation yok)
```

## State ve service sınırı

Production implementation’da route params/loader yalnız auth role ve view state’i belirlemelidir. Başvuru ve hesap işlemlerinin doğrulama, yetki, durum geçişi, saklama ve audit kuralları Spring Boot servisinde onaylı backend sözleşmesiyle ele alınmalıdır. Buradaki local route query’leri yalnız görsel screenshot varyantıdır; herhangi bir API çağrısı, e-posta, kalıcı kayıt veya parola/hesap değişikliği yoktur.

Yeni API endpoint’i, response modeli, e-posta gönderimi, KEP/support kanalı, ret/itiraz yolu veya yeniden etkinleştirme kuralı önerilmemiştir. Bunlar ürün/güvenlik/hukuk kararlarından sonra mevcut backend sahipleriyle belirlenmelidir.

## Erişilebilirlik genişletmeleri

`Field`/`SelectField` label, `aria-invalid` ve `aria-describedby` bağlantısı kullanır. Production formda hata odağı ilk hatalı alana taşınmalı; genel durum değişikliği `role=status`/live region üzerinden duyurulmalıdır. StatusBadge yanında metin etiketi vardır. Modal üretimde dialog adı ve açıklamasına ek olarak focus trap, Escape, ilk odak, arka plan inertliği ve kapandığında odağın açan kontrole dönüşünü sağlamalıdır. Workspace mobil nav açıldığında odak drawer’a taşınmalı, kapanınca açma düğmesine dönmeli; menü kapatma ve 44×44 px hedef alanları doğrulanmalıdır.

Desktop 1440×900 ve mobile 390×844 screenshot’ları tam sayfa tasarım referansıdır. 768 px ve 320 px overflow kontrolü yapılır. WCAG 2.2 AA-oriented tasarım rehberidir; ayrıca kontrast/klavye/screen-reader testi yapılmadan uygunluk sertifikası sayılmaz.