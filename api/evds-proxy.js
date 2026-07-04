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
// TÜFE NOTU (2026-07): TCMB'nin kendi açıklamasına göre TÜFE'nin baz yılı 2025
// olarak güncellendi, bu değişiklik 2026 Ocak verisinden itibaren geçerli.
// TP.FE.OKTG01 (2003=100) serisi Aralık 2025'ten sonra hiç güncellenmemiş —
// bu, kod tarafında bir hata değil, muhtemelen TÜİK/TCMB'nin yeni bazlı seriye
// geçişiyle ilgili. Yeni serinin kesin EVDS kodu doğrulanamadı; TUFE_YILLIK/
// TUFE_AYLIK bu yüzden şimdilik null dönebilir. EVDS'nin "Tüm Seriler" arama
// arayüzünden "TÜFE 2025=100" ile doğru kodu bulup ENFLASYON dizisine
// eklemek gerekiyor.

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";
const CACHE_TTL_MS = 6 * 3600 * 1000;
let cacheAnlik = { data: null, ts: 0 };
let cacheTarihsel = {};

const HAFTALIK = [
  "TP.KTF10","TP.KTF11","TP.KTF12",
  "TP.KTF101",
  "TP.KTF17","TP.KTF171","TP.KTF172",
  "TP.KTF1",
  "TP.KTF1.USD","TP.KTF1.EUR",
  "TP.KTF1.K","TP.KTF1.K.USD","TP.KTF1.K.EUR",
  "TP.KTF17.TL","TP.KTF17.USD","TP.KTF17.EUR",
];

const AYLIK = [
  "TP_BKR_TRY_KTF10","TP_BKR_TRY_17","TP_BKR_TRY_18",
  "TP_BKR_TRY_1","TP_BKR_USD_1","TP_BKR_EUR_1",
  "TP_KBK_TRY_KBTF10","TP_KBK_TRY_17","TP_KBK_TRY_18",
  "TP_KBK_TRY_1","TP_KBK_USD_KBTF17","TP_KBK_EUR_KBTF17",
  "TP_KKP_TRY_KTF10","TP_KKP_TRY_17","TP_KKP_TRY_18",
  "TP_KKP_TRY_1","TP_KKP_USD_KTF17","TP_KKP_EUR_KTF17",
];

const ENFLASYON = [
  "TP.FE.OKTG01",  // TÜFE genel endeks (2003=100) — Aralık 2025'ten sonra donmuş, bkz. üstteki not
  "TP.FE.OKTG02",  // A Endeksi (mevsimlik hariç)
];

const POLITIKA = [
  "TP.APIFON4",    // AOFM
];

const GUNLUK = [
  "TP.BISTTLREF.KAPANIS", // TLREF endeksi (ORAN DEĞİL) — günlük değişimden oran türetilir
];

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
  const r=await fetch(url,{headers:{"key":apiKey,"Accept":"application/json"}});
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
    const c=cacheTarihsel[seri];
    if(c&&now-c.ts<CACHE_TTL_MS)
      return res.status(200).json({tarihsel:{[seri]:c.data},cached:true});
    try{
      const isGunluk=seri.includes("TLREF")||seri.includes("BISTTL");
      const isHaftalik=seri.includes(".")&&!isGunluk&&!seri.startsWith("TP.FE");
      const freq=isGunluk?"1":isHaftalik?"8":"9";
      const period=isGunluk?90:isHaftalik?200:400;
      const url=`${BASE}/series=${seri}&startDate=${onceki(period)}&endDate=${tarihStr(new Date())}&type=json&frequency=${freq}`;
      const {json}=await evdsFetch(url,apiKey);
      const degerler=tumDegerler(json?.items||[],seri);
      cacheTarihsel[seri]={data:degerler,ts:now};
      return res.status(200).json({tarihsel:{[seri]:degerler}});
    }catch(err){
      const c2=cacheTarihsel[seri];
      if(c2) return res.status(200).json({tarihsel:{[seri]:c2.data},cached:true});
      return res.status(500).json({error:err.message});
    }
  }

  if(cacheAnlik.data&&now-cacheAnlik.ts<CACHE_TTL_MS&&debug!=="1")
    return res.status(200).json({...cacheAnlik.data,cached:true});

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

  try{
    const [hafJson,ayJson,gunJson,enfJson,polJson]=await Promise.all([
      guvenliCek("haftalik", `${BASE}/series=${HAFTALIK.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=8`),
      guvenliCek("aylik",    `${BASE}/series=${AYLIK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=9`),
      guvenliCek("gunluk_tlref", `${BASE}/series=${GUNLUK.join("-")}&startDate=${onceki(30)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("enflasyon", `${BASE}/series=${ENFLASYON.join("-")}&startDate=${onceki(450)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("politika_aofm", `${BASE}/series=${POLITIKA.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=8`),
    ]);

    const sonuclar={};
    for(const s of HAFTALIK) sonuclar[s]=sonDeger(hafJson?.items||[],s);
    for(const s of AYLIK)    sonuclar[s]=sonDeger(ayJson?.items||[],s);
    for(const s of POLITIKA) sonuclar[s]=sonDeger(polJson?.items||[],s);

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
    } else {
      sonuclar["TP.BISTTLREF.KAPANIS"]=null;
    }

    const enfItems=enfJson?.items||[];
    const tufeDizi=tumDegerler(enfItems,"TP.FE.OKTG01");
    teshis.tufeDizi_uzunluk = tufeDizi.length;
    teshis.tufeDizi_son3 = tufeDizi.slice(-3);
    if(tufeDizi.length>=13){
      const son=tufeDizi[tufeDizi.length-1];
      const oncekiAy=tufeDizi[tufeDizi.length-2];
      const oncekiYil=tufeDizi[tufeDizi.length-13];
      sonuclar["TUFE_YILLIK"]={deger:((son.deger-oncekiYil.deger)/oncekiYil.deger*100),tarih:son.tarih};
      sonuclar["TUFE_AYLIK"]={deger:((son.deger-oncekiAy.deger)/oncekiAy.deger*100),tarih:son.tarih};
    } else {
      sonuclar["TUFE_YILLIK"]=null;
      sonuclar["TUFE_AYLIK"]=null;
    }

    const yanit={tarih:tarihStr(new Date()),seriler:sonuclar, _teshis: teshis};
    cacheAnlik={data:yanit,ts:now};
    return res.status(200).json(yanit);
  }catch(err){
    if(cacheAnlik.data)
      return res.status(200).json({...cacheAnlik.data,cached:true,hata:err.message});
    return res.status(500).json({error:err.message});
  }
}

