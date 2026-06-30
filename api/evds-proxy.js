// api/evds-proxy.js - FINAL v4
// Haftalık kredi oranları + Aylık stok + Enflasyon + TLTEFK

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";
const CACHE_TTL_MS = 6 * 3600 * 1000;
let cacheAnlik = { data: null, ts: 0 };
let cacheTarihsel = {};

// Haftalık akım (frequency=8)
const HAFTALIK = [
  "TP.KTF10","TP.KTF11","TP.KTF12",
  "TP.KTF101",
  "TP.KTF17","TP.KTF171","TP.KTF172",
  "TP.KTF1",
  "TP.KTF1.USD","TP.KTF1.EUR",
  "TP.KTF1.K","TP.KTF1.K.USD","TP.KTF1.K.EUR",
  "TP.KTF17.TL","TP.KTF17.USD","TP.KTF17.EUR",
];

// Aylık stok (frequency=9)
const AYLIK = [
  "TP_BKR_TRY_KTF10","TP_BKR_TRY_17","TP_BKR_TRY_18",
  "TP_BKR_TRY_1","TP_BKR_USD_1","TP_BKR_EUR_1",
  "TP_KBK_TRY_KBTF10","TP_KBK_TRY_17","TP_KBK_TRY_18",
  "TP_KBK_TRY_1","TP_KBK_USD_KBTF17","TP_KBK_EUR_KBTF17",
  "TP_KKP_TRY_KTF10","TP_KKP_TRY_17","TP_KKP_TRY_18",
  "TP_KKP_TRY_1","TP_KKP_USD_KTF17","TP_KKP_EUR_KTF17",
  // Enflasyon (aylık)
  "TP.FE.OKTG01",  // TÜFE yıllık değişim
  "TP.FE.OKTG02",  // TÜFE aylık değişim
  "TP.FE.OKTG09",  // Yİ-ÜFE yıllık
  "TP.FE.OKTG10",  // Yİ-ÜFE aylık
  "TP.FE.OKTG36",  // Çekirdek enflasyon C yıllık
];

// Günlük (frequency=1) - TLTEFK
const GUNLUK = [
  "TP.BISTTLREF.KAPANIS", // TLTEFK kapanış
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
  if(text.trim().startsWith("<")) throw new Error(`HTML döndü (HTTP ${r.status})`);
  return JSON.parse(text);
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  const apiKey=process.env.EVDS_KEY;
  if(!apiKey) return res.status(500).json({error:"EVDS_KEY eksik"});

  const {grafik,seri}=req.query;
  const now=Date.now();

  // GRAFİK MODU
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
      const json=await evdsFetch(url,apiKey);
      const degerler=tumDegerler(json?.items||[],seri);
      cacheTarihsel[seri]={data:degerler,ts:now};
      return res.status(200).json({tarihsel:{[seri]:degerler}});
    }catch(err){
      const c2=cacheTarihsel[seri];
      if(c2) return res.status(200).json({tarihsel:{[seri]:c2.data},cached:true});
      return res.status(500).json({error:err.message});
    }
  }

  // ANLIK MOD
  if(cacheAnlik.data&&now-cacheAnlik.ts<CACHE_TTL_MS)
    return res.status(200).json({...cacheAnlik.data,cached:true});

  try{
    const [hafJson,ayJson,gunJson]=await Promise.all([
      evdsFetch(`${BASE}/series=${HAFTALIK.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=8`,apiKey),
      evdsFetch(`${BASE}/series=${AYLIK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=9`,apiKey),
      evdsFetch(`${BASE}/series=${GUNLUK.join("-")}&startDate=${onceki(30)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`,apiKey),
    ]);

    const sonuclar={};
    for(const s of HAFTALIK) sonuclar[s]=sonDeger(hafJson?.items||[],s);
    for(const s of AYLIK)    sonuclar[s]=sonDeger(ayJson?.items||[],s);
    for(const s of GUNLUK)   sonuclar[s]=sonDeger(gunJson?.items||[],s);

    const yanit={tarih:tarihStr(new Date()),seriler:sonuclar};
    cacheAnlik={data:yanit,ts:now};
    return res.status(200).json(yanit);
  }catch(err){
    if(cacheAnlik.data)
      return res.status(200).json({...cacheAnlik.data,cached:true,hata:err.message});
    return res.status(500).json({error:err.message});
  }
}
