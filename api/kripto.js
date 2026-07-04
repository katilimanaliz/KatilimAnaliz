// api/kripto.js - CoinGecko ücretsiz API
// REDIS/KV + KİLİT KORUMASI (2026-07): CoinGecko'nun ücretsiz katmanı hız sınırlı.
// Sadece paylaşımlı önbellek yetmez — önbellek süresi dolduğu anda binlerce eşzamanlı
// kullanıcı aynı anda CoinGecko'ya gidebilir. _lib/kilitliOnbellek.js ile bunu önlüyoruz:
// sadece BİR istek tazeler, geri kalanı onun sonucunu Redis'ten okur.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "kripto:v1";
const KV_TTL_SANIYE = 300; // 5 dakika

async function taze() {
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

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
