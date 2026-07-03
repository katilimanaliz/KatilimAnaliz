// api/cron-tefas-guncelle.js
// SADECE Vercel Cron tarafından tetiklenir (bkz. vercel.json → 05:00/06:00/07:00 UTC,
// yani TR saatiyle hafta içi her gün 08:00/09:00/10:00). Fonoloji'den taze veri
// çekip Vercel KV'ye yazar. api/tefas-proxy.js buradan HİÇ canlı istek atmaz,
// sadece KV'yi okur — böylece gün içinde binlerce kullanıcı isteği Fonoloji'ye
// değil, hızlı bir KV okumasına gider.
//
// ÖNCEKİ MİMARİ İLE FARKI: Eskiden cron doğrudan /api/tefas-proxy'yi tetikliyordu
// (o da hem veri çeken hem kullanıcıya cevap veren aynı fonksiyondu). Bu, her
// Vercel edge node'unun kendi ayrı belleği/cache'i olduğu için "bazı kullanıcılarda
// veri eksik/farklı" sorununa yol açıyordu. Artık TEK bir yazma noktası (bu cron)
// ve TEK bir okuma kaynağı (KV) var — herkes aynı veriyi görür.
//
// Neden 3 kez (8-9-10) ve tek sefer değil: Fonoloji'nin günlük TEFAS verisini tam
// olarak ne zaman işlediği garanti değil. 08:00'de eksik gelirse 09:00'da, o da
// eksikse 10:00'da düzelmiş olma ihtimali yüksek. Her çalışma, önceki KV içeriğini
// SADECE yeni veri daha "iyi" (daha fazla fon) ise günceller.
//
// KURULUM GEREKSİNİMİ: Vercel projesine Upstash (Redis) bağlanmalı
// (Vercel Dashboard → Storage → Marketplace → Upstash → Redis oluştur → projeye bağla).
// Bağlanınca UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN ortam değişkenleri
// otomatik eklenir. (Not: Vercel KV kaldırıldı, yerine Upstash geçti.)
// Paket: `npm install @upstash/redis`

import { Redis } from "@upstash/redis";
import { fonVerisiCek, ŞÜPHELİ_EŞİK } from "./_lib/fonFetch.js";

// Vercel'in Upstash entegrasyonu, bağlantı şekline göre ortam değişkenlerini
// ya UPSTASH_REDIS_REST_* ya da (eski @vercel/kv uyumluluğu için) KV_REST_API_*
// adıyla enjekte edebiliyor — hangisi geldiyse onu kullan.
const kv = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "tefas:katilim-fonlari";

export default async function handler(req, res) {
  // Güvenlik: bu endpoint'i sadece Vercel'in kendi cron sistemi (ya da CRON_SECRET
  // biliniyorsa elle test) tetikleyebilsin.
  const cronSecret = process.env.CRON_SECRET;
  const gelenAuth = req.headers.authorization;
  const vercelCronMu = req.headers["x-vercel-cron"] === "1";
  if (cronSecret && !vercelCronMu && gelenAuth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Yetkisiz" });
  }

  try {
    const yeni = await fonVerisiCek();
    const eski = await kv.get(KV_ANAHTAR).catch(() => null);

    // Yeni sonuç eskisinden belirgin şekilde daha azsa (bozuk/eksik), üzerine yazma —
    // günün ilerleyen saatlerindeki denemeye şans bırak, KV'deki iyi veriyi koru.
    const yaz = !eski || yeni.count >= ŞÜPHELİ_EŞİK || yeni.count >= (eski.count || 0);
    if (yaz) {
      await kv.set(KV_ANAHTAR, yeni);
    }

    return res.status(200).json({
      success: true,
      yazildi: yaz,
      yeniSayim: yeni.count,
      eskiSayim: eski?.count ?? null,
      eksikGorunuyor: yeni.eksikGorunuyor,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
