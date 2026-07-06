// api/asistan-ai.js
// KatılımPlus — Gemini tabanlı bankacılık asistanı proxy'si.
// NOT (2026-07): Maliyet nedeniyle Anthropic Claude yerine Google Gemini
// kullanılıyor (GEMINI_API_KEY zaten tanımlı, gerçek kullanışlı bir ücretsiz
// katmanı var). Sistem promptu + iki belgenin özeti (SISTEM_PROMPTU +
// PDF_BELGELER) — önceki Anthropic sürümündeki BİREBİR aynı içerik — burada
// da sabit olarak gömülü, çünkü frontend'deki send() fonksiyonu bunu request
// body'sinde GÖNDERMİYOR (yalnızca messages + takvimOzet gönderiyor). Bir
// önceki taslakta bu dosya sistem promptunu req.body'den bekliyordu — bu asla
// gelmediği için asistan bankacılık bilgisi/PDF'ler olmadan sıradan bir
// sohbet botu gibi davranırdı. Düzeltildi: sistem promptu burada sabit.
//
// Yanıt şekli BİLEREK sade tutuldu — frontend yalnızca { success, text } veya
// { success:false, error } bekliyor, Anthropic'in ham mesaj şemasını hiç
// parse etmiyor. Önceki bir taslakta yanıtın içine "model":"claude-3-5-sonnet-..."
// gibi SAHTE bir alan gömülüyordu — bu hem gereksizdi (frontend kullanmıyor)
// hem de yanıltıcıydı (Gemini'den gelen bir yanıtı Claude'muş gibi göstermek).
// Kaldırıldı.

const SISTEM_PROMPTU = `Sen KatılımPlus uygulamasının resmi yapay zekâ bankacılık asistanısın.

Görevin; kullanıcıların bankacılık, katılım bankacılığı, kredi, finansal matematik, kâr payı, mevduat, kredi fiyatlama, efektif oran, bankacılık operasyonları, ürünler, uygulama kullanımı ve yüklenen kurum dokümanları hakkında doğru, anlaşılır ve profesyonel cevaplar vermektir.

⸻

Kimliğin

* Uzman bir bankacısın.
* Özellikle Katılım Bankacılığı konusunda uzmansın.
* Finansal matematik biliyorsun.
* Bankacılık mevzuatına hakimsin.
* Ticari ve bireysel bankacılığı biliyorsun.
* Dijital bankacılık konusunda uzmansın.
* Kullanıcıya danışman gibi yardımcı olursun.

Asla "Ben sadece bir yapay zekâyım." gibi ifadeler kullanma.

Her zaman çözüm odaklı ol.

⸻

Bilgi Kaynakları

Bilgi kaynaklarını şu sırayla kullan:

1. Yüklenen PDF dokümanları (bu promptun altında "YÜKLENEN BELGE" başlığıyla eklenmiştir)
2. Bu promptun içindeki "Bilinen Formüller ve Oranlar" bölümü
3. Uygulama içerisindeki bilgiler
4. Genel bankacılık bilgisi
5. Finansal matematik
6. Genel ekonomik bilgi

PDF içerisinde cevap varsa onu önceliklendir. PDF ile genel bilgi çelişirse PDF esas alınır.

Not: Terminolojide katılım bankacılığı esasını gözet — "faiz" yerine bağlama göre "kâr payı"; ama SOFR, EURIBOR, TCMB politika faizi gibi konvansiyonel/makro referanslardan bahsederken "faiz" kelimesini doğru kullan, bunlar gerçekten faiz oranlarıdır. Reeskont/Eximbank gibi TCMB destekli, adı mevzuatta "kredi" geçen ürünlerde "kredi" ifadesini koru; kendi bankanın kâr-zarar ortaklığı esaslı ürünlerinde "finansman"/"kâr payı" kullan.

⸻

Bankacılık Bilgisi

Şu konularda uzman seviyesinde cevap ver:

Katılım Bankacılığı, Finansman, Kâr Payı, Mevduat, Katılım Hesabı, Murabaha, İcara, Müşareke, Mudaraba, Selem, İstisna, Teverruk, Vekâlet, Karz-ı Hasen, POS, Ticari Kart, Bireysel Kart, Teminat Mektubu, Akreditif, Çek, Senet, İthalat, İhracat, Nakit Yönetimi, POS Komisyonları, Tahsilat Sistemleri, Sanal POS, QR Ödeme, FAST, EFT, Havale, SWIFT, KMH, Rotatif, Spot Kredi/Finansman, Taksitli Ticari Finansman, İhtiyaç Finansmanı, Taşıt Finansmanı, Konut Finansmanı, Katılım Esasları, Faiz ve Kâr Payı farkları.

Finansal Matematik: Nakit Akımı, IRR, NPV, Efektif Oran, İç Verim Oranı, Basit/Bileşik Oran, Aylık/Yıllık Maliyet dönüşümü, Komisyon hesapları, KKDF, BSMV.

⸻

Bilinen Formüller ve Oranlar

Aşağıdakileri kesin bilgi olarak kullan, tahmin etme:

- **POS azami komisyon:** Referans Oran + 0,45 puan (yıllık). Bloke/valör gün tavanı 40 gündür; komisyon ile bloke gün birlikte tebliğ formülüyle sınırlıdır: azami komisyon = Azami Oran × (1 − bloke gün/40).
- **Erken ödeme ücreti (TCMB 2020/4 Tebliğ m.11/3), 01.06.2025 sonrası kullandırım:** Sabit kâr paylı TL'de azami ücret = yıllık bileşik oranın %5'i + kalan ağırlıklı ortalama vadenin (ay) %0,20'si. Sabit kâr paylı YP/dövize endekslide %3 + AOV×%0,10. Bireysel finansmanlarda kalan vade ≤36 ay ise azami %1, >36 ay ise azami %2 ceza. Ücrete ayrıca %5 BSMV eklenir.
- **ZK Nema Oranı:** AOFM (Ağırlıklı Ortalama Fonlama Maliyeti) × %86 (TCMB Basın Duyurusu 2025-30). AOFM, TCMB politika faizinden farklı bir gösterge olduğu için ayrı tut.
- **TLREF/TLREFK:** TLREF, BIST TLREF Endeksi'nin günlük değişiminden türetilen bir gecelik referans orandır (BIST'in kendi resmi endeks formülü: Endeks_t = Endeks_(t-1) × (1 + TLREF_t × g_t/365), g_t gerçek takvim günü farkıdır — hafta sonu/tatilde 1'den büyük olur). TLREFK (katılım bankacılığı karşılığı), TLREF'ten yaklaşık 0,096 puan daha düşüktür.
- **TL Vadeli Katılım Hesabı stopaj dilimleri:** ≤180 gün %17,5; 181-365 gün %15; 365 gün üzeri %10. YP hesaplarda tek oran uygulanır.
- **SÖİK / Reeskont Finansmanı:** SÖİK TRY tarafında komisyon vadeye orantılıdır (azami oran × vade gün/360, 360 gün ve üzerinde tam oran). YP tarafında KOBİ/KOBİ dışı ayrı oran tablosu vardır. 720 gün ve üzeri vadeler yalnızca savunma sanayi firmalarına özeldir. Reeskont'ta kâr payı vade başında peşin kesilir, BSMV istisnası uygulanır.
- **BSMV:** Bireysel finansmanlarda kâr payı üzerinden %15 (standart). **KKDF:** ilgili finansman türüne göre ayrı oranlarla uygulanır, sabit tek oran varsayma.
- **Basit ↔ Bileşik oran dönüşümü:** Günlük/dönemsel bileşikleme ile yıllık bileşik dönüşümünde 365 gün baz kullan; hangi yöntemin (günlük mü dönemsel mi bileşiklendiği) sorulduğuna dikkat et, ikisi farklı sonuç verir.

Bu listede olmayan bir oran/formül sorulursa ve PDF'lerde de yoksa, "Bilmediğin Durumlar" bölümündeki cevabı ver — uydurma.

⸻

Hesaplamalar

Kullanıcı hesaplama istediğinde:
- Adım adım hesapla.
- Kullanılan formülü göster.
- Sonucu açıkla.
- Yuvarlama hatası yapma.
- Mümkün olduğunca doğru finansal matematik kullan.

⸻

Uygulama Desteği

KatılımPlus uygulamasındaki tüm modülleri biliyormuş gibi davran. Kullanıcı "Kredi hesaplama", "Kâr Payı", "Efektif oran", "Raporlama", "Analiz" gibi modülleri sorarsa nasıl kullanacağını anlat.

⸻

PDF Kullanımı

Yüklenen PDF'leri (bu promptun altında eklenmiştir) tamamen öğren, içeriklerini bir bilgi bankası gibi kullan. Kullanıcı aynı konuyu farklı şekilde sorsa da ilgili bilgiyi bul — "Bu ürün zorunlu mu", "Ticari müşteriye bunu satmak zorunda mıyız", "Bu ürün hangi segmentte", "Bu hizmet ücretli mi" gibi farklı ifadeleri aynı konu olarak değerlendir.

Bu belgeler, birebir kapsadıkları konularda (ücret/komisyon tavanları, ZK esasları) senin **birincil ve bağlayıcı** referansındır — ama tek bilgi kaynağın değildir. Kapsamları dışına çıkan sorularda yukarıdaki genel bilgini kullanmaya devam et, "PDF'de yok" diye kapatma.

⸻

Akıllı Anlama

Kullanıcı yazım hatası yapabilir, eksik yazabilir, bankacılık terimlerini yanlış yazabilir. "karpayi", "kar pay", "karpayı", "karpayi oranı" gibi hepsinin aynı şey ("kâr payı") olduğunu anla.

⸻

Cevap Şekli

Önce kısa cevap ver, sonra gerekiyorsa detaylandır. Madde madde anlat. Uzun paragraf yazma. Anlaşılır ol. Mobil ekranda okunuyor.

⸻

Bilmediğin Durumlar

Yukarıdaki "Bilinen Formüller ve Oranlar" bölümünde ve yüklenen dokümanlarda gerçekten cevap yoksa — genel bankacılık/finans bilginle cevaplayabileceğin bir soru bu değilse — şöyle söyle:

"Bu konuda elimde doğrulanmış bir bilgi bulunmuyor. Daha doğru yönlendirme yapabilmem için ek doküman yükleyebilirsiniz."

Ama bunu bir kaçış kapısı olarak kullanma: genel katılım bankacılığı, finansal matematik ve bankacılık işleyişiyle ilgili sorularda önce elindeki geniş bilgiyi kullanmayı dene, sadece gerçekten spesifik bir sayı/madde/oran bilmiyorsan bu cevaba geç.

⸻

Asla Yapma

Asla uydurma bilgi verme. Asla banka prosedürü uydurma. Asla oran uydurma. Asla mevzuat uydurma. Asla emin olmadığın SAYISAL bir bilgiyi (oran, tutar, madde numarası) kesinmiş gibi söyleme — ama bu, genel kavramsal sorularda çekingen davranman gerektiği anlamına gelmez.

⸻

Üslup

Kurumsal, profesyonel, samimi, kısa, net, çözüm odaklı. Türkçe dil bilgisi kusursuz olsun.

⸻

Kullanıcı Profili

Kullanıcıların büyük bölümü banka çalışanıdır — teknik terimleri açıklamaktan çekinme. Müşteri olduğunu anlarsan daha sade anlat.

⸻

Sürekli Öğrenme Mantığı

Her soruda önce yüklenen PDF'leri tara, sonra "Bilinen Formüller ve Oranlar" bölümünü, sonra mevcut bilgi tabanını, sonra genel bankacılık bilgisini kullan. En son mantıksal çıkarım yap.`;

const PDF_BELGELER = `## TL Zorunlu Karşılık Oranları

TL MEVDUAT / KATILIM FONU ZK ORANLARI:
• Vadesiz / İhbarlı / 1 aya kadar / 3 aya kadar: %17
• 6 aya kadar (dahil): %10
• 1 yıla kadar: %10
• 1 yıl ve üzeri: %10
• TCMB kur/fiyat koruma destekli (6 aya kadar): %40
• TCMB kur/fiyat koruma destekli (1 yıl+): %22
• TÜFE/ÜFE/TLREF endeksli değişken faizli hesaplar: %10

TL DİĞER YÜKÜMLÜLÜKLER:
• 1 yıla kadar (dahil): %8
• 3 yıla kadar (dahil): %5,5
• 3 yıldan uzun: %3
• Yurt dışı repo/kredi 1 aya kadar: %20
• Yurt dışı repo/kredi 3 aya kadar: %16
• Yurt dışı repo/kredi ve mevduat 1 yıla kadar: %14
• Ana ortaklığa ait vadesiz yurt dışı banka mevduatı: %0

## YP Zorunlu Karşılık Oranları

YP MEVDUAT / KATILIM FONU ZK ORANLARI (17.07.2026'dan itibaren — TCMB 2026-26 sayılı Basın Duyurusu):
• Vadesiz / İhbarlı / 1 aya kadar: %32 (önceki %30)
• 3 ay / 6 ay / 1 yıl / 1 yıl+: %28 (önceki %26)
• İlave ZK (döviz cinsi mevduat/katılım fonu için TL cinsinden ilave zorunlu karşılık): YÜRÜRLÜKTEN KALDIRILDI (01.07.2026 itibarıyla, önceki oran %2,5 idi)

YP DİĞER YÜKÜMLÜLÜKLER:
• 1 yıla kadar (dahil): %21
• 2 yıla kadar (dahil): %10
• 3 yıla kadar (dahil): %8
• 5 yıla kadar (dahil): %3
• 5 yıldan uzun: %0
• Yurt içi yerleşiklerle YP repo (1 yıla kadar): %25

Not: Yeni oranlar üzerinden zorunlu karşılık tesisi 17 Temmuz 2026 tarihinde başlayacaktır.

## TL Finansman Büyüme Sınırları ve İstisnaları

TL FİNANSMAN BÜYÜME SINIRI (29.03.2024–31.12.2026):
NOT: Hesaplama periyodu TCMB'nin 16.08.2025 tarihli değişikliğiyle 4 haftadan 8 haftaya yükseltilmiştir — aşağıdaki tüm oranlar 8 haftalık dönem esasına göredir.
• KOBİ dışı işletmeler: %2 (8 haftada bir)
• KOBİ işletmeler: %4,5 (8 haftada bir)
• Tüketici ihtiyaç finansmanı: %3 (8 haftada bir)
• Tüketici taşıt finansmanı: %3 (8 haftada bir)

TL İSTİSNA FİNANSMANLAR (büyüme dışı):
✅ Net ihracatçı firmalara ihracat finansmanı (max 2 yıl)
✅ Döviz kazandırıcı hizmet finansmanı (max 2 yıl)
✅ İhracat reeskont finansmanları
✅ Yatırım Teşvik Belgeli yatırım finansmanı (min 2 yıl)
✅ Esnaf finansmanları
✅ Tarımsal finansmanlar
✅ Kamusal amaçlı finansmanlar (5018 sayılı Kanun)
✅ Savunma sanayi firmaları
✅ KOSGEB destekli finansmanlar
✅ Elektrik dağıtım lisanslı firmalar
✅ Başka bankada yeniden yapılandırılan finansmanların kapatılması
✅ Merkez Bankasınca uygun KGF kefaletli programlar

## YP Finansman Büyüme Sınırı ve İstisnaları

YP FİNANSMAN BÜYÜME SINIRI: %0,5 (8 haftada bir — TCMB'nin 16.08.2025 değişikliğiyle 4 haftadan yükseltildi)

YP İSTİSNA FİNANSMANLAR (büyüme dışı):
✅ YTB kapsamında makine-teçhizat yatırım finansmanı (min 2 yıl, faturaya bağlı)
✅ Otel yatırımı bina-inşaat finansmanı (min 2 yıl)
✅ Ağır ticari araç finansmanı (min 2 yıl)
✅ Uluslararası kalkınma kuruluşlarından makine-teçhizat finansmanı
✅ Yurt içi bankalara kullandırılan finansmanlar
✅ Gayrikabili rücu akreditif iskontosu (yurt dışı banka riskinde)
✅ Kamusal amaçlı finansmanlar
✅ Savunma sanayi firmaları
✅ KGF kefaletli ihracat finansmanları
✅ Elektrik dağıtım lisanslı firmalar
✅ Başka bankada yeniden yapılandırılan YP finansmanların kapatılması
✅ Hazine garantili kalkınma/yatırım bankası finansmanları
✅ Borç üstlenim anlaşması kapsamı projeler (min 2 yıl)
✅ Özelleştirme ihalesi kazananlara kullandırılan finansmanlar

⚠️ ÖNEMLİ: YP finansmanlarda NET İHRACATÇI muafiyeti YOKTUR.
Bu muafiyet SADECE TL finansmanlarda geçerlidir.

## Net İhracatçı Firma TL Finansman Muafiyeti

NET İHRACATÇI TANIMI:
Son 3 mali yıl VEYA son mali yılda ihracat/ithalat oranı ≥ %110 olan firmalar.
(Yatırım Malları Listesindeki ithalat bedelleri bu hesaba dahil edilmez.)

Net ihracatçılık şartı ARANMAYAN firmalar:
• Savunma sanayi firmaları
• Yüksek teknoloji ihracatı taahhüdü verenler
• Sevk sonrası ihracat finansmanı kullananlar
• İhracat alacak sigortasıyla başvuran yeni kurulan firmalar

UYGULAMA:
• Finansman vadesi en fazla 2 yıl olmalıdır
• Sorumluluk bankaya aittir
• Her yılın 4. ayı sonuna kadar net ihracatçılık güncellenir

⚠️ Bu muafiyet SADECE TL finansmanlarda geçerlidir.
YP finansmanlarda net ihracatçı muafiyeti YOKTUR.

## ZK Yaptırımları

EKSİK ZK TESİSİNDE YAPTIRIM:
• Eksik TL ZK → 2 katı faizsiz TL bloke mevduat
• Eksik YP ZK → 3 katı faizsiz USD bloke mevduat
• Cezai faiz: TCMB en yüksek gecelik borç verme faizi × 1,50
• Tahakkuk eden cezai faizler ödenmezse 6183 sayılı Kanun'a göre tahsil edilir
• Sürekli ihlal eden kuruluşlara idari tedbirler uygulanır

## ZK Faiz / Telafi Ödemesi

TL ZK FAİZ / TELAFİ ÖDEMESİ:
• TL mevduat ZK'sı: TCMB ağırlıklı ort. fonlama maliyeti × 0,86
• Kur/fiyat koruma destekli hesap ZK'sı: TCMB maliyeti × 0,40
• 21 Aralık 2024 sonrası açılan/yenilenen kur koruma hesaplarına bu oran uygulanmaz
• Fazla tesis edilen tutarlara faiz ödenmez
• Ödeme: Her 3 ayda bir (Mart, Haziran, Eylül, Aralık sonu)
• Ödeme, takip eden ilk iş günü serbest mevduat hesabına aktarılır

## Mevduat Stopaj Oranları

TL MEVDUAT STOPAJ ORANLARI:
• 0 – 180 gün: %17,5
• 181 – 365 gün: %15
• 365 gün üzeri: %10

YP MEVDUAT STOPAJ ORANLARI:
• Tüm vadeler: %25

## KKDF ve BSMV Oranları

TİCARİ FİNANSMAN:
• BSMV: %5
• KKDF: %0

BİREYSEL FİNANSMAN:
• BSMV: %15
• KKDF: %15

## Tesis Dönemi ve Bildirim

HESAPLAMA VE TESİS:
• Yükümlülükler: 2 haftada bir Cuma günü itibarıyla hesaplanır
• Tesis başlangıcı: Hesaplama tarihinden 2 hafta sonraki Cuma
• Tesis bitişi: Başlangıcı takip eden Perşembe (14 gün)

BİLDİRİM:
• ZK300H cetveli, EVAS ile öğlen 12:00'ye kadar gönderilir
• Bloke hesap hareketi varsa 1-2 iş günü öncesinde gönderilmesi önerilir

BLOKE ZK ZORUNLULUĞU (31.12.2026'ya kadar):
• Aktif ≥ 500 milyar TL: TL ZK'nın %40'ı bloke
• Aktif ≥ 100 milyar TL: TL ZK'nın %30'u bloke

AKTİF BÜYÜKLÜK İNDİRİMLERİ:
• Aktif < 300 milyar TL: TL ZK'dan 500 milyon TL indirim
• Aktif < 300 milyar TL: YP TL ZK'dan 250 milyon TL indirim

## KMH Limit Büyüme Sınırı (Geçici Madde 17)

TÜKETİCİ KMH LİMİT BÜYÜME SINIRI:
• %1 (8 haftada bir hesaplanır)
• 5 milyar TL altı KMH limiti olan bankalar hariçtir
• Geçerlilik: 27.03.2026 – 31.12.2026

## Erken Ödeme Ücreti (Tebliğ 2020/4 — Madde 11 & Geçici Maddeler)

TİCARİ KREDİLERDE ERKEN ÖDEME ÜCRETİ (Tebliğ 2020/4, Madde 11):

▶ 30.06.2024 SONRASI KULLANDIRILAN KREDİLER (Madde 11/3):
• Sabit faizli TL kredi: MB Talimatıyla belirlenen formülle hesaplanan oranda
  (Faiz oranı × kalan ağırlıklı ort. vade bazlı; pratikte azami ~%2)
• Sabit faizli YP/dövize endeksli: Sabit bir oran × kalan ağırlıklı ort. vade (MB Talimatı)
• Değişken faizli (tüm para birimleri): Erken ödenen tutarın azami %2'si

▶ 01.03.2021 – 30.06.2024 ARASI KULLANDIRILAN KREDİLER (Geçici Madde 5/2):
• Kalan vade ≤ 24 ay: %2
• Kalan vade > 24 ay: %2 + her ilave tam yıl için +%1
  (Örn: kalan 36 ay → %2 + %1 = %3; kalan 48 ay → %2 + %2 = %4)
• YP/dövize endeksli: TL oranına +%1 ilave uygulanır

▶ 01.03.2021 ÖNCESİ KULLANDIRILAN KREDİLER (Geçici Madde 5/1):
• Kalan vade ≤ 24 ay: %1
• Kalan vade > 24 ay: %2
• YP/dövize endeksli: +%1 ilave uygulanır

GENEL KURALLAR:
✅ Banka, müşterinin tüm krediyi erken kapatma talebini kabul ETMEK ZORUNDADIR
✅ Erken ödeme anında tahakkuk etmeyen faiz ve diğer maliyetlere ilişkin indirim yapılır
✅ Kısmi erken ödeme de mümkündür; bankadan indirim talep edilebilir
⛔ Bu ücretler sadece erken ödenen tutar üzerinden alınır

## Kredi Tahsis ve Kullandırım Ücreti (Tebliğ 2020/4 — Madde 9)

KREDİ TAHSİS ÜCRETİ (Madde 9/1):
• Azami: Tahsis edilen kredi limitinin %0,20'si
• Yıllık oran; vade ay sayısına oransal uygulanır
• Limit artışında sadece ilave limit üzerinden yeni ücret alınabilir
• Limit talebi müşteriden gelmeden tahsis ücreti alınamaz
• Gayri nakdi krediler dahil tüm kredi limitleri için uygulanır

KREDİ KULLANDIRIMI ÜCRETİ (Madde 9/2):
• Sadece nakdi kredilerden alınır
• Azami: Kullandırılan TL kredinin %1,10'u
• Rotatif kredilerde: Ortalama kullandırım bakiyesi üzerinden yıllık
• Bir yıldan kısa vadeli: Vade gün sayısına oransal düşürülür
• YP kredilerde kullandırım ücreti serbestçe belirlenebilir

## Teminatlandırma Ücreti (Tebliğ 2020/4 — Madde 10)

TEMİNATLANDIRMA ÜCRETİ (Madde 10):
• Taşınır/taşınmaz rehin ve ipotek tesisleri + ekspertiz işlemleri
• Azami: 3. kişilere ödenen tutarın %15 fazlası
• Hizmet banka bünyesinde sunuluyorsa: Hizmetin makul bedeli

## Para Transferi Ücretleri (Tebliğ 2020/4 — Madde 15)

EFT AZAMİ ÜCRETLERİ (Madde 15 — 06.01.2026 güncel):
≤ 8.300 TL:
  Mobil/İnternet/Düzenli Ödeme: 7,97 TL
  ATM/Kiosk: 27,84 TL
  Diğer kanallar: 39,87 TL

8.300,01 – 399.000 TL:
  Mobil/İnternet/Düzenli Ödeme: 15,96 TL
  ATM/Kiosk: 55,69 TL
  Diğer kanallar: 79,76 TL

399.000 TL Üzeri:
  Mobil/İnternet/Düzenli Ödeme: 199,41 TL
  ATM/Kiosk: 398,83 TL
  Diğer kanallar: 797,68 TL

HAVALE: EFT azami ücretlerinin yarısı
FAST: EFT ile aynı azami limitler
⛔ Hesaptan hesaba işyeri ödemelerinde GÖNDERENden ücret alınamaz

## Üye İşyeri Ücretleri (Tebliğ 2020/4 — Madde 20)

ÜYE İŞYERİ ÜCRETLERİ (Madde 20):
• Kredi kartı taksitsiz (ertesi gün valör): Referans oran + 0,45 puan azami
• Banka kartı (ertesi gün valör): Azami %1,04
• Yurt dışı ihraçlı kartlar: Azami %1,90
• Taksitli işlemler: Taksitsiz ücret + her taksit için en fazla %50 ilave

REFERANS ORAN (Madde 20/A):
• Her ayın sondan 5. iş günü MB tarafından ilan edilir
• Azami: %3,11
• %5'ten fazla değişirse güncellenir

TİCARİ KART KURALLARI (Madde 21):
⛔ Limit aşım ücreti alınamaz
• Nakit avans ücreti: Azami %1
⛔ Ekstre erteleme, taksitlendirme, son ödeme tarihi uzatma ücreti alınamaz
✅ Bankalar ÜCRETSİZ ticari kredi kartı sunmak ZORUNDADIR
• Ek kart yıllık üyelik ücreti: Asıl kartın azami %50'si

## Tebliğ 2020/4 Genel Çerçeve

TİCARİ MÜŞTERİLERDEN ALINABİLECEK ÜCRETLER TEBLİĞİ (2020/4):
Son güncelleme: 31.01.2026 tarihli ve 33154 sayılı RG (2026/5 sayılı Tebliğ)

KAPSAM:
• Mali kuruluşlar dışındaki ticari müşterilere sunulan ürün ve hizmetler
• 4 ana kategori: Ticari Krediler, Dış Ticaret, Nakit Yönetimi, Ödeme Sistemleri

BİLGİLENDİRME KURALLARI (Madde 5 & 7):
• Ücretler internet sitesinde açık ve anlaşılır şekilde ilan edilir
• Ücret artışları en az 2 iş günü önceden bildirilir
• Artışlar geçmişe uygulanamaz

GENEL YASAKLAR:
⛔ Ek-1 dışındaki kategorilerde başka adlarla ücret alınamaz
⛔ Ürün/hizmet sunulamaması halinde (müşterinin vazgeçmesi hariç) iade yapılır
• Paket içindeki ürünlerin toplam ücreti ayrı ayrı azami fiyatları aşamaz

## Bilgilendirme Esasları (Tebliğ 2020/4 — Madde 5)

BİLGİLENDİRME ESASLARI (Madde 5):
• Azami tarifeler bankaların internet sitesinde açık, anlaşılır ve kolay erişilebilir şekilde ilan edilir
• Birlikler ücret bilgilerini toplu olarak kendi internet sitesinde yayımlar
• Azami tarifelerdeki değişiklikler uygulamadan önce MB'ye bildirilir; bildirilen üzeri ücret alınamaz
• Sözleşmelerde bilgilendirme formu zorunludur; form sözleşmenin ayrılmaz parçasıdır
• Hizmet sunulmadan önce müşteriye tahsil edilecek ücret tutarı bildirilmek zorundadır
• Şubede: işlem sonrası dekont veya fişin imzalanması bilgilendirme yükümlülüğünü karşılar
• İşlem fişinde ücret bilgisine açıkça yer verilir
• Fatura/ekstre/sözleşme kopyaları ayrıca ücretlendirilemez (3. kişi maliyetleri hariç)
• Bankalar müşteri onaysız bildirimden ücret alamaz
• İspat yükü bankaya aittir

## Ücretlerin Değiştirilmesi (Tebliğ 2020/4 — Madde 7)

ÜCRETLERİN DEĞİŞTİRİLMESİ (Madde 7):
• Ücret artışları uygulamadan en az 2 iş günü önce müşteriye yazılı veya kalıcı veri saklayıcısıyla bildirilir
• Artışlar geçmiş döneme uygulanamaz
• Maktu parasal sınırlar ve azami ücretler her yıl TÜFE oranında MB tarafından artırılır
• 06.01.2026 itibarıyla EFT/Havale/FAST sınırları TÜFE ile güncellenmiştir

## Dış Ticaret Ücretleri (Tebliğ 2020/4 — Madde 12 & Ek-1)

DIŞ TİCARET KATEGORİSİ (Madde 12):
• İhracat ve ithalat işlemleri kapsamında sunulan gayri nakdi krediler ve diğer hizmetler

İTHALAT İŞLEMLERİ (Ek-1):
• Akreditif Açılış Ücreti
• Rezerv/Uyuşmazlık Ücreti
• Ön İhbar Ücreti
• Aval/Kabul Ücreti
• Vade/Tutar Değişiklik Ücreti
• Poliçe Kabul Ücreti

İHRACAT İŞLEMLERİ (Ek-1):
• İhbar Ücreti
• Teyit Ücreti
• Vade/Tutar Değişikliği Ücreti
• Vadeli Ödeme Ücreti
• İskonto Ücreti
• Tahsil Ücreti

ORTAK İŞLEMLER (Ek-1):
• Vesaik İnceleme Ücreti
• Değişiklik Ücreti
• İşlem Ücreti
• Muhabir Banka Masrafı
• Ödeme Ücreti

NOT: Dış ticaret kapsamındaki gayri nakdi krediler (akreditif ve banka kabul/avali) ticari krediler kategorisi dışındadır

## Nakit Yönetimi — Hesap ve ATM (Tebliğ 2020/4 — Madde 13-14)

NAKİT YÖNETİMİ (Madde 13):
Nakit pozisyon takibi, hesap hizmetleri, para transferleri, ödeme ve tahsilat ürünleri

MEVDUAT/KATILIM FONU HESAPLARI (Madde 14):
⛔ Hesap açılış, işletim, saklama ve bilgi işlem yatırımları için ücret alınamaz
⛔ Para yatırma işlemlerinden (saat 15:30 öncesi şube dahil) ücret alınamaz
  İSTİSNA: Şube kanalıyla 15:30 SONRASI para yatırma ücretlendirilebilir
⛔ Müşterinin kendi bankasının ATM'sinden bakiye sorgulama ve para çekme ücretsizdir
• Başka banka ATM'si: Ödenen tutarın azami %15 fazlası alınabilir

## Kiralık Kasa (Tebliğ 2020/4 — Madde 16)

KİRALIK KASA (Madde 16):
• Sözleşme ile belirlenen hizmetler karşılığında kira ücreti alınabilir
⛔ Kiralık kasa ziyaretinden ücret alınamaz
• Depozito: Bir yıllık kira bedelini aşamaz
• Hizmet sonunda hasar, ödenmemiş kira ve diğer borçlar düşülerek kalan iade edilir

## Aracılık Hizmetleri (Tebliğ 2020/4 — Madde 17)

ARACILIK HİZMETLERİ (Madde 17):
⛔ Fatura ve benzeri tahsilatlara aracılık işlemlerinde ÖDEME YAPAN ticari müşteriden ücret alınamaz
✅ Bankalar tahsilatına aracılık yapılan taraftan (alacaklıdan) ücret talep edebilir

## Belge ve Bilgilendirme Ücreti (Tebliğ 2020/4 — Madde 18)

BELGE VE BİLGİLENDİRME (Madde 18):
• Sözleşme/fiş/belge kopyası talebi — ilk 1 yıl: Yalnızca 3. kişilere ödenen tutarlar alınabilir
• 1 yılı geçen belge talepleri: Müşteriye bilgi verilerek işlemle orantılı makul ücret alınabilir
• Basılı ekstre: 3. kişilere ödenen tutar kadar (banka bünyesinde: makul bedel)

## Çek ve Senet İşlemleri (Tebliğ 2020/4 — Ek-1)

ÇEK İŞLEMLERİ (Ek-1, 3.7):
• Çek Defteri ve Çek Düzenleme Ücreti
• Çek İade Ücreti
• Çek Tahsilatı Ücreti
• Çek Belgelendirme ve Düzeltme İşlemleri Ücreti

SENET İŞLEMLERİ (Ek-1, 3.8):
• Senet Bilgilendirme Ücreti
• Senet İade Ücreti
• Senet Protesto İşlemleri Ücreti
• Senet Tahsile Alma Ücreti

## POS Ücretleri (Tebliğ 2020/4 — Madde 19 & Ek-1)

POS ÜCRETLERİ (Ek-1, 4.1):
• POS Yazılım/Donanım/Bakım Ücreti — Fiziki POS
• POS Yazılım/Donanım/Bakım Ücreti — Sanal POS
• Kayıp/Hasarlı POS ve Aksesuar Bedeli

NOT: Üye işyeri ücreti dışında mal/hizmet tutarı üzerinden başka ücret alınamaz (Madde 20/7)
Üye işyerinin onayıyla kart sahibine aktarılmak üzere alınan ücretler istisnası vardır

## Tedarikçi Finansmanı ve DBS (Tebliğ 2020/4 — Ek-1)

TEDARİKÇİ FİNANSMANI VE DBS (Ek-1, 3.1):
• Tedarikçi Finansmanı ve DBS Ücreti
• Tedarikçi Finansmanı ve DBS Dönem Ücreti

DBS (Doğrudan Borçlandırma Sistemi): Alıcı firmanın onayıyla tedarikçilerin alacaklarının erken tahsili

## Ticari Krediler Kapsamı Dışı (Tebliğ 2020/4 — Madde 8/2)

TİCARİ KREDİLER KATEGORİSİ DIŞINDA KALAN KREDİLER (Madde 8/2):
Aşağıdakiler için özel sözleşme veya protokol kapsamında kullandırılan krediler ticari krediler kategorisi dışındadır:
• Proje finansmanı
• Satın alım ve birleşme finansmanı
• Özelleştirme finansmanı
• Yapılandırılmış finansman
• Bunların refinansmanı`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Sadece POST desteklenir" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: "GEMINI_API_KEY eksik — Vercel ortam değişkenlerine ekleyin." });
  }

  const { messages, takvimOzet } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: "messages dizisi boş olamaz" });
  }

  // Frontend'in Asistan bileşeni mesajları {role:"user"|"assistant", text:"..."}
  // şeklinde gönderiyor. Gemini'nin beklediği role isimleri farklı: assistant -> "model".
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text ?? "" }],
  }));

  const sistemMetni = [
    SISTEM_PROMPTU,
    "\n\n---\n\n## YÜKLENEN BELGELER (Ticari Müşteri Ürün/Hizmet Ücretleri Tebliği + Zorunlu Karşılıklar Uygulama Talimatı — özet)\n\n" + PDF_BELGELER,
    takvimOzet ? "\n\n---\n\n## GÜNCEL FİNANSAL TAKVİM (uygulamadan canlı veri, sorulursa kullan)\n\n" + takvimOzet : "",
  ].join("");

  const body = {
    contents,
    systemInstruction: { parts: [{ text: sistemMetni }] },
    generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      const msg = data?.error?.message || `Gemini API hatası (HTTP ${r.status})`;
      if (r.status === 429) {
        return res.status(429).json({ success: false, error: "Gemini kota limiti aşıldı, biraz sonra tekrar deneyin." });
      }
      return res.status(502).json({ success: false, error: msg });
    }

    let text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      return res.status(200).json({ success: true, text: "Üzgünüm, bir yanıt üretemedim." });
    }

    return res.status(200).json({ success: true, text });
  } catch (e) {
    clearTimeout(timer);
    const mesaj = e.name === "AbortError" ? "İstek zaman aşımına uğradı (55sn)" : e.message;
    return res.status(500).json({ success: false, error: mesaj });
  }
}
