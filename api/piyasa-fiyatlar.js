// api/piyasa-fiyatlar.js
// Birleştirilmiş fiyat proxy'si: altin + kripto + petrol + kur + altinapi
// Kullanım: /api/piyasa-fiyatlar?tip=altin | kripto | petrol | kur | altinapi
//
// ═══════════════════════════════════════════════════════════════════════════
// KAYNAK DEĞİŞİKLİĞİ (2026-08-08) — Yahoo/Frankfurter → AltinAPI
// ═══════════════════════════════════════════════════════════════════════════
// SORUN: Kurlar Frankfurter'dan (Avrupa Merkez Bankası GÜNLÜK REFERANS kuru,
// günde tek yayın) geliyordu. Bu kur ne serbest piyasa kuruydu ne de gün
// içinde güncelleniyordu; kullanıcının döviz bürosunda gördüğü rakamla
// uyuşmuyordu. Altın/gümüş ise Yahoo futures'tan (GC=F, SI=F) alınıp USD/TRY
// ile ÇARPILARAK gram fiyatına çevriliyordu — bu da Kapalı Çarşı fiyatı değil,
// türetilmiş bir yaklaşıklıktı.
//
// ÇÖZÜM: Tümü AltinAPI'ye (Harem Altın verisi, serbest piyasa) taşındı.
// Böylece uygulama genelinde TEK kaynak kullanılıyor; altın Harem'den, kur
// ECB'den gelince ortaya çıkan iç tutarsızlık ortadan kalktı.
//
// ALTINAPI'DE OLMAYANLAR — bilinçli olarak eski kaynaklarında bırakıldı:
//   • Petrol (BZ=F)  → AlphaVantage, yedeği Yahoo
//   • Bitcoin        → CoinGecko
//
// BID/ASK: AltinAPI her sembol için alış (bid) ve satış (ask) veriyor.
// Ana alan adları (USD_TRY vb.) SATIŞ fiyatını taşıyor — kullanıcı döviz
// ALIRKEN ödeyeceği fiyat budur ve ana ekranda gösterilen odur. Alış/satış
// ayrı ayrı da döndürülüyor ("detay" altında) ki Piyasa ekranı ikisini
// birden gösterebilsin.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── ORTAK: AltinAPI ham veri ──────────────────────────────────────────────
// Tek istekte 260+ sembol dönüyor; altin/kur/altinapi tiplerinin hepsi bunu
// kullanıyor. Her tip kendi Redis anahtarında önbelleklendiği için AltinAPI'ye
// giden istek sayısı artmıyor.
async function altinApiCek() {
  const apiKey = process.env.ALTINAPI_KEY;
  if (!apiKey) throw new Error("ALTINAPI_KEY tanimli degil");
  const r = await fetch("https://altinapi.com/api/v1/prices", {
    headers: { "X-API-Key": apiKey },
  });
  if (!r.ok) throw new Error("AltinAPI HTTP " + r.status);
  const json = await r.json();
  const items = (json && json.data) || [];
  const harita = {};
  for (const item of items) {
    if (!item || !item.symbol) continue;
    harita[item.symbol] = item;
  }
  return harita;
}

// Sembolden sayı çıkarır. AltinAPI bazı sembolleri 0 ya da null döndürüyor
// (örn. USDRUB bid=ask=0); bunlar geçersiz sayılıp null dönüyor ki hesaplara
// sızmasın.
function fiyat(harita, sembol, alan) {
  const it = harita[sembol];
  if (!it) return null;
  const v = Number(it[alan]);
  return isFinite(v) && v > 0 ? v : null;
}
// Satış (kullanıcı alırken ödediği) — ana gösterim
const satis = (h, s) => fiyat(h, s, "ask");
// Alış (kullanıcı bozdururken aldığı)
const alis = (h, s) => fiyat(h, s, "bid");
// Önceki kapanış — günlük % değişim için
const kapanis = (h, s) => fiyat(h, s, "close");

// Bir sembol için alış/satış/kapanış/değişim paketini üretir
function cift(h, sembol) {
  const a = alis(h, sembol), s = satis(h, sembol), k = kapanis(h, sembol);
  return {
    alis: a,
    satis: s,
    kapanis: k,
    degisim: s != null && k != null && k > 0 ? Math.round((s - k) / k * 10000) / 100 : null,
  };
}

// ─── ALTIN (Kaynak: AltinAPI) ──────────────────────────────────────────────
// Alan adları BİREBİR korundu (XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram,
// XAG_TRY_gram) — frontend'in beklediği şekil değişmedi. Tek fark: gram
// fiyatları artık ons × kur ile HESAPLANMIYOR, doğrudan Kapalı Çarşı
// verisinden (ALTIN / GUMUSTRY) geliyor.
async function altinTaze() {
  const h = await altinApiCek();

  const XAU_USD = satis(h, "XAUUSD");
  const XAG_USD = satis(h, "XAGUSD");
  const USD_TRY = satis(h, "USDTRY");
  const XAU_TRY_gram = satis(h, "ALTIN");
  const XAG_TRY_gram = satis(h, "GUMUSTRY");

  if (XAU_USD == null) throw new Error("XAUUSD (ons altın) alınamadı");
  if (XAU_TRY_gram == null) throw new Error("ALTIN (gram altın) alınamadı");
  if (USD_TRY == null) throw new Error("USDTRY alınamadı");
  // Gümüş/altın oranı anormalse kaynak şüphelidir (eski koddaki koruma korundu)
  if (XAG_USD != null && XAG_USD >= XAU_USD) {
    throw new Error(`Gümüş/Altın oranı anormal (XAG=${XAG_USD}, XAU=${XAU_USD}) — kaynak veri şüpheli`);
  }

  return {
    XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram, XAG_TRY_gram,
    detay: {
      ons_altin: cift(h, "XAUUSD"),
      ons_gumus: cift(h, "XAGUSD"),
      gram_altin: cift(h, "ALTIN"),
      gram_gumus: cift(h, "GUMUSTRY"),
    },
    ts: new Date().toISOString(),
  };
}

// ─── KRİPTO (Kaynak: CoinGecko — AltinAPI'de kripto yok) ───────────────────
async function kriptoTaze() {
  const r = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,try"
  );
  if (!r.ok) throw new Error("CoinGecko error");
  const data = await r.json();
  return {
    btc_usd: data.bitcoin?.usd,
    btc_try: data.bitcoin?.try,
    eth_usd: data.ethereum?.usd,
    eth_try: data.ethereum?.try,
    ts: new Date().toISOString(),
  };
}

// ─── PETROL (Kaynak: AlphaVantage, yedek Yahoo — AltinAPI'de petrol yok) ───
async function petrolTaze() {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (apiKey) {
    try {
      const url = "https://www.alphavantage.co/query?function=BRENT&interval=daily&apikey=" + apiKey;
      const r = await fetch(url);
      if (r.ok) {
        const json = await r.json();
        const veri = ((json && json.data) || []).filter(function(n) {
          return n.value !== "." && n.value != null && !isNaN(parseFloat(n.value));
        });
        if (veri.length >= 2) {
          const price = parseFloat(veri[0].value);
          const prev = parseFloat(veri[1].value);
          return {
            brent_usd: price,
            prev_usd: prev,
            change_pct: ((price - prev) / prev * 100).toFixed(2),
            ts: new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      // Alpha Vantage basarisiz olursa asagidaki Yahoo yoluna dusulur
    }
  }

  const r = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1d&range=1d",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!r.ok) throw new Error("Yahoo Finance error");
  const data = await r.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const prev  = data?.chart?.result?.[0]?.meta?.chartPreviousClose;
  return {
    brent_usd: price,
    prev_usd: prev,
    change_pct: price && prev ? ((price - prev) / prev * 100).toFixed(2) : null,
    ts: new Date().toISOString(),
  };
}

// ─── ALTINAPI (ham, tüm semboller) ─────────────────────────────────────────
const ALTINAPI_GARANTI = [
  "ALTIN","ONS","AYAR22","AYAR14","CEYREK_YENI","CEYREK_ESKI","YARIM_YENI",
  "YARIM_ESKI","TEK_YENI","TEK_ESKI","ATA_YENI","ATA_ESKI","XAGUSD",
  "GUMUSTRY","XPTUSD","PLATIN","XPDUSD","PALADYUM","USDTRY","EURTRY",
];

async function altinApiTaze() {
  const harita = await altinApiCek();
  const sonuc = {};
  for (const sembol of Object.keys(harita)) {
    const i = harita[sembol];
    sonuc[sembol] = { bid: i.bid, ask: i.ask, close: i.close };
  }
  for (const sembol of ALTINAPI_GARANTI) {
    if (!(sembol in sonuc)) sonuc[sembol] = null;
  }
  return sonuc;
}

// ─── KUR (Kaynak: AltinAPI; Bitcoin için CoinGecko) ────────────────────────
// Alan adları BİREBİR korundu. Ana alanlar (USD_TRY, EUR_TRY …) SATIŞ
// fiyatını taşıyor; alış/satış ayrımı "detay" altında.
//
// RUB/CNY/AED: AltinAPI'de ana sembol boş dönüyor (USDRUB bid=ask=0), bu
// yüzden DS_ önekli karşılıkları yedek olarak kullanılıyor. DS_ serisi farklı
// bir sağlayıcıdan geliyor; ana sembol dolu geldiğinde o tercih ediliyor.
async function kurTaze() {
  const [haritaRes, btcRes] = await Promise.allSettled([
    altinApiCek(),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
  ]);

  if (haritaRes.status !== "fulfilled") {
    throw new Error("AltinAPI alınamadı: " + (haritaRes.reason?.message || "bilinmeyen hata"));
  }
  const h = haritaRes.value;

  const btcData = btcRes.status === "fulfilled" && btcRes.value.ok ? await btcRes.value.json() : null;
  const BTC_USD = btcData?.bitcoin?.usd ?? null;

  // Ana sembol boşsa DS_ karşılığına düş
  const kurSatis = (ana, yedek) => satis(h, ana) ?? (yedek ? satis(h, yedek) : null);
  const kurCift  = (ana, yedek) => (satis(h, ana) != null ? cift(h, ana) : (yedek ? cift(h, yedek) : cift(h, ana)));

  const USD_TRY = kurSatis("USDTRY");
  if (USD_TRY == null) throw new Error("USDTRY alınamadı");

  const JPY = kurSatis("JPYTRY");

  return {
    USD_TRY,
    EUR_TRY: kurSatis("EURTRY"),
    GBP_TRY: kurSatis("GBPTRY"),
    CHF_TRY: kurSatis("CHFTRY"),
    SAR_TRY: kurSatis("SARTRY"),
    RUB_TRY: kurSatis("RUBTRY", "DS_RUBTRY"),
    AED_TRY: kurSatis("AEDTRY", "DS_AEDTRY"),
    CNY_TRY: kurSatis("CNYTRY", "DS_CNYTRY"),
    JPY_TRY: JPY,
    JPY100_TRY: JPY != null ? Math.round(JPY * 100 * 10000) / 10000 : null,
    CAD_TRY: kurSatis("CADTRY"),
    AUD_TRY: kurSatis("AUDTRY"),
    EUR_USD: kurSatis("EURUSD"),
    XAU_USD: satis(h, "XAUUSD"),
    XAU_TRY_gram: satis(h, "ALTIN"),
    XAG_TRY_gram: satis(h, "GUMUSTRY"),
    BTC_USD,
    // Piyasa ekranı için alış + satış + günlük değişim
    detay: {
      USD_TRY: kurCift("USDTRY"),
      EUR_TRY: kurCift("EURTRY"),
      GBP_TRY: kurCift("GBPTRY"),
      CHF_TRY: kurCift("CHFTRY"),
      SAR_TRY: kurCift("SARTRY"),
      RUB_TRY: kurCift("RUBTRY", "DS_RUBTRY"),
      AED_TRY: kurCift("AEDTRY", "DS_AEDTRY"),
      CNY_TRY: kurCift("CNYTRY", "DS_CNYTRY"),
      JPY_TRY: kurCift("JPYTRY"),
      CAD_TRY: kurCift("CADTRY"),
      AUD_TRY: kurCift("AUDTRY"),
      EUR_USD: kurCift("EURUSD"),
      XAU_USD: cift(h, "XAUUSD"),
      XAG_USD: cift(h, "XAGUSD"),
      XAU_TRY_gram: cift(h, "ALTIN"),
      XAG_TRY_gram: cift(h, "GUMUSTRY"),
    },
    ts: new Date().toISOString(),
  };
}

// ─── Tip → { Redis anahtarı, TTL, taze() fonksiyonu, Cache-Control } ───────
// TTL'ler AltinAPI'ye geçişle güncellendi: altın artık 8 saatlik değil, kur
// ile aynı tazelikte (300 sn). Anahtarlar yükseltildi — aksi halde eski
// şekildeki önbellek dönmeye devam eder ve değişiklik hiç görünmez.
const YAPILANDIRMA = {
  altin:    { anahtar: "altin:v2",    ttl: 300,  fn: altinTaze,    cacheControl: "s-maxage=300" },
  kripto:   { anahtar: "kripto:v1",   ttl: 300,  fn: kriptoTaze,   cacheControl: "s-maxage=300" },
  petrol:   { anahtar: "petrol:v1",   ttl: 1800, fn: petrolTaze,   cacheControl: "s-maxage=1800" },
  kur:      { anahtar: "kur:v2",      ttl: 300,  fn: kurTaze,      cacheControl: "s-maxage=300" },
  altinapi: { anahtar: "altinapi:v5", ttl: 300,  fn: altinApiTaze, cacheControl: "s-maxage=300" },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const tip = req.query.tip;
  const conf = YAPILANDIRMA[tip];
  if (!conf) {
    return res.status(400).json({
      error: `Geçersiz veya eksik 'tip' parametresi (gelen: ${tip ?? "yok"}). Kullanım: /api/piyasa-fiyatlar?tip=altin|kripto|petrol|kur|altinapi`,
    });
  }

  res.setHeader("Cache-Control", conf.cacheControl);
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = req.query.debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, conf.anahtar, conf.ttl, conf.fn, { debug });
    return res.status(200).json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(conf.anahtar);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}
