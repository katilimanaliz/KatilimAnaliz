// api/piyasa-fiyatlar.js
// Birleştirilmiş fiyat proxy'si: altin.js + kripto.js + petrol.js + kur.js
// (2026-07) Vercel Hobby planındaki "deployment başına en fazla 12 serverless
// function" sınırı asistan-ai.js eklenince aşıldı; bu 4 küçük route tek dosyada
// birleştirildi. Her tipin davranışı/response şekli BİREBİR korundu — frontend
// hangi alanı bekliyorsa (XAU_TRY_gram, btc_usd, brent_usd, USD_TRY vb.) aynen
// dönüyor. Kullanım: /api/piyasa-fiyatlar?tip=altin | kripto | petrol | kur
//
// GÜNCELLEME (2026-07): altin.js önceden gold-api.com kullanıyordu; ücretsiz
// plan istek limitine ulaşıldığı için kaynak Yahoo Finance'e (GC=F altın,
// SI=F gümüş futures) çevrildi — kur.js zaten aynı kaynağı kullanıyordu,
// tutarlılık sağlandı. Döndürülen alanlar (XAU_USD, XAG_USD, USD_TRY,
// XAU_TRY_gram, XAG_TRY_gram) değişmedi.
//
// TEK DAVRANIŞ DEĞİŞİKLİĞİ: kur.js önceden Redis dağıtık kilidi (kilitliGetir)
// KULLANMIYORDU, sadece CDN Cache-Control'e güveniyordu — bu, önbellek süresi
// dolduğunda 5 dış API'ye (Frankfurter, open.er-api, Yahoo Finance x2, CoinGecko)
// aynı anda binlerce istek gidebileceği anlamına geliyordu (tam da kripto.js'nin
// kendi yorumunda uyardığı "thundering herd" riski). Diğer üç route zaten bu
// korumaya sahip olduğu için, tutarlılık ve güvenlik adına kur tipine de aynı
// kilitliGetir koruması eklendi. Döndürülen veri/alanlar değişmedi.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── ALTIN (Kaynak: Yahoo Finance GC=F / SI=F) ─────────────────────────────
async function altinTaze() {
  const GRAM_ONS = 31.1035;

  const usdRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY");
  if (!usdRes.ok) throw new Error(`USD/TRY kuru alınamadı (HTTP ${usdRes.status})`);
  const usdData = await usdRes.json();
  const USD_TRY = Number(usdData?.rates?.TRY);
  if (!isFinite(USD_TRY) || USD_TRY <= 0) throw new Error("USD/TRY kuru geçersiz döndü");

  const [altinRes, gumusRes] = await Promise.all([
    fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } }),
    fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } }),
  ]);
  if (!altinRes.ok) throw new Error(`Altın fiyatı alınamadı (HTTP ${altinRes.status})`);
  if (!gumusRes.ok) throw new Error(`Gümüş fiyatı alınamadı (HTTP ${gumusRes.status})`);

  const altin = await altinRes.json();
  const gumus = await gumusRes.json();

  const XAU_USD = Number(altin?.chart?.result?.[0]?.meta?.regularMarketPrice);
  const XAG_USD = Number(gumus?.chart?.result?.[0]?.meta?.regularMarketPrice);
  if (!isFinite(XAU_USD) || XAU_USD <= 0) throw new Error("Altın fiyatı geçersiz veri döndürdü: " + JSON.stringify(altin));
  if (!isFinite(XAG_USD) || XAG_USD <= 0) throw new Error("Gümüş fiyatı geçersiz veri döndürdü: " + JSON.stringify(gumus));
  if (XAG_USD >= XAU_USD) throw new Error(`Gümüş/Altın oranı anormal (XAG=${XAG_USD}, XAU=${XAU_USD}) — kaynak veri şüpheli`);

  const XAU_TRY_gram = (XAU_USD * USD_TRY) / GRAM_ONS;
  const XAG_TRY_gram = (XAG_USD * USD_TRY) / GRAM_ONS;

  return { XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram, XAG_TRY_gram };
}

// ─── KRİPTO (Kaynak: CoinGecko) ────────────────────────────────────────────
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

// ─── PETROL (Kaynak: Yahoo Finance BZ=F) ───────────────────────────────────
async function petrolTaze() {
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

// ─── KUR (Döviz + Altın + Bitcoin, çoklu kaynak) ───────────────────────────
async function kurTaze() {
  const [dovizRes, erApiRes, gcRes, siRes, btcRes] = await Promise.allSettled([
    fetch("https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP,CHF,JPY,CNY"),
    fetch("https://open.er-api.com/v6/latest/USD"), // SAR, RUB, AED dahil geniş kapsam - key gerektirmez
    fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d", {headers:{"User-Agent":"Mozilla/5.0"}}),
    fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d", {headers:{"User-Agent":"Mozilla/5.0"}}),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
  ]);

  const doviz = dovizRes.status==="fulfilled" && dovizRes.value.ok ? await dovizRes.value.json() : null;
  const erApi = erApiRes.status==="fulfilled" && erApiRes.value.ok ? await erApiRes.value.json() : null;
  const gcData = gcRes.status==="fulfilled" && gcRes.value.ok ? await gcRes.value.json() : null;
  const siData = siRes.status==="fulfilled" && siRes.value.ok ? await siRes.value.json() : null;
  const btcData = btcRes.status==="fulfilled" && btcRes.value.ok ? await btcRes.value.json() : null;

  const rates = doviz?.rates ?? {};
  const erRates = erApi?.rates ?? {}; // base: USD

  // USD_TRY öncelik: Frankfurter, yoksa open.er-api
  const USD_TRY = rates.TRY ?? erRates.TRY ?? null;

  const gcFiyat = gcData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  const siFiyat = siData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  const XAU_TRY_gram = gcFiyat && USD_TRY ? Math.round(gcFiyat * USD_TRY / 31.1035 * 100) / 100 : null;
  const XAG_TRY_gram = siFiyat && USD_TRY ? Math.round(siFiyat * USD_TRY / 32.1507 * 100) / 100 : null;
  const BTC_USD = btcData?.bitcoin?.usd ?? null;

  // SAR, RUB, CNY için open.er-api kullan (Frankfurter desteklemiyor / yedek)
  const SAR_TRY = USD_TRY && erRates.SAR ? Math.round(USD_TRY / erRates.SAR * 10000) / 10000 : null;
  const RUB_TRY = USD_TRY && erRates.RUB ? Math.round(USD_TRY / erRates.RUB * 10000) / 10000 : null;
  const AED_TRY = USD_TRY && (rates.AED ?? erRates.AED) ? Math.round(USD_TRY / (rates.AED ?? erRates.AED) * 10000) / 10000 : null;
  const CNY_TRY = USD_TRY && (rates.CNY ?? erRates.CNY) ? Math.round(USD_TRY / (rates.CNY ?? erRates.CNY) * 10000) / 10000 : null;

  return {
    USD_TRY,
    EUR_TRY: USD_TRY && rates.EUR ? Math.round(USD_TRY / rates.EUR * 10000) / 10000 : null,
    GBP_TRY: USD_TRY && rates.GBP ? Math.round(USD_TRY / rates.GBP * 10000) / 10000 : null,
    CHF_TRY: USD_TRY && rates.CHF ? Math.round(USD_TRY / rates.CHF * 10000) / 10000 : null,
    SAR_TRY,
    RUB_TRY,
    AED_TRY,
    CNY_TRY,
    JPY_TRY: USD_TRY && rates.JPY ? Math.round(USD_TRY / rates.JPY * 10000) / 10000 : null,
    JPY100_TRY: USD_TRY && rates.JPY ? Math.round(USD_TRY / rates.JPY * 100 * 10000) / 10000 : null,
    EUR_USD: rates.EUR ? Math.round(1 / rates.EUR * 10000) / 10000 : null,
    XAU_USD: gcFiyat,
    XAU_TRY_gram,
    XAG_TRY_gram,
    BTC_USD,
  };
}

// ─── Tip → { Redis anahtarı, TTL, taze() fonksiyonu, Cache-Control } eşlemesi ──
// (TTL/anahtar/Cache-Control değerleri orijinal 4 dosyadan BİREBİR alındı)
const YAPILANDIRMA = {
  altin:  { anahtar: "altin:v1",  ttl: 28800, fn: altinTaze,  cacheControl: "public, s-maxage=28800, stale-while-revalidate=3600" },
  kripto: { anahtar: "kripto:v1", ttl: 300,   fn: kriptoTaze, cacheControl: "s-maxage=300" },
  petrol: { anahtar: "petrol:v1", ttl: 1800,  fn: petrolTaze, cacheControl: "s-maxage=1800" },
  kur:    { anahtar: "kur:v1",    ttl: 300,   fn: kurTaze,    cacheControl: "s-maxage=300" },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const tip = req.query.tip;
  const conf = YAPILANDIRMA[tip];
  if (!conf) {
    return res.status(400).json({
      error: `Geçersiz veya eksik 'tip' parametresi (gelen: ${tip ?? "yok"}). Kullanım: /api/piyasa-fiyatlar?tip=altin|kripto|petrol|kur`,
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
