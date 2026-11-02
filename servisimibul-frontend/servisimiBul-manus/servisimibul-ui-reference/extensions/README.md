# ServisimiBul — Account & Privacy UX eklentisi

Bu ZIP yalnızca son eklenen UX-01 (Hesap ve Gizlilik), UX-02 (KVKK kişisel veri başvuruları) ve UX-03 (hesap devre dışı bırakma/veri silme talebi) kapsamını içerir. Önceki 25 ekranın kaynakları, görselleri ve segmentleri yeniden paketlenmemiştir.

## İçerik

- `src/features/accountPrivacy/`: yeni React + TypeScript sayfaları ve CSS.
- `integration/`: mevcut uygulamaya eklenen route/shell dosyalarının kopyaları ve yalnızca 25 yeni route girdisi.
- `docs/account-privacy/`: ekran envanteri, akışlar, bileşen haritası, legal placeholder’lar ve referans notları.
- `screenshots/full-page-state/`: 31 ekran/state için 62 desktop/mobile tam sayfa PNG ve 2 adet 390×844 açık drawer PNG’si (64 PNG).
- `screenshots/segments/`: yalnızca bu uzantının 96 viewport segmenti; 80 px örtüşme. İndeks: `screenshots/segments-index.md` ve `.json`.
- `screenshots/capture-results.json` ve `scripts/capture_account_privacy.mjs`: yakalama ölçümleri ve betiği.

Bu bir görsel/etkileşim referansıdır, bağımsız çalışan uygulama veya üretime hazır backend değildir. Var olan UI shell ve paylaşılan bileşenlere bağımlıdır. Hukuk/ürün metinleri placeholder’dır; gerçek e-posta, başvuru, hesap veya veri silme işlemi yapılmaz.
