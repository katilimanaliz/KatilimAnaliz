// api/piyasalar.js - Yahoo Finance üzerinden toplu piyasa özeti (endeksler, emtia, kripto, tahvil)
// REDIS/KV EKLENDİ (2026-07) — bkz. kripto.js'deki aynı not. Bu dosya 16 ayrı Yahoo
// Finance isteği attığı için (Promise.allSettled) paylaşımlı önbellek özellikle önemli.
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "piyasalar:v1";
const KV_TTL_SANIYE = 900; // 15 dakika

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900");

  const debug = req.query.debug === "1";

  if (!debug) {
    try {
      const onbellek = await redis.get(KV_ANAHTAR);
      if (onbellek) return res.json({ ...onbellek, cached: true });
    } catch {}
  }

  const semboller = [
    "^GSPC","^DJI","^IXIC","^GDAXI","XU100.IS",
    "BZ=F","CL=F","NG=F","GC=F","SI=F","HG=F","ZW=F",
    "BTC-USD","ETH-USD",
    "^TNX","^IRX",
  ];

  try {
    const results = await Promise.allSettled(
      semboller.map(s =>
        fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" } }
        )
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) return null;
          return {
            sembol: s,
            fiyat: meta.regularMarketPrice,
            onceki: meta.chartPreviousClose,
            degisim: meta.regularMarketPrice && meta.chartPreviousClose
              ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100).toFixed(2)
              : null,
            para: meta.currency,
          };
        })
        .catch(() => null)
      )
    );

    const data = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        data[semboller[i]] = r.value;
      }
    });

    const yanit = { data, ts: new Date().toISOString() };
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

export const config = { maxDuration: 30 };
