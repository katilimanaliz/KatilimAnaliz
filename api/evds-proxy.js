// api/evds-proxy.js - Haftalık + Aylık Stok
const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";
const CACHE_TTL_MS = 6 * 3600 * 1000;
let cacheAnlik = { data: null, ts: 0 };

// Haftalık akım (doğrulanmış + test edilecek)
const HAFTALIK = [
  "TP.KTF10","TP.KTF11","TP.KTF12",    // Tüm: konut/taşıt/ihtiyaç
  "TP.KTF101","TP.KTF111","TP.KTF121",  // Kamu: konut/taşıt/ihtiyaç
  "TP.KTF17","TP.KTF171","TP.KTF172",   // Katılım: konut/taşıt/ihtiyaç
  "TP.KTF1",                              // Tüm ticari TL
  "TP.KTF1.USD","TP.KTF1.EUR",           // Tüm ticari USD/EUR
  "TP.KTF1.K","TP.KTF1.K.USD","TP.KTF1.K.EUR", // Kamu ticari
  "TP.KTF17.TL","TP.KTF17.USD","TP.KTF17.EUR",  // Katılım ticari
];

// Aylık stok (doğrulanmış)
const AYLIK = [
  "TP_BKR_TRY_KTF10","TP_BKR_TRY_17","TP_BKR_TRY_18",
  "TP_BKR_TRY_1","TP_BKR_USD_1","TP_BKR_EUR_1",
  "TP_KBK_TRY_KBTF10","TP_KBK_TRY_17","TP_KBK_TRY_18",
  "TP_KBK_TRY_1","TP_KBK_USD_KBTF17","TP_KBK_EUR_KBTF17",
  "TP_KKP_TRY_KTF10","TP_KKP_TRY_17","TP_KKP_TRY_18",
  "TP_KKP_TRY_1","TP_KKP_USD_KTF17","TP_KKP_EUR_KTF17",
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
  const keys=[seri,seri.replace(/\./g,"_"),seri.replace(/_/g,".")];
  for(let i=items.length-1;i>=0;i--){
    for(const k of keys){
      const v=items[i][k];
      if(v!==null&&v!==undefined&&v!=="")
        return {deger:parseFloat(v),tarih:normalizeTarih(items[i].Tarih)};
    }
  }
  return null;
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

  const now=Date.now();
  if(cacheAnlik.data&&now-cacheAnlik.ts<CACHE_TTL_MS)
    return res.status(200).json({...cacheAnlik.data,cached:true});

  try{
    const [hafJson,ayJson]=await Promise.all([
      evdsFetch(`${BASE}/series=${HAFTALIK.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=8`,apiKey),
      evdsFetch(`${BASE}/series=${AYLIK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=9`,apiKey),
    ]);
    const sonuclar={};
    for(const s of HAFTALIK) sonuclar[s]=sonDeger(hafJson?.items||[],s);
    for(const s of AYLIK)    sonuclar[s]=sonDeger(ayJson?.items||[],s);
    const yanit={tarih:tarihStr(new Date()),seriler:sonuclar};
    cacheAnlik={data:yanit,ts:now};
    return res.status(200).json(yanit);
  }catch(err){
    if(cacheAnlik.data) return res.status(200).json({...cacheAnlik.data,cached:true,hata:err.message});
    return res.status(500).json({error:err.message});
  }
}
