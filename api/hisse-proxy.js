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

const KV_KATILIM_KEY = "katilim:endeks:v1";
const KATILIM_TTL = 24 * 3600;
const KV_HISSE_FIYAT_KEY = "hisse:fiyat:v1";
const HISSE_FIYAT_TTL = 3 * 3600;

// ── HİSSE EK VERİ ÖNBELLEĞİ (2026-08-18) ────────────────────────────────────
// GEREKÇE: Midas ana kaynak olduğundan beri (bkz. "KAYNAK SECIMI" notu aşağıda)
// TradingView'a özgü alanlar (sektör, endüstri, borç/özkaynak, beta, net kâr
// marjı, hisse başı kâr, 10 günlük ort. hacim, 3A/6A/YTD getiri) her istekte
// null geliyordu — kullanıcı ekran görüntüsüyle bildirdi (Bilgi sekmesi ve
// Getiri sekmesindeki 6 Ay/YTD kutuları boş). Kullanıcının önerisi doğru:
// bu alanlar (sektör, beta, F/K gibi temel göstergeler) günlük hızla
// DEĞİŞMEZ — her istekte canlı TradingView çağrısı yapmak yerine, GÜNDE
// BİR-İKİ KEZ Redis'e yazılıp buradan okunabilir. Aynen katılimUyelikGetir()
// deseninin (Redis → canlı istek → yedek, 24 saatlik TTL) burada da
// uygulanması — TEK FARK: veri kod→obje haritası, tek bir dizi değil.
const KV_HISSE_EK_VERI_KEY = "hisse:ek-veri:v1";
const HISSE_EK_VERI_TTL = 24 * 3600; // 24 saat — sektör/beta gibi yavaş değişen alanlar için yeterli

const KATILIM_ENDEKS_ESLEME = {
  "BIST:XKTUM": "tum",
  "BIST:XK100": "yuz",
  "BIST:XK050": "elli",
  "BIST:XK030": "otuz",
};

function fetchZamanAsimli(url, opts, msTimeout) {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), msTimeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(zamanlayici));
}

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
    15000
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

async function katilimUyelikGetir() {
  try {
    const kayit = await redis.get(KV_KATILIM_KEY);
    if (kayit && Array.isArray(kayit.tum) && kayit.tum.length > 50) {
      return { veri: kayit, kaynak: "onbellek" };
    }
  } catch {}

  try {
    const gruplar = await tradingViewEndeksCek();
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

const STATIC_ISIM_HARITASI = {"A1CAP":"A1 CAPITAL YATIRIM","A1YEN":"A1 YENILENEBILIR ENERJI","AAGYO":"AGAOGLU GMYO","ACSEL":"ACIPAYAM SELULOZ","ADEL":"ADEL KALEMCILIK","ADESE":"ADESE GAYRIMENKUL","ADGYO":"ADRA GMYO","AEFES":"ANADOLU EFES","AFYON":"AFYON CIMENTO","AGESA":"AGESA HAYAT EMEKLILIK","AGHOL":"ANADOLU GRUBU HOLDING","AGROT":"AGROTECH TEKNOLOJI","AGYO":"ATAKULE GMYO","AHGAZ":"AHLATCI DOGALGAZ","AHSGY":"AHES GMYO","AKBNK":"AKBANK","AKCNS":"AKCANSA","AKENR":"AKENERJI","AKFGY":"AKFEN GMYO","AKFIS":"AKFEN INSAAT","AKFYE":"AKFEN YEN. ENERJI","AKGRT":"AKSIGORTA","AKHAN":"AKHAN UN","AKMGY":"AKMERKEZ GMYO","AKSA":"AKSA","AKSEN":"AKSA ENERJI","AKSGY":"AKIS GMYO","AKSUE":"AKSU ENERJI","AKYHO":"AKDENIZ YATIRIM HOLDING","ALARK":"ALARKO HOLDING","ALBRK":"ALBARAKA TURK","ALCAR":"ALARKO CARRIER","ALCTL":"ALCATEL LUCENT TELETAS","ALFAS":"ALFA SOLAR ENERJI","ALGYO":"ALARKO GMYO","ALKA":"ALKIM KAGIT","ALKIM":"ALKIM KIMYA","ALKLC":"ALTINKILIC GIDA VE SUT","ALTNY":"ALTINAY SAVUNMA","ALVES":"ALVES KABLO","ANELE":"ANEL ELEKTRIK","ANGEN":"ANATOLIA TANI VE BIYOTEKNOLOJI","ANHYT":"ANADOLU HAYAT EMEK.","ANSGR":"ANADOLU SIGORTA","APBDL":"AK PORTFOY BIST BANKA DISI LIKIT 10 HSY BYF","APGLD":"AK PORTFOY ALTIN KATILIM BYF","APLIB":"AK PORTFOY BIST LIKIT BANKA HSY BYF","APMDL":"AK PORTFOY BIST 100 ENDEKSI MODEL HSY BYF","APX30":"AK PORTFOY BIST 30 ENDEKSI HSY BYF","ARASE":"DOGU ARAS ENERJI","ARCLK":"ARCELIK","ARDYZ":"ARD BILISIM TEKNOLOJILERI","ARENA":"ARENA BILGISAYAR","ARFYE":"ARF BIO YENILENEBILIR ENERJI","ARMGD":"ARMADA GIDA","ARSAN":"ARSAN HOLDING","ARTMS":"ARTEMIS HALI","ARZUM":"ARZUM EV ALETLERI","ASELS":"ASELSAN","ASGYO":"ASCE GMYO","ASTOR":"ASTOR ENERJI","ASUZU":"ANADOLU ISUZU","ATAGY":"ATA GMYO","ATAKP":"ATAKEY PATATES","ATATP":"ATP YAZILIM","ATATR":"ATA TURIZM","ATEKS":"AKIN TEKSTIL","ATLAS":"ATLAS YAT. ORT.","ATSYH":"ATLANTIS YATIRIM HOLDING","AVGYO":"AVRASYA GMYO","AVHOL":"AVRUPA YATIRIM HOLDING","AVOD":"A.V.O.D GIDA VE TARIM","AVPGY":"AVRUPAKENT GMYO","AVTUR":"AVRASYA PETROL VE TUR.","AYCES":"ALTINYUNUS CESME","AYDEM":"AYDEM ENERJI","AYEN":"AYEN ENERJI","AYES":"AYES CELIK HASIR VE CIT","AYGAZ":"AYGAZ","AZTEK":"AZTEK TEKNOLOJI","BAGFS":"BAGFAS","BAHKM":"BAHADIR KIMYA","BAKAB":"BAK AMBALAJ","BALAT":"BALATACILAR BALATACILIK","BALSU":"BALSU GIDA","BANVT":"BANVIT","BARMA":"BAREM AMBALAJ","BASCM":"BASTAS BASKENT CIMENTO","BASGZ":"BASKENT DOGALGAZ GMYO","BAYRK":"BAYRAK TABAN SANAYI","BEGYO":"BATI EGE GMYO","BERA":"BERA HOLDING","BESLR":"BESLER GIDA","BESTE":"BEST BRANDS ENERJI","BETAE":"BETA ENERJI VE TEKNOLOJI","BEYAZ":"BEYAZ FILO","BFREN":"BOSCH FREN SISTEMLERI","BIENY":"BIEN YAPI URUNLERI","BIGCH":"BUYUK SEFLER BIGCHEFS","BIGEN":"BIRLESIM GRUP ENERJI","BIGTK":"BIG MEDYA TEKNOLOJI","BIMAS":"BIM MAGAZALAR","BINBN":"BIN ULASIM TEKNOLOJILERI","BINHO":"1000 YATIRIMLAR HOL.","BIOEN":"BIOTREND CEVRE VE ENERJI","BIZIM":"BIZIM MAGAZALARI","BJKAS":"BESIKTAS FUTBOL YAT.","BLCYT":"BILICI YATIRIM","BLUME":"BLUME METAL KIMYA","BMSCH":"BMS CELIK HASIR","BMSTL":"BMS BIRLESIK METAL","BNTAS":"BANTAS AMBALAJ","BOBET":"BOGAZICI BETON SANAYI","BORLS":"BORLEASE OTOMOTIV","BORSK":"BOR SEKER","BOSSA":"BOSSA","BRISA":"BRISA","BRKO":"BIRKO MENSUCAT","BRKSN":"BERKOSAN YALITIM","BRKVY":"BIRIKIM VARLIK YONETIM","BRLSM":"BIRLESIM MUHENDISLIK","BRMEN":"BIRLIK MENSUCAT","BRSAN":"BORUSAN BORU SANAYI","BRYAT":"BORUSAN YAT. PAZ.","BSOKE":"BATICIM CIMENTO","BTCIM":"BATICIM BATI ANADOLU","BUCIM":"BURSA CIMENTO","BULGS":"BULLS GSYO","BURCE":"BURCELIK","BURVA":"BURCELIK VANA","BVSAN":"BULBULOGLU VINC","BYDNR":"BAYDONER RESTORANLARI","CANTE":"CAN2 TERMIK","CATES":"CATES ELEKTRIK","CCOLA":"COCA COLA ICECEK","CELHA":"CELIK HALAT","CEMAS":"CEMAS DOKUM","CEMTS":"CEMTAS","CEMZY":"CEM ZEYTIN","CEOEM":"CEO EVENT MEDYA","CGCAM":"CAGDAS CAM","CIMSA":"CIMSA","CLEBI":"CELEBI","CMBTN":"CIMBETON","CMENT":"CIMENTAS","CONSE":"CONSUS ENERJI","COSMO":"COSMOS YAT. HOLDING","CRDFA":"CREDITWEST FAKTORING","CRFSA":"CARREFOURSA","CUSAN":"CUHADAROGLU METAL","CVKMD":"CVK MADEN","CWENE":"CW ENERJI","DAGI":"DAGI GIYIM","DAPGM":"DAP GAYRIMENKUL","DARDL":"DARDANEL","DCTTR":"DCT TRADING DIS TICARET","DENGE":"DENGE HOLDING","DERHL":"DERLUKS YATIRIM HOLDING","DERIM":"DERIMOD","DESA":"DESA DERI","DESPC":"DESPEC BILGISAYAR","DEVA":"DEVA HOLDING","DGATE":"DATAGATE BILGISAYAR","DGGYO":"DOGUS GMYO","DGNMO":"DOGANLAR MOBILYA","DIRIT":"DIRITEKS DIRILIS TEKSTIL","DITAS":"DITAS BDY","DMRGD":"DMR UNLU MAMULLER","DMSAS":"DEMISAS DOKUM","DNISI":"DINAMIK ISI MAKINA YALITIM","DOAS":"DOGUS OTOMOTIV","DOCO":"DO-CO","DOFER":"DOFER YAPI MALZEMELERI","DOFRB":"DOF ROBOTIK","DOGUB":"DOGUSAN","DOHOL":"DOGAN HOLDING","DOKTA":"DOKTAS DOKUMCULUK","DSTKF":"DESTEK FINANS FAKTORING","DUNYH":"DUNYA HOLDING","DURDO":"DURAN DOGAN BASIM","DURKN":"DURUKAN SEKERLEME","DYOBY":"DYO BOYA","DZGYO":"DENIZ GMYO","EBEBK":"EBEBEK MAGAZACILIK","ECILC":"ECZACIBASI ILAC","ECOGR":"ECOGREEN ENERJI","ECZYT":"ECZACIBASI YATIRIM","EDATA":"E-DATA TEKNOLOJI","EDIP":"EDIP GAYRIMENKUL","EFOR":"EFOR YATIRIM","EGEEN":"EGE ENDUSTRI","EGEGY":"EGEYAPI AVRUPA GMYO","EGEPO":"NASMED EGEPOL","EGGUB":"EGE GUBRE","EGPRO":"EGE PROFIL","EGSER":"EGE SERAMIK","EKDMR":"EKINCILER DEMIR CELIK","EKGYO":"EMLAK KONUT GMYO","EKIZ":"EKIZ KIMYA","EKOS":"EKOS TEKNOLOJI","EKSUN":"EKSUN GIDA","ELITE":"ELITE NATUREL ORGANIK GIDA","EMKEL":"EMEK ELEKTRIK","EMNIS":"EMINIS AMBALAJ","EMPAE":"EMPA ELEKTRONIK","ENDAE":"ENDA ENERJI HOLDING","ENERY":"ENERYA ENERJI","ENJSA":"ENERJISA ENERJI","ENKAI":"ENKA INSAAT","ENPRA":"ENPARA BANK","ENRYA":"ENERYA ENERJİ","ENSRI":"ENSARI SINAI YATIRIMLAR","ENTRA":"IC ENTERRA YEN. ENERJI","EPLAS":"EGEPLAST","ERBOS":"ERBOSAN","ERCB":"ERCIYAS CELIK BORU","EREGL":"EREGLI DEMIR CELIK","ERSU":"ERSU GIDA","ESCAR":"ESCAR FILO","ESCOM":"ESCORT TEKNOLOJI","ESEN":"ESENBOGA ELEKTRIK","ETILR":"ETILER GIDA","ETYAT":"EURO TREND YAT. ORT.","EUHOL":"EURO YATIRIM HOLDING","EUKYO":"EURO KAPITAL YAT. ORT.","EUPWR":"EUROPOWER ENERJI","EUREN":"EUROPEN ENDUSTRI","EUYO":"EURO YAT. ORT.","EYGYO":"EYG GMYO","FADE":"FADE GIDA","FENER":"FENERBAHCE FUTBOL","FLAP":"FLAP KONGRE TOPLANTI HIZ.","FMIZP":"F-M IZMIT PISTON","FONET":"FONET BILGI TEKNOLOJILERI","FORMT":"FORMET METAL VE CAM","FORTE":"FORTE BILGI ILETISIM","FRIGO":"FRIGO PAK GIDA","FRMPL":"FORMUL PLASTIK VE METAL","FROTO":"FORD OTOSAN","FZLGY":"FUZUL GMYO","GARAN":"GARANTI BANKASI","GARFA":"GARANTI FAKTORING","GATEG":"GATE GROUP TEKNOLOJI","GEDIK":"GEDIK Y. MEN. DEG.","GEDZA":"GEDIZ AMBALAJ","GENIL":"GEN ILAC","GENKM":"GENTAS KIMYA","GENTS":"GENTAS","GEREL":"GERSAN ELEKTRIK","GESAN":"GIRISIM ELEKTRIK SANAYI","GIPTA":"GIPTA OFIS KIRTASIYE","GLBMD":"GLOBAL MEN. DEG.","GLCVY":"GELECEK VARLIK YONETIMI","GLDTR":"QNB PORTFOY ALTIN KATILIM BYF","GLRMK":"GULERMAK AGIR SANAYI","GLRYH":"GULER YAT. HOLDING","GLYHO":"GLOBAL YAT. HOLDING","GMSTR":"QNB PORTFOY GUMUS KATILIM BYF","GMSTRF":"FINANS PORTFOY GUMUS BYF","GMTAS":"GIMAT MAGAZACILIK","GOKNR":"GOKNUR GIDA","GOLTS":"GOLTAS CIMENTO","GOODY":"GOOD-YEAR","GOZDE":"GOZDE GIRISIM","GRNYO":"GARANTI YAT. ORT.","GRSEL":"GUR-SEL TURIZM TASIMACILIK","GRTHO":"GRAINTURK HOLDING","GSDDE":"GSD DENIZCILIK","GSDHO":"GSD HOLDING","GSRAY":"GALATASARAY SPORTIF","GUBRF":"GUBRE FABRIK.","GUNDG":"GUNDOGDU GIDA","GWIND":"GALATA WIND ENERJI","GZNMI":"GEZINOMI SEYAHAT","HALKB":"T. HALK BANKASI","HATEK":"HATAY TEKSTIL","HATSN":"HATSAN GEMI","HDFGS":"HEDEF GIRISIM","HEDEF":"HEDEF HOLDING","HEKTS":"HEKTAS","HKTM":"HIDROPAR HAREKET KONTROL","HLGYO":"HALK GMYO","HOROZ":"HOROZ LOJISTIK","HRKET":"HAREKET PROJE TASIMACILIGI","HTTBT":"HITIT BILGISAYAR","HUBVC":"HUB GIRISIM","HUNER":"HUN YENILENEBILIR ENERJI","HURGZ":"HURRIYET GZT.","ICBCT":"ICBC TURKEY BANK","ICUGS":"ICU GIRISIM","IDGYO":"IDEALIST GMYO","IEYHO":"ISIKLAR ENERJI YAPI HOL.","IHAAS":"IHLAS HABER AJANSI","IHEVA":"IHLAS EV ALETLERI","IHGZT":"IHLAS GAZETECILIK","IHLAS":"IHLAS HOLDING","IHLGM":"IHLAS GAYRIMENKUL","IHYAY":"IHLAS YAYIN HOLDING","IMASM":"IMAS MAKINA","INDES":"INDEKS BILGISAYAR","INFO":"INFO YATIRIM","INGRM":"INGRAM BILISIM","INTEK":"INNOSA TEKNOLOJI","INTEM":"INTEMA","INVEO":"INVEO YATIRIM HOLDING","INVES":"INVESTCO HOLDING","ISATR":"IS BANKASI (A)","ISBIR":"ISBIR HOLDING","ISBTR":"IS BANKASI (B)","ISCTR":"IS BANKASI (C)","ISDMR":"ISKENDERUN DEMIR CELIK","ISFIN":"IS FIN.KIR.","ISGLK":"IS PORTFOY ALTIN KATILIM BYF","ISGSY":"IS GIRISIM","ISGYO":"IS GMYO","ISKPL":"ISIK PLASTIK","ISKUR":"IS BANKASI (KUR.)","ISMEN":"IS Y. MEN. DEG.","ISSEN":"ISBIR SENTETIK DOKUMA","ISYAT":"IS YAT. ORT.","IZENR":"IZDEMIR ENERJI","IZFAS":"IZMIR FIRCA","IZINV":"IZ YATIRIM HOLDING","IZMDC":"IZMIR DEMIR CELIK","JANTS":"JANTSA JANT SANAYI","KAPLM":"KAPLAMIN","KAREL":"KAREL ELEKTRONIK","KARSN":"KARSAN OTOMOTIV","KARTN":"KARTONSAN","KATMR":"KATMERCILER EKIPMAN","KAYSE":"KAYSERI SEKER FABRIKASI","KBORU":"KUZEY BORU","KCAER":"KOCAER CELIK","KCHOL":"KOC HOLDING","KENT":"KENT GIDA","KERVN":"KERVANSARAY YAT. HOLDING","KFEIN":"KAFEIN YAZILIM","KGYO":"KORAY GMYO","KIMMR":"KIM MARKET-ERSAN ALISVERIS","KLGYO":"KILER GMYO","KLKIM":"KALEKIM KIMYEVI MADDELER","KLMSN":"KLIMASAN KLIMA","KLNMA":"T. KALKINMA BANK.","KLRHO":"KILER HOLDING","KLSER":"KALESERAMIK","KLSYN":"KOLEKSIYON MOBILYA","KLYPV":"KALYON GUNES TEKNOLOJILERI","KMPUR":"KIMTEKS POLIURETAN","KNFRT":"KONFRUT TARIM","KOCMT":"KOC METALURJI","KONKA":"KONYA KAGIT","KONTR":"KONTROLMATIK TEKNOLOJI","KONYA":"KONYA CIMENTO","KOPOL":"KOZA POLYESTER","KORDS":"KORDSA TEKNIK TEKSTIL","KOTON":"KOTON MAGAZACILIK","KRDMA":"KARDEMIR (A)","KRDMB":"KARDEMIR (B)","KRDMD":"KARDEMIR (D)","KRGYO":"KORFEZ GMYO","KRONT":"KRON TEKNOLOJI","KRPLS":"KOROPLAST TEMIZLIK AMBALAJ","KRSTL":"KRISTAL KOLA","KRTEK":"KARSU TEKSTIL","KRVGD":"KERVAN GIDA","KSTUR":"KUSTUR KUSADASI TURIZM","KTLEV":"KATILIMEVIM TAS. FIN.","KTSKR":"KUTAHYA SEKER FABRIKASI","KUTPO":"KUTAHYA PORSELEN","KUVVA":"KUVVA GIDA","KUYAS":"KUYAS YATIRIM","KZBGY":"KIZILBUK GYO","KZGYO":"KUZUGRUP GMYO","LIDER":"LDR TURIZM","LIDFA":"LIDER FAKTORING","LILAK":"LILA KAGIT","LINK":"LINK BILGISAYAR","LKMNH":"LOKMAN HEKIM SAGLIK","LMKDC":"LIMAK DOGU ANADOLU","LOGO":"LOGO YAZILIM","LRSHO":"LORAS HOLDING","LUKSK":"LUKS KADIFE","LXGYO":"LUXERA GMYO","LYDHO":"LYDIA HOLDING","LYDIA":"LYDIA HOLDING","LYDYE":"LYDIA YESIL ENERJI","MAALT":"MARMARIS ALTINYUNUS","MACKO":"MACKOLIK INTERNET HIZMETLERI","MAGEN":"MARGUN ENERJI","MAKIM":"MAKIM MAKINE","MAKTK":"MAKINA TAKIM","MANAS":"MANAS ENERJI YONETIMI","MARBL":"TUREKS TURUNC MADENCILIK","MARKA":"MARKA YATIRIM HOLDING","MARMR":"MARMARA HOLDING","MARTI":"MARTI OTEL","MAVI":"MAVI GIYIM","MCARD":"METROPAL KURUMSAL HIZMETLER","MEDTR":"MEDITERA TIBBI MALZEME","MEGAP":"MEGA POLIETILEN","MEGMT":"MEGA METAL","MEKAG":"MEKA GLOBAL MAKINE","MEPET":"BREAK MOLA TURIZM","MERCN":"MERCAN KIMYA","MERIT":"MERIT TURIZM","MERKO":"MERKO GIDA","METRO":"METRO HOLDING","MEYSU":"MEYSU GIDA","MGROS":"MIGROS TICARET","MHRGY":"MHR GMYO","MIATK":"MIA TEKNOLOJI","MMCAS":"MMC SAN. VE TIC. YAT.","MNDRS":"MENDERES TEKSTIL","MNDTR":"MONDI TURKEY","MOBTL":"MOBILTEL ILETISIM","MOGAN":"MOGAN ENERJI","MOPAS":"MOPAS MARKETCILIK","MPARK":"MLP SAGLIK","MRGYO":"MARTI GMYO","MRSHL":"MARSHALL","MSGYO":"MISTRAL GMYO","MTRKS":"MATRIKS FINANSAL TEKNOLOJILER","MTRYO":"METRO YAT. ORT.","MZHLD":"MAZHAR ZORLU HOLDING","NATEN":"NATUREL ENERJI","NETAS":"NETAS TELEKOM.","NETCD":"NETCAD YAZILIM","NIBAS":"NIGBAS NIGDE BETON","NPTLR":"NUROL PORTFOY TLREF BYF","NTGAZ":"NATURELGAZ","NTHOL":"NET HOLDING","NUGYO":"NUROL GMYO","NUHCM":"NUH CIMENTO","OBAMS":"OBA MAKARNACILIK","OBASE":"OBASE BILGISAYAR","ODAS":"ODAS ELEKTRIK","ODINE":"ODINE TEKNOLOJI","OFSYM":"OFIS YEM GIDA","ONCSM":"ONCOSEM ONKOLOJIK SISTEMLER","ONRYT":"ONUR TEKNOLOJI","OPK30":"OSMANLI PORTFOY KATILIM 30 ENDEKS HSY BYF","OPT25":"OSMANLI PORTFOY BIST TEMETTU 25 ENDEKS HSY BYF","OPTGY":"OSMANLI PORTFOY KAR PAYI ODEYEN BIST GYO HSY BYF","OPTLR":"OSMANLI P BIST TLREF(TL) END BYF","OPX30":"OSMANLI PORTFOY BIST 30 HSY BYF","ORCAY":"ORCAY ORTAKOY CAY SANAYI","ORGE":"ORGE ENERJI ELEKTRIK","ORMA":"ORMA ORMAN MAHSULLERI","OSMEN":"OSMANLI MENKUL","OSTIM":"OSTIM ENDUSTRIYEL YAT","OTKAR":"OTOKAR","OTTO":"OTTO HOLDING","OYAKC":"OYAK CIMENTO","OYAYO":"OYAK YAT. ORT.","OYLUM":"OYLUM SINAI YATIRIMLAR","OYYAT":"OYAK YATIRIM MENKUL","OZATD":"OZATA DENIZCILIK","OZGYO":"OZDERICI GMYO","OZKGY":"OZAK GMYO","OZRDN":"OZERDEN AMBALAJ","OZSUB":"OZSU BALIK","OZYSR":"OZYASAR TEL","PAGYO":"PANORA GMYO","PAHOL":"PASIFIK HOLDING","PAMEL":"PAMEL ELEKTRIK","PAPIL":"PAPILON SAVUNMA","PARSN":"PARSAN","PASEU":"PASIFIK EURASIA LOJISTIK","PATEK":"PASIFIK TEKNOLOJI","PCILT":"PC ILETISIM MEDYA","PEKGY":"PEKER GMYO","PENGD":"PENGUEN GIDA","PENTA":"PENTA TEKNOLOJI URUNLERI DAGITIM","PETKM":"PETKIM","PETUN":"PINAR ET VE UN","PGSUS":"PEGASUS","PINSU":"PINAR SU","PKART":"PLASTIKKART","PKENT":"PETROKENT TURIZM","PLTUR":"PLATFORM TURIZM","PNLSN":"PANELSAN CATI CEPHE","PNSUT":"PINAR SUT","POLHO":"POLISAN HOLDING","POLTK":"POLITEKNIK METAL","PRDGS":"PARDUS GIRISIM","PRKAB":"TURK PRYSMIAN KABLO","PRKME":"PARK ELEK.MADENCILIK","PRZMA":"PRIZMA PRESS MATBAACILIK","PSDTC":"PERGAMON DIS TICARET","PSGYO":"PASIFIK GMYO","QNBFK":"QNB FINANSAL KIRALAMA","QNBTR":"QNB BANK","QTEMZ":"QNB PORTFOY TEMIZ ENERJI HSY BYF","QUAGR":"QUA GRANITE HAYAL YAPI","RALYH":"RAL YATIRIM HOLDING","RAYSG":"RAY SIGORTA","REEDR":"REEDER TEKNOLOJI","RGYAS":"RONESANS GAYRIMENKUL YAT.","RNPOL":"RAINBOW POLIKARBONAT","RODRG":"RODRIGO TEKSTIL","RTALB":"RTA LABORATUVARLARI","RUBNS":"RUBENIS TEKSTIL","RUZYE":"RUZY MADENCILIK VE ENERJI","RYGYO":"REYSAS GMYO","RYSAS":"REYSAS LOJISTIK","SAFKR":"SAFKAR EGE SOGUTMACILIK","SAHOL":"SABANCI HOLDING","SAMAT":"SARAY MATBAACILIK","SANEL":"SANEL MUHENDISLIK","SANFM":"SANIFOAM ENDUSTRI","SANKO":"SANKO PAZARLAMA","SARKY":"SARKUYSAN","SASA":"SASA POLYESTER","SAYAS":"SAY YENILENEBILIR ENERJI","SDTTR":"SDT UZAY VE SAVUNMA","SEGMN":"SEGMEN KARDESLER GIDA","SEGYO":"SEKER GMYO","SEKFK":"SEKER FIN. KIR.","SEKUR":"SEKURO PLASTIK","SELEC":"SELCUK ECZA DEPOSU","SELVA":"SELVA GIDA","SERNT":"SERANIT GRANIT SERAMIK","SEYKM":"SEYITLER KIMYA","SILVR":"SILVERLINE ENDUSTRI","SISE":"SISE CAM","SKBNK":"SEKERBANK","SKTAS":"SOKTAS","SKYLP":"SKYALP FINANSAL TEKNOLOJILER","SKYMD":"SEKER YATIRIM","SMART":"SMARTIKS YAZILIM","SMRTG":"SMART GUNES ENERJISI TEK.","SMRVA":"SUMER VARLIK YONETIM","SNGYO":"SINPAS GMYO","SNICA":"SANICA ISI SANAYI","SNPAM":"SONMEZ PAMUKLU","SODSN":"SODAS SODYUM SANAYII","SOKE":"SOKE DEGIRMENCILIK","SOKM":"SOK MARKETLER TICARET","SONME":"SONMEZ FILAMENT","SRVGY":"SERVET GMYO","SUMAS":"SUMAS SUNI TAHTA","SUNTK":"SUN TEKSTIL","SURGY":"SUR TATIL EVLERI GMYO","SUWEN":"SUWEN TEKSTIL","SVGYO":"SAVUR GMYO","TABGD":"TAB GIDA","TARKM":"TARKIM BITKI KORUMA","TATEN":"TATLIPINAR ENERJI URETIM","TATGD":"TAT GIDA","TAVHL":"TAV HAVALIMANLARI","TBORG":"T.TUBORG","TCELL":"TURKCELL","TCKRC":"KIRAC GALVANIZ","TDGYO":"TREND GMYO","TEHOL":"TERA YATIRIM TEK. HOL.","TEKTU":"TEK-ART TURIZM","TERA":"TERA YATIRIM MENKUL DEGERLER","TEZOL":"EUROPAP TEZOL KAGIT","TGSAS":"TGS DIS TICARET","THYAO":"TURK HAVA YOLLARI","TKFEN":"TEKFEN HOLDING","TKNSA":"TEKNOSA IC VE DIS TICARET","TLMAN":"TRABZON LIMAN","TMPOL":"TEMAPOL POLIMER PLASTIK","TMSN":"TUMOSAN MOTOR VE TRAKTOR","TNZTP":"TAPDI TINAZTEPE","TOASO":"TOFAS OTO. FAB.","TRALT":"TURK ALTIN ISLETMELERI","TRCAS":"TURCAS HOLDING","TRENJ":"TR DOGAL ENERJI","TRGYO":"TORUNLAR GMYO","TRHOL":"TERA FINANSAL YAT. HOL.","TRILC":"TURK ILAC SERUM","TRMET":"TR ANADOLU METAL MADENCILIK","TSGYO":"TSKB GMYO","TSKB":"T.S.K.B.","TSPOR":"TRABZONSPOR SPORTIF","TTKOM":"TURK TELEKOM","TTRAK":"TURK TRAKTOR","TUCLK":"TUGCELIK","TUKAS":"TUKAS","TUPRS":"TUPRAS","TUREX":"TUREKS TURIZM TASIMACILIK","TURGG":"TURKER PROJE GAYRIMENKUL","TURSG":"TURKIYE SIGORTA","UCAYM":"UCAY MUHENDISLIK","UFUK":"UFUK YATIRIM","ULAS":"ULASLAR TURIZM YAT.","ULKER":"ULKER BISKUVI","ULUFA":"ULUSAL FAKTORING","ULUSE":"ULUSOY ELEKTRIK","ULUUN":"ULUSOY UN SANAYI","UMPAS":"UMPAS HOLDING","UNLU":"UNLU YATIRIM HOLDING","USAK":"USAK SERAMIK","USDTR":"QNB PORTFOY ABD DOLARI BYF","USDTRF":"ABD HAZ BONOSU DOLAR BYF","VAKBN":"VAKIFLAR BANKASI","VAKFA":"VAKIF FAKTORING","VAKFN":"VAKIF FIN. KIR.","VAKKO":"VAKKO TEKSTIL","VANGD":"VANET GIDA","VBTYZ":"VBT YAZILIM","VERTU":"VERUSATURK GIRISIM","VERUS":"VERUSA HOLDING","VESBE":"VESTEL BEYAZ ESYA","VESTL":"VESTEL","VKFYO":"VAKIF YAT. ORT.","VKGYO":"VAKIF GMYO","VKING":"VIKING KAGIT","VRGYO":"VERA KONSEPT GMYO","VSNMD":"VISNE MADENCILIK","YAPRK":"YAPRAK SUT VE BESI CIFT.","YATAS":"YATAS","YAYLA":"YAYLA EN. UR. TUR. VE INS","YBTAS":"YIBITAS INSAAT MALZEME","YEOTK":"YEO TEKNOLOJI ENERJI","YESIL":"YESIL YATIRIM HOLDING","YGGYO":"YENI GIMAT GMYO","YIGIT":"YIGIT AKU","YKBNK":"YAPI VE KREDI BANK.","YKSLN":"YUKSELEN CELIK","YONGA":"YONGA MOBILYA","YUNSA":"YUNSA","YYAPI":"YESIL YAPI","YYLGD":"YAYLA GIDA","Z30EA":"ZIRAAT PORTFOY BIST30 EA ENDEKSI HSY BYF","Z30KE":"ZIRAAT PORTFOY KATILIM 30 EA HSY BYF","Z30KP":"ZIRAAT PORTFOY KATILIM 30 ENDEKSI HSY BYF","ZEDUR":"ZEDUR ENERJI","ZELOT":"ZIRAAT PORTFOY BIST 50-30 HY BYF","ZERGY":"ZERAY GMYO","ZGOLD":"ZIRAAT PORTFOY ALTIN BYF","ZGOLDF":"ZIRAAT PORTFOY ALTIN BYF","ZGYO":"Z GMYO","ZOREN":"ZORLU ENERJI","ZPBDL":"ZIRAAT PORTFOY BIST BANKA DISI LIKIT 10 HY BYF","ZPLIB":"ZIRAAT PORTFOY BIST LIKIT BANKA HY BYF","ZPT10":"ZIRAAT PORTFOY YP TEKNOLOJI ILETISIM 10 HY BYF","ZPX30":"ZIRAAT PORTFOY BIST 30 HY BYF","ZRE20":"ZIRAAT PORTFOY RISK ESIT BD20 ENDEKSI HSY BYF","ZRGYO":"ZIRAAT GMYO","ZSR25":"ZIRAAT PORTFOY BIST SURD. 25 ENDEKSI HY BYF","ZTLRF":"ZIRAAT PORTFOY TLREF BYF","ZTLRK":"ZIRAAT PORTFOY TLREFK KATILIM BYF","ZTM25":"ZIRAAT PORTFOY BIST TEMETTU 25 ENDEKS HSY BYF"};

const CACHE_TTL = 30 * 24 * 3600 * 1000;
let isimCache = { data: null, ts: 0, rawSample: null, rawCount: 0 };

function ilkGecerliAlan(obj, adaylar) {
  for (const k of adaylar) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

const KOD_ALANLARI = ["kod","Kod","KOD","sembol","Sembol","SEMBOL","symbol","Symbol","HisseKodu","hisseKodu"];
const AD_ALANLARI  = ["ad","Ad","AD","hisseAdi","HisseAdi","HISSE_ADI","isim","Isim","IsimTam","name","Name","Aciklama","aciklama","Unvan","unvan","SirketAdi","sirketAdi"];

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
    const isimMap = { ...STATIC_ISIM_HARITASI };
    for (const h of liste) {
      const kod = ilkGecerliAlan(h, KOD_ALANLARI);
      const ad  = ilkGecerliAlan(h, AD_ALANLARI);
      if (kod && ad) isimMap[kod] = ad;
    }
    isimCache = { data: isimMap, ts: now, rawSample: liste.slice(0, 2), rawCount: liste.length };
    return isimMap;
  } catch (e) {
    isimCache.rawSample = isimCache.rawSample || [{ hata: String(e && e.message || e) }];
    return isimCache.data || STATIC_ISIM_HARITASI;
  }
}

const TV_SUTUNLAR = [
  "name","close","change","Perf.W","Perf.1M","Perf.Y","high","low","volume",
  "market_cap_basic","price_earnings_ttm","price_book_fq","return_on_equity",
  "sector","industry","debt_to_equity","price_52_week_high","price_52_week_low",
  "Perf.3M","Perf.6M","Perf.YTD","beta_1_year","net_margin_ttm",
  "earnings_per_share_basic_ttm","average_volume_10d_calc","dividends_yield_current",
];

const BAYAT_ESIK_DK = 45;

function piyasaAcikMi() {
  const tr = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const gun = tr.getDay();
  const dk = tr.getHours() * 60 + tr.getMinutes();
  return gun >= 1 && gun <= 5 && dk >= 10 * 60 && dk < 18 * 60;
}

function veriTazelenirMi() {
  const tr = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const gun = tr.getDay();
  const dk = tr.getHours() * 60 + tr.getMinutes();
  return gun >= 1 && gun <= 5 && dk >= 10 * 60 && dk < 18 * 60 + 30;
}

function midasBayatMi(veriZamani) {
  if (!piyasaAcikMi()) return false;
  if (!veriZamani) return true;
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

function tradingViewNormalize(tvJson, isimMap, katilimSet) {
  const sayi = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const yuvarla = (v) => (sayi(v) == null ? null : parseFloat(v.toFixed(2)));

  return (tvJson.data || [])
    .map((satir) => {
      const d = satir?.d || [];
      const kod = String(d[0] || satir?.s || "").split(":").pop().trim().toUpperCase();
      if (!kod || kod.startsWith("X")) return null;
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
        sektorEn: (typeof d[13] === "string" && d[13]) ? d[13] : null,
        endustri: (typeof d[14] === "string" && d[14]) ? d[14] : null,
        borcOzkaynak: sayi(d[15]),
        yuksek52h:    sayi(d[16]),
        dusuk52h:     sayi(d[17]),
        degisim3a:    yuvarla(d[18]),
        degisim6a:    yuvarla(d[19]),
        degisimYtd:   yuvarla(d[20]),
        beta:         sayi(d[21]) == null ? null : parseFloat(d[21].toFixed(2)),
        netMarj:      yuvarla(d[22]),
        hisseBasiKar: sayi(d[23]) == null ? null : parseFloat(d[23].toFixed(2)),
        ortHacim10g:  sayi(d[24]),
        temetu: sayi(d[25]),
        katilimEndeksi: katilimSet.has(kod),
        // 2026-08-17 EKLENENLER (Midas ana kaynak olunca sekil tutarliligi icin)
        // TradingView bu alanlari SAGLAMIYOR - null kaliyor.
        taban: null,
        tavan: null,
        agirlikliOrtalama: null,
        sermaye: null,
        halkaAciklikOrani: null,
        netKar: null,
        hacimTL: null,
        haftalikYuksek: null,
        haftalikDusuk: null,
        aylikYuksek: null,
        aylikDusuk: null,
        volatilite: null,
      };
    })
    .filter((h) => h && h.fiyat > 0)
    .sort((a, b) => (b.piyasaDegeri || 0) - (a.piyasaDegeri || 0));
}

// ── HİSSE EK VERİ (2026-08-18) ──────────────────────────────────────────────
// katilimUyelikGetir() ile AYNI desen: Redis → taze TradingView çekimi →
// (bulunamazsa) boş/bayat harita. Midas ana kaynak olduğundan beri sektör/
// beta/borç-özkaynak/net kâr marjı/hisse başı kâr/ort. hacim/3A-6A-YTD gibi
// alanlar her istekte null geliyordu (bkz. midasHisseler map'indeki null
// atamalar) — kullanıcı bunu fark etti ve haklı bir öneri getirdi: bu
// alanlar günlük hızla değişmiyor, her istekte canlı TradingView çağrısı
// GEREKMİYOR. Günde bir-iki kez (cron ile) tazelenip Redis'te tutuluyor,
// ana istek akışı buradan (hızlı, ağsız) okuyor.
// isimMap/katilimSet'e gerçekte ihtiyaç YOK (sirket/katilimEndeksi alanlarını
// kullanmıyoruz) — tradingViewNormalize()'ı kodu tekrarlamadan kullanmak
// için boş/dummy değerlerle çağrılıyor.
async function hisseEkVeriGetir(zorlaTazele = false) {
  if (!zorlaTazele) {
    try {
      const kayit = await redis.get(KV_HISSE_EK_VERI_KEY);
      if (kayit && kayit.veri && Object.keys(kayit.veri).length > 100) {
        const yasSaat = (Date.now() - (kayit.yazilmaTs || 0)) / 3600000;
        if (yasSaat < 24) return { veri: kayit.veri, kaynak: "onbellek", yasSaat };
      }
    } catch {}
  }

  try {
    const tv = await tradingViewCek();
    const tvHisseler = tradingViewNormalize(tv, {}, new Set());
    if (tvHisseler.length < 100) throw new Error(`TV yetersiz kayit (${tvHisseler.length})`);

    const harita = {};
    for (const h of tvHisseler) {
      harita[h.ticker] = {
        sektorEn: h.sektorEn, endustri: h.endustri, borcOzkaynak: h.borcOzkaynak,
        yuksek52h: h.yuksek52h, dusuk52h: h.dusuk52h,
        degisim3a: h.degisim3a, degisim6a: h.degisim6a, degisimYtd: h.degisimYtd,
        beta: h.beta, netMarj: h.netMarj, hisseBasiKar: h.hisseBasiKar,
        ortHacim10g: h.ortHacim10g, temetu: h.temetu,
      };
    }
    try {
      await redis.set(KV_HISSE_EK_VERI_KEY, { veri: harita, yazilmaTs: Date.now() }, { ex: HISSE_EK_VERI_TTL });
    } catch {}
    return { veri: harita, kaynak: "canli", yasSaat: 0 };
  } catch (e) {
    console.error("Hisse ek veri cekilemedi:", e.message);
    // Redis'te ESKİ (24 saatten eski de olsa) bir kayıt varsa onu kullan —
    // hiç veri göstermemekten (tüm alanlar "—") iyidir.
    try {
      const kayit = await redis.get(KV_HISSE_EK_VERI_KEY);
      if (kayit && kayit.veri) {
        const yasSaat = (Date.now() - (kayit.yazilmaTs || 0)) / 3600000;
        return { veri: kayit.veri, kaynak: "onbellek-bayat", yasSaat };
      }
    } catch {}
    return { veri: {}, kaynak: "yok", yasSaat: null };
  }
}

function originIzinliMi(origin) {
  if (!origin) return false;
  if (/^https:\/\/katilim-analiz(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
  if (/^https:\/\/(www\.)?katilimplus\.com$/i.test(origin)) return true;
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

    // ── HİSSE EK VERİ CRON MODU (2026-08-18) ────────────────────────────────
    // ?ekveri=1 ile tetiklenir — TradingView'dan sektör/beta/6A-YTD gibi
    // yavaş değişen alanları ÇEKİP Redis'e YAZAR, ana hisse listesini
    // DÖNDÜRMEZ. vercel.json'da ayrı bir cron tanımıyla günde 1-2 kez
    // tetiklenmesi gerekiyor (bkz. paylaşım mesajındaki kurulum notu).
    // ⚠️ Bu dosyanın geri kalanı gibi (tefas-proxy.js'nin aksine) CRON_SECRET
    // kontrolü YOK — mevcut güvenlik modeliyle tutarlı bırakıldı, kapsam dışı.
    if (req.query.ekveri === "1") {
      const sonuc = await hisseEkVeriGetir(true); // zorlaTazele=true, Redis'i yok say
      return res.status(200).json({
        success: sonuc.kaynak === "canli",
        kaynak: sonuc.kaynak,
        adet: Object.keys(sonuc.veri).length,
        guncelleme: new Date().toISOString(),
      });
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
        veri_zamani: veriZamani,
        veri_yasi_dk: veriZamani ? Math.round((Date.now() - new Date(veriZamani).getTime()) / 60000) : null,
        midas_ham_ornek: midasListe.slice(0, 3),
        midas_alan_adlari: midasListe[0] ? Object.keys(midasListe[0]) : [],
        isim_kaynagi_kayit_sayisi: Object.keys(isimMap).length,
        isim_kaynagi_ham_toplam: isimCache.rawCount,
        isim_kaynagi_ham_ornek: tamListe ? isimCache.rawSample : isimCache.rawSample?.slice(0, 2),
        isim_kaynagi_cache_yasi_dk: isimCache.ts ? Math.round((Date.now() - isimCache.ts) / 60000) : null,
        eslesme_orani: `${eslesenler.length} / ${tumKodlar.length}`,
        eslesmeyen_kod_sayisi: eslesmeyenler.length,
        eslesmeyen_ornekler: eslesmeyenler.slice(0, 15),
        eslesen_ornek: midasListe.slice(0, 5).map(h => ({
          kod: h.Code,
          bulunan_isim: isimMap[h.Code] || "BULUNAMADI"
        })),
        tam_isim_haritasi: tamListe ? isimMap : undefined,
      });
    }

    const { veri: katilimVeri, kaynak: katilimKaynak } = await katilimUyelikGetir();
    const katilimSet = new Set(katilimVeri.tum || []);

    // MIDAS NORMALIZE (2026-08-17 GENISLETILDI) - Midas artik ANA kaynak.
    // Daha once sadece 16 alan map ediliyordu; ham yanitta ZATEN gelen ama
    // kullanilmayan alanlar vardi. Kullanici BigPara'nin ayri "hisseyuzeysel"
    // ucundan cektigi Sermaye/Taban/Tavan/Halka Aciklik degerleriyle bu
    // alanlari TEK TEK karsilastirdi - BIREBIR ESLESTI (AEFES icin
    // Capital=5.921.052.630=BigPara sermaye; FreeFloatRate=32.27=BigPara
    // saklamaor; LowerLimit/UpperLimit=17.4/21.26=BigPara taban/tavan).
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
          sektorEn:     null,
          endustri:     null,
          borcOzkaynak: null,
          yuksek52h:    null,
          dusuk52h:     null,
          degisim3a:    null,
          degisim6a:    null,
          degisimYtd:   null,
          beta:         null,
          netMarj:      null,
          hisseBasiKar: null,
          ortHacim10g:  null,
          temetu:       null,
          katilimEndeksi: katilimSet.has(kod),
          // YENI (2026-08-17): Midas'in verdigi ama onceden atilan alanlar
          taban:              typeof h.LowerLimit === "number" ? h.LowerLimit : null,
          tavan:              typeof h.UpperLimit === "number" ? h.UpperLimit : null,
          agirlikliOrtalama:  typeof h.VWAP === "number" ? h.VWAP : null,
          sermaye:            typeof h.Capital === "number" ? h.Capital : null,
          halkaAciklikOrani:  typeof h.FreeFloatRate === "number" ? h.FreeFloatRate : null,
          netKar:             typeof h.NetProfit === "number" ? h.NetProfit : null,
          hacimTL:            typeof h.TotalTurnover === "number" ? h.TotalTurnover : null,
          haftalikYuksek:     typeof h.WOWHigh === "number" ? h.WOWHigh : null,
          haftalikDusuk:      typeof h.WOWLow === "number" ? h.WOWLow : null,
          aylikYuksek:        typeof h.MOMHigh === "number" ? h.MOMHigh : null,
          aylikDusuk:         typeof h.MOMLow === "number" ? h.MOMLow : null,
          volatilite:         typeof h.Volatility === "number" ? h.Volatility : null,
        };
      })
      .sort((a,b) => (b.piyasaDegeri||0) - (a.piyasaDegeri||0));

    // KAYNAK SECIMI (2026-08-17: MIDAS TEKRAR ANA KAYNAK)
    // GECMIS: 24-27 Temmuz'da Midas'in ucu 4 gun donmustu (ayni DateTime
    // damgasini tekrarliyordu), bu yuzden 28 Temmuz'da TradingView'a
    // gecilmisti. 17 Agustos'ta canli kontrol edildi: Midas'in DateTime
    // damgalari GERCEKTEN GUNCEL (aktif hisselerde son birkac saniye icinde,
    // seans saatiyle uyumlu) - sorun duzelmis gorunuyor.
    //
    // Midas'in ham yaniti TradingView'dan daha ZENGIN (Taban/Tavan/Sermaye/
    // Halka Aciklik/Net Kar/Agirlikli Ortalama gibi TradingView'in hic
    // saglamadigi alanlari iceriyor) - bu yuzden Midas TERCIH EDILEN kaynak
    // yapildi. AMA gecmisteki donma riski gercek oldugu icin KORU KORUNE
    // guvenilmiyor: mevcut midasBayatMi() (45 dk esik, sadece seans icinde
    // anlamli) her istekte kontrol ediliyor. Bayat/yetersizse TradingView'a
    // OTOMATIK yedek geciliyor.
    //
    // GERI ALMAK KOLAY: ?kaynak=tradingview ile aninda test edilir, kalici
    // donus icin TERCIH sabitini "tradingview" yapmak yeterli.
    const TERCIH = "midas";
    const zorlananKaynak = req.query.kaynak;
    const oncelik = (zorlananKaynak === "midas" || zorlananKaynak === "tradingview")
      ? zorlananKaynak : TERCIH;

    let hisseler = midasHisseler;
    let kaynak = "midas";
    let etkinVeriZamani = veriZamani;
    let yedekHata = null;

    const midasYeterliMi = midasHisseler.length >= 100;
    const midasEskiMi = midasBayatMi(veriZamani);

    if (oncelik === "midas" && midasYeterliMi && !midasEskiMi) {
      // Midas taze ve yeterli - baslangic degerleri zaten dogru, dokunma.
    } else if (oncelik === "midas") {
      const sebep = !midasYeterliMi
        ? `Midas yetersiz kayit (${midasHisseler.length})`
        : `Midas bayat (${veriZamani}, esik ${BAYAT_ESIK_DK}dk)`;
      try {
        const tv = await tradingViewCek();
        const tvHisseler = tradingViewNormalize(tv, isimMap, katilimSet);
        if (tvHisseler.length >= 100) {
          hisseler = tvHisseler;
          kaynak = "tradingview";
          etkinVeriZamani = new Date(Date.now() - 15 * 60 * 1000).toISOString();
          yedekHata = `${sebep} — TradingView'a gecildi`;
        } else {
          yedekHata = `${sebep}, TradingView de yetersiz (${tvHisseler.length}) — Midas (bayat olsa da) kullaniliyor`;
        }
      } catch (e) {
        yedekHata = `${sebep}, TradingView de basarisiz: ${String(e && e.message || e)} — Midas (bayat olsa da) kullaniliyor`;
      }
    } else if (oncelik === "tradingview") {
      try {
        const tv = await tradingViewCek();
        const tvHisseler = tradingViewNormalize(tv, isimMap, katilimSet);
        if (tvHisseler.length >= 100) {
          hisseler = tvHisseler;
          kaynak = "tradingview";
          etkinVeriZamani = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        } else {
          yedekHata = `TV yetersiz kayit (${tvHisseler.length}) — Midas'a dusuldu`;
        }
      } catch (e) {
        yedekHata = String(e && e.message || e) + " — Midas'a dusuldu";
      }
    }

    // ── EK VERİ BİRLEŞTİRME (2026-08-18) ────────────────────────────────────
    // Midas ana kaynak olduğunda sektör/beta/6A-YTD gibi alanlar null kalıyor
    // (Midas bu alanları sağlamıyor). Redis'te (günde 1-2 kez cron ile
    // tazelenen) TradingView kaynaklı ek veri varsa, SADECE null olan
    // alanları doldurmak için burada birleştiriliyor — Midas'ın kendi
    // sağladığı alanlara (taban/tavan/sermaye gibi) DOKUNULMUYOR.
    // kaynak==="tradingview" iken bu alanlar zaten dolu geldiği için
    // birleştirmeye gerek yok — gereksiz Redis okumasını önlemek için
    // sadece midas dalında çalıştırılıyor.
    let ekVeriKaynak = null;
    if (kaynak === "midas") {
      try {
        const ekSonuc = await hisseEkVeriGetir();
        ekVeriKaynak = ekSonuc.kaynak;
        if (Object.keys(ekSonuc.veri).length > 0) {
          for (const h of hisseler) {
            const ek = ekSonuc.veri[h.ticker];
            if (!ek) continue;
            if (h.sektorEn == null) h.sektorEn = ek.sektorEn;
            if (h.endustri == null) h.endustri = ek.endustri;
            if (h.borcOzkaynak == null) h.borcOzkaynak = ek.borcOzkaynak;
            if (h.yuksek52h == null) h.yuksek52h = ek.yuksek52h;
            if (h.dusuk52h == null) h.dusuk52h = ek.dusuk52h;
            if (h.degisim3a == null) h.degisim3a = ek.degisim3a;
            if (h.degisim6a == null) h.degisim6a = ek.degisim6a;
            if (h.degisimYtd == null) h.degisimYtd = ek.degisimYtd;
            if (h.beta == null) h.beta = ek.beta;
            if (h.netMarj == null) h.netMarj = ek.netMarj;
            if (h.hisseBasiKar == null) h.hisseBasiKar = ek.hisseBasiKar;
            if (h.ortHacim10g == null) h.ortHacim10g = ek.ortHacim10g;
            if (h.temetu == null) h.temetu = ek.temetu;
          }
        }
      } catch (e) {
        console.error("Ek veri birlestirilemedi:", e.message);
        // Hata olsa bile ana veri (fiyat vb.) ETKİLENMEZ — sadece ek alanlar
        // null kalmaya devam eder, kullanıcı "—" görür (hatalı sayı değil).
      }
    }

    const tazelenmeli = veriTazelenirMi();
    const onbellekSn = tazelenmeli ? 600 : 3600;
    res.setHeader("Cache-Control", `s-maxage=${onbellekSn}, stale-while-revalidate=120`);

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
      guncelleme: new Date().toISOString(),
      veriZamani: etkinVeriZamani,
      kaynak,
      midasVeriZamani: veriZamani,
      midasBayat: midasBayatMi(veriZamani),
      katilimKaynak,
      katilimSayisi: katilimSet.size,
      // Sektör/beta/6A-YTD gibi alanların nereden geldiği: "onbellek" (Redis,
      // taze), "canli" (bu istekte TradingView'dan çekildi, nadiren olur),
      // "onbellek-bayat" (24 saatten eski ama veri yok'tan iyi), "yok" (hiç
      // veri yok, tüm bu alanlar "—" görünür), null (kaynak zaten tradingview
      // olduğu için birleştirmeye hiç gerek kalmadı).
      ekVeriKaynak,
      ...(yedekHata ? { yedekHata } : {}),
      data: hisseler,
    });

  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
}
