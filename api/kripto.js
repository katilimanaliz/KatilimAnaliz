// api/kripto.js - CoinGecko ücretsiz API
// REDIS/KV EKLENDİ (2026-07): CoinGecko'nun ücretsiz katmanı hız sınırlı — her kullanıcı
// ayrı istek atarsa kotayı hızla tüketebiliriz. Artık Upstash Redis ile 5 dakikada bir
// tek istek atılıp herkese aynı veri gösteriliyor.
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "kripto:v1";
const KV_TTL_SANIYE = 300; // 5 dakika

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  const debug = req.query.debug === "1";

  if (!debug) {
    try {
      const onbellek = await redis.get(KV_ANAHTAR);
      if (onbellek) return res.json({ ...onbellek, cached: true });
    } catch {}
  }

  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,try"
    );
    if (!r.ok) throw new Error("CoinGecko error");
    const data = await r.json();
    const yanit = {
      btc_usd: data.bitcoin?.usd,
      btc_try: data.bitcoin?.try,
      eth_usd: data.ethereum?.usd,
      eth_try: data.ethereum?.try,
      ts: new Date().toISOString(),
    };
    try { await redis.set(KV_ANAHTAR, yanit, { ex: KV_TTL_SANIYE }); } catch {}
    res.json(yanit);
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(KV_ANAHTAR);
      if (eskiOnbellek) return res.json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    res.status(500).json({ error: e.message });
  }
}
