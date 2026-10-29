# ServisimiBul — Navigasyon Haritası

Bu bağımsız prototipte oturum veya rol doğrulaması yoktur. Üstteki **Prototip alanı** kısayolu, kullanıcıya kamu/ebeveyn/işletmeci/yönetim alanlarını demo olarak gezdirir. Tüm linkler gerçek prototip rotalarına gider; rol kısayolu gerçek yetki sağlamaz.

```text
Kamu
├── /                    P01 Anasayfa ve okul keşfi
│   ├── /arama            P02 İşletmeci sonuçları
│   ├── /tarife           P03 UKOME referansı
│   ├── /demands          D01 Talep panosu
│   ├── /notifications    N01 Ebeveyn bildirimleri
│   └── /register         A01 Hesap türü seçimi
├── /demands/:demandId    D02 Talep ayrıntısı
│   ├── açık/kapalı/karşılandı/yeniden açıldı görünümleri
│   ├── destek, işletmeci yanıtı, ebeveyn geri bildirimi ve yorumlar
│   └── içerik bildirimi → gerekçeli demo modalı
├── /parent/register      A02 Ebeveyn kaydı
├── /parent/login         A03 Ebeveyn girişi
├── /operator/register    A04 İşletmeci kaydı
├── /operator/login       A05 İşletmeci girişi
├── /operator/verify-email A06 E-posta doğrulama
├── /forgot-password      A07 Şifre sıfırlama isteği
└── /reset-password       A08 Şifre yenileme

İşletmeci çalışma alanı
├── /operator             O01 Genel bakış
├── /operator/profile     O02 İşletme profili
├── /operator/schools     O03 Okul ve mahalle kapsamı
├── /operator/offerings   O04 Araç ve servis teklifleri (isteğe bağlı)
└── /operator/notifications N02 İşletmeci bildirimleri

Yönetim alanı
├── /admin/applications   M01 İşletmeci listesi
├── /admin/applications/:applicationId M02 İşletmeci ayrıntısı
├── /admin/schools        M03 Okul kataloğu
├── /admin/tariffs        M04 Resmî tarife JSON/önizleme
├── /admin/moderation     M05 İnsan tarafından incelenen bildirimler
└── /admin/notifications  N03 Yönetim bildirimleri
```

`/isletmeci`, mevcut referansla uyumluluk için `/operator` rotasına yönlendirilir; ayrı ekran sayılmaz. P02 araması okul kataloğu ve ana arama formundan `/arama` rotasına geçer. P03 anasayfa özetinden veya ortak navigasyondan `/tarife` sayfasına açılır. Rol geçiş kısayolları görsel prototip navigasyonudur, hesap açma veya gerçek oturum iddiası değildir.
