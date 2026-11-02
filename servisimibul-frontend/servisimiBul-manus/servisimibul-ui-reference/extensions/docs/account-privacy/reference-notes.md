# Hesap ve Gizlilik UX — Kaynak Notları

Bu notlar yalnız görsel referans ve mevcut bileşenleri eşlemek içindir. Hukuki görüş ya da üretim davranışı onayı değildir.

## Sağlanan dosya

- Kullanıcının yüklediği **ServisimiBul_Hesap_Gizlilik_KVKK_Issue_Yol_Haritasi_2026.pdf** (`/home/ubuntu/upload/ServisimiBul_Hesap_Gizlilik_KVKK_Issue_Yol_Haritasi_2026.pdf`), 1 Kasım 2026 tarihli yol haritası. Bu belgede LEG-05/06/07 hukuk/ürün kararları P0 taslakları; UX-01/02/03 P1 tasarım işleri olarak tarif edilmiştir. LEG kararlarının imzalanmış olduğu varsayılmamıştır.

## Pinned public GitHub kaynakları

- Onaylı UI referans klasörü ve `cf77ff5b6e714076ccdc16b68f0787c9f7e1045a` commit’i: [UI reference tree](https://github.com/Atakan8479/ServisimiBul/tree/cf77ff5b6e714076ccdc16b68f0787c9f7e1045a/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference).
- [Tasarım tokenları ve ortak bileşen dokümanı](https://raw.githubusercontent.com/Atakan8479/ServisimiBul/cf77ff5b6e714076ccdc16b68f0787c9f7e1045a/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/docs/design-tokens.md), [screen inventory](https://raw.githubusercontent.com/Atakan8479/ServisimiBul/cf77ff5b6e714076ccdc16b68f0787c9f7e1045a/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/docs/screen-inventory.md) ve [token CSS](https://raw.githubusercontent.com/Atakan8479/ServisimiBul/cf77ff5b6e714076ccdc16b68f0787c9f7e1045a/servisimibul-frontend/servisimiBul-manus/servisimibul-ui-reference/src/styles/tokens.css) incelendi.
- Production frontend’deki mevcut [design-system.tsx](https://raw.githubusercontent.com/Atakan8479/ServisimiBul/cf77ff5b6e714076ccdc16b68f0787c9f7e1045a/servisimibul-frontend/src/components/design-system.tsx), [WorkspaceShell.tsx](https://raw.githubusercontent.com/Atakan8479/ServisimiBul/cf77ff5b6e714076ccdc16b68f0787c9f7e1045a/servisimibul-frontend/src/components/WorkspaceShell.tsx) ve [router.tsx](https://raw.githubusercontent.com/Atakan8479/ServisimiBul/cf77ff5b6e714076ccdc16b68f0787c9f7e1045a/servisimibul-frontend/src/app/router.tsx) salt okunur incelendi.

## Görsel dil ve mevcut component ailesi

Pinned UI reference tokenları: lacivert `#10253F`, gövde `#183149`, teal `#087F83`, sarı `#F5BD42`, açık canvas `#F7F9FA`, beyaz yüzey, Manrope başlıklar ve DM Sans gövde. Var olan bileşen ailesi Button, FormField, SurfaceCard, SectionShell, StatusBadge ve StatePanel olarak tanımlanıyor. Production shell mobilde odak tutma/geri yükleme ve skip-link davranışı içeriyor; ekran tasarımına klavye ve mobil çekmece gereksinimleri bu yüzden ayrıca eklenecek.

## Tasarıma aktarılan yol haritası sınırları

- UX-01 bağımlılıkları: LEG-05, LEG-06, LEG-07 ve mevcut UI-fidelity kapanışı.
- UX-02 bağımlılıkları: LEG-06, LEG-07 ve UX-01; alındı, inceleniyor, ek doğrulama, yanıtlandı/ret ve hata/boş durumları istenir.
- UX-03 bağımlılıkları: LEG-03, LEG-07 ve UX-01; silme talebi hesap silinmiş gibi sunulamaz; hesabı devre dışı bırakma, işletmeci profilini gizleme ve admin askısı ayrı kalır.
- Yol haritasında APP-06, gerçek başvuru kanalının işlemesini; APP-07, talep doğrulama/yetki/30 günlük takip akışını tarif eder. E-posta teslimi şu an etkin olmadığı için ekranlarda çalışan e-posta/KEP adresi veya başarılı iletim varsayılmaz. 30 günlük metin yalnız LEG-06 hukuk/operasyon onayıyla eklenebilir.
- Ana test/yayın kapısı gerçek veride imha ve kalıcı hesap işlemlerinden önce ayrı güvenlik, mobil, UX ve hukuk onayını şart koşar.

Bu referans dosyaları, tasarım uzantısında herhangi bir üretim dosyasını değiştirmek veya yayımlamak için kullanılmamıştır.
