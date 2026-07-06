// api/kar-payi.js
// Katılım bankalarının kâr payı oranları — TKBB'nin robots.txt ile otomatik
// erişimi engellemesi ve bankaların kendi sitelerinin tek tip/stabil bir
// format sunmaması nedeniyle otomatik çekme (scraping) YAPILMIYOR (bkz. proje
// notları, 2026-07). Bunun yerine haftalık manuel güncelleme + Redis'te
// saklama modeli kullanılıyor:
//   - GET: herkes okuyabilir, kimlik doğrulama gerekmez.
//   - POST: sadece KARPAYI_ADMIN_SIFRE ortam değişkenini bilen biri
//     güncelleyebilir (uygulama içindeki "Kâr Payı Güncelle" ekranından).
//
// Metodoloji TKBB'nin kendi karşılaştırma yöntemiyle aynı: 100 Bin TL,
// 100 Bin USD, 100 Bin EUR ve 1.000gr altın tutarlarında, 1 aylık vade,
// şubeden açılan standart hesaba dağıtılan brüt yıllık kâr payı oranı (%).
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KV_ANAHTAR = "karpayi:oranlar:v1";

// Sıra, uygulamadaki "Katılım Bankaları" listesiyle aynı (alfabetik) —
// tutarlılık için. Yeni banka eklenirse burada da eklenmeli.
const BANKALAR = [
  "Adil Katılım", "Albaraka Türk", "Dünya Katılım", "Emlak Katılım",
  "Hayat Finans", "İktisat Katılım", "Kuveyt Türk", "T.O.M. Katılım",
  "Türkiye Finans", "Vakıf Katılım", "Ziraat Katılım",
];

function bosVeriIskeleti() {
  return {
    guncelleme: null,
    bankalar: BANKALAR.map((ad) => ({ ad, tl: null, usd: null, eur: null, altin: null })),
  };
}

function originIzinliMi(origin) {
  if (!origin) return false;
  if (/^https:\/\/(www\.)?katilimplus\.com$/i.test(origin)) return true;
  if (/^https:\/\/katilim-analiz(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}
function corsAyarla(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", originIzinliMi(origin) ? origin : "https://www.katilimplus.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

async function handleGet(req, res) {
  try {
    const kayit = await redis.get(KV_ANAHTAR);
    if (!kayit) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      return res.status(200).json({ success: true, ...bosVeriIskeleti() });
    }
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json({ success: true, ...kayit });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function handlePost(req, res) {
  const sifre = process.env.KARPAYI_ADMIN_SIFRE;
  if (!sifre) {
    return res.status(500).json({ success: false, error: "KARPAYI_ADMIN_SIFRE ortam değişkeni tanımlı değil — Vercel'e ekleyin." });
  }
  const { sifre: gelenSifre, bankalar } = req.body || {};
  if (gelenSifre !== sifre) {
    return res.status(401).json({ success: false, error: "Şifre yanlış." });
  }
  if (!Array.isArray(bankalar) || bankalar.length === 0) {
    return res.status(400).json({ success: false, error: "bankalar dizisi boş olamaz." });
  }

  // Basit doğrulama: her satırda 'ad' olmalı, oranlar sayı ya da null olmalı.
  const temiz = bankalar.map((b) => ({
    ad: String(b.ad || "").trim(),
    tl: b.tl === "" || b.tl == null ? null : Number(b.tl),
    usd: b.usd === "" || b.usd == null ? null : Number(b.usd),
    eur: b.eur === "" || b.eur == null ? null : Number(b.eur),
    altin: b.altin === "" || b.altin == null ? null : Number(b.altin),
  }));
  for (const b of temiz) {
    if (!b.ad) return res.status(400).json({ success: false, error: "Her satırda banka adı zorunlu." });
    for (const alan of ["tl", "usd", "eur", "altin"]) {
      if (b[alan] !== null && !Number.isFinite(b[alan])) {
        return res.status(400).json({ success: false, error: `${b.ad}: "${alan}" alanı geçerli bir sayı değil.` });
      }
    }
  }

  const kayit = { guncelleme: new Date().toISOString(), bankalar: temiz };
  try {
    await redis.set(KV_ANAHTAR, kayit);
    return res.status(200).json({ success: true, ...kayit });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

export default async function handler(req, res) {
  corsAyarla(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return handleGet(req, res);
  if (req.method === "POST") return handlePost(req, res);
  return res.status(405).json({ success: false, error: "Sadece GET/POST desteklenir." });
}
