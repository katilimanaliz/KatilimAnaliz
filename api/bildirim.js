// api/bildirim.js
//
// TEK dosyada iki işlem — Vercel'in /api altında en fazla 12 fonksiyon
// sınırına takılmamak için "push-token-kaydet" ve "bildirim-gonder"
// buraya birleştirildi. Hangi işlemin yapılacağı query parametresiyle
// belirleniyor: ?islem=kaydet  veya  ?islem=gonder
//
// ── 1) Token kaydetme (uygulamadan çağrılır, herkes çağırabilir) ──
//
// FiyatlamaPro.tsx içindeki "registration" listener'ı:
//
//   fetch(`${API_BASE}/api/bildirim?islem=kaydet`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ token: token.value, platform: ... }),
//   });
//
// ── 2) Bildirim gönderme (sadece admin, x-admin-key gerekli) ──
//
//   curl -X POST "https://www.katilimplus.com/api/bildirim?islem=gonder" \
//     -H "Content-Type: application/json" \
//     -H "x-admin-key: GIZLI_ANAHTARINIZ" \
//     -d '{"baslik":"Yeni Kur!", "govde":"USD/TRY güncellendi."}'

import { Redis } from "@upstash/redis";
import { admin } from "./_lib/firebaseAdmin.js";

// NOT: Vercel KV entegrasyonu, Upstash'in standart isimlendirmesi olan
// UPSTASH_REDIS_REST_URL/TOKEN yerine KV_REST_API_URL/KV_REST_API_TOKEN
// isimlerini kullanıyor — bu yüzden Redis.fromEnv() yerine bunları
// açıkça veriyoruz.
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function tokenKaydet(req, res) {
  const { token, platform } = req.body || {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ hata: "Geçerli bir 'token' alanı gerekli" });
    return;
  }

  await redis.sadd("pushTokens", token);
  if (platform) {
    await redis.hset("pushTokenPlatform", { [token]: platform });
  }

  res.status(200).json({ basarili: true });
}

async function bildirimGonder(req, res) {
  const gelenAnahtar = req.headers["x-admin-key"];
  if (!process.env.ADMIN_GIZLI_ANAHTAR || gelenAnahtar !== process.env.ADMIN_GIZLI_ANAHTAR) {
    res.status(401).json({ hata: "Yetkisiz istek" });
    return;
  }

  const { baslik, govde, veri } = req.body || {};
  if (!baslik || !govde) {
    res.status(400).json({ hata: "'baslik' ve 'govde' alanları zorunlu" });
    return;
  }

  const tokenlar = await redis.smembers("pushTokens");
  if (!tokenlar || tokenlar.length === 0) {
    res.status(200).json({ basarili: true, gonderilen: 0, mesaj: "Kayıtlı token yok" });
    return;
  }

  const GRUP_BOYU = 500;
  let gonderilenToplam = 0;
  let gecersizTokenlar = [];
  let hataDetaylari = []; // GEÇİ
