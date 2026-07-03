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
// KURULUM GEREKSİNİMİ: Vercel projesine bir KV veritabanı bağlanmalı
// (Vercel Dashboard → Storage → Create Database → KV → projeye bağla).
// Bağlanınca KV_REST_API_URL / KV_REST_API_TOKEN ortam değişkenleri otomatik eklenir.
// Paket: `npm install @vercel/kv`

import { kv } from "@vercel/kv";
import { fonVerisiCek, ŞÜPHELİ_EŞİK } from "./_lib/fonFetch.js";

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
