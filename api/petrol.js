// api/petrol.js - Yahoo Finance gayri resmi endpoint
// REDIS/KV + KİLİT KORUMASI (2026-07) — bkz. kripto.js'deki aynı not.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "petrol:v1";
const KV_TTL_SANIYE = 1800; // 30 dakika

async function taze() {
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800");

  const debug = req.query.debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, KV_ANAHTAR, KV_TTL_SANIYE, taze, { debug });
    res.json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(KV_ANAHTAR);
      if (eskiOnbellek) return res.json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    res.status(500).json({ error: e.message });
  }
}
