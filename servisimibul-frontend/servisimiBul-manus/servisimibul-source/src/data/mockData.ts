export type School = { id: string; name: string; district: string; neighborhood: string; type: string };
export type Operator = { id: string; name: string; initials: string; phone: string; email: string; schools: string[]; neighborhoods: string[]; vehicles: number; seats: number; hasOfferings?: boolean; description: string; color: string; status: 'Yayında' | 'Taslak' | 'Güncelleme gerekli' };
export type Demand = { id: string; school: string; district: string; neighborhood: string; title: string; reason: string; supporters: number; shift: string[]; status: 'Açık' | 'Karşılandı' | 'Kapalı'; updated: string; created: string; description: string; operatorResponse?: string };

export const schools: School[] = [
  { id: 's1', name: 'Ufuk Çocuk Akademisi', district: 'Kadıköy', neighborhood: 'Koşuyolu', type: 'Özel okul' },
  { id: 's2', name: 'Marmara Işık İlkokulu', district: 'Üsküdar', neighborhood: 'Acıbadem', type: 'İlkokul' },
  { id: 's3', name: 'Çınaraltı Eğitim Kampüsü', district: 'Ataşehir', neighborhood: 'Küçükbakkalköy', type: 'Kampüs' },
  { id: 's4', name: 'Rota Koleji Anadolu Lisesi', district: 'Maltepe', neighborhood: 'Altayçeşme', type: 'Lise' },
  { id: 's5', name: 'Yeni Ufuklar Ortaokulu', district: 'Ümraniye', neighborhood: 'Atakent', type: 'Ortaokul' },
  { id: 's6', name: 'Papatya Çocuk Evi', district: 'Beşiktaş', neighborhood: 'Levent', type: 'Anaokulu' },
  { id: 's7', name: 'Yakamoz Eğitim Kurumları', district: 'Bakırköy', neighborhood: 'Ataköy 7-8-9-10. Kısım', type: 'Kampüs' },
  { id: 's8', name: 'Güneykent Bilim Okulu', district: 'Kartal', neighborhood: 'Yakacık', type: 'Ortaokul' },
  { id: 's9', name: 'Mimoza İlkokulu', district: 'Şişli', neighborhood: 'Mecidiyeköy', type: 'İlkokul' },
];

export const operators: Operator[] = [
  { id: 'op1', name: 'Mavi Rota Taşımacılık', initials: 'MR', phone: '+90 (212) 000 00 14', email: 'iletisim@mavirota.example', schools: ['Ufuk Çocuk Akademisi', 'Marmara Işık İlkokulu'], neighborhoods: ['Koşuyolu', 'Acıbadem', 'Hasanpaşa'], vehicles: 5, seats: 108, hasOfferings: true, description: 'Kadıköy ve Üsküdar çevresinde okul saatlerine göre planlanan servis hizmeti.', color: 'teal', status: 'Yayında' },
  { id: 'op2', name: 'Kuzey Hat Ulaşım', initials: 'KH', phone: '+90 (212) 000 00 28', email: 'merhaba@kuzeyhat.example', schools: ['Çınaraltı Eğitim Kampüsü'], neighborhoods: ['Küçükbakkalköy', 'İçerenköy'], vehicles: 3, seats: 72, hasOfferings: true, description: 'Ataşehir çevresinde hizmet alanı paylaşan yerel işletmeci.', color: 'blue', status: 'Yayında' },
  { id: 'op3', name: 'Güvenli Yol Servis', initials: 'GY', phone: '+90 (212) 000 00 36', email: 'destek@guvenliyol.example', schools: ['Rota Koleji Anadolu Lisesi', 'Güneykent Bilim Okulu'], neighborhoods: ['Altayçeşme', 'Yakacık', 'Cevizli'], vehicles: 0, seats: 0, hasOfferings: false, description: 'Araç ayrıntıları henüz eklenmedi. İşletmeci okul ve mahalle kapsamını paylaşmış durumda.', color: 'gold', status: 'Yayında' },
  { id: 'op4', name: 'Yelken Servis Ağı', initials: 'YS', phone: '+90 (212) 000 00 41', email: 'bilgi@yelkensev.example', schools: ['Papatya Çocuk Evi'], neighborhoods: ['Levent', 'Etiler', 'Akatlar'], vehicles: 4, seats: 82, hasOfferings: true, description: 'Beşiktaş ve çevresindeki okul/mahalle kapsamını paylaşıyor.', color: 'plum', status: 'Yayında' },
];

export const initialDemands: Demand[] = [
  { id: 'd-1042', school: 'Ufuk Çocuk Akademisi', district: 'Kadıköy', neighborhood: 'Koşuyolu', title: 'Koşuyolu sabah servisi için talep', reason: 'Mahallemizde aynı okula giden aileler için sabah gidiş seçeneği arıyoruz.', supporters: 18, shift: ['Sabah'], status: 'Açık', updated: 'Bugün güncellendi', created: '12 Eylül 2026', description: 'Koşuyolu ve yakın sokaklardan Ufuk Çocuk Akademisi’ne sabah gidiş için servis seçeneği arayan aileleri bir araya getiriyoruz. Bu talep bir rezervasyon değildir; işletmecilerle doğrudan iletişim kurup hizmet kapsamını ayrıca teyit edin.' },
  { id: 'd-1038', school: 'Marmara Işık İlkokulu', district: 'Üsküdar', neighborhood: 'Acıbadem', title: 'Acıbadem öğleden sonra dönüş', reason: 'Öğleden sonra okul çıkışı için mahalle bazlı talep oluşturuyoruz.', supporters: 12, shift: ['Öğleden sonra'], status: 'Açık', updated: 'Dün güncellendi', created: '8 Eylül 2026', description: 'Acıbadem çevresinden Marmara Işık İlkokulu çıkışında öğleden sonra servis ihtiyacı olan ailelerin talebi.', operatorResponse: 'Kapsamı değerlendirmek için okul çıkış saatlerini ve mahalle sınırını işletmeciyle teyit edin.' },
  { id: 'd-1025', school: 'Çınaraltı Eğitim Kampüsü', district: 'Ataşehir', neighborhood: 'İçerenköy', title: 'İçerenköy için sabah servisi', reason: 'Yeni dönemde okul çevresindeki servis seçeneklerini görünür kılmak.', supporters: 9, shift: ['Sabah'], status: 'Açık', updated: '3 gün önce', created: '2 Eylül 2026', description: 'İçerenköy’de aynı kampüse giden aileler için sabah servis talebi.' },
  { id: 'd-0998', school: 'Yeni Ufuklar Ortaokulu', district: 'Ümraniye', neighborhood: 'Atakent', title: 'Atakent çevresi servis talebi', reason: 'Mevcut talep işletmecilerden yanıt aldı.', supporters: 21, shift: ['Sabah', 'Öğleden sonra'], status: 'Karşılandı', updated: '18 Eylül 2026', created: '27 Ağustos 2026', description: 'Bu talep için bir işletmeci hizmet alanını paylaştı. Aileler kapsamı ve uygunluğu doğrudan teyit etmelidir.', operatorResponse: 'İşletmeci Atakent için okul saatlerine uygun kapsam paylaşmıştır. Bu yanıt, bireysel yer garantisi veya rezervasyon değildir.' },
  { id: 'd-0981', school: 'Mimoza İlkokulu', district: 'Şişli', neighborhood: 'Mecidiyeköy', title: 'Mecidiyeköy sabah talebi', reason: 'Talep oluşturucusu konuyu kapattı.', supporters: 7, shift: ['Sabah'], status: 'Kapalı', updated: '15 Eylül 2026', created: '22 Ağustos 2026', description: 'Talep oluşturucusu bu talebi kapattı. Geçmiş içerik referans için görüntülenebilir.' },
];

export const tariffBands = [
  { distance: '0–1 km', monthly: 4456, annual: 39970 },
  { distance: '1–3 km', monthly: 4772, annual: 42804 },
  { distance: '3–5 km', monthly: 5157, annual: 46258 },
  { distance: '5–7 km', monthly: 5379, annual: 48249 },
  { distance: '7–9 km', monthly: 5671, annual: 50868 },
  { distance: '9–11 km', monthly: 6569, annual: 58923 },
  { distance: '11–13 km', monthly: 7561, annual: 67822 },
  { distance: '13–15 km', monthly: 7942, annual: 71239 },
  { distance: '15–17 km', monthly: 8573, annual: 76899 },
  { distance: '17–19 km', monthly: 9064, annual: 81304 },
  { distance: '19–21 km', monthly: 9645, annual: 86515 },
  { distance: '21–23 km', monthly: 10046, annual: 90112 },
  { distance: '23–25 km', monthly: 10436, annual: 93610 },
];

export const dashboardSchools = [
  { id: 'sc-1', name: 'Ufuk Çocuk Akademisi', district: 'Kadıköy', neighborhoods: ['Koşuyolu', 'Hasanpaşa'], active: true },
  { id: 'sc-2', name: 'Marmara Işık İlkokulu', district: 'Üsküdar', neighborhoods: ['Acıbadem'], active: true },
  { id: 'sc-3', name: 'Çınaraltı Eğitim Kampüsü', district: 'Ataşehir', neighborhoods: ['Küçükbakkalköy'], active: false },
];

export const initialNotifications = {
  parent: [
    { id: 'n1', title: 'Talebine yeni bir destekçi katıldı', detail: 'Koşuyolu sabah servisi talebi', time: '24 dk önce', read: false, icon: 'users' },
    { id: 'n2', title: 'Talep için yeni bir yanıt var', detail: 'Atakent servis talebini incele', time: 'Dün, 16.42', read: false, icon: 'message' },
    { id: 'n3', title: 'Talebin yeniden açıldı', detail: 'Marmara Işık İlkokulu · Acıbadem', time: '2 gün önce', read: true, icon: 'refresh' },
    { id: 'n4', title: 'Geri bildirimini paylaşabilirsin', detail: 'Bir talep için çözüm durumu bekleniyor', time: '5 gün önce', read: true, icon: 'check' },
  ],
  operator: [
    { id: 'n5', title: 'Profil bilgilerini tamamla', detail: 'İletişim ve hizmet kapsamını gözden geçir', time: '1 saat önce', read: false, icon: 'profile' },
    { id: 'n6', title: 'Yeni bir servis talebi paylaşıldı', detail: 'Ufuk Çocuk Akademisi · Koşuyolu', time: 'Dün, 09.30', read: false, icon: 'route' },
    { id: 'n7', title: 'Okul kapsamın güncellendi', detail: 'Marmara Işık İlkokulu', time: '3 gün önce', read: true, icon: 'school' },
  ],
  admin: [
    { id: 'n8', title: 'Yeni bir içerik bildirimi var', detail: 'Talep yorumu · DM-244', time: '18 dk önce', read: false, icon: 'flag' },
    { id: 'n9', title: 'Tarife sürümü için kontrol gerekiyor', detail: 'UKOME 2026–27 · taslak değişikliği', time: '2 saat önce', read: false, icon: 'file' },
    { id: 'n10', title: 'Bir okul kaydı güncellendi', detail: 'Ufuk Çocuk Akademisi', time: 'Dün, 12.11', read: true, icon: 'school' },
  ],
};

export const formatTL = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);
