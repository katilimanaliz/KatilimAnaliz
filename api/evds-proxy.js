// api/evds-proxy.js - FINAL v10
// Haftalık kredi oranları + Aylık stok + Enflasyon + TLREF (oran, endeksten türetilmiş) + AOFM
// + Dış Ticaret & Ödemeler Dengesi (v10)
//
// TLREF DÜZELTMESİ (2026-07): TP.BISTTLREF.KAPANIS ham değeri bir ORAN (%) değil,
// bir ENDEKS seviyesidir (örn. 6223.01) — TLREF'in her gün bileşik olarak
// büyüttüğü bir toplam getiri endeksi. Gerçek günlük/yıllıklandırılmış TLREF
// ORANINI elde etmek için ardışık iki günün endeks değerinden türetiyoruz.
//
// TÜFE NOTU (2026-07, ÇÖZÜLDÜ): TCMB'nin baz yıl güncellemesi (2025=100)
// nedeniyle eski TP.FE.OKTG01 serisi Aralık 2025'te donmuştu. Doğru yeni seri
// kodu (TP_TUKFIY2025_GENEL) EVDS üzerinden bulunup doğrulandı, Haziran 2026'ya
// kadar güncel veri veriyor. ENFLASYON dizisi buna göre güncellendi.
//
// TÜFE SERİ DÜZELTMESİ (2026-07, v7): Ana kart (anlık TUFE_YILLIK) değeri ile
// detay tablosundaki (TUFE_YILLIK_SERI) en son satır birbirinden farklı
// görünüyordu (örn. %32,11 vs %33,92). Kök neden: YoY (yıllık değişim) hesabı
// "12 ay önceki" veriyle kıyaslanmalıyken, seri döngüsü yanlışlıkla "13 ay
// önceki" veriyle kıyaslıyordu (index i-13, doğrusu i-12). Ana karttaki tekil
// hesap zaten doğruydu (tufeDizi.length-13, ki bu length-1'den 12 geridir);
// sadece seri döngüsündeki indeks kayması düzeltildi — artık ikisi birebir
// aynı ayı, aynı yöntemle hesaplayıp aynı sonucu veriyor.
//
// DIŞ TİCARET & ÖDEMELER DENGESİ (2026-07, v10): Seri kodları EVDS katalog
// keşfiyle (?katalog=1&filtre=DIS TICARET / ODEMELER DENGESI / EFEKTIF DOVIZ)
// bulunup doğrulandı:
//   TP.IHRACATBEC.9999    İhracat toplamı (Genel Ticaret Sistemi, aylık, USD)
//   TP.ITHALATBEC.9999    İthalat toplamı (Genel Ticaret Sistemi, aylık, USD)
//   TP.ODANA6.Q01         Cari İşlemler Hesabı (Analitik Sunum, aylık, USD)
//   TP.HARICCARIACIK.K10  Altın ve Enerji Hariç Cari İşlemler Hesabı (aylık)
//   TP.RK.T1.Y            TÜFE Bazlı Reel Efektif Döviz Kuru (2025=100, endeks)
// Türetilenler: Dış Ticaret Dengesi (ihracat-ithalat), Karşılama Oranı
// (ihracat/ithalat*100) ve ihracat/ithalat/denge/cari için 12 AYLIK KÜMÜLATİF
// (yıllıklandırılmış) toplamlar — takvim yılına kilitli olmadığından her ay
// güncellenir; ekstra EVDS isteği gerektirmez.

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
// NOT (2026-07-05): v4 → v5 sürüm değişikliği — DÜZELTME 5 ile TLREF hesaplama
// yöntemi (regresyon → medyan + tam formül) değiştiği için tekrar artırıldı.
// NOT (2026-07): v5 → v6 sürüm değişikliği — TÜFE serisindeki off-by-one
// (13 ay yerine 12 ay geri kıyaslama) düzeltmesi eski cache'i geçersiz kılmak
// için yapıldı; aksi halde kod deploy edilse bile kullanıcı 6 saat boyunca
// hâlâ hatalı önbelleklenmiş TUFE_YILLIK_SERI'yi görmeye devam ederdi.
// NOT (2026-07-09): v6 → v7 sürüm değişikliği — ABD tahvil faizleri (DGS2/5/10),
// FED (DFF) ve ECB (ECBDFR) FRED serileri eklendiği için yapıldı. Versiyon
// artırılmazsa eski v6 önbelleği (bu alanları içermeyen) 6 saat boyunca
// döndürülmeye devam eder — yeni alanlar "—" görünür (tam bu hatayı yaşadık).
// NOT (2026-07-09b): v7 → v8 sürüm değişikliği — SOFR 3M/6M (SOFR90DAYAVG/
// SOFR180DAYAVG) eklendiği için yapıldı. Versiyon artırılmazsa eski önbellek
// bu yeni alanları içermeden 6 saat daha döner (bkz. bir önceki v6→v7 dersi).
// NOT (2026-07-09c): v8 → v9 sürüm değişikliği — FED Üst/Alt Bant (DFEDTARU/
// DFEDTARL) eklendiği için yapıldı.
// NOT (2026-07-11): v9 → v10 sürüm değişikliği — Dış Ticaret & Ödemeler
// Dengesi serileri (DT_* / CARI_* / REK_*) eklendiği için yapıldı. Aynı ders:
// versiyon artırılmazsa eski önbellek yeni alanları 6 saat boyunca göstermez.
const KV_ANLIK_KEY = "evds:anlik:v10";
const KV_TARIHSEL_PREFIX = "evds:tarihsel:v10:";

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

// Dış Ticaret & Ödemeler Dengesi (v10) — kodlar katalog keşfiyle doğrulandı.
const DISTICARET = [
  "TP.IHRACATBEC.9999",
  "TP.ITHALATBEC.9999",
  "TP.ODANA6.Q01",
  "TP.HARICCARIACIK.K10",
  "TP.RK.T1.Y",
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

// ── DIŞ TİCARET yardımcıları (v10) ─────────────────────────────────────────
// BİRİM NORMALİZASYONU: EVDS bu serileri kaynağına göre "Bin USD" ya da
// "Milyon USD" olarak verebiliyor; hangisi olduğu API yanıtında yazmıyor.
// Seri bazında MEDYAN mutlak büyüklükten tespit edip her şeyi MİLYON USD'a
// çeviriyoruz: medyan > 100.000 ise değerler Bin USD kabul edilir (aylık
// hiçbir dış ticaret/cari kalemi 100 milyar USD'ı aşmadığından, milyon USD
// cinsinden hiçbir aylık değer bu eşiği geçemez — güvenli ayrım noktası).
function milyonUSDNormalize(dizi){
  if(!dizi || dizi.length===0) return dizi||[];
  const mutlak = dizi.map(n=>Math.abs(n.deger)).filter(v=>v>0).sort((a,b)=>a-b);
  if(mutlak.length===0) return dizi;
  const medyan = mutlak[Math.floor(mutlak.length/2)];
  if(medyan > 100000) return dizi.map(n=>({tarih:n.tarih, deger:n.deger/1000}));
  return dizi;
}
// 12 aylık kümülatif (hareketli) toplam — i. nokta, i dahil geriye doğru 12
// aylık pencerenin toplamıdır. İlk 11 nokta (eksik pencere) atlanır.
function kumulatif12Ay(dizi){
  const sonuc=[];
  for(let i=11;i<dizi.length;i++){
    let toplam=0;
    for(let j=i-11;j<=i;j++) toplam+=dizi[j].deger;
    sonuc.push({tarih:dizi[i].tarih, deger:toplam});
  }
  return sonuc;
}
// İki aylık seriyi tarihe göre eşleştirip f(a,b) ile birleştirir (denge,
// karşılama oranı gibi türetilmiş seriler için). Yalnızca iki seride de aynı
// ay varsa nokta üretir — yayın gecikmeleri farklıysa uçtaki aylar atlanır.
function seriBirlestir(a, b, f){
  const map={};
  for(const n of b) map[n.tarih]=n.deger;
  const sonuc=[];
  for(const n of a){
    const v=map[n.tarih];
    if(v===undefined) continue;
    const r=f(n.deger, v);
    if(r==null || !isFinite(r)) continue;
    sonuc.push({tarih:n.tarih, deger:r});
  }
  return sonuc;
}
function sonNokta(dizi){
  if(!dizi || dizi.length===0) return null;
  const s=dizi[dizi.length-1];
  return {deger:s.deger, tarih:s.tarih};
}

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
  return fark > 0 ? fark : 1;
}

function ayinNIsGunu(yil, ay, gun){
  let d = new Date(Date.UTC(yil, ay, gun));
  while(d.getUTCDay()===0 || d.getUTCDay()===6){ d.setUTCDate(d.getUTCDate()+1); }
  return d;
}
function tufeAcikilanmaTarihi(referansTarihStr){
  const d = tarihParseDDMMYYYY(referansTarihStr);
  if(!d) return referansTarihStr;
  const yil = d.getUTCFullYear();
  const ay = d.getUTCMonth();
  const acikilanma = ayinNIsGunu(yil, ay+1, 3);
  const dd=String(acikilanma.getUTCDate()).padStart(2,"0");
  const mm=String(acikilanma.getUTCMonth()+1).padStart(2,"0");
  const yy=acikilanma.getUTCFullYear();
  return `${dd}-${mm}-${yy}`;
}

function gunlukTlrefOranlari(dizi){
  const oranlar=[];
  for(let i=1;i<dizi.length;i++){
    const g = gunFarki(dizi[i].tarih, dizi[i-1].tarih);
    if(g<=0 || !dizi[i-1].deger || !dizi[i].deger) continue;
    const oran = ((dizi[i].deger/dizi[i-1].deger)-1) * (365/g) * 100;
    oranlar.push({tarih:dizi[i].tarih, deger:oran, gun:g});
  }
  return oranlar;
}
function medyanTlrefOrani(gunlukOranlar, sonIndex, pencereNokta=9){
  const baslangic = Math.max(0, sonIndex - pencereNokta + 1);
  const dilim = gunlukOranlar.slice(baslangic, sonIndex+1).map(o=>o.deger).sort((a,b)=>a-b);
  if(dilim.length===0) return null;
  const orta = Math.floor(dilim.length/2);
  return dilim.length%2 ? dilim[orta] : (dilim[orta-1]+dilim[orta])/2;
}
const TLREF_PENCERE_NOKTA = 9;

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

  // ── KATALOG KESFI (yardimci): /api/evds-proxy?katalog=1[&filtre=IHALE,HAZINE]
  // EVDS veri gruplarini ve seri kodlarini listeler (2Y/5Y tahvil ihale faiz
  // serilerini bulmak icin eklendi). Anahtar sunucuda kalir, disari sizmez.
  if(req.query.katalog==="1"){
    try{
      const filtreParam = String(req.query.filtre||"IHALE,HAZINE,DIBS,BORCLANMA");
      const N = function(s){ return String(s==null?"":s).toLocaleUpperCase("tr-TR")
        .split("\u0130").join("I").split("\u015E").join("S")
        .split("\u00C7").join("C").split("\u00D6").join("O")
        .split("\u00DC").join("U").split("\u011E").join("G"); };
      const filtreler = filtreParam.split(",").map(function(s){return N(s.trim());}).filter(Boolean);
      const kataloglar = ["https://evds2.tcmb.gov.tr/service/evds", BASE];
      let gruplar=null, kullanilan=null;
      for(const kb of kataloglar){
        try{
          const r = await fetchZamanli(kb+"/datagroups/mode=0&code=0&type=json",{headers:{"key":apiKey,"Accept":"application/json"}},10000);
          const t = await r.text();
          if(t.trim().startsWith("[")){ gruplar=JSON.parse(t); kullanilan=kb; break; }
        }catch(e){}
      }
      if(!gruplar) return res.status(502).json({error:"datagroups alinamadi"});
      const ilgili = gruplar.filter(function(g){
        const ad=N(g.DATAGROUP_ADI||g.DATAGROUP_NAME);
        return filtreler.some(function(f){return ad.indexOf(f)>=0;});
      }).slice(0,40);
      const sonuc=[];
      for(const g of ilgili){
        const kod=g.DATAGROUP_KODU||g.DATAGROUP_CODE;
        let seriler=[];
        try{
          const r2=await fetchZamanli(kullanilan+"/serieList/type=json&code="+kod,{headers:{"key":apiKey,"Accept":"application/json"}},10000);
          const t2=await r2.text();
          if(t2.trim().startsWith("[")){
            seriler=JSON.parse(t2).map(function(s){return {kod:s.SERIE_CODE, ad:s.SERIE_NAME};});
          }
        }catch(e){}
        sonuc.push({grupKodu:kod, grupAdi:g.DATAGROUP_ADI||g.DATAGROUP_NAME, seriler:seriler});
      }
      return res.status(200).json({kaynak:kullanilan, grupSayisi:sonuc.length, gruplar:sonuc});
    }catch(err){
      return res.status(500).json({error:err.message});
    }
  }


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
    const [hafJson,ayJson,gunJson,enfJson,polJson,rezervJson,dtJson]=await Promise.all([
      guvenliCek("haftalik", `${BASE}/series=${HAFTALIK.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
      guvenliCek("aylik",    `${BASE}/series=${AYLIK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("gunluk_tlref", `${BASE}/series=${GUNLUK.join("-")}&startDate=${onceki(30)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("enflasyon", `${BASE}/series=${ENFLASYON.join("-")}&startDate=${onceki(730)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("politika_aofm", `${BASE}/series=${POLITIKA.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("rezerv", `${BASE}/series=${REZERV.join("-")}&startDate=${onceki(180)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
      // Dış ticaret (v10): 12 aylık kümülatif serinin 24 noktası için ~36 ay
      // ham aylık veri gerekir → 1150 günlük pencere (~38 ay), tek istek.
      guvenliCek("disticaret", `${BASE}/series=${DISTICARET.join("-")}&startDate=${onceki(1150)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
    ]);

    const [sofr,eur3m,us2y,us5y,us10y,fedFonlama,ecbMevduat,sofr3m,sofr6m,fedUst,fedAlt]=await Promise.all([
      guvenliCekFred("fred_sofr", "SOFR"),
      guvenliCekFred("fred_euribor3m", "IR3TIB01EZM156N"),
      // ABD Hazine tahvil faizleri (2/5/10 yıl) — FRED'in günlük "Constant
      // Maturity" serileri, en güvenilir ve güncel kaynak (bkz. DGS2/DGS5/DGS10).
      guvenliCekFred("fred_us2y", "DGS2"),
      guvenliCekFred("fred_us5y", "DGS5"),
      guvenliCekFred("fred_us10y", "DGS10"),
      // FED — Federal Funds Effective Rate (günlük, FOMC'nin belirlediği HEDEF
      // BANT içinde piyasada FİİLEN GERÇEKLEŞEN gecelik faiz — bandın kendisi
      // değil). TCMB'deki "AOFM" ile aynı mantık: gerçekleşen oran.
      guvenliCekFred("fred_fedfunds", "DFF"),
      // ECB — Mevduat İmkanı Faizi (Deposit Facility Rate). Mart 2024'ten beri
      // ECB'nin para politikasını yönlendirdiği ASIL politika faizi budur
      // (Ana Refinansman Faizi değil) — bkz. ECB'nin kendi açıklaması.
      guvenliCekFred("fred_ecb", "ECBDFR"),
      // SOFR 3M/6M — NY Fed'in resmi "SOFR Averages" serileri (90/180 günlük
      // bileşik ortalama). NOT: CME'nin piyasada asıl kullanılan "Term SOFR"u
      // değildir (o ileriye dönük ve lisanslı/ücretli) — bu, geriye dönük
      // gerçekleşmiş SOFR'un ortalaması. Ücretsiz ve resmi tek alternatif budur.
      guvenliCekFred("fred_sofr3m", "SOFR90DAYAVG"),
      guvenliCekFred("fred_sofr6m", "SOFR180DAYAVG"),
      // FED HEDEF BANT (2026-07 eklendi) — FOMC oranı TCMB gibi tek sayı değil,
      // bir ARALIK olarak açıklıyor (örn. %3,50-%3,75). DFF bu aralığın
      // İÇİNDE gerçekleşen fiili orandır, aralığın kendisi değil — kullanıcı
      // karışıklığını önlemek için üst/alt bandı ayrıca gösteriyoruz.
      guvenliCekFred("fred_fed_ust", "DFEDTARU"),
      guvenliCekFred("fred_fed_alt", "DFEDTARL"),
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
    sonuclar["FRED_US2Y"]=us2y.son;
    sonuclar["FRED_US2Y_SERI"]=us2y.seri;
    sonuclar["FRED_US5Y"]=us5y.son;
    sonuclar["FRED_US5Y_SERI"]=us5y.seri;
    sonuclar["FRED_US10Y"]=us10y.son;
    sonuclar["FRED_US10Y_SERI"]=us10y.seri;
    sonuclar["FRED_FEDFUNDS"]=fedFonlama.son;
    sonuclar["FRED_FEDFUNDS_SERI"]=fedFonlama.seri;
    sonuclar["FRED_ECB"]=ecbMevduat.son;
    sonuclar["FRED_ECB_SERI"]=ecbMevduat.seri;
    sonuclar["FRED_SOFR3M"]=sofr3m.son;
    sonuclar["FRED_SOFR3M_SERI"]=sofr3m.seri;
    sonuclar["FRED_SOFR6M"]=sofr6m.son;
    sonuclar["FRED_SOFR6M_SERI"]=sofr6m.seri;
    sonuclar["FRED_FED_UST"]=fedUst.son;
    sonuclar["FRED_FED_UST_SERI"]=fedUst.seri;
    sonuclar["FRED_FED_ALT"]=fedAlt.son;
    sonuclar["FRED_FED_ALT_SERI"]=fedAlt.seri;

    sonuclar["TP.APIFON4_SERI"]=tumDegerler(polJson?.items||[], "TP.APIFON4").slice(-24);
    sonuclar["TP_AB_TOPLAM_SERI"]=tumDegerler(rezervJson?.items||[], "TP_AB_TOPLAM").slice(-24);

    // ── DIŞ TİCARET & ÖDEMELER DENGESİ (v10) ──────────────────────────────
    // Tüm parasal değerler milyonUSDNormalize ile MİLYON USD'a normalize
    // edilir; UI tarafı "milyon$" birimiyle Milyar $ olarak biçimlendirir.
    const dtItems = dtJson?.items||[];
    const ihrDizi  = milyonUSDNormalize(tumDegerler(dtItems, "TP.IHRACATBEC.9999"));
    const ithDizi  = milyonUSDNormalize(tumDegerler(dtItems, "TP.ITHALATBEC.9999"));
    const cariDizi = milyonUSDNormalize(tumDegerler(dtItems, "TP.ODANA6.Q01"));
    const cariAEDizi = milyonUSDNormalize(tumDegerler(dtItems, "TP.HARICCARIACIK.K10"));
    const rekDizi  = tumDegerler(dtItems, "TP.RK.T1.Y"); // endeks, normalize edilmez
    // Türetilmiş aylık seriler (tarih eşleştirmeli — yayın gecikmesi farkları
    // uçtaki ayları güvenle atlar):
    const dengeDizi     = seriBirlestir(ihrDizi, ithDizi, (ih,it)=>ih-it);
    const karsilamaDizi = seriBirlestir(ihrDizi, ithDizi, (ih,it)=>it!==0?(ih/it*100):null);
    // 12 aylık kümülatifler:
    const ihr12  = kumulatif12Ay(ihrDizi);
    const ith12  = kumulatif12Ay(ithDizi);
    const denge12= kumulatif12Ay(dengeDizi);
    const cari12 = kumulatif12Ay(cariDizi);
    teshis.disticaret_hesap = {
      ihracat_nokta: ihrDizi.length, ithalat_nokta: ithDizi.length,
      cari_nokta: cariDizi.length, cariAE_nokta: cariAEDizi.length,
      rek_nokta: rekDizi.length,
      ihracat_son: sonNokta(ihrDizi), ithalat_son: sonNokta(ithDizi),
      cari_son: sonNokta(cariDizi),
    };
    sonuclar["DT_IHRACAT"]=sonNokta(ihrDizi);
    sonuclar["DT_IHRACAT_SERI"]=ihrDizi.slice(-24);
    sonuclar["DT_IHRACAT_12AY"]=sonNokta(ihr12);
    sonuclar["DT_IHRACAT_12AY_SERI"]=ihr12.slice(-24);
    sonuclar["DT_ITHALAT"]=sonNokta(ithDizi);
    sonuclar["DT_ITHALAT_SERI"]=ithDizi.slice(-24);
    sonuclar["DT_ITHALAT_12AY"]=sonNokta(ith12);
    sonuclar["DT_ITHALAT_12AY_SERI"]=ith12.slice(-24);
    sonuclar["DT_DENGE"]=sonNokta(dengeDizi);
    sonuclar["DT_DENGE_SERI"]=dengeDizi.slice(-24);
    sonuclar["DT_DENGE_12AY"]=sonNokta(denge12);
    sonuclar["DT_DENGE_12AY_SERI"]=denge12.slice(-24);
    sonuclar["DT_KARSILAMA"]=sonNokta(karsilamaDizi);
    sonuclar["DT_KARSILAMA_SERI"]=karsilamaDizi.slice(-24);
    sonuclar["CARI_DENGE"]=sonNokta(cariDizi);
    sonuclar["CARI_DENGE_SERI"]=cariDizi.slice(-24);
    sonuclar["CARI_DENGE_12AY"]=sonNokta(cari12);
    sonuclar["CARI_DENGE_12AY_SERI"]=cari12.slice(-24);
    sonuclar["CARI_DENGE_AE"]=sonNokta(cariAEDizi);
    sonuclar["CARI_DENGE_AE_SERI"]=cariAEDizi.slice(-24);
    sonuclar["REK_TUFE"]=sonNokta(rekDizi);
    sonuclar["REK_TUFE_SERI"]=rekDizi.slice(-24);

    const tlrefEndeksDizi=tumDegerler(gunJson?.items||[], "TP.BISTTLREF.KAPANIS");
    teshis.tlrefEndeksDizi_uzunluk = tlrefEndeksDizi.length;
    const gunlukOranlarDizi = gunlukTlrefOranlari(tlrefEndeksDizi);
    const sonIdx = gunlukOranlarDizi.length-1;
    const sonYillikOran = sonIdx>=0 ? medyanTlrefOrani(gunlukOranlarDizi, sonIdx, TLREF_PENCERE_NOKTA) : null;
    if(sonIdx>=0 && sonYillikOran!=null){
      const son=tlrefEndeksDizi[tlrefEndeksDizi.length-1];
      sonuclar["TP.BISTTLREF.KAPANIS"]={deger:sonYillikOran, tarih:son.tarih, endeksHam:son.deger};
      teshis.tlref_hesap = {
        yontem:"medyan_tam_formul",
        pencere_nokta:TLREF_PENCERE_NOKTA,
        son_endeks:son.deger,
        son_tarih:son.tarih,
        yillik_oran_pct:sonYillikOran,
        son_9_gunluk_oran:gunlukOranlarDizi.slice(-9),
      };
      const tlrefSeri=[];
      for(let i=0;i<gunlukOranlarDizi.length;i++){
        const oran=medyanTlrefOrani(gunlukOranlarDizi, i, TLREF_PENCERE_NOKTA);
        if(oran==null) continue;
        tlrefSeri.push({tarih:gunlukOranlarDizi[i].tarih, deger:oran});
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
      const oncekiYil=tufeDizi[tufeDizi.length-13]; // 12 ay önce (length-1 - 12)
      sonuclar["TUFE_YILLIK"]={deger:((son.deger-oncekiYil.deger)/oncekiYil.deger*100),tarih:tufeAcikilanmaTarihi(son.tarih)};
      sonuclar["TUFE_AYLIK"]={deger:((son.deger-oncekiAy.deger)/oncekiAy.deger*100),tarih:tufeAcikilanmaTarihi(son.tarih)};

      // DÜZELTME (2026-07, v7): oY indeksi "i-13" idi (13 ay önce), doğrusu
      // "i-12" (12 ay önce) — artık ana karttaki hesapla birebir aynı ayı,
      // aynı yöntemle kıyaslıyor. Döngü koşulu da i>=12'ye çekildi.
      const yillikSeri=[], aylikSeri=[];
      for(let i=tufeDizi.length-1;i>=12;i--){
        const s=tufeDizi[i], oA=tufeDizi[i-1], oY=tufeDizi[i-12];
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
