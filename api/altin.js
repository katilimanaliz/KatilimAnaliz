// api/altin.js
// Kaynak: gold-api.com — ücretsiz, kimlik doğrulama gerektirmiyor, istek limiti yok.
// (Daha önce goldapi.io kullanılıyordu; aylık 100 istek limitine takıldı.)
// REDIS/KV EKLENDİ (2026-07) — bkz. kripto.js'deki aynı not.
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "altin:v1";
const KV_TTL_SANIYE = 28800; // 8 saat — mevcut Cache-Control ile aynı süre

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=28800, stale-while-revalidate=3600");
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = req.query.debug === "1";

  if (!debug) {
    try {
      const onbellek = await redis.get(KV_ANAHTAR);
      if (onbellek) return res.status(200).json({ ...onbellek, cached: true });
    } catch {}
  }

  const GRAM_ONS = 31.1035; // 1 ons = 31.1035 gram

  try {
    const usdRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY");
    if (!usdRes.ok) throw new Error(`USD/TRY kuru alınamadı (HTTP ${usdRes.status})`);
    const usdData = await usdRes.json();
    const USD_TRY = Number(usdData?.rates?.TRY);
    if (!isFinite(USD_TRY) || USD_TRY <= 0) throw new Error("USD/TRY kuru geçersiz döndü");

    const [altinRes, gumusRes] = await Promise.all([
      fetch("https://api.gold-api.com/price/XAU"),
      fetch("https://api.gold-api.com/price/XAG"),
    ]);
    if (!altinRes.ok) throw new Error(`Altın fiyatı alınamadı (HTTP ${altinRes.status})`);
    if (!gumusRes.ok) throw new Error(`Gümüş fiyatı alınamadı (HTTP ${gumusRes.status})`);

    const altin = await altinRes.json();
    const gumus = await gumusRes.json();

    const XAU_USD = Number(altin?.price);
    const XAG_USD = Number(gumus?.price);
    if (!isFinite(XAU_USD) || XAU_USD <= 0) throw new Error("Altın fiyatı geçersiz veri döndürdü: " + JSON.stringify(altin));
    if (!isFinite(XAG_USD) || XAG_USD <= 0) throw new Error("Gümüş fiyatı geçersiz veri döndürdü: " + JSON.stringify(gumus));

    if (XAG_USD >= XAU_USD) throw new Error(`Gümüş/Altın oranı anormal (XAG=${XAG_USD}, XAU=${XAU_USD}) — kaynak veri şüpheli`);

    const XAU_TRY_gram = (XAU_USD * USD_TRY) / GRAM_ONS;
    const XAG_TRY_gram = (XAG_USD * USD_TRY) / GRAM_ONS;

    const yanit = { XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram, XAG_TRY_gram };
    try { await redis.set(KV_ANAHTAR, yanit, { ex: KV_TTL_SANIYE }); } catch {}
    res.status(200).json(yanit);
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(KV_ANAHTAR);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    res.status(500).json({ error: e.message });
  }
}
