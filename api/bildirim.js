// api/bildirim.js
//
// TEK dosyada iki işlem — Vercel'in /api altında en fazla 12 fonksiyon
// sınırına takılmamak için "push-token-kaydet" ve "bildirim-gonder"
// buraya birleştirildi. Hangi işlemin yapılacağı query parametresiyle
// belirleniyor: ?islem=kaydet  veya  ?islem=gonder
//
// ── 1) Token kaydetme (uygulamadan çağrılır, herkes çağırabilir) ──
//
// FiyatlamaPro.tsx içindeki "registration" listener'ını şöyle güncelleyin:
//
//   PushNotifications.addListener("registration", (token) => {
//     fetch(`${API_BASE}/api/bildirim?islem=kaydet`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         token: token.value,
//         platform: (window as any).Capacitor?.getPlatform?.() ?? "unknown",
//       }),
//     }).catch((e) => console.error("Token kaydedilemedi:", e));
//   });
//
// ── 2) Bildirim gönderme (sadece admin, x-admin-key gerekli) ──
//
//   curl -X POST "https://katilimplus.com/api/bildirim?islem=gonder" \
//     -H "Content-Type: application/json" \
//     -H "x-admin-key: GIZLI_ANAHTARINIZ" \
//     -d '{"baslik":"Yeni Kur!", "govde":"USD/TRY güncellendi."}'

const { Redis } = require("@upstash/redis");
const { admin } = require("./_lib/firebaseAdmin");

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

  for (let i = 0; i < tokenlar.length; i += GRUP_BOYU) {
    const grup = tokenlar.slice(i, i + GRUP_BOYU);

    const mesaj = {
      notification: { title: baslik, body: govde },
      data: veri || {},
      tokens: grup,
    };

    const sonuc = await admin.messaging().sendEachForMulticast(mesaj);
    gonderilenToplam += sonuc.successCount;

    sonuc.responses.forEach((r, idx) => {
      if (!r.success) {
        const kod = r.error?.code || "";
        if (
          kod.includes("registration-token-not-registered") ||
          kod.includes("invalid-argument")
        ) {
          gecersizTokenlar.push(grup[idx]);
        }
      }
    });
  }

  if (gecersizTokenlar.length > 0) {
    await redis.srem("pushTokens", ...gecersizTokenlar);
    await redis.hdel("pushTokenPlatform", ...gecersizTokenlar);
  }

  res.status(200).json({
    basarili: true,
    hedefTokenSayisi: tokenlar.length,
    basariylaGonderilen: gonderilenToplam,
    temizlenenGecersizToken: gecersizTokenlar.length,
  });
}

module.exports = async (req, res) => {
  // CORS: Capacitor/WebView tabanlı istekler önce bir OPTIONS (preflight)
  // isteği gönderir. Bunu yanıtlamazsak gerçek POST isteği hiç gitmez.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ hata: "Sadece POST kabul edilir" });
    return;
  }

  const islem = req.query?.islem;

  try {
    if (islem === "kaydet") {
      await tokenKaydet(req, res);
    } else if (islem === "gonder") {
      await bildirimGonder(req, res);
    } else {
      res.status(400).json({ hata: "Geçersiz 'islem'. 'kaydet' veya 'gonder' olmalı." });
    }
  } catch (e) {
    console.error("bildirim.js hatası:", e);
    res.status(500).json({ hata: "Sunucu hatası oluştu" });
  }
};
