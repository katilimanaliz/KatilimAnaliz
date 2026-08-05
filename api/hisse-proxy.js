import { Redis } from "@upstash/redis";

// NOT: Vercel KV entegrasyonu UPSTASH_* yerine KV_REST_API_* isimlerini
// kullanıyor; diğer api dosyalarındaki desenin aynısı, fallback'li.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Katılım Endeksi (XK100) etiketi için kullanılan liste. ÖNEMLİ KURAL:
// konvansiyonel (faizli) bankalar, konvansiyonel sigorta şirketleri ve alkol
// üretimi gibi yasak sektörler, TANIM GEREĞİ hiçbir katılım/faizsiz endekste
// yer alamaz — bu, İslami finans taramasının en temel/tartışmasız kuralıdır.
// Önceki listede bu kural yanlışlıkla ihlal edilmiş: Halkbank, Akbank, Garanti,
// VakıfBank, İşbank, Yapı Kredi, TSKB (hepsi faizli banka), Anadolu Sigorta ve
// Türkiye Sigorta (konvansiyonel/faizli sigorta), Anadolu Efes (bira/alkol
// üretimi) sehven eklenmişti — çıkarıldı. Albaraka Türk (ALBRK) gerçek bir
// katılım bankası olduğu için doğru şekilde listede kalıyor.
//
// 2026-07 GÜNCELLEMESİ: Kullanıcı geri bildirimiyle 4 büyük/tanınmış şirketin
// daha sehven listede olduğu tespit edildi — bunlar sektör yasağına değil,
// FİNANSAL KRİTERLERE (faizli iştirak/borç oranı) takılıyor, bu yüzden ilk
// bakışta "yasaklı sektör" listesiyle fark edilmiyordu:
//   - KCHOL (Koç Holding): bağlı ortaklığı Yapı Kredi Bankası (konvansiyonel
//     banka) nedeniyle KAP'ta yayınlanan KAFİF formuna göre XKTUM'da değil.
//   - SAHOL (Sabancı Holding): bağlı ortaklığı Akbank (konvansiyonel banka)
//     nedeniyle aynı şekilde endeks dışı.
//   - THYAO (Türk Hava Yolları): yüksek faizli borç oranı nedeniyle endekste
//     değil.
//   - TCELL (Turkcell): yüksek faizli borç oranı nedeniyle endekte değil.
// NOT: Bu şirketlerin kendi bağlı ortaklıkları (örn. SAHOL'a bağlı ENJSA,
// BRISA, TKNSA — hepsi ayrı işlem gören, kendi mali tablosu olan şirketler)
// bu kuraldan ETKİLENMİYOR, çünkü tarama her şirketin KENDİ konsolide mali
// tablosuna bakıyor — bu yüzden onlar listede kalmaya devam ediyor.
//
// NOT: Bu yine de elle tutulan/tahmini bir liste — resmi XK100 bileşen listesini
// gerçek zamanlı veren ücretsiz bir API yok (bkz. hisse-proxy.js'deki genel not).
// Üç ayda bir gerçek endeks bileşenleriyle karşılaştırılıp güncellenmelidir.
// 2026-07 GÜNCELLEMESİ 4: Kullanıcının açık isteğiyle liste, Kuveyt Türk
// Yatırım'ın katılım hisseleri sayfasıyla SIKI şekilde eşleştirildi — o
// sayfada bulunmayan 67 şirket çıkarıldı (aralarında daha önce başka
// kaynaklarla "uygun" olarak doğrulanmış MGROS, ULKER, ARCLK, PGSUS, TAVHL,
// SASA, TOASO, TTRAK, SISE gibi büyük şirketler de var — kullanıcı bunu
// bilerek onayladı). Bu Kuveyt Türk sayfası küçük/orta ölçekli ağırlıklı
// görünüyor; büyük şirketlerin de gerçekten güncel katılım listesinde olup
// olmadığı ayrıca resmi bir kaynakla teyit edilirse liste tekrar
// güncellenmelidir.
// ── KATILIM ENDEKSİ ÜYELİĞİ ────────────────────────────────────────────────
// 2026-07-28'e kadar bu liste ELLE yazılmış sabit bir Set'ti ve adı
// XK100_KODLARI idi. Canlı veriyle karşılaştırınca iki şey ortaya çıktı:
//
//   1) Liste aslında XK100 DEĞİL, XKTUM (BIST Katılım Tüm Endeksi) idi.
//      206 kaydın TAMAMI XKTUM'da çıktı; XK100'ün ise yalnızca 100 üyesi var.
//      Yani isimlendirme baştan yanlıştı.
//   2) Liste bayatlamıştı: XKTUM'a sonradan giren 35 hisse eksikti.
//      Neyse ki hata TEMKİNLİ yöndeydi — yanlış "uygun" gösterilen hisse
//      YOKTU, sadece uygun olan bazıları "değil" görünüyordu.
//
// Ayrım kullanıcı için kritik: XKTUM = katılım ilkelerine uygun TÜM hisseler
// ("bu hisse uygun mu" sorusunun cevabı). XK100/XK050/XK030 ise bunların
// büyüklük/likidite sıralamasıdır — uygunlukla ilgisi yoktur.
//
// Artık üyelik TradingView'dan canlı çekiliyor (fiyat verisiyle aynı kaynak,
// ek bağımlılık yok). Aşağıdaki sabit liste SİLİNMEDİ — en son güvenlik ağı
// olarak duruyor (bkz. katilimUyelikGetir'deki üç katmanlı düşüş).
const KATILIM_YEDEK_LISTE = new Set([
  "AAGYO","ACSEL","AHGAZ","AHSGY","AKFYE","AKHAN","ALBRK","ALCTL","ALFAS",
  "ALKA","ALKIM","ALKLC","ALTNY","ALVES","ARASE","ARDYZ","ARENA","ASELS",
  "ATAKP","ATATP","AVPGY","AYEN","BAHKM","BAKAB","BASGZ","BAYRK","BEGYO",
  "BERA","BESTE","BIENY","BIMAS","BINBN","BINHO","BORSK","BOSSA","BRISA",
  "BRKSN","BSOKE","BUCIM","BURCE","BURVA","BYDNR","CANTE","CATES","CELHA",
  "CEMTS","CEMZY","CIMSA","CMBTN","COSMO","CVKMD","CWENE","DAPGM","DARDL",
  "DCTTR","DENGE","DESPC","DGATE","DITAS","DMSAS","DNISI","DOFER","DOFRB",
  "DOGUB","DYOBY","EBEBK","EDIP","EFOR","EGGUB","EGPRO","EKGYO","EKSUN",
  "ENJSA","EREGL","ESCOM","EUPWR","EYGYO","FADE","FONET","FORMT","FORTE",
  "FZLGY","GEDZA","GENIL","GENKM","GENTS","GEREL","GESAN","GLRMK","GOKNR",
  "GOLTS","GOODY","GRSEL","GRTHO","GUBRF","GUNDG","HATSN","HKTM","HOROZ",
  "HRKET","IDGYO","IHEVA","IHLAS","IHLGM","IHYAY","IMASM","INGRM","INTEM",
  "ISDMR","IZFAS","JANTS","KARSN","KATMR","KBORU","KCAER","KLSER","KMPUR",
  "KNFRT","KOCMT","KONYA","KOPOL","KOTON","KRDMA","KRDMB","KRDMD","KRGYO",
  "KRONT","KRSTL","KRVGD","KTLEV","KUTPO","KZBGY","LKMNH","LMKDC","LOGO",
  "LXGYO","MAGEN","MARBL","MAVI","MCARD","MEGMT","MEKAG","MERKO","MOPAS",
  "MPARK","NETAS","NETCD","NTGAZ","OBAMS","ONCSM","ORGE","OSTIM","OZATD",
  "OZGYO","OZRDN","OZYSR","PAGYO","PARSN","PASEU","PENGD","PENTA","PETKM",
  "PKART","PNSUT","POLHO","PRKME","QUAGR","RALYH","RGYAS","RODRG","SAFKR",
  "SAMAT","SANEL","SANKO","SARKY","SAYAS","SDTTR","SEKUR","SELEC","SILVR",
  "SMART","SNGYO","SOKE","SRVGY","SURGY","TARKM","TKFEN","TKNSA","TMPOL",
  "TUCLK","TUKAS","TUPRS","TUREX","TURGG","UCAYM","UFUK","ULUSE","USAK",
  "VAKKO","VANGD","YATAS","YEOTK","YIGIT","YKSLN","YUNSA","ZERGY",
]);

// TradingView'ın "indexes" sütunu her hisse için üyesi olduğu endeksleri
// döndürüyor (bkz. proname: "BIST:XKTUM"). Bu sütun BÜYÜK veri getirdiği için
// fiyat isteğine EKLENMİYOR; ayrı ve seyrek (24 saatte bir) çekilip Redis'te
// tutuluyor. Endeks kompozisyonu üç ayda bir revize edildiği için bu fazlasıyla
// yeterli, üstelik Vercel CPU kotasını da korur.
const KV_KATILIM_KEY = "katilim:endeks:v1";
const KATILIM_TTL = 24 * 3600;

// ── ALARM İÇİN FİYAT ANLIK GÖRÜNTÜSÜ (2026-07-29) ──────────────────────────
// api/bildirim.js'deki BİST fiyat alarmları bu anahtarı okuyor.
//
// GEREKÇE: Alarm cron'u 10 dakikada bir çalışıyor. Önceki tasarımda bildirim.js
// bu uca HTTP ile istek atıyordu; CDN önbelleğiyle çakışmadığı her turda
// fonksiyonun TAM çalışmasını tetikliyordu (TradingView isteği + 615 kaydın
// normalize edilmesi). Kaba hesapla ayda ~1.600 fazladan çalışma, ~30-50 dakika
// CPU — aylık 4 saatlik kotanın beşte biri. Seans dışında ise tamamen boşa,
// çünkü fiyat değişmiyor.
//
// Artık hesaplanan fiyatlar burada Redis'e yazılıyor, bildirim.js doğrudan
// okuyor (altinapi:v3 deseninin aynısı). Yazma doğal olarak kısıtlı: bu
// fonksiyon yalnızca CDN önbelleği ıskalandığında çalışıyor.
//
// İçerik BİLEREK sade: yalnızca ticker→fiyat haritası + veri zamanı. Tam
// 615 kayıtlık yanıtı yazmak ~500 KB olurdu; bu hâli ~10 KB.
//
// ⚠️ Anahtar adı veya içerik şekli değişirse api/bildirim.js DE güncellenmeli.
const KV_HISSE_FIYAT_KEY = "hisse:fiyat:v1";
// TTL, tazeleme aralığından (en fazla 1 saat) belirgin şekilde uzun — kısa bir
// kesintide anahtar boşalıp alarm sessizce atlanmasın. Bayatlık kararını
// bildirim.js zaten veriZamani üzerinden kendisi veriyor, TTL'e güvenmiyor.
const HISSE_FIYAT_TTL = 3 * 3600;

// Yalnızca GERÇEK katılım endeksleri. Dikkat: "XK" önekiyle eşleştirme YAPMA —
// XKMYA (kimya), XKOBI (KOBİ), XKURY (kurumsal yönetim), XKAGT (kağıt) da bu
// önekle başlıyor ama katılım endeksi DEĞİLLER.
const KATILIM_ENDEKS_ESLEME = {
  "BIST:XKTUM": "tum",   // Katılım Tüm — uygunluk ölçütü budur
  "BIST:XK100": "yuz",
  "BIST:XK050": "elli",
  "BIST:XK030": "otuz",
};

async function tradingViewEndeksCek() {
  const govde = {
    columns: ["name", "indexes"],
    filter: [{ left: "type", operation: "equal", right: "stock" }],
    range: [0, 1000],
  };
  const r = await fetchZamanAsimli(
    "https://scanner.tradingview.com/turkey/scan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify(govde),
    },
    15000   // fiyat isteğinden uzun: "indexes" sütunu çok daha büyük yanıt getiriyor
  );
  if (!r.ok) throw new Error("TV endeks HTTP " + r.status);
  const j = await r.json();

  const gruplar = { tum: [], yuz: [], elli: [], otuz: [] };
  for (const kayit of (j?.data || [])) {
    const kod = kayit?.d?.[0];
    const endeksler = kayit?.d?.[1];
    if (!kod || !Array.isArray(endeksler)) continue;
    for (const e of endeksler) {
      const alan = KATILIM_ENDEKS_ESLEME[e?.proname];
      if (alan) gruplar[alan].push(kod);
    }
  }
  return gruplar;
}

// Üç katmanlı düşüş: Redis → taze istek → sabit yedek liste.
// Kaynak çökerse uygulama "hiçbir hisse uygun değil" gibi YANLIŞ ve zararlı
// bir cevap vermek yerine son bilinen doğruya döner.
async function katilimUyelikGetir() {
  try {
    const kayit = await redis.get(KV_KATILIM_KEY);
    if (kayit && Array.isArray(kayit.tum) && kayit.tum.length > 50) {
      return { veri: kayit, kaynak: "onbellek" };
    }
  } catch {}

  try {
    const gruplar = await tradingViewEndeksCek();
    // Anlamsız küçük sonuca güvenme — XKTUM normalde 240 civarı.
    if (gruplar.tum.length > 50) {
      try { await redis.set(KV_KATILIM_KEY, gruplar, { ex: KATILIM_TTL }); } catch {}
      return { veri: gruplar, kaynak: "canli" };
    }
  } catch (e) {
    console.error("Katilim endeksi cekilemedi:", e.message);
  }

  return {
    veri: { tum: [...KATILIM_YEDEK_LISTE], yuz: [], elli: [], otuz: [] },
    kaynak: "yedek",
  };
}


// ─── STATİK ŞİRKET İSİM HARİTASI ────────────────────────────────────────────
// Kaynak: BigPara /api/v1/hisse/list, alındığı tarih: 2026-07-02 (646 kayıt).
// Şirket isimleri neredeyse hiç değişmediği için bu liste koda gömülü — hiçbir
// ağ isteğine bağımlı olmadan anında kullanılabiliyor. Canlı BigPara isteği
// aşağıda hâlâ deneniyor (yeni halka arzları yakalamak için) ama başarısız
// olursa/timeout olursa artık isim ASLA boş kalmıyor, bu statik listeye düşüyor.
// Yenilemek için: /api/hisse-proxy?debug=1&tam=1 çağrısının tam_isim_haritasi
// alanını buraya kopyala (ayda bir yeterli).
const STATIC_ISIM_HARITASI = {"A1CAP":"A1 CAPITAL YATIRIM","A1YEN":"A1 YENILENEBILIR ENERJI","AAGYO":"AGAOGLU GMYO","ACSEL":"ACIPAYAM SELULOZ","ADEL":"ADEL KALEMCILIK","ADESE":"ADESE GAYRIMENKUL","ADGYO":"ADRA GMYO","AEFES":"ANADOLU EFES","AFYON":"AFYON CIMENTO","AGESA":"AGESA HAYAT EMEKLILIK","AGHOL":"ANADOLU GRUBU HOLDING","AGROT":"AGROTECH TEKNOLOJI","AGYO":"ATAKULE GMYO","AHGAZ":"AHLATCI DOGALGAZ","AHSGY":"AHES GMYO","AKBNK":"AKBANK","AKCNS":"AKCANSA","AKENR":"AKENERJI","AKFGY":"AKFEN GMYO","AKFIS":"AKFEN INSAAT","AKFYE":"AKFEN YEN. ENERJI","AKGRT":"AKSIGORTA","AKHAN":"AKHAN UN","AKMGY":"AKMERKEZ GMYO","AKSA":"AKSA","AKSEN":"AKSA ENERJI","AKSGY":"AKIS GMYO","AKSUE":"AKSU ENERJI","AKYHO":"AKDENIZ YATIRIM HOLDING","ALARK":"ALARKO HOLDING","ALBRK":"ALBARAKA TURK","ALCAR":"ALARKO CARRIER","ALCTL":"ALCATEL LUCENT TELETAS","ALFAS":"ALFA SOLAR ENERJI","ALGYO":"ALARKO GMYO","ALKA":"ALKIM KAGIT","ALKIM":"ALKIM KIMYA","ALKLC":"ALTINKILIC GIDA VE SUT","ALTNY":"ALTINAY SAVUNMA","ALVES":"ALVES KABLO","ANELE":"ANEL ELEKTRIK","ANGEN":"ANATOLIA TANI VE BIYOTEKNOLOJI","ANHYT":"ANADOLU HAYAT EMEK.","ANSGR":"ANADOLU SIGORTA","APBDL":"AK PORTFOY BIST BANKA DISI LIKIT 10 HSY BYF","APGLD":"AK PORTFOY ALTIN KATILIM BYF","APLIB":"AK PORTFOY BIST LIKIT BANKA HSY BYF","APMDL":"AK PORTFOY BIST 100 ENDEKSI MODEL HSY BYF","APX30":"AK PORTFOY BIST 30 ENDEKSI HSY BYF","ARASE":"DOGU ARAS ENERJI","ARCLK":"ARCELIK","ARDYZ":"ARD BILISIM TEKNOLOJILERI","ARENA":"ARENA BILGISAYAR","ARFYE":"ARF BIO YENILENEBILIR ENERJI","ARMGD":"ARMADA GIDA","ARSAN":"ARSAN HOLDING","ARTMS":"ARTEMIS HALI","ARZUM":"ARZUM EV ALETLERI","ASELS":"ASELSAN","ASGYO":"ASCE GMYO","ASTOR":"ASTOR ENERJI","ASUZU":"ANADOLU ISUZU","ATAGY":"ATA GMYO","ATAKP":"ATAKEY PATATES","ATATP":"ATP YAZILIM","ATATR":"ATA TURIZM","ATEKS":"AKIN TEKSTIL","ATLAS":"ATLAS YAT. ORT.","ATSYH":"ATLANTIS YATIRIM HOLDING","AVGYO":"AVRASYA GMYO","AVHOL":"AVRUPA YATIRIM HOLDING","AVOD":"A.V.O.D GIDA VE TARIM","AVPGY":"AVRUPAKENT GMYO","AVTUR":"AVRASYA PETROL VE TUR.","AYCES":"ALTINYUNUS CESME","AYDEM":"AYDEM ENERJI","AYEN":"AYEN ENERJI","AYES":"AYES CELIK HASIR VE CIT","AYGAZ":"AYGAZ","AZTEK":"AZTEK TEKNOLOJI","BAGFS":"BAGFAS","BAHKM":"BAHADIR KIMYA","BAKAB":"BAK AMBALAJ","BALAT":"BALATACILAR BALATACILIK","BALSU":"BALSU GIDA","BANVT":"BANVIT","BARMA":"BAREM AMBALAJ","BASCM":"BASTAS BASKENT CIMENTO","BASGZ":"BASKENT DOGALGAZ GMYO","BAYRK":"BAYRAK TABAN SANAYI","BEGYO":"BATI EGE GMYO","BERA":"BERA HOLDING","BESLR":"BESLER GIDA","BESTE":"BEST BRANDS ENERJI","BETAE":"BETA ENERJI VE TEKNOLOJI","BEYAZ":"BEYAZ FILO","BFREN":"BOSCH FREN SISTEMLERI","BIENY":"BIEN YAPI URUNLERI","BIGCH":"BUYUK SEFLER BIGCHEFS","BIGEN":"BIRLESIM GRUP ENERJI","BIGTK":"BIG MEDYA TEKNOLOJI","BIMAS":"BIM MAGAZALAR","BINBN":"BIN ULASIM TEKNOLOJILERI","BINHO":"1000 YATIRIMLAR HOL.","BIOEN":"BIOTREND CEVRE VE ENERJI","BIZIM":"BIZIM MAGAZALARI","BJKAS":"BESIKTAS FUTBOL YAT.","BLCYT":"BILICI YATIRIM","BLUME":"BLUME METAL KIMYA","BMSCH":"BMS CELIK HASIR","BMSTL":"BMS BIRLESIK METAL","BNTAS":"BANTAS AMBALAJ","BOBET":"BOGAZICI BETON SANAYI","BORLS":"BORLEASE OTOMOTIV","BORSK":"BOR SEKER","BOSSA":"BOSSA","BRISA":"BRISA","BRKO":"BIRKO MENSUCAT","BRKSN":"BERKOSAN YALITIM","BRKVY":"BIRIKIM VARLIK YONETIM","BRLSM":"BIRLESIM MUHENDISLIK","BRMEN":"BIRLIK MENSUCAT","BRSAN":"BORUSAN BORU SANAYI","BRYAT":"BORUSAN YAT. PAZ.","BSOKE":"BATICIM CIMENTO","BTCIM":"BATICIM BATI ANADOLU","BUCIM":"BURSA CIMENTO","BULGS":"BULLS GSYO","BURCE":"BURCELIK","BURVA":"BURCELIK VANA","BVSAN":"BULBULOGLU VINC","BYDNR":"BAYDONER RESTORANLARI","CANTE":"CAN2 TERMIK","CATES":"CATES ELEKTRIK","CCOLA":"COCA COLA ICECEK","CELHA":"CELIK HALAT","CEMAS":"CEMAS DOKUM","CEMTS":"CEMTAS","CEMZY":"CEM ZEYTIN","CEOEM":"CEO EVENT MEDYA","CGCAM":"CAGDAS CAM","CIMSA":"CIMSA","CLEBI":"CELEBI","CMBTN":"CIMBETON","CMENT":"CIMENTAS","CONSE":"CONSUS ENERJI","COSMO":"COSMOS YAT. HOLDING","CRDFA":"CREDITWEST FAKTORING","CRFSA":"CARREFOURSA","CUSAN":"CUHADAROGLU METAL","CVKMD":"CVK MADEN","CWENE":"CW ENERJI","DAGI":"DAGI GIYIM","DAPGM":"DAP GAYRIMENKUL","DARDL":"DARDANEL","DCTTR":"DCT TRADING DIS TICARET","DENGE":"DENGE HOLDING","DERHL":"DERLUKS YATIRIM HOLDING","DERIM":"DERIMOD","DESA":"DESA DERI","DESPC":"DESPEC BILGISAYAR","DEVA":"DEVA HOLDING","DGATE":"DATAGATE BILGISAYAR","DGGYO":"DOGUS GMYO","DGNMO":"DOGANLAR MOBILYA","DIRIT":"DIRITEKS DIRILIS TEKSTIL","DITAS":"DITAS BDY","DMRGD":"DMR UNLU MAMULLER","DMSAS":"DEMISAS DOKUM","DNISI":"DINAMIK ISI MAKINA YALITIM","DOAS":"DOGUS OTOMOTIV","DOCO":"DO-CO","DOFER":"DOFER YAPI MALZEMELERI","DOFRB":"DOF ROBOTIK","DOGUB":"DOGUSAN","DOHOL":"DOGAN HOLDING","DOKTA":"DOKTAS DOKUMCULUK","DSTKF":"DESTEK FINANS FAKTORING","DUNYH":"DUNYA HOLDING","DURDO":"DURAN DOGAN BASIM","DURKN":"DURUKAN SEKERLEME","DYOBY":"DYO BOYA","DZGYO":"DENIZ GMYO","EBEBK":"EBEBEK MAGAZACILIK","ECILC":"ECZACIBASI ILAC","ECOGR":"ECOGREEN ENERJI","ECZYT":"ECZACIBASI YATIRIM","EDATA":"E-DATA TEKNOLOJI","EDIP":"EDIP GAYRIMENKUL","EFOR":"EFOR YATIRIM","EGEEN":"EGE ENDUSTRI","EGEGY":"EGEYAPI AVRUPA GMYO","EGEPO":"NASMED EGEPOL","EGGUB":"EGE GUBRE","EGPRO":"EGE PROFIL","EGSER":"EGE SERAMIK","EKDMR":"EKINCILER DEMIR CELIK","EKGYO":"EMLAK KONUT GMYO","EKIZ":"EKIZ KIMYA","EKOS":"EKOS TEKNOLOJI","EKSUN":"EKSUN GIDA","ELITE":"ELITE NATUREL ORGANIK GIDA","EMKEL":"EMEK ELEKTRIK","EMNIS":"EMINIS AMBALAJ","EMPAE":"EMPA ELEKTRONIK","ENDAE":"ENDA ENERJI HOLDING","ENERY":"ENERYA ENERJI","ENJSA":"ENERJISA ENERJI","ENKAI":"ENKA INSAAT","ENPRA":"ENPARA BANK","ENRYA":"ENERYA ENERJİ","ENSRI":"ENSARI SINAI YATIRIMLAR","ENTRA":"IC ENTERRA YEN. ENERJI","EPLAS":"EGEPLAST","ERBOS":"ERBOSAN","ERCB":"ERCIYAS CELIK BORU","EREGL":"EREGLI DEMIR CELIK","ERSU":"ERSU GIDA","ESCAR":"ESCAR FILO","ESCOM":"ESCORT TEKNOLOJI","ESEN":"ESENBOGA ELEKTRIK","ETILR":"ETILER GIDA","ETYAT":"EURO TREND YAT. ORT.","EUHOL":"EURO YATIRIM HOLDING","EUKYO":"EURO KAPITAL YAT. ORT.","EUPWR":"EUROPOWER ENERJI","EUREN":"EUROPEN ENDUSTRI","EUYO":"EURO YAT. ORT.","EYGYO":"EYG GMYO","FADE":"FADE GIDA","FENER":"FENERBAHCE FUTBOL","FLAP":"FLAP KONGRE TOPLANTI HIZ.","FMIZP":"F-M IZMIT PISTON","FONET":"FONET BILGI TEKNOLOJILERI","FORMT":"FORMET METAL VE CAM","FORTE":"FORTE BILGI ILETISIM","FRIGO":"FRIGO PAK GIDA","FRMPL":"FORMUL PLASTIK VE METAL","FROTO":"FORD OTOSAN","FZLGY":"FUZUL GMYO","GARAN":"GARANTI BANKASI","GARFA":"GARANTI FAKTORING","GATEG":"GATE GROUP TEKNOLOJI","GEDIK":"GEDIK Y. MEN. DEG.","GEDZA":"GEDIZ AMBALAJ","GENIL":"GEN ILAC","GENKM":"GENTAS KIMYA","GENTS":"GENTAS","GEREL":"GERSAN ELEKTRIK","GESAN":"GIRISIM ELEKTRIK SANAYI","GIPTA":"GIPTA OFIS KIRTASIYE","GLBMD":"GLOBAL MEN. DEG.","GLCVY":"GELECEK VARLIK YONETIMI","GLDTR":"QNB PORTFOY ALTIN KATILIM BYF","GLRMK":"GULERMAK AGIR SANAYI","GLRYH":"GULER YAT. HOLDING","GLYHO":"GLOBAL YAT. HOLDING","GMSTR":"QNB PORTFOY GUMUS KATILIM BYF","GMSTRF":"FINANS PORTFOY GUMUS BYF","GMTAS":"GIMAT MAGAZACILIK","GOKNR":"GOKNUR GIDA","GOLTS":"GOLTAS CIMENTO","GOODY":"GOOD-YEAR","GOZDE":"GOZDE GIRISIM","GRNYO":"GARANTI YAT. ORT.","GRSEL":"GUR-SEL TURIZM TASIMACILIK","GRTHO":"GRAINTURK HOLDING","GSDDE":"GSD DENIZCILIK","GSDHO":"GSD HOLDING","GSRAY":"GALATASARAY SPORTIF","GUBRF":"GUBRE FABRIK.","GUNDG":"GUNDOGDU GIDA","GWIND":"GALATA WIND ENERJI","GZNMI":"GEZINOMI SEYAHAT","HALKB":"T. HALK BANKASI","HATEK":"HATAY TEKSTIL","HATSN":"HATSAN GEMI","HDFGS":"HEDEF GIRISIM","HEDEF":"HEDEF HOLDING","HEKTS":"HEKTAS","HKTM":"HIDROPAR HAREKET KONTROL","HLGYO":"HALK GMYO","HOROZ":"HOROZ LOJISTIK","HRKET":"HAREKET PROJE TASIMACILIGI","HTTBT":"HITIT BILGISAYAR","HUBVC":"HUB GIRISIM","HUNER":"HUN YENILENEBILIR ENERJI","HURGZ":"HURRIYET GZT.","ICBCT":"ICBC TURKEY BANK","ICUGS":"ICU GIRISIM","IDGYO":"IDEALIST GMYO","IEYHO":"ISIKLAR ENERJI YAPI HOL.","IHAAS":"IHLAS HABER AJANSI","IHEVA":"IHLAS EV ALETLERI","IHGZT":"IHLAS GAZETECILIK","IHLAS":"IHLAS HOLDING","IHLGM":"IHLAS GAYRIMENKUL","IHYAY":"IHLAS YAYIN HOLDING","IMASM":"IMAS MAKINA","INDES":"INDEKS BILGISAYAR","INFO":"INFO YATIRIM","INGRM":"INGRAM BILISIM","INTEK":"INNOSA TEKNOLOJI","INTEM":"INTEMA","INVEO":"INVEO YATIRIM HOLDING","INVES":"INVESTCO HOLDING","ISATR":"IS BANKASI (A)","ISBIR":"ISBIR HOLDING","ISBTR":"IS BANKASI (B)","ISCTR":"IS BANKASI (C)","ISDMR":"ISKENDERUN DEMIR CELIK","ISFIN":"IS FIN.KIR.","ISGLK":"IS PORTFOY ALTIN KATILIM BYF","ISGSY":"IS GIRISIM","ISGYO":"IS GMYO","ISKPL":"ISIK PLASTIK","ISKUR":"IS BANKASI (KUR.)","ISMEN":"IS Y. MEN. DEG.","ISSEN":"ISBIR SENTETIK DOKUMA","ISYAT":"IS YAT. ORT.","IZENR":"IZDEMIR ENERJI","IZFAS":"IZMIR FIRCA","IZINV":"IZ YATIRIM HOLDING","IZMDC":"IZMIR DEMIR CELIK","JANTS":"JANTSA JANT SANAYI","KAPLM":"KAPLAMIN","KAREL":"KAREL ELEKTRONIK","KARSN":"KARSAN OTOMOTIV","KARTN":"KARTONSAN","KATMR":"KATMERCILER EKIPMAN","KAYSE":"KAYSERI SEKER FABRIKASI","KBORU":"KUZEY BORU","KCAER":"KOCAER CELIK","KCHOL":"KOC HOLDING","KENT":"KENT GIDA","KERVN":"KERVANSARAY YAT. HOLDING","KFEIN":"KAFEIN YAZILIM","KGYO":"KORAY GMYO","KIMMR":"KIM MARKET-ERSAN ALISVERIS","KLGYO":"KILER GMYO","KLKIM":"KALEKIM KIMYEVI MADDELER","KLMSN":"KLIMASAN KLIMA","KLNMA":"T. KALKINMA BANK.","KLRHO":"KILER HOLDING","KLSER":"KALESERAMIK","KLSYN":"KOLEKSIYON MOBILYA","KLYPV":"KALYON GUNES TEKNOLOJILERI","KMPUR":"KIMTEKS POLIURETAN","KNFRT":"KONFRUT TARIM","KOCMT":"KOC METALURJI","KONKA":"KONYA KAGIT","KONTR":"KONTROLMATIK TEKNOLOJI","KONYA":"KONYA CIMENTO","KOPOL":"KOZA POLYESTER","KORDS":"KORDSA TEKNIK TEKSTIL","KOTON":"KOTON MAGAZACILIK","KRDMA":"KARDEMIR (A)","KRDMB":"KARDEMIR (B)","KRDMD":"KARDEMIR (D)","KRGYO":"KORFEZ GMYO","KRONT":"KRON TEKNOLOJI","KRPLS":"KOROPLAST TEMIZLIK AMBALAJ","KRSTL":"KRISTAL KOLA","KRTEK":"KARSU TEKSTIL","KRVGD":"KERVAN GIDA","KSTUR":"KUSTUR KUSADASI TURIZM","KTLEV":"KATILIMEVIM TAS. FIN.","KTSKR":"KUTAHYA SEKER FABRIKASI","KUTPO":"KUTAHYA PORSELEN","KUVVA":"KUVVA GIDA","KUYAS":"KUYAS YATIRIM","KZBGY":"KIZILBUK GYO","KZGYO":"KUZUGRUP GMYO","LIDER":"LDR TURIZM","LIDFA":"LIDER FAKTORING","LILAK":"LILA KAGIT","LINK":"LINK BILGISAYAR","LKMNH":"LOKMAN HEKIM SAGLIK","LMKDC":"LIMAK DOGU ANADOLU","LOGO":"LOGO YAZILIM","LRSHO":"LORAS HOLDING","LUKSK":"LUKS KADIFE","LXGYO":"LUXERA GMYO","LYDHO":"LYDIA HOLDING","LYDIA":"LYDIA HOLDING","LYDYE":"LYDIA YESIL ENERJI","MAALT":"MARMARIS ALTINYUNUS","MACKO":"MACKOLIK INTERNET HIZMETLERI","MAGEN":"MARGUN ENERJI","MAKIM":"MAKIM MAKINE","MAKTK":"MAKINA TAKIM","MANAS":"MANAS ENERJI YONETIMI","MARBL":"TUREKS TURUNC MADENCILIK","MARKA":"MARKA YATIRIM HOLDING","MARMR":"MARMARA HOLDING","MARTI":"MARTI OTEL","MAVI":"MAVI GIYIM","MCARD":"METROPAL KURUMSAL HIZMETLER","MEDTR":"MEDITERA TIBBI MALZEME","MEGAP":"MEGA POLIETILEN","MEGMT":"MEGA METAL","MEKAG":"MEKA GLOBAL MAKINE","MEPET":"BREAK MOLA TURIZM","MERCN":"MERCAN KIMYA","MERIT":"MERIT TURIZM","MERKO":"MERKO GIDA","METRO":"METRO HOLDING","MEYSU":"MEYSU GIDA","MGROS":"MIGROS TICARET","MHRGY":"MHR GMYO","MIATK":"MIA TEKNOLOJI","MMCAS":"MMC SAN. VE TIC. YAT.","MNDRS":"MENDERES TEKSTIL","MNDTR":"MONDI TURKEY","MOBTL":"MOBILTEL ILETISIM","MOGAN":"MOGAN ENERJI","MOPAS":"MOPAS MARKETCILIK","MPARK":"MLP SAGLIK","MRGYO":"MARTI GMYO","MRSHL":"MARSHALL","MSGYO":"MISTRAL GMYO","MTRKS":"MATRIKS FINANSAL TEKNOLOJILER","MTRYO":"METRO YAT. ORT.","MZHLD":"MAZHAR ZORLU HOLDING","NATEN":"NATUREL ENERJI","NETAS":"NETAS TELEKOM.","NETCD":"NETCAD YAZILIM","NIBAS":"NIGBAS NIGDE BETON","NPTLR":"NUROL PORTFOY TLREF BYF","NTGAZ":"NATURELGAZ","NTHOL":"NET HOLDING","NUGYO":"NUROL GMYO","NUHCM":"NUH CIMENTO","OBAMS":"OBA MAKARNACILIK","OBASE":"OBASE BILGISAYAR","ODAS":"ODAS ELEKTRIK","ODINE":"ODINE TEKNOLOJI","OFSYM":"OFIS YEM GIDA","ONCSM":"ONCOSEM ONKOLOJIK SISTEMLER","ONRYT":"ONUR TEKNOLOJI","OPK30":"OSMANLI PORTFOY KATILIM 30 ENDEKS HSY BYF","OPT25":"OSMANLI PORTFOY BIST TEMETTU 25 ENDEKS HSY BYF","OPTGY":"OSMANLI PORTFOY KAR PAYI ODEYEN BIST GYO HSY BYF","OPTLR":"OSMANLI P BIST TLREF(TL) END BYF","OPX30":"OSMANLI PORTFOY BIST 30 HSY BYF","ORCAY":"ORCAY ORTAKOY CAY SANAYI","ORGE":"ORGE ENERJI ELEKTRIK","ORMA":"ORMA ORMAN MAHSULLERI","OSMEN":"OSMANLI MENKUL","OSTIM":"OSTIM ENDUSTRIYEL YAT","OTKAR":"OTOKAR","OTTO":"OTTO HOLDING","OYAKC":"OYAK CIMENTO","OYAYO":"OYAK YAT. ORT.","OYLUM":"OYLUM SINAI YATIRIMLAR","OYYAT":"OYAK YATIRIM MENKUL","OZATD":"OZATA DENIZCILIK","OZGYO":"OZDERICI GMYO","OZKGY":"OZAK GMYO","OZRDN":"OZERDEN AMBALAJ","OZSUB":"OZSU BALIK","OZYSR":"OZYASAR TEL","PAGYO":"PANORA GMYO","PAHOL":"PASIFIK HOLDING","PAMEL":"PAMEL ELEKTRIK","PAPIL":"PAPILON SAVUNMA","PARSN":"PARSAN","PASEU":"PASIFIK EURASIA LOJISTIK","PATEK":"PASIFIK TEKNOLOJI","PCILT":"PC ILETISIM MEDYA","PEKGY":"PEKER GMYO","PENGD":"PENGUEN GIDA","PENTA":"PENTA TEKNOLOJI URUNLERI DAGITIM","PETKM":"PETKIM","PETUN":"PINAR ET VE UN","PGSUS":"PEGASUS","PINSU":"PINAR SU","PKART":"PLASTIKKART","PKENT":"PETROKENT TURIZM","PLTUR":"PLATFORM TURIZM","PNLSN":"PANELSAN CATI CEPHE","PNSUT":"PINAR SUT","POLHO":"POLISAN HOLDING","POLTK":"POLITEKNIK METAL","PRDGS":"PARDUS GIRISIM","PRKAB":"TURK PRYSMIAN KABLO","PRKME":"PARK ELEK.MADENCILIK","PRZMA":"PRIZMA PRESS MATBAACILIK","PSDTC":"PERGAMON DIS TICARET","PSGYO":"PASIFIK GMYO","QNBFK":"QNB FINANSAL KIRALAMA","QNBTR":"QNB BANK","QTEMZ":"QNB PORTFOY TEMIZ ENERJI HSY BYF","QUAGR":"QUA GRANITE HAYAL YAPI","RALYH":"RAL YATIRIM HOLDING","RAYSG":"RAY SIGORTA","REEDR":"REEDER TEKNOLOJI","RGYAS":"RONESANS GAYRIMENKUL YAT.","RNPOL":"RAINBOW POLIKARBONAT","RODRG":"RODRIGO TEKSTIL","RTALB":"RTA LABORATUVARLARI","RUBNS":"RUBENIS TEKSTIL","RUZYE":"RUZY MADENCILIK VE ENERJI","RYGYO":"REYSAS GMYO","RYSAS":"REYSAS LOJISTIK","SAFKR":"SAFKAR EGE SOGUTMACILIK","SAHOL":"SABANCI HOLDING","SAMAT":"SARAY MATBAACILIK","SANEL":"SANEL MUHENDISLIK","SANFM":"SANIFOAM ENDUSTRI","SANKO":"SANKO PAZARLAMA","SARKY":"SARKUYSAN","SASA":"SASA POLYESTER","SAYAS":"SAY YENILENEBILIR ENERJI","SDTTR":"SDT UZAY VE SAVUNMA","SEGMN":"SEGMEN KARDESLER GIDA","SEGYO":"SEKER GMYO","SEKFK":"SEKER FIN. KIR.","SEKUR":"SEKURO PLASTIK","SELEC":"SELCUK ECZA DEPOSU","SELVA":"SELVA GIDA","SERNT":"SERANIT GRANIT SERAMIK","SEYKM":"SEYITLER KIMYA","SILVR":"SILVERLINE ENDUSTRI","SISE":"SISE CAM","SKBNK":"SEKERBANK","SKTAS":"SOKTAS","SKYLP":"SKYALP FINANSAL TEKNOLOJILER","SKYMD":"SEKER YATIRIM","SMART":"SMARTIKS YAZILIM","SMRTG":"SMART GUNES ENERJISI TEK.","SMRVA":"SUMER VARLIK YONETIM","SNGYO":"SINPAS GMYO","SNICA":"SANICA ISI SANAYI","SNPAM":"SONMEZ PAMUKLU","SODSN":"SODAS SODYUM SANAYII","SOKE":"SOKE DEGIRMENCILIK","SOKM":"SOK MARKETLER TICARET","SONME":"SONMEZ FILAMENT","SRVGY":"SERVET GMYO","SUMAS":"SUMAS SUNI TAHTA","SUNTK":"SUN TEKSTIL","SURGY":"SUR TATIL EVLERI GMYO","SUWEN":"SUWEN TEKSTIL","SVGYO":"SAVUR GMYO","TABGD":"TAB GIDA","TARKM":"TARKIM BITKI KORUMA","TATEN":"TATLIPINAR ENERJI URETIM","TATGD":"TAT GIDA","TAVHL":"TAV HAVALIMANLARI","TBORG":"T.TUBORG","TCELL":"TURKCELL","TCKRC":"KIRAC GALVANIZ","TDGYO":"TREND GMYO","TEHOL":"TERA YATIRIM TEK. HOL.","TEKTU":"TEK-ART TURIZM","TERA":"TERA YATIRIM MENKUL DEGERLER","TEZOL":"EUROPAP TEZOL KAGIT","TGSAS":"TGS DIS TICARET","THYAO":"TURK HAVA YOLLARI","TKFEN":"TEKFEN HOLDING","TKNSA":"TEKNOSA IC VE DIS TICARET","TLMAN":"TRABZON LIMAN","TMPOL":"TEMAPOL POLIMER PLASTIK","TMSN":"TUMOSAN MOTOR VE TRAKTOR","TNZTP":"TAPDI TINAZTEPE","TOASO":"TOFAS OTO. FAB.","TRALT":"TURK ALTIN ISLETMELERI","TRCAS":"TURCAS HOLDING","TRENJ":"TR DOGAL ENERJI","TRGYO":"TORUNLAR GMYO","TRHOL":"TERA FINANSAL YAT. HOL.","TRILC":"TURK ILAC SERUM","TRMET":"TR ANADOLU METAL MADENCILIK","TSGYO":"TSKB GMYO","TSKB":"T.S.K.B.","TSPOR":"TRABZONSPOR SPORTIF","TTKOM":"TURK TELEKOM","TTRAK":"TURK TRAKTOR","TUCLK":"TUGCELIK","TUKAS":"TUKAS","TUPRS":"TUPRAS","TUREX":"TUREKS TURIZM TASIMACILIK","TURGG":"TURKER PROJE GAYRIMENKUL","TURSG":"TURKIYE SIGORTA","UCAYM":"UCAY MUHENDISLIK","UFUK":"UFUK YATIRIM","ULAS":"ULASLAR TURIZM YAT.","ULKER":"ULKER BISKUVI","ULUFA":"ULUSAL FAKTORING","ULUSE":"ULUSOY ELEKTRIK","ULUUN":"ULUSOY UN SANAYI","UMPAS":"UMPAS HOLDING","UNLU":"UNLU YATIRIM HOLDING","USAK":"USAK SERAMIK","USDTR":"QNB PORTFOY ABD DOLARI BYF","USDTRF":"ABD HAZ BONOSU DOLAR BYF","VAKBN":"VAKIFLAR BANKASI","VAKFA":"VAKIF FAKTORING","VAKFN":"VAKIF FIN. KIR.","VAKKO":"VAKKO TEKSTIL","VANGD":"VANET GIDA","VBTYZ":"VBT YAZILIM","VERTU":"VERUSATURK GIRISIM","VERUS":"VERUSA HOLDING","VESBE":"VESTEL BEYAZ ESYA","VESTL":"VESTEL","VKFYO":"VAKIF YAT. ORT.","VKGYO":"VAKIF GMYO","VKING":"VIKING KAGIT","VRGYO":"VERA KONSEPT GMYO","VSNMD":"VISNE MADENCILIK","YAPRK":"YAPRAK SUT VE BESI CIFT.","YATAS":"YATAS","YAYLA":"YAYLA EN. UR. TUR. VE INS","YBTAS":"YIBITAS INSAAT MALZEME","YEOTK":"YEO TEKNOLOJI ENERJI","YESIL":"YESIL YATIRIM HOLDING","YGGYO":"YENI GIMAT GMYO","YIGIT":"YIGIT AKU","YKBNK":"YAPI VE KREDI BANK.","YKSLN":"YUKSELEN CELIK","YONGA":"YONGA MOBILYA","YUNSA":"YUNSA","YYAPI":"YESIL YAPI","YYLGD":"YAYLA GIDA","Z30EA":"ZIRAAT PORTFOY BIST30 EA ENDEKSI HSY BYF","Z30KE":"ZIRAAT PORTFOY KATILIM 30 EA HSY BYF","Z30KP":"ZIRAAT PORTFOY KATILIM 30 ENDEKSI HSY BYF","ZEDUR":"ZEDUR ENERJI","ZELOT":"ZIRAAT PORTFOY BIST 50-30 HY BYF","ZERGY":"ZERAY GMYO","ZGOLD":"ZIRAAT PORTFOY ALTIN BYF","ZGOLDF":"ZIRAAT PORTFOY ALTIN BYF","ZGYO":"Z GMYO","ZOREN":"ZORLU ENERJI","ZPBDL":"ZIRAAT PORTFOY BIST BANKA DISI LIKIT 10 HY BYF","ZPLIB":"ZIRAAT PORTFOY BIST LIKIT BANKA HY BYF","ZPT10":"ZIRAAT PORTFOY YP TEKNOLOJI ILETISIM 10 HY BYF","ZPX30":"ZIRAAT PORTFOY BIST 30 HY BYF","ZRE20":"ZIRAAT PORTFOY RISK ESIT BD20 ENDEKSI HSY BYF","ZRGYO":"ZIRAAT GMYO","ZSR25":"ZIRAAT PORTFOY BIST SURD. 25 ENDEKSI HY BYF","ZTLRF":"ZIRAAT PORTFOY TLREF BYF","ZTLRK":"ZIRAAT PORTFOY TLREFK KATILIM BYF","ZTM25":"ZIRAAT PORTFOY BIST TEMETTU 25 ENDEKS HSY BYF"};

const CACHE_TTL = 30 * 24 * 3600 * 1000; // canlı BigPara tazelemesi ayda bir denenir (arka planda, isteğe bağlı takviye)
let isimCache = { data: null, ts: 0, rawSample: null, rawCount: 0 };

// BigPara'nın döndürdüğü alan adı (kod/ad) zaman içinde değişmiş/farklı casing kullanıyor olabilir.
// Bilinen tüm olası varyantları dener — hangisi API'de gerçekten varsa onu kullanır.
function ilkGecerliAlan(obj, adaylar) {
  for (const k of adaylar) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

const KOD_ALANLARI = ["kod","Kod","KOD","sembol","Sembol","SEMBOL","symbol","Symbol","HisseKodu","hisseKodu"];
const AD_ALANLARI  = ["ad","Ad","AD","hisseAdi","HisseAdi","HISSE_ADI","isim","Isim","IsimTam","name","Name","Aciklama","aciklama","Unvan","unvan","SirketAdi","sirketAdi"];

// Zaman aşımlı fetch — BigPara yavaş kaldığında istek sonsuza kadar beklemesin
function fetchZamanAsimli(url, opts, msTimeout) {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), msTimeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(zamanlayici));
}

// BigPara isteği bazı soğuk başlangıçlarda (cold start) tek seferde başarısız/timeout olabiliyor.
// Statik liste zaten neredeyse tüm hisseleri karşıladığı için burada agresif tekrar denemeye
// gerek yok — 1 hızlı deneme yeterli; başarısız olursa isteği yavaşlatmadan statik listeye düşer.
async function bigparaCekTekrarli(deneme = 1) {
  for (let i = 0; i < deneme; i++) {
    try {
      const r = await fetchZamanAsimli(
        "https://bigpara.hurriyet.com.tr/api/v1/hisse/list",
        { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } },
        3000
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const liste = json?.data || [];
      if (Array.isArray(liste) && liste.length > 0) return liste;
      throw new Error("Boş liste döndü");
    } catch (e) {
      if (i === deneme - 1) throw e;
      await new Promise(res => setTimeout(res, 400));
    }
  }
  return [];
}

async function sirketIsimleriniGetir() {
  const now = Date.now();
  if (isimCache.data && now - isimCache.ts < CACHE_TTL) return isimCache.data;

  try {
    const liste = await bigparaCekTekrarli(2);

    const isimMap = { ...STATIC_ISIM_HARITASI }; // statik taban her zaman garanti
    for (const h of liste) {
      const kod = ilkGecerliAlan(h, KOD_ALANLARI);
      const ad  = ilkGecerliAlan(h, AD_ALANLARI);
      if (kod && ad) isimMap[kod] = ad; // canlı veri varsa (yeni IPO'lar dahil) üzerine yazar
    }
    isimCache = {
      data: isimMap,
      ts: now,
      rawSample: liste.slice(0, 2),   // BigPara'dan gelen ham ilk 2 kayıt — gerçek alan adlarını görmek için
      rawCount: liste.length,
    };
    return isimMap;
  } catch (e) {
    // Canlı BigPara isteği 3 denemede de başarısız oldu — statik listeye (ya da varsa
    // bu instance'ın önceki başarılı sonucuna) düş. Böylece isim ASLA boş kalmaz.
    isimCache.rawSample = isimCache.rawSample || [{ hata: String(e && e.message || e) }];
    return isimCache.data || STATIC_ISIM_HARITASI;
  }
}

// ─── YEDEK VERİ KAYNAĞI: TradingView Scanner (2026-07-27 eklendi) ───────────
// GEREKÇE: 27 Temmuz'da Midas'ın kendi API'si bütün gün donup Cuma kapanışını
// döndürdü (uygulamada hisse fiyatları hiç değişmedi). Tek kaynağa bağımlılığı
// azaltmak için, SADECE Midas bayat kaldığında devreye giren bir yedek eklendi.
//
// TASARIM İLKESİ — bu yedek TAMAMEN EK bir katman:
//   • Midas taze ise TradingView'a HİÇ istek atılmaz (normal akış değişmedi)
//   • TradingView herhangi bir sebeple başarısız olursa (erişilemez, format
//     değişmiş, alan eksik) sessizce Midas verisine düşülür — bayat da olsa
//     ekranda bir şey görünür, boş kalmaz
//   • Hangi kaynağın kullanıldığı yanıttaki "kaynak" alanında bildirilir
//
// Scanner uç noktası, istenen sütunları biz belirlediğimiz için yanıt formatı
// tahmine dayalı değil: { data: [ { s: "BIST:ASELS", d: [sütun değerleri...] } ] }
// — d dizisinin sırası, aşağıdaki TV_SUTUNLAR dizisinin sırasıyla birebir aynı.
// Yine de sütun KİMLİKLERİ canlı doğrulanmalı: /api/hisse-proxy?debug=tv
const TV_SUTUNLAR = [
  "name",                 // 0  ticker (ASELS)
  "close",                // 1  son fiyat
  "change",               // 2  günlük değişim %
  "Perf.W",               // 3  haftalık %
  "Perf.1M",              // 4  aylık %
  "Perf.Y",               // 5  yıllık %
  "high",                 // 6  gün içi yüksek
  "low",                  // 7  gün içi düşük
  "volume",               // 8  hacim (lot)
  "market_cap_basic",     // 9  piyasa değeri
  "price_earnings_ttm",   // 10 F/K
  "price_book_fq",        // 11 PD/DD
  "return_on_equity",     // 12 ROE
];

// Midas verisi ne kadar eskiyse "bayat" sayılsın (dakika). Seans içinde Midas
// normalde 15 dk gecikmeli geliyor; 45 dk eşiği normal gecikmeyi yanlışlıkla
// bayat saymayacak kadar geniş, gerçek donmayı yakalayacak kadar dar.
const BAYAT_ESIK_DK = 45;

// Piyasa açık mı? (TR saati, hafta içi 10:00–18:00). Kapalıyken Midas'ın
// "eski" veri döndürmesi NORMAL — o yüzden yedeğe hiç gerek yok.
function piyasaAcikMi() {
  const tr = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const gun = tr.getDay();                       // 0=Pazar, 6=Cumartesi
  const dk = tr.getHours() * 60 + tr.getMinutes();
  return gun >= 1 && gun <= 5 && dk >= 10 * 60 && dk < 18 * 60;
}

// Önbellek süresi için kullanılan pencere. piyasaAcikMi()'den AYRI tutuldu
// çünkü o fonksiyon midasBayatMi() içinde "bayatlık normal mi" kararında
// kullanılıyor ve seans saatini (10:00–18:00) temsil etmeli. Burada ise
// kapanış verisinin oturması için 18:30'a kadar uzatıyoruz.
function veriTazelenirMi() {
  const tr = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const gun = tr.getDay();                       // 0=Pazar, 6=Cumartesi
  const dk = tr.getHours() * 60 + tr.getMinutes();
  return gun >= 1 && gun <= 5 && dk >= 10 * 60 && dk < 18 * 60 + 30;
}

function midasBayatMi(veriZamani) {
  if (!piyasaAcikMi()) return false;             // kapalıyken eskilik normal
  if (!veriZamani) return true;                  // hiç damga yoksa güvenme
  const yasDk = (Date.now() - new Date(veriZamani).getTime()) / 60000;
  return yasDk > BAYAT_ESIK_DK;
}

async function tradingViewCek() {
  const govde = {
    filter: [{ left: "type", operation: "equal", right: "stock" }],
    options: { lang: "tr" },
    symbols: { query: { types: [] }, tickers: [] },
    columns: TV_SUTUNLAR,
    sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    range: [0, 1000],
  };
  const r = await fetchZamanAsimli(
    "https://scanner.tradingview.com/turkey/scan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify(govde),
    },
    6000
  );
  if (!r.ok) throw new Error(`TV HTTP ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j?.data) || j.data.length === 0) throw new Error("TV boş liste");
  return j;
}

// TradingView yanıtını, Midas'la AYNI şekle çevirir — frontend hiçbir farkı
// görmez, sadece sayılar başka kaynaktan gelir.
function tradingViewNormalize(tvJson, isimMap, katilimSet) {
  const sayi = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const yuvarla = (v) => (sayi(v) == null ? null : parseFloat(v.toFixed(2)));

  return (tvJson.data || [])
    .map((satir) => {
      const d = satir?.d || [];
      // "BIST:ASELS" → "ASELS" (name sütunu zaten sade gelir ama garanti olsun)
      const kod = String(d[0] || satir?.s || "").split(":").pop().trim().toUpperCase();
      if (!kod || kod.startsWith("X")) return null;   // endeksleri ele (Midas'taki filtreyle aynı)
      return {
        ticker: kod,
        sirket: isimMap[kod] || kod,
        sektor: "",
        fiyat: sayi(d[1]) ?? 0,
        degisim1g: yuvarla(d[2]) ?? 0,
        degisim1h: yuvarla(d[3]),
        degisim1a: yuvarla(d[4]),
        degisim1y: yuvarla(d[5]),
        yuksek: sayi(d[6]) ?? 0,
        dusuk: sayi(d[7]) ?? 0,
        hacim: sayi(d[8]) ?? 0,
        piyasaDegeri: sayi(d[9]) ?? 0,
        fk: sayi(d[10]),
        pddd: sayi(d[11]),
        roe: sayi(d[12]),
        temetu: null,
        katilimEndeksi: katilimSet.has(kod),
      };
    })
    .filter((h) => h && h.fiyat > 0)
    .sort((a, b) => (b.piyasaDegeri || 0) - (a.piyasaDegeri || 0));
}

// ── GEÇİCİ SÜTUN YOKLAMA TEŞHİSİ (2026-08-05) ──────────────────────────────
//   GET /api/hisse-proxy?debug=tvtest
//
// NEDEN VAR: Ekranda "Sektör" ve "Temettü Verimi" satırları HEP BOŞ — çünkü
// tradingViewNormalize bu ikisini `sektor:""` ve `temetu:null` olarak sabit
// yazıyor; TradingView bunları veriyor olabilir ama TV_SUTUNLAR'da istenmiyor.
// Ayrıca katılım uygunluğunun asıl kriteri olan borç/özkaynak oranı da yok
// (kodun kendi notunda THYAO/TCELL'in "yüksek faizli borç" yüzünden endeks
// dışı olduğu yazılı — o oranı göstermek kullanıcıya NEDENİNİ anlatır).
//
// ⚠️ SÜTUN KİMLİKLERİ TAHMİN EDİLEMEZ. Yanlış bir sütun adı isteğin TAMAMINI
// bozabilir ve bu uç ana ekranlardan birini besliyor. Bu yüzden adaylar
// CANLI AKIŞA HİÇ DOKUNULMADAN, ayrı bir istekte tek tek yoklanıyor:
// TV_SUTUNLAR değişmiyor, kullanıcılar etkilenmiyor.
//
// Rapor her aday için "kaç kayıtta gerçek değer döndü" bilgisini verir.
// Sonuç görülünce çalışan sütunlar TV_SUTUNLAR'a eklenecek ve BU BLOK SİLİNECEK.
const TV_ADAY_SUTUNLAR = [
  "sector",                    // boş "Sektör" alanı için
  "industry",                  // sector tutmazsa alternatif
  "dividends_yield_current",   // boş "Temettü Verimi" alanı için
  "dividend_yield_recent",     // alternatif isimlendirme
  "debt_to_equity",            // ⭐ katılım uygunluğunun asıl finansal kriteri
  "total_debt",                // debt_to_equity yoksa elle hesaplamak için
  "price_52_week_high",
  "price_52_week_low",
  "Perf.3M",
  "Perf.6M",
  "Perf.YTD",
  "beta_1_year",
  "average_volume_10d_calc",
  "net_margin_ttm",
  "earnings_per_share_basic_ttm",
  "number_of_employees",
];

// Bir sütun listesini TradingView'a sorar; hata olursa fırlatmaz, raporlar.
async function tvSutunYokla(sutunlar) {
  const govde = {
    filter: [{ left: "type", operation: "equal", right: "stock" }],
    options: { lang: "tr" },
    symbols: { query: { types: [] }, tickers: [] },
    columns: ["name", ...sutunlar],
    sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    range: [0, 60],   // yoklama için 60 kayıt yeter
  };
  const r = await fetchZamanAsimli(
    "https://scanner.tradingview.com/turkey/scan",
    { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify(govde) },
    12000
  );
  if (!r.ok) return { ok: false, durum: r.status, govde: (await r.text()).slice(0, 300) };
  const j = await r.json();
  return { ok: true, satirlar: j?.data || [] };
}


function originIzinliMi(origin) {
  if (!origin) return false;
  if (/^https:\/\/katilim-analiz(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
  if (/^https:\/\/(www\.)?katilimplus\.com$/i.test(origin)) return true;
  // Native uygulama (Capacitor iOS/Android) origin'leri — 2026-07-23:
  // native WebView istekleri capacitor://localhost veya ionic://localhost
  // origin'iyle gelir; beyaz listede olmadıklari için BIST/haber/grafik
  // verileri native'de "Load failed" veriyordu.
  if (/^(capacitor|ionic):\/\/localhost$/i.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}
function corsAyarla(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", originIzinliMi(origin) ? origin : "https://katilim-analiz.vercel.app");
  res.setHeader("Vary", "Origin");
}

export default async function handler(req, res) {
  corsAyarla(req, res);
  try {
    const debug = req.query.debug === "1";

    // ── SÜTUN YOKLAMA (?debug=tvtest) ───────────────────────────────────────
    // Önce hepsi birlikte denenir (tek istek). Toplu istek reddedilirse
    // sütunlar TEK TEK yoklanır — hangisinin sorunlu olduğu böyle bulunur.
    if (req.query.debug === "tvtest") {
      const rapor = {};
      const toplu = await tvSutunYokla(TV_ADAY_SUTUNLAR);

      if (toplu.ok) {
        // Sütun i, d dizisinde i+1'de (0 = name)
        TV_ADAY_SUTUNLAR.forEach((ad, i) => {
          const degerler = toplu.satirlar.map(s => s?.d?.[i + 1]);
          const dolu = degerler.filter(v => v != null && v !== "");
          rapor[ad] = {
            calisti: true,
            doluOran: `${dolu.length}/${degerler.length}`,
            ornekler: dolu.slice(0, 3),
            tip: dolu.length ? typeof dolu[0] : null,
          };
        });
        return res.status(200).json({
          mod: "toplu",
          not: "doluOran yuksek olan sutunlar TV_SUTUNLAR'a eklenebilir",
          ornekHisseler: toplu.satirlar.slice(0, 3).map(s => s?.d?.[0]),
          rapor,
        });
      }

      // Toplu istek reddedildi → tek tek dene
      for (const ad of TV_ADAY_SUTUNLAR) {
        const tek = await tvSutunYokla([ad]);
        if (!tek.ok) { rapor[ad] = { calisti: false, durum: tek.durum, govde: tek.govde }; continue; }
        const degerler = tek.satirlar.map(s => s?.d?.[1]);
        const dolu = degerler.filter(v => v != null && v !== "");
        rapor[ad] = {
          calisti: true,
          doluOran: `${dolu.length}/${degerler.length}`,
          ornekler: dolu.slice(0, 3),
          tip: dolu.length ? typeof dolu[0] : null,
        };
      }
      return res.status(200).json({
        mod: "tek-tek",
        topluIstekHatasi: { durum: toplu.durum, govde: toplu.govde },
        rapor,
      });
    }

    // ── TEŞHİS: TradingView ham yanıtı (?debug=tv) ──────────────────────────
    // Sütun KİMLİKLERİNİN gerçekten doğru olduğunu tahminle değil canlı
    // görerek doğrulamak için. Bir kez bakıp kapatılabilir, zararsız.
    if (req.query.debug === "tv") {
      try {
        const tv = await tradingViewCek();
        const isimMap = await sirketIsimleriniGetir();
        const normal = tradingViewNormalize(tv, isimMap, KATILIM_YEDEK_LISTE);
        return res.status(200).json({
          tv_calisti: true,
          tv_toplam: tv.totalCount ?? null,
          tv_donen_satir: (tv.data || []).length,
          istenen_sutunlar: TV_SUTUNLAR,
          ham_ilk_3_satir: (tv.data || []).slice(0, 3),
          normalize_ilk_3: normal.slice(0, 3),
          normalize_toplam: normal.length,
          piyasa_acik: piyasaAcikMi(),
        });
      } catch (e) {
        return res.status(200).json({ tv_calisti: false, hata: String(e && e.message || e) });
      }
    }

    const [midasRes, isimMap] = await Promise.all([
      fetch("https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data?sortId=&return=table", {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      }),
      sirketIsimleriniGetir(),
    ]);

    let midasListe = [];
    if (midasRes.ok) {
      const text = await midasRes.text();
      try {
        const parsed = JSON.parse(text);
        midasListe = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
        if (!Array.isArray(midasListe)) midasListe = [];
      } catch(e) {}
    }

    // ─── VERİNİN KAYNAKTA ÜRETİLDİĞİ AN (2026-07-27 eklendi) ─────────────────
    // Midas her kayda kendi DateTime damgasını (epoch ms) koyuyor. Bunu dışarı
    // vermek ÖNEMLİ: 27 Temmuz'da Midas bütün gün Cuma kapanışını döndürdü,
    // uygulamada sabit "veri 15 dk gecikmeli" yazdığı için sorun saatlerce fark
    // edilmedi. Artık frontend gerçek saati de gösteriyor — kaynak donarsa
    // kullanıcı bunu doğrudan görebiliyor.
    // Kayıtlar birkaç ms farkla geldiği için EN BÜYÜK damga alınıyor.
    const zamanDamgalari = midasListe
      .map(h => h && h.DateTime)
      .filter(t => typeof t === "number" && t > 0);
    const veriZamani = zamanDamgalari.length
      ? new Date(Math.max(...zamanDamgalari)).toISOString()
      : null;

    if (debug) {
      const tumKodlar = midasListe.filter(h => h.Code && !h.Code.startsWith("X")).map(h => h.Code);
      const eslesenler = tumKodlar.filter(k => isimMap[k]);
      const eslesmeyenler = tumKodlar.filter(k => !isimMap[k]);
      const tamListe = req.query.tam === "1";
      return res.status(200).json({
        midas_kayit_sayisi: midasListe.length,
        // Verinin tazeliğini hızlıca kontrol etmek için (bkz. yukarıdaki not)
        veri_zamani: veriZamani,
        veri_yasi_dk: veriZamani ? Math.round((Date.now() - new Date(veriZamani).getTime()) / 60000) : null,
        // YENİ: Midas'ın döndürdüğü TÜM alan adlarını görmek için ham örnek —
        // sektör bilgisi (Sector/Sektor/Industry/Group vb.) var mı yok mu bunu
        // görmek için ekledik. "sektor" alanı hep boş geliyordu, kaynakta var mı
        // diye bakıyoruz.
        midas_ham_ornek: midasListe.slice(0, 3),
        midas_alan_adlari: midasListe[0] ? Object.keys(midasListe[0]) : [],
        isim_kaynagi_kayit_sayisi: Object.keys(isimMap).length,
        isim_kaynagi_ham_toplam: isimCache.rawCount,
        isim_kaynagi_ham_ornek: tamListe ? isimCache.rawSample : isimCache.rawSample?.slice(0, 2),
        isim_kaynagi_cache_yasi_dk: isimCache.ts ? Math.round((Date.now() - isimCache.ts) / 60000) : null,
        // GERÇEK EŞLEŞME ORANI — tüm hisselerin kaçında isim bulunuyor
        eslesme_orani: `${eslesenler.length} / ${tumKodlar.length}`,
        eslesmeyen_kod_sayisi: eslesmeyenler.length,
        eslesmeyen_ornekler: eslesmeyenler.slice(0, 15),
        eslesen_ornek: midasListe.slice(0, 5).map(h => ({
          kod: h.Code,
          bulunan_isim: isimMap[h.Code] || "BULUNAMADI"
        })),
        // ?tam=1 ile eklenir: statik listeye gömmek için kod->isim eşlemesinin TAMAMI
        tam_isim_haritasi: tamListe ? isimMap : undefined,
      });
    }

    // Katılım endeksi üyeliği (Redis → canlı → yedek liste). Her iki kaynak
    // yolunda da aynı Set kullanılıyor ki Midas ve TradingView tutarlı olsun.
    const { veri: katilimVeri, kaynak: katilimKaynak } = await katilimUyelikGetir();
    const katilimSet = new Set(katilimVeri.tum || []);

    const midasHisseler = midasListe
      .filter(h => h.Code && !h.Code.startsWith("X"))
      .map(h => {
        const kod = h.Code;
        return {
          ticker:       kod,
          sirket:       isimMap[kod] || kod,
          sektor:       "",
          fiyat:        h.Last || h.Close || 0,
          degisim1g:    parseFloat((h.DailyChangePercent || 0).toFixed(2)),
          degisim1h:    h.WeeklyChangePercent != null ? parseFloat(h.WeeklyChangePercent.toFixed(2)) : null,
          degisim1a:    (h.MOMChangePercent ?? h.MonthlyChangePercent) != null
                          ? parseFloat((h.MOMChangePercent ?? h.MonthlyChangePercent).toFixed(2)) : null,
          degisim1y:    (h.YearlyChangePercent ?? h.YearlyChange) != null
                          ? parseFloat((h.YearlyChangePercent ?? h.YearlyChange).toFixed(2)) : null,
          yuksek:       h.High || 0,
          dusuk:        h.Low || 0,
          hacim:        h.TotalVolume || 0,
          piyasaDegeri: h.MarketValue || 0,
          fk:           h.PriceEarning || null,
          pddd:         h.PriceBookValue || null,
          roe:          h.ReturnOnEquity != null ? h.ReturnOnEquity * 100 : null,
          temetu:       null,
          katilimEndeksi: katilimSet.has(kod),
        };
      })
      .sort((a,b) => (b.piyasaDegeri||0) - (a.piyasaDegeri||0));

    // ── KAYNAK SEÇİMİ (2026-07-28: SIRA TERSİNE ÇEVRİLDİ) ──────────────────
    // ARTIK ÖNCE TRADINGVIEW, sonra Midas.
    //
    // GEREKÇE: Midas'ın bu ucu (getmidas.com'un WordPress eklentisi,
    // /wp-json/midas-api/...) 24 Temmuz Cuma kapanışından beri donmuş —
    // dört gün boyunca aynı DateTime damgasını (1784905800501) döndürdü.
    // Bu geçici bir aksaklık değil, beslemenin kırılmış olması. Midas'ın
    // KENDİ uygulaması çalışıyor; sorun yalnızca pazarlama sitesindeki
    // "Canlı Borsa" tablosunu besleyen serviste ve fark edilmiş görünmüyor.
    //
    // Eski kurgu (Midas asıl → bayatsa TV) her istekte önce bayatlık hesabı
    // yapıp sonra yedeğe gidiyordu; kaynak kalıcı olarak bozukken bu sadece
    // gereksiz gecikme demek.
    //
    // GERİ ALMAK KOLAY: Midas düzelirse ?kaynak=midas ile anında test edilir,
    // kalıcı dönüş için aşağıdaki TERCIH sabitini "midas" yapmak yeterli.
    const TERCIH = "tradingview";                    // "tradingview" | "midas"
    const zorlananKaynak = req.query.kaynak;         // test/geri alma anahtarı
    const oncelik = (zorlananKaynak === "midas" || zorlananKaynak === "tradingview")
      ? zorlananKaynak : TERCIH;

    let hisseler = midasHisseler;
    let kaynak = "midas";
    let etkinVeriZamani = veriZamani;
    let yedekHata = null;

    if (oncelik === "tradingview") {
      try {
        const tv = await tradingViewCek();
        const tvHisseler = tradingViewNormalize(tv, isimMap, katilimSet);
        // Anlamlı sayıda kayıt gelmediyse güvenme — Midas'a düş.
        if (tvHisseler.length >= 100) {
          hisseler = tvHisseler;
          kaynak = "tradingview";
          // TradingView de ~15 dk gecikmeli veri veriyor; kesin damga
          // sunmadığı için zamanı bu bilinen gecikmeye göre belirtiyoruz.
          etkinVeriZamani = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        } else {
          yedekHata = `TV yetersiz kayit (${tvHisseler.length}) — Midas'a dusuldu`;
        }
      } catch (e) {
        yedekHata = String(e && e.message || e) + " — Midas'a dusuldu";
      }
    }

    // ── ÖNBELLEK SÜRESİ PİYASA SAATİNE GÖRE ────────────────────────────────
    // Fiyatlar yalnızca seans içinde değişiyor; kapalıyken aynı veriyi 10
    // dakikada bir yeniden üretmek boşuna işlemci harcaması. Vercel CPU
    // kotası sınırlı olduğu için (aylık 4 saat, Temmuz sonunda %75'i doluydu)
    // bu gerçek bir tasarruf: haftanın ~%75'i seans dışı, o sürede istekler
    // fonksiyonu hiç çalıştırmadan CDN önbelleğinden karşılanıyor.
    //
    // Pencere 18:30'a kadar uzatıldı çünkü kapanış verisi 18:00'dan sonra
    // birkaç dakika daha oturuyor (Midas damgası 18:10 görülmüştü).
    const tazelenmeli = veriTazelenirMi();
    const onbellekSn = tazelenmeli ? 600 : 3600;
    res.setHeader("Cache-Control", `s-maxage=${onbellekSn}, stale-while-revalidate=120`);

    // ── ALARM ANLIK GÖRÜNTÜSÜ ────────────────────────────────────────────────
    // api/bildirim.js bunu okuyor (bkz. KV_HISSE_FIYAT_KEY notu). Yanıttan
    // ÖNCE yazılıyor ama hata yutuluyor: Redis erişilemezse kullanıcıya
    // dönen fiyat verisi bundan etkilenmemeli. En kötü durumda bildirim.js
    // kendi HTTP yedeğine düşer.
    try {
      const fiyatHaritasi = {};
      for (const h of hisseler) {
        if (h?.ticker && typeof h.fiyat === "number" && h.fiyat > 0) fiyatHaritasi[h.ticker] = h.fiyat;
      }
      if (Object.keys(fiyatHaritasi).length >= 100) {
        await redis.set(KV_HISSE_FIYAT_KEY, {
          veriZamani: etkinVeriZamani,
          kaynak,
          yazilmaTs: Date.now(),
          adet: Object.keys(fiyatHaritasi).length,
          fiyatlar: fiyatHaritasi,
        }, { ex: HISSE_FIYAT_TTL });
      }
    } catch (e) {
      console.error("Alarm fiyat anlik goruntusu yazilamadi:", e.message);
    }

    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h=>h.katilimEndeksi).length,
      guncelleme: new Date().toISOString(),   // bu isteğin işlendiği an
      veriZamani: etkinVeriZamani,             // verinin üretildiği an (bkz. yukarıdaki not)
      kaynak,                                  // "midas" | "tradingview"
      // Midas'ın durumu izlenebilsin diye her yanıtta bildiriliyor — düzelip
      // düzelmediğini görmek için ayrıca istek atmaya gerek kalmıyor.
      midasVeriZamani: veriZamani,
      midasBayat: midasBayatMi(veriZamani),
      // Katılım üyeliğinin nereden geldiği izlenebilsin: "onbellek"|"canli"|"yedek".
      // "yedek" görülüyorsa TradingView'a ulaşılamıyor demektir — liste bayatlar.
      katilimKaynak,
      katilimSayisi: katilimSet.size,
      ...(yedekHata ? { yedekHata } : {}),     // yedek denenip başarısız olduysa sebebi
      data: hisseler,
    });

  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
}
