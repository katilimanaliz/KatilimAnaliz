// api/gecmis.js
// Yahoo Finance üzerinden 30 günlük geçmiş fiyat verisi (Kur Grafik Modalı için)
// REDIS/KV + KİLİT KORUMASI (2026-07) — bkz. kripto.js'deki aynı not. Her sembol
// kendi kilidini/önbelleğini kullanır (aynı sembole binlerce kişi aynı anda
// bakabilir, farklı semboller birbirini beklemez).
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_TTL_SANIYE = 900; // 15 dakika

function originIzinliMi(origin) {
  if (!origin) return false;
  if (/^https:\/\/katilim-analiz(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}
function corsAyarla(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", originIzinliMi(origin) ? origin : "https://katilim-analiz.vercel.app");
  res.setHeader("Vary", "Origin");
}

async function veriHesapla(sembol) {
  const GRAM_ONS = 31.1034768;

  if (sembol === "GRAM_ALTIN" || sembol === "GRAM_GUMUS") {
    const onsSembol = sembol === "GRAM_ALTIN" ? "GC=F" : "SI=F";
    const [onsRes, usdRes] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${onsSembol}?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);
    const onsJson = await onsRes.json();
    const usdJson = await usdRes.json();

    const onsResult = onsJson?.chart?.result?.[0];
    const usdResult = usdJson?.chart?.result?.[0];
    if (!onsResult || !usdResult) {
      return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };
    }

    const usdMap = {};
    (usdResult.timestamp || []).forEach((t, i) => {
      const tarih = new Date(t * 1000).toISOString().slice(0, 10);
      const c = usdResult.indicators?.quote?.[0]?.close?.[i];
      if (c != null) usdMap[tarih] = c;
    });

    const onsTimestamps = onsResult.timestamp || [];
    const onsCloses = onsResult.indicators?.quote?.[0]?.close || [];

    let sonUsdTry = null;
    const noktalar = onsTimestamps
      .map((t, i) => {
        const tarih = new Date(t * 1000).toISOString().slice(0, 10);
        const onsFiyat = onsCloses[i];
        const usdTry = usdMap[tarih] ?? sonUsdTry;
        if (usdTry != null) sonUsdTry = usdTry;
        if (onsFiyat == null || usdTry == null) return null;
        const gramTL = (onsFiyat * usdTry) / GRAM_ONS;
        return { tarih, fiyat: Math.round(gramTL * 100) / 100 };
      })
      .filter(p => p !== null && p.fiyat > 0);

    const onsMeta = onsResult.meta || {};
    const usdMeta = usdResult.meta || {};
    const guncelOns = onsMeta.regularMarketPrice ?? null;
    const guncelUsd = usdMeta.regularMarketPrice;
    const oncekiOnsMeta = onsMeta.previousClose ?? onsMeta.chartPreviousClose;
    const oncekiUsdMeta = usdMeta.previousClose ?? usdMeta.chartPreviousClose;

    const guncelFiyat = (guncelOns != null && guncelUsd != null)
      ? Math.round((guncelOns * guncelUsd / GRAM_ONS) * 100) / 100
      : (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
    const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
      ?? ((oncekiOnsMeta != null && oncekiUsdMeta != null)
        ? Math.round((oncekiOnsMeta * oncekiUsdMeta / GRAM_ONS) * 100) / 100
        : null);

    return { noktalar, guncelFiyat, oncekiKapanis };
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=1mo`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();

  const result = json?.chart?.result?.[0];
  if (!result) {
    return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };
  }

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const meta = result.meta || {};

  const noktalar = timestamps
    .map((t, i) => ({
      tarih: new Date(t * 1000).toISOString().slice(0, 10),
      fiyat: closes[i],
    }))
    .filter(p => p.fiyat != null && p.fiyat > 0);

  const guncelFiyat = meta.regularMarketPrice ?? (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
  const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
    ?? meta.previousClose ?? meta.chartPreviousClose ?? null;

  return { noktalar, guncelFiyat, oncekiKapanis };
}

export default async function handler(req, res) {
  corsAyarla(req, res);
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const { sembol, debug } = req.query;
  if (!sembol) {
    return res.status(400).json({ error: "sembol parametresi gerekli" });
  }

  const kvAnahtar = `gecmis:v1:${sembol}`;
  const debugMi = debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, kvAnahtar, KV_TTL_SANIYE, () => veriHesapla(sembol), { debug: debugMi });
    res.status(200).json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(kvAnahtar);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    res.status(500).json({ error: e.message, noktalar: [], guncelFiyat: null, oncekiKapanis: null });
  }
}
