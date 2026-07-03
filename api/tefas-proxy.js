// api/tefas-proxy.js
// TEK fonksiyon, İKİ rol:
//  1) Normal kullanıcı isteği (GET, header/param yok) → KV'den okur, hızlı yanıt verir
//  2) Vercel Cron tetiklemesi (x-vercel-cron header'ı ya da ?cron=1) → Fonoloji'den
//     taze veri çekip KV'ye YAZAR
//
// NEDEN TEK DOSYA: Vercel Hobby plan deployment başına en fazla 12 Serverless
// Function'a izin veriyor (bu repo zaten sınırda — daha önce fred-proxy.js bu
// yüzden kaldırılmıştı). Ayrı bir cron-tefas-guncelle.js dosyası eklemek 13.
// fonksiyona çıkarıp build'i kırdı. Cron mantığını buraya taşıyarak fonksiyon
// sayısı ARTMIYOR.
//
// KURULUM GEREKSİNİMİ: Vercel projesine Upstash (Redis) bağlanmalı
// (Vercel Dashboard → Storage → Marketplace → Upstash → Redis → projeye bağla).
// Paket: `npm install @upstash/redis`

import { Redis } from "@upstash/redis";
import { fonVerisiCek, ŞÜPHELİ_EŞİK } from "./_lib/fonFetch.js";

// Vercel'in enjekte ettiği env var adı entegrasyon şekline göre değişebiliyor,
// ikisini de kontrol ediyoruz.
const kv = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "tefas:katilim-fonlari";
const BAYATLIK_SINIRI_SAAT = 20;

async function cronYaz(req, res) {
  // Güvenlik: sadece Vercel'in kendi cron sistemi (ya da CRON_SECRET biliniyorsa
  // elle test) bu yazma işlemini tetikleyebilsin.
  const cronSecret = process.env.CRON_SECRET;
  const gelenAuth = req.headers.authorization;
  const vercelCronMu = req.headers["x-vercel-cron"] === "1";
  if (cronSecret && !vercelCronMu && gelenAuth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Yetkisiz" });
  }

  try {
    const yeni = await fonVerisiCek();
    const eski = await kv.get(KV_ANAHTAR).catch(() => null);

    // Yeni sonuç eskisinden belirgin şekilde daha azsa (bozuk/eksik), üzerine yazma.
    const yaz = !eski || yeni.count >= ŞÜPHELİ_EŞİK || yeni.count >= (eski.count || 0);
    if (yaz) await kv.set(KV_ANAHTAR, yeni);

    return res.status(200).json({
      success: true,
      mod: "cron-yazma",
      yazildi: yaz,
      yeniSayim: yeni.count,
      eskiSayim: eski?.count ?? null,
      eksikGorunuyor: yeni.eksikGorunuyor,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function herkesOku(req, res) {
  try {
    let kayit = await kv.get(KV_ANAHTAR).catch(() => null);
    const bayatMi = !kayit || (Date.now() - new Date(kayit.guncelleme).getTime()) > BAYATLIK_SINIRI_SAAT*3600*1000;

    if (bayatMi) {
      try {
        const taze = await fonVerisiCek();
        if (taze.count >= ŞÜPHELİ_EŞİK) {
          await kv.set(KV_ANAHTAR, taze).catch(() => {});
          kayit = taze;
        } else if (!kayit && taze.count > 0) {
          kayit = taze; // hiç veri yoktan iyidir, ama KV'ye YAZMA
        }
      } catch (e) { /* elimizde ne varsa onu döneceğiz */ }
    }

    if (!kayit) {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=30");
      return res.status(200).json({
        success: false,
        error: "Veri henüz mevcut değil. Vercel KV bağlantısını ve cron'un en az bir kez çalıştığını kontrol edin.",
        count: 0,
        data: [],
      });
    }

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=900");
    return res.status(200).json({
      success: true,
      count: kayit.count,
      guncelleme: kayit.guncelleme,
      kaynakBayat: bayatMi,
      kategori_dagilim: kayit.kategori_dagilim,
      data: kayit.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, count: 0, data: [] });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const cronIstegi = req.headers["x-vercel-cron"] === "1" || req.query?.cron === "1";
  if (cronIstegi) return cronYaz(req, res);
  return herkesOku(req, res);
}
