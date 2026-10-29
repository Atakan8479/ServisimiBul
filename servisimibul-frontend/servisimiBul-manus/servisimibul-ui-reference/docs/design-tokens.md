# ServisimiBul — Tasarım Tokenları ve Ortak Bileşenler

Kaynak: `src/styles/tokens.css`, `src/styles/global.css`. Marka kimliği mevcut ServisimiBul referansından korunmuştur.

## Renk tokenları

| Token | Değer | Kullanım |
|---|---|---|
| `--ink` | `#10253f` | Başlık, navigasyon, güçlü metin; güven/hiyerarşi |
| `--ink-soft` | `#183149` | Gövde metni |
| `--muted` | `#738196` | Yardımcı açıklama |
| `--canvas` | `#f7f9fa` | Uygulama arka planı |
| `--paper` | `#ffffff` | Kart ve form yüzeyleri |
| `--line` | `#e6ebee` | İnce ayırıcı ve kenarlık |
| `--teal` | `#087f83` | İmza marka rengi, ana eylem, keşif ve focus |
| `--teal-strong` | `#066b70` | Hover/aktif teal |
| `--teal-light` | `#e8f5f3` | Teal durumu ve yumuşak zemin |
| `--yellow` | `#f5bd42` | Sıcak, ölçülü vurgu/rota işareti |
| `--yellow-light` | `#fff7df` | Uyarı/ikincil vurgu zemini |
| `--green` | `#27875b` | Başarı/etkin |
| `--red` | `#c85151` | Hata/yıkıcı işlem |
| `--blue` | `#3973ad` | Bilgi/ek durum |

## Tipografi ve boşluk

- Başlıklar: Manrope (400–800); gövde ve etiketler: DM Sans (400–700); sistem sans fallback.
- Spacing ölçüleri ağırlıklı olarak 4/8px katmanlarına dayanır; kartlar arası boşluk 8–24px, büyük bölüm araları 60–92px.
- Köşeler: `--radius-sm: 10px`, `--radius-md: 16px`, `--radius-lg: 24px`, `--radius-xl: 32px`.
- Gölge: `--shadow-sm: 0 2px 8px rgba(16,37,63,.045)`, `--shadow-md: 0 12px 40px rgba(16,37,63,.09)`, `--shadow-lg: 0 24px 70px rgba(16,37,63,.16)`.
- Erişilebilir klavye odağı: `--focus: 0 0 0 3px rgba(8,127,131,.18)`.

## Ortak bileşenler

- `src/components/ui.tsx`: Button varyantları; Badge semantik tonları; Card; Field/SelectField; SearchInput; InlineMessage; PageHeader; StatCard; EmptyState; Modal; DemoNotice.
- `src/components/Shells.tsx`: PublicLayout, Brand, WorkspaceShell; sticky kamu navigasyonu, daraltılabilir rol yan navigasyonu ve demo alan geçişi.
- `src/components/DemoSwitcher.tsx`: Kamu/Ebeveyn/İşletmeci/Yönetim prototip alanları arasında net, erişilebilir demo navigasyonu.
- Tekrarlanan state desenleri: loading, empty, error/retry, success, draft/published, active/inactive; buton durumları ve açıklayıcı metinlerle gösterilir.

## Hareket ve etkileşim

Hover yükselmesi sınırlıdır; küçük geçişler yaklaşık 160–220 ms. Kritik/askıya alma işlemleri gerekçe ve onay modalı kullanır. `prefers-reduced-motion` hareketi azaltır. Tüm form işlemleri local UI demo state’idir; backend/e-posta gönderimi yoktur.
