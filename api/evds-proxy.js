// api/evds-proxy.js - FINAL v5
// Haftalık kredi oranları + Aylık stok + Enflasyon + TLREF (oran, endeksten türetilmiş) + AOFM
//
// TLREF DÜZELTMESİ (2026-07): TP.BISTTLREF.KAPANIS ham değeri bir ORAN (%) değil,
// bir ENDEKS seviyesidir (örn. 6223.01) — TLREF'in her gün bileşik olarak
// büyüttüğü bir toplam getiri endeksi. Gerçek günlük/yıllıklandırılmış TLREF
// ORANINI elde etmek için ardışık iki günün endeks değerinden türetiyoruz:
//   günlük_oran = (bugünkü_endeks / dünkü_endeks) - 1
//   yıllık_oran = günlük_oran × 365 × 100
//
// TÜFE NOTU (2026-07, ÇÖZÜLDÜ): TCMB'nin baz yıl güncellemesi (2025=100)
// nedeniyle eski TP.FE.OKTG01 serisi Aralık 2025'te donmuştu. Doğru yeni seri
// kodu (TP_TUKFIY2025_GENEL) EVDS üzerinden bulunup doğrulandı, Haziran 2026'ya
// kadar güncel veri veriyor. ENFLASYON dizisi buna göre güncellendi.

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";

// ── KALICI ÖNBELLEK (Vercel KV / Upstash Redis) ────────────────────────────
// ÖNEMLİ: "let cacheAnlik = {...}" gibi bellek-içi (in-memory) değişkenler
// serverless ortamda GÜVENİLİR DEĞİL — Vercel her istekte aynı "sıcak" fonksiyon
// örneğini kullanacağını garanti etmez, sık sık sıfırlanıp her kullanıcı için
// ayrı ayrı TCMB/FRED'e sorgu atabilir. Bu yüzden tefas-proxy'de kurduğumuz aynı
// Upstash Redis'i burada da kullanıyoruz — TÜM kullanıcılar gerçekten aynı,
// kalıcı önbelleklenmiş veriyi görsün.
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANLIK_KEY = "evds:anlik:v1";
const KV_TARIHSEL_PREFIX = "evds:tarihsel:v1:";

// Vercel'in varsayılan fonksiyon süresi (Hobby planda genelde 10sn) artık 8 dış
// isteğe (5 EVDS + 3 FRED) yetmiyor — bu yüzden ERR_CONNECTION_CLOSED alınıyordu
// (fonksiyon yanıt vermeden aniden kesiliyordu). Süreyi uzatıyoruz.
export const config = { maxDuration: 60 };

// Her dış isteğe ayrı bir zaman sınırı — tek bir yavaş/asılı kalan istek tüm
// fonksiyonu bloke etmesin diye.
async function fetchZamanli(url, opsiyonlar={}, msTimeout=8000){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), msTimeout);
  try {
    return await fetch(url, { ...opsiyonlar, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
const CACHE_TTL_SANIYE = 6 * 3600; // 6 saat, Redis TTL saniye cinsinden ister

const HAFTALIK = [
  "TP.KTF10","TP.KTF11","TP.KTF12",
  "TP.KTF101",
  "TP.KTF17","TP.KTF171","TP.KTF172",
  "TP.KTF1",
  "TP.KTF1.USD","TP.KTF1.EUR",
  "TP.KTF1.K","TP.KTF1.K.USD","TP.KTF1.K.EUR",
  "TP.KTF17.TL","TP.KTF17.USD","TP.KTF17.EUR",
];

// TCMB Brüt Rezerv (Altın+Döviz Toplamı, Milyon USD), haftalık — kullanıcı
// tarafından EVDS'den doğrulandı. AYRI bir istekte tutuluyor çünkü alt çizgili
// format (TP_AB_TOPLAM) ile HAFTALIK'taki noktalı formatı (TP.KTF10 vb.) AYNI
// çoklu-seri isteğine karıştırmak EVDS'nin TÜM isteği reddetmesine yol açtı
// (muhtemelen farklı "veri grubu"na ait seriler aynı anda istenemiyor).
const REZERV = ["TP.AB.TOPLAM"]; // DÜZELTME: "series does not exist" hatası alınca
                                   // TÜFE'dekiyle aynı teoriyi denedik — sorgu
                                   // parametresi noktalı format istiyor olabilir.

const AYLIK = [
  "TP_BKR_TRY_KTF10","TP_BKR_TRY_17","TP_BKR_TRY_18",
  "TP_BKR_TRY_1","TP_BKR_USD_1","TP_BKR_EUR_1",
  "TP_KBK_TRY_KBTF10","TP_KBK_TRY_17","TP_KBK_TRY_18",
  "TP_KBK_TRY_1","TP_KBK_USD_KBTF17","TP_KBK_EUR_KBTF17",
  "TP_KKP_TRY_KTF10","TP_KKP_TRY_17","TP_KKP_TRY_18",
  "TP_KKP_TRY_1","TP_KKP_USD_KTF17","TP_KKP_EUR_KTF17",
];

// TÜFE NOTU (2026-07, GÜNCELLENDİ): Yeni baz yıllı (2025=100) seri kodu
// kullanıcı tarafından EVDS'den doğrulanarak bulundu: TP_TUKFIY2025_GENEL.
// Eski TP.FE.OKTG01 (2003=100) serisi Aralık 2025'te donmuştu — artık yeni
// seriye geçildi, veri Haziran 2026'ya kadar güncel ve doğrulandı (~%32 yıllık,
// ~%1 aylık — makul rakamlar).
const ENFLASYON = [
  "TP.TUKFIY2025.GENEL",  // TÜFE genel endeks (2025=100, YENİ SERİ) — DÜZELTME:
                           // "Series does not exist" hatası alınca fark ettik,
                           // EVDS sorgu parametresi NOKTALI format istiyor; alt
                           // çizgili format (TP_TUKFIY2025_GENEL) sadece YANIT
                           // alan adında görünüyor. sonDeger/tumDegerler zaten
                           // her iki formatı da response'ta arıyor, sorun yok.
];

const POLITIKA = [
  "TP.APIFON4",    // AOFM
];

const GUNLUK = [
  "TP.BISTTLREF.KAPANIS",  // TLREF endeksi (ORAN DEĞİL) — günlük değişimden oran türetilir
  // NOT: "TP.BISTTLREFK.KAPANIS" denendi ama EVDS'de veri vermedi (kod yanlış/
  // kayıtlı değil). TLREFK artık TLREF'ten tahmin ediliyor, bkz. aşağıdaki not.
];

// ── FRED (ABD Merkez Bankası St. Louis) — SOFR, EURIBOR ───────────────────
// ÖNEMLİ (2026-07): Eski yöntem (fredgraph.csv, anahtarsız) Vercel'den atılan
// sunucu-taraflı isteklerde sessizce asılı kalıp zaman aşımına uğruyordu
// (muhtemelen bu "grafik indirme" endpoint'i tarayıcı-dışı erişimi engelliyor).
// Resmi FRED REST API'sine geçildi — otomatik/programatik erişim için
// tasarlanmış, API anahtarı gerektiriyor (ücretsiz, fredaccount.stlouisfed.org).
const FRED_API_URL = (seri, apiKey) =>
  `https://api.stlouisfed.org/fred/series/observations?series_id=${seri}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=30`;

function fredJsonParse(json) {
  const obs = (json?.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
  if (obs.length === 0) return { son: null, seri: [] };
  const son = { deger: parseFloat(obs[0].value), tarih: obs[0].date };
  const seri = obs.slice(0, 24).reverse().map(o => ({ tarih: o.date, deger: parseFloat(o.value) }));
  return { son, seri };
}

function tarihStr(d) {
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function onceki(gun) { const d=new Date(); d.setDate(d.getDate()-gun); return tarihStr(d); }

function normalizeTarih(t) {
  if(!t) return null;
  const s=String(t);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split("-");return `${d}-${m}-${y}`;}
  if(/^\d{4}-\d{2}$/.test(s)){const[y,m]=s.split("-");return `01-${m}-${y}`;}
  if(/^\d{4}$/.test(s)) return null;
  return s;
}

function sonDeger(items, seri) {
  const keys=[seri, seri.replace(/\./g,"_"), seri.replace(/_/g,".")];
  for(let i=items.length-1;i>=0;i--){
    for(const k of keys){
      const v=items[i][k];
      if(v!==null&&v!==undefined&&v!=="")
        return {deger:parseFloat(v),tarih:normalizeTarih(items[i].Tarih)};
    }
  }
  return null;
}

function tumDegerler(items, seri) {
  const keys=[seri, seri.replace(/\./g,"_"), seri.replace(/_/g,".")];
  return items.map(row=>{
    for(const k of keys){
      const v=row[k];
      if(v!==null&&v!==undefined&&v!==""){
        const tarih=normalizeTarih(row.Tarih);
        if(!tarih) return null;
        return {deger:parseFloat(v),tarih};
      }
    }
    return null;
  }).filter(Boolean);
}

async function evdsFetch(url,apiKey){
  const r=await fetchZamanli(url,{headers:{"key":apiKey,"Accept":"application/json"}},10000);
  const text=await r.text();
  if(text.trim().startsWith("<")) throw new Error(`HTML döndü (HTTP ${r.status}) — ilk 200 karakter: ${text.slice(0,200)}`);
  let json;
  try { json = JSON.parse(text); }
  catch(e){ throw new Error(`JSON parse hatası (HTTP ${r.status}): ${text.slice(0,200)}`); }
  if(r.status<200||r.status>=300) throw new Error(`HTTP ${r.status}: ${text.slice(0,200)}`);
  return { json, httpStatus: r.status };
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  const apiKey=process.env.EVDS_KEY;
  if(!apiKey) return res.status(500).json({error:"EVDS_KEY eksik"});

  const {grafik,seri,debug}=req.query;
  const now=Date.now();

  if(grafik==="1"&&seri){
    const kvAnahtar = KV_TARIHSEL_PREFIX+seri;
    try{
      const onbellek = await redis.get(kvAnahtar);
      if(onbellek) return res.status(200).json({tarihsel:{[seri]:onbellek},cached:true});
    }catch{} // Redis'e ulaşılamazsa sessizce devam et, taze veri çekmeyi dene
    try{
      const isGunluk=seri.includes("TLREF")||seri.includes("BISTTL");
      const isHaftalik=seri.includes(".")&&!isGunluk&&!seri.startsWith("TP.FE");
      const freq=isGunluk?"1":isHaftalik?"3":"5";
      const period=isGunluk?90:isHaftalik?200:400;
      const url=`${BASE}/series=${seri}&startDate=${onceki(period)}&endDate=${tarihStr(new Date())}&type=json&frequency=${freq}`;
      const {json}=await evdsFetch(url,apiKey);
      const degerler=tumDegerler(json?.items||[],seri);
      try{ await redis.set(kvAnahtar, degerler, {ex: CACHE_TTL_SANIYE}); }catch{}
      return res.status(200).json({tarihsel:{[seri]:degerler}});
    }catch(err){
      try{
        const eskiOnbellek = await redis.get(kvAnahtar);
        if(eskiOnbellek) return res.status(200).json({tarihsel:{[seri]:eskiOnbellek},cached:true});
      }catch{}
      return res.status(500).json({error:err.message});
    }
  }

  if(debug!=="1"){
    try{
      const onbellek = await redis.get(KV_ANLIK_KEY);
      if(onbellek) return res.status(200).json({...onbellek,cached:true});
    }catch{} // Redis'e ulaşılamazsa sessizce devam et, taze veri çek
  }

  const teshis = {};
  async function guvenliCek(ad, url) {
    try {
      const { json, httpStatus } = await evdsFetch(url, apiKey);
      const itemSayisi = (json?.items || []).length;
      teshis[ad] = { basarili: true, httpStatus, itemSayisi };
      return json;
    } catch (err) {
      teshis[ad] = { basarili: false, hata: err.message };
      return { items: [] };
    }
  }
  async function guvenliCekFred(ad, seri) {
    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) {
      teshis[ad] = { basarili: false, hata: "FRED_API_KEY ortam değişkeni tanımlı değil" };
      return { son: null, seri: [] };
    }
    try {
      const r = await fetchZamanli(FRED_API_URL(seri, fredKey), {}, 15000);
      const text = await r.text();
      if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}: ${text.slice(0,200)}`);
      const json = JSON.parse(text);
      const { son, seri: seriDizi } = fredJsonParse(json);
      teshis[ad] = { basarili: son != null, httpStatus: r.status, sonDeger: son };
      return { son, seri: seriDizi };
    } catch (err) {
      teshis[ad] = {
        basarili: false,
        hata: err.message,
        hataAdi: err.name,
        hataKod: err.cause?.code || err.code || null,
      };
      return { son: null, seri: [] };
    }
  }

  try{
    const [hafJson,ayJson,gunJson,enfJson,polJson,rezervJson]=await Promise.all([
      guvenliCek("haftalik", `${BASE}/series=${HAFTALIK.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
      guvenliCek("aylik",    `${BASE}/series=${AYLIK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("gunluk_tlref", `${BASE}/series=${GUNLUK.join("-")}&startDate=${onceki(30)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("enflasyon", `${BASE}/series=${ENFLASYON.join("-")}&startDate=${onceki(730)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("politika_aofm", `${BASE}/series=${POLITIKA.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("rezerv", `${BASE}/series=${REZERV.join("-")}&startDate=${onceki(180)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
    ]);

    // FRED çağrıları AYRI bir aşamada — EVDS'nin 6 eşzamanlı isteğiyle aynı anda
    // yarışıp bağlantı sıkışıklığına (contention) yol açmasın diye. Zaman aşımını
    // uzatmak tek başına yetmemişti, bu ihtimali de eleyelim diye ayırdık.
    const [sofr,eur3m]=await Promise.all([
      guvenliCekFred("fred_sofr", "SOFR"),
      // DÜZELTME: "EUR3MTD156N" yanlış/yok olan bir kod çıktı. Doğru kod:
      // IR3TIB01EZM156N — OECD'nin Euro Bölgesi 3 aylık bankalar arası faiz
      // oranı (FRED üzerinden), aylık veri. Gerçek "EURIBOR" markalı seri FRED'de
      // yok, bu en yakın/eşdeğer resmi kaynak.
      guvenliCekFred("fred_euribor3m", "IR3TIB01EZM156N"),
    ]);
    // NOT: EURIBOR 6M için FRED'de doğrulanmış bir seri bulunamadı (Euro Bölgesi
    // için sadece 3 aylık tenor mevcut görünüyor) — tahminle uğraşmak yerine bu
    // gösterge sabit/periyodik güncellenen değer olarak kalmaya devam ediyor.

    const sonuclar={};
    for(const s of HAFTALIK) sonuclar[s]=sonDeger(hafJson?.items||[],s);
    for(const s of AYLIK)    sonuclar[s]=sonDeger(ayJson?.items||[],s);
    for(const s of POLITIKA) sonuclar[s]=sonDeger(polJson?.items||[],s);
    for(const s of REZERV)   sonuclar[s]=sonDeger(rezervJson?.items||[],s);
    sonuclar["FRED_SOFR"]=sofr.son; // {deger, tarih} veya null
    sonuclar["FRED_SOFR_SERI"]=sofr.seri;
    sonuclar["FRED_EUR3M"]=eur3m.son;
    sonuclar["FRED_EUR3M_SERI"]=eur3m.seri;

    // AOFM geçmiş serisi (grafik için) — zaten oran, ek dönüşüm gerekmiyor
    sonuclar["TP.APIFON4_SERI"]=tumDegerler(polJson?.items||[], "TP.APIFON4").slice(-24);
    // Rezerv geçmiş serisi (grafik için) — Milyon USD, ham, artık kendi ayrı isteğinden
    sonuclar["TP_AB_TOPLAM_SERI"]=tumDegerler(rezervJson?.items||[], "TP_AB_TOPLAM").slice(-24);

    // TLREF: endeksten oran türetimi
    const tlrefEndeksDizi=tumDegerler(gunJson?.items||[], "TP.BISTTLREF.KAPANIS");
    teshis.tlrefEndeksDizi_uzunluk = tlrefEndeksDizi.length;
    if(tlrefEndeksDizi.length>=2){
      const son=tlrefEndeksDizi[tlrefEndeksDizi.length-1];
      const onceki_=tlrefEndeksDizi[tlrefEndeksDizi.length-2];
      const gunlukOran=(son.deger/onceki_.deger)-1;
      const yillikOran=gunlukOran*365*100;
      sonuclar["TP.BISTTLREF.KAPANIS"]={deger:yillikOran, tarih:son.tarih, endeksHam:son.deger};
      teshis.tlref_hesap = {son_endeks:son.deger, onceki_endeks:onceki_.deger, gunluk_oran:gunlukOran, yillik_oran_pct:yillikOran};
      // Geçmiş seri: her gün için endeksten türetilmiş yıllık oran
      const tlrefSeri=[];
      for(let i=1;i<tlrefEndeksDizi.length;i++){
        const g=(tlrefEndeksDizi[i].deger/tlrefEndeksDizi[i-1].deger)-1;
        tlrefSeri.push({tarih:tlrefEndeksDizi[i].tarih, deger:g*365*100});
      }
      sonuclar["TP.BISTTLREF.KAPANIS_SERI"]=tlrefSeri.slice(-24);
    } else {
      sonuclar["TP.BISTTLREF.KAPANIS"]=null;
      sonuclar["TP.BISTTLREF.KAPANIS_SERI"]=[];
    }

    // TLREFK: GERÇEK EVDS KODU BULUNAMADI (denenen "TP.BISTTLREFK.KAPANIS" veri
    // vermiyor). Kullanıcının borsaistanbul.com'dan aldığı 7 günlük gerçek
    // TLREFK verisiyle bizim hesapladığımız TLREF'i karşılaştırdık: TLREFK,
    // TLREF'in tutarlı şekilde ~0,096 puan altında seyrediyor (standart sapma
    // sadece 0,015 puan — çok sıkı bir ilişki). Gerçek seri bulunana kadar bu
    // TAHMİNİ (TLREF - 0,096) kullanıyoruz; arayüzde "tahmini" olduğu belirtilmeli.
    const TLREFK_TLREF_FARKI = 0.096;
    if(sonuclar["TP.BISTTLREF.KAPANIS"]){
      sonuclar["TP.BISTTLREFK.KAPANIS"] = {
        deger: sonuclar["TP.BISTTLREF.KAPANIS"].deger - TLREFK_TLREF_FARKI,
        tarih: sonuclar["TP.BISTTLREF.KAPANIS"].tarih,
        tahmini: true,
      };
      sonuclar["TP.BISTTLREFK.KAPANIS_SERI"] = (sonuclar["TP.BISTTLREF.KAPANIS_SERI"]||[])
        .map(n => ({ tarih: n.tarih, deger: n.deger - TLREFK_TLREF_FARKI }));
    } else {
      sonuclar["TP.BISTTLREFK.KAPANIS"]=null;
      sonuclar["TP.BISTTLREFK.KAPANIS_SERI"]=[];
    }

    const enfItems=enfJson?.items||[];
    const tufeDizi=tumDegerler(enfItems,"TP_TUKFIY2025_GENEL");
    teshis.tufeDizi_uzunluk = tufeDizi.length;
    teshis.tufeDizi_son3 = tufeDizi.slice(-3);
    if(tufeDizi.length>=13){
      const son=tufeDizi[tufeDizi.length-1];
      const oncekiAy=tufeDizi[tufeDizi.length-2];
      const oncekiYil=tufeDizi[tufeDizi.length-13];
      sonuclar["TUFE_YILLIK"]={deger:((son.deger-oncekiYil.deger)/oncekiYil.deger*100),tarih:son.tarih};
      sonuclar["TUFE_AYLIK"]={deger:((son.deger-oncekiAy.deger)/oncekiAy.deger*100),tarih:son.tarih};

      // Grafik için: TÜM aylar boyunca YoY/MoM serisi (son 24 ay ile sınırlı,
      // grafik/tooltip performansı için yeterli).
      const yillikSeri=[], aylikSeri=[];
      for(let i=tufeDizi.length-1;i>=13;i--){
        const s=tufeDizi[i], oA=tufeDizi[i-1], oY=tufeDizi[i-13];
        yillikSeri.unshift({tarih:s.tarih, deger:(s.deger-oY.deger)/oY.deger*100});
        aylikSeri.unshift({tarih:s.tarih, deger:(s.deger-oA.deger)/oA.deger*100});
        if(yillikSeri.length>=24) break;
      }
      sonuclar["TUFE_YILLIK_SERI"]=yillikSeri;
      sonuclar["TUFE_AYLIK_SERI"]=aylikSeri;
    } else {
      sonuclar["TUFE_YILLIK"]=null;
      sonuclar["TUFE_AYLIK"]=null;
      sonuclar["TUFE_YILLIK_SERI"]=[];
      sonuclar["TUFE_AYLIK_SERI"]=[];
    }

    const yanit={tarih:tarihStr(new Date()),seriler:sonuclar, _teshis: teshis};
    try{ await redis.set(KV_ANLIK_KEY, yanit, {ex: CACHE_TTL_SANIYE}); }catch{}
    return res.status(200).json(yanit);
  }catch(err){
    try{
      const eskiOnbellek = await redis.get(KV_ANLIK_KEY);
      if(eskiOnbellek) return res.status(200).json({...eskiOnbellek,cached:true,hata:err.message});
    }catch{}
    return res.status(500).json({error:err.message});
  }
}

