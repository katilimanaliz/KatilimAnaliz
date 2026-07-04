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
// NOT (2026-07-04): v1 → v2 sürüm değişikliği BİLEREK yapıldı. TLREF hesaplama
// mantığı düzeltildi (DÜZELTME 3, aşağıda) ama eski v1 anahtarı altında Redis'te
// 6 saatlik TTL ile ESKİ (hatalı) hesaplanmış değer önbellekte duruyordu — kod
// deploy edilse bile önbellek kontrolü hesaplamadan ÖNCE çalıştığı için kullanıcı
// hâlâ eski %119,98 değerini görüyordu. Anahtar versiyonunu artırarak eski cache
// otomatik olarak "yok" sayılıyor, ilk istekte taze (düzeltilmiş) veri hesaplanıp
// yeni anahtar altında cache'leniyor. İleride benzer bir hesaplama mantığı
// değişikliği yapılırsa yine bu versiyonu artırmak gerekir.
const KV_ANLIK_KEY = "evds:anlik:v4";
const KV_TARIHSEL_PREFIX = "evds:tarihsel:v4:";

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

const REZERV = ["TP.AB.TOPLAM"];

const AYLIK = [
  "TP_BKR_TRY_KTF10","TP_BKR_TRY_17","TP_BKR_TRY_18",
  "TP_BKR_TRY_1","TP_BKR_USD_1","TP_BKR_EUR_1",
  "TP_KBK_TRY_KBTF10","TP_KBK_TRY_17","TP_KBK_TRY_18",
  "TP_KBK_TRY_1","TP_KBK_USD_KBTF17","TP_KBK_EUR_KBTF17",
  "TP_KKP_TRY_KTF10","TP_KKP_TRY_17","TP_KKP_TRY_18",
  "TP_KKP_TRY_1","TP_KKP_USD_KTF17","TP_KKP_EUR_KTF17",
];

const ENFLASYON = [
  "TP.TUKFIY2025.GENEL",
];

const POLITIKA = [
  "TP.APIFON4",
];

const GUNLUK = [
  "TP.BISTTLREF.KAPANIS",
];

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
  if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){
    const[y,m,d]=s.split("-");
    return `${d.padStart(2,"0")}-${m.padStart(2,"0")}-${y}`;
  }
  // DÜZELTME: eski regex "\d{2}" (tam 2 haneli ay) istiyordu — "2025-10" gibi
  // ayları yakalayıp DD-MM-YYYY'ye çeviriyordu ama "2026-6" gibi TEK haneli
  // ayları HİÇ yakalamıyordu, bu yüzden bazı aylar ham "YYYY-M" formatında
  // kalıp diğerleriyle (DD-MM-YYYY) karışık görünüyordu. Artık "\d{1,2}" ile
  // her iki durumu da yakalayıp aynı formata (sıfır dolgulu) çeviriyoruz.
  if(/^\d{4}-\d{1,2}$/.test(s)){
    const[y,m]=s.split("-");
    return `01-${m.padStart(2,"0")}-${y}`;
  }
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

// ── Tarih ayrıştırma (DD-MM-YYYY) ve gün farkı hesaplama ────────────────────
// TLREF endeksinden oran türetirken iki ardışık veri noktası arasındaki
// GERÇEK takvim günü farkını bilmemiz gerekiyor (aşağıdaki TLREF DÜZELTMESİ 2
// notuna bkz) — bu yüzden "DD-MM-YYYY" formatındaki tarihi Date nesnesine
// çeviren küçük bir yardımcı.
function tarihParseDDMMYYYY(s) {
  if(!s) return null;
  const [d,m,y] = s.split("-").map(Number);
  if(!d||!m||!y) return null;
  return new Date(Date.UTC(y, m-1, d));
}
function gunFarki(tarihSonStr, tarihOncekiStr) {
  const a = tarihParseDDMMYYYY(tarihSonStr);
  const b = tarihParseDDMMYYYY(tarihOncekiStr);
  if(!a||!b) return 1;
  const fark = Math.round((a - b) / (1000*60*60*24));
  return fark > 0 ? fark : 1; // negatif/0 gelirse (bozuk veri) en az 1 varsay
}

// ── TÜFE gerçek açıklanma tarihi ────────────────────────────────────────────
// EVDS'deki TÜFE serisinin "tarih" alanı verinin REFERANS AYINI gösterir
// (örn. "2026-6" → Haziran 2026 enflasyonu), yayımlandığı takvim gününü değil.
// TÜİK, bir ayın enflasyon verisini BİR SONRAKİ ayın 3. günü (hafta sonuysa
// ileri kaydırılmış) açıklar. Referans ayı, sanki verinin "01"i açıklanmış
// gibi göstermek (önceki davranış) yanıltıcıydı — kullanıcı bunu fark etti.
function ayinNIsGunu(yil, ay, gun){ // ay: 0-indeksli
  let d = new Date(Date.UTC(yil, ay, gun));
  while(d.getUTCDay()===0 || d.getUTCDay()===6){ d.setUTCDate(d.getUTCDate()+1); }
  return d;
}
function tufeAcikilanmaTarihi(referansTarihStr){
  const d = tarihParseDDMMYYYY(referansTarihStr);
  if(!d) return referansTarihStr;
  const yil = d.getUTCFullYear();
  const ay = d.getUTCMonth(); // 0-indeksli referans ay
  const acikilanma = ayinNIsGunu(yil, ay+1, 3); // referans ayından BİR SONRAKİ ayın 3. günü
  const dd=String(acikilanma.getUTCDate()).padStart(2,"0");
  const mm=String(acikilanma.getUTCMonth()+1).padStart(2,"0");
  const yy=acikilanma.getUTCFullYear();
  return `${dd}-${mm}-${yy}`;
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
    const kilitAnahtariSeri = `lock:${kvAnahtar}`;
    let kilitBizdeMiSeri = false;
    try{
      const onbellek = await redis.get(kvAnahtar);
      if(onbellek) return res.status(200).json({tarihsel:{[seri]:onbellek},cached:true});
    }catch{}

    try{
      const sonuc = await redis.set(kilitAnahtariSeri, "1", {nx:true, ex:20});
      kilitBizdeMiSeri = sonuc === "OK" || sonuc === true;
    }catch{}
    if(!kilitBizdeMiSeri){
      for(let i=0;i<5;i++){
        await new Promise(r=>setTimeout(r,400));
        try{
          const onbellek = await redis.get(kvAnahtar);
          if(onbellek) return res.status(200).json({tarihsel:{[seri]:onbellek},cached:true});
        }catch{}
      }
    }

    try{
      const isGunluk=seri.includes("TLREF")||seri.includes("BISTTL");
      const isHaftalik=seri.includes(".")&&!isGunluk&&!seri.startsWith("TP.FE");
      const freq=isGunluk?"1":isHaftalik?"3":"5";
      const period=isGunluk?90:isHaftalik?200:400;
      const url=`${BASE}/series=${seri}&startDate=${onceki(period)}&endDate=${tarihStr(new Date())}&type=json&frequency=${freq}`;
      const {json}=await evdsFetch(url,apiKey);
      const degerler=tumDegerler(json?.items||[],seri);
      try{ await redis.set(kvAnahtar, degerler, {ex: CACHE_TTL_SANIYE}); }catch{}
      if(kilitBizdeMiSeri){ try{ await redis.del(kilitAnahtariSeri); }catch{} }
      return res.status(200).json({tarihsel:{[seri]:degerler}});
    }catch(err){
      if(kilitBizdeMiSeri){ try{ await redis.del(kilitAnahtariSeri); }catch{} }
      try{
        const eskiOnbellek = await redis.get(kvAnahtar);
        if(eskiOnbellek) return res.status(200).json({tarihsel:{[seri]:eskiOnbellek},cached:true});
      }catch{}
      return res.status(500).json({error:err.message});
    }
  }

  const kilitAnahtari = `lock:${KV_ANLIK_KEY}`;
  let kilitBizdeMi = false;

  if(debug!=="1"){
    try{
      const onbellek = await redis.get(KV_ANLIK_KEY);
      if(onbellek) return res.status(200).json({...onbellek,cached:true});
    }catch{}

    try{
      const sonuc = await redis.set(kilitAnahtari, "1", {nx:true, ex:50});
      kilitBizdeMi = sonuc === "OK" || sonuc === true;
    }catch{}

    if(!kilitBizdeMi){
      for(let i=0;i<6;i++){
        await new Promise(r=>setTimeout(r,400));
        try{
          const onbellek = await redis.get(KV_ANLIK_KEY);
          if(onbellek) return res.status(200).json({...onbellek,cached:true});
        }catch{}
      }
    }
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

    const [sofr,eur3m]=await Promise.all([
      guvenliCekFred("fred_sofr", "SOFR"),
      guvenliCekFred("fred_euribor3m", "IR3TIB01EZM156N"),
    ]);

    const sonuclar={};
    for(const s of HAFTALIK) sonuclar[s]=sonDeger(hafJson?.items||[],s);
    for(const s of AYLIK)    sonuclar[s]=sonDeger(ayJson?.items||[],s);
    for(const s of POLITIKA) sonuclar[s]=sonDeger(polJson?.items||[],s);
    for(const s of REZERV)   sonuclar[s]=sonDeger(rezervJson?.items||[],s);
    sonuclar["FRED_SOFR"]=sofr.son;
    sonuclar["FRED_SOFR_SERI"]=sofr.seri;
    sonuclar["FRED_EUR3M"]=eur3m.son;
    sonuclar["FRED_EUR3M_SERI"]=eur3m.seri;

    sonuclar["TP.APIFON4_SERI"]=tumDegerler(polJson?.items||[], "TP.APIFON4").slice(-24);
    sonuclar["TP_AB_TOPLAM_SERI"]=tumDegerler(rezervJson?.items||[], "TP_AB_TOPLAM").slice(-24);

    // TLREF: endeksten oran türetimi
    //
    // TLREF DÜZELTMESİ 4 (2026-07-05, kullanıcı gerçek veriyle doğruladı):
    // DÜZELTME 3, iki veri noktasını (bugün ve ~1 hafta önce) kıyaslayarak
    // Cuma/Pazartesi sapmasını gidermişti — ama bu kez ayrı bir haftalık
    // örüntü ortaya çıktı: HER PERŞEMBE günü hesaplanan oran ~%26'ya düşüyordu
    // (diğer günler doğru ~%40 civarındaydı). Yani veri kaynağında, hangi
    // gün çiftini seçersen seç, en az bir gün için sonucu bozan tekrarlayan
    // bir haftalık sapma var. İKİ NOKTAYA dayanan HERHANGİ bir kıyaslama
    // yöntemi bu tuzağa düşmeye devam edecekti.
    //
    // ÇÖZÜM: Artık iki nokta değil, ~3 haftalık bir PENCEREDEKİ TÜM noktalara
    // en küçük kareler (linear regresyon) uygulayıp eğimi (günlük logaritmik
    // büyüme oranı) hesaplıyoruz. Bu yöntem, hangi güne denk gelirse gelsin
    // aynı sonucu verir çünkü tek bir gün çiftine değil, pencuredeki TÜM
    // noktalara dayanır — bu da tekrarlayan haftalık sapmayı (hangi gün
    // kaynaklı olursa olsun) büyük ölçüde ortalayarak etkisiz kılar.
    function regresyonYillikOran(dizi, sonIndex, pencereGun){
      const sonTarih = tarihParseDDMMYYYY(dizi[sonIndex]?.tarih);
      if(!sonTarih) return null;
      const sonTarihMs = sonTarih.getTime();
      const noktalar=[];
      for(let k=sonIndex;k>=0;k--){
        const d = tarihParseDDMMYYYY(dizi[k].tarih);
        if(!d) continue;
        const farkGun = (sonTarihMs - d.getTime())/86400000;
        if(farkGun > pencereGun) break;
        noktalar.push({x:d.getTime()/86400000, y:Math.log(dizi[k].deger)});
      }
      if(noktalar.length<3) return null; // güvenilir bir eğim için en az 3 nokta gerekli
      const n=noktalar.length;
      const xOrt=noktalar.reduce((a,p)=>a+p.x,0)/n;
      const yOrt=noktalar.reduce((a,p)=>a+p.y,0)/n;
      let pay=0, payda=0;
      for(const p of noktalar){ pay+=(p.x-xOrt)*(p.y-yOrt); payda+=(p.x-xOrt)*(p.x-xOrt); }
      if(payda===0) return null;
      const gunlukLogGetiri = pay/payda;
      return gunlukLogGetiri*365*100;
    }
    const TLREF_PENCERE_GUN = 21; // ~3 hafta — haftalık örüntüyü ortalamaya yetecek genişlikte
    const tlrefEndeksDizi=tumDegerler(gunJson?.items||[], "TP.BISTTLREF.KAPANIS");
    teshis.tlrefEndeksDizi_uzunluk = tlrefEndeksDizi.length;
    const sonIdx = tlrefEndeksDizi.length-1;
    const sonYillikOran = sonIdx>=0 ? regresyonYillikOran(tlrefEndeksDizi, sonIdx, TLREF_PENCERE_GUN) : null;
    if(sonIdx>=0 && sonYillikOran!=null){
      const son=tlrefEndeksDizi[sonIdx];
      sonuclar["TP.BISTTLREF.KAPANIS"]={deger:sonYillikOran, tarih:son.tarih, endeksHam:son.deger};
      teshis.tlref_hesap = {yontem:"regresyon", pencere_gun:TLREF_PENCERE_GUN, son_endeks:son.deger, son_tarih:son.tarih, yillik_oran_pct:sonYillikOran};
      // Geçmiş seri: her nokta kendi ~3 haftalık trailing penceresiyle hesaplanıyor
      const tlrefSeri=[];
      for(let i=0;i<tlrefEndeksDizi.length;i++){
        const oran=regresyonYillikOran(tlrefEndeksDizi, i, TLREF_PENCERE_GUN);
        if(oran==null) continue;
        tlrefSeri.push({tarih:tlrefEndeksDizi[i].tarih, deger:oran});
      }
      sonuclar["TP.BISTTLREF.KAPANIS_SERI"]=tlrefSeri.slice(-24);
    } else {
      sonuclar["TP.BISTTLREF.KAPANIS"]=null;
      sonuclar["TP.BISTTLREF.KAPANIS_SERI"]=[];
    }

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
      sonuclar["TUFE_YILLIK"]={deger:((son.deger-oncekiYil.deger)/oncekiYil.deger*100),tarih:tufeAcikilanmaTarihi(son.tarih)};
      sonuclar["TUFE_AYLIK"]={deger:((son.deger-oncekiAy.deger)/oncekiAy.deger*100),tarih:tufeAcikilanmaTarihi(son.tarih)};

      const yillikSeri=[], aylikSeri=[];
      for(let i=tufeDizi.length-1;i>=13;i--){
        const s=tufeDizi[i], oA=tufeDizi[i-1], oY=tufeDizi[i-13];
        const acikilanmaTarihi = tufeAcikilanmaTarihi(s.tarih);
        yillikSeri.unshift({tarih:acikilanmaTarihi, deger:(s.deger-oY.deger)/oY.deger*100});
        aylikSeri.unshift({tarih:acikilanmaTarihi, deger:(s.deger-oA.deger)/oA.deger*100});
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
    if(kilitBizdeMi){ try{ await redis.del(kilitAnahtari); }catch{} }
    return res.status(200).json(yanit);
  }catch(err){
    if(kilitBizdeMi){ try{ await redis.del(kilitAnahtari); }catch{} }
    try{
      const eskiOnbellek = await redis.get(KV_ANLIK_KEY);
      if(eskiOnbellek) return res.status(200).json({...eskiOnbellek,cached:true,hata:err.message});
    }catch{}
    return res.status(500).json({error:err.message});
  }
}
