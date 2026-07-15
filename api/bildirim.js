// api/bildirim.js
//
// TEK dosyada DÖRT işlem — Vercel'in /api altında en fazla 12 fonksiyon
// sınırına takılmamak için hepsi buraya birleştirildi. Hangi işlemin
// yapılacağı query parametresiyle belirleniyor: ?islem=...
//
// ── 1) Token kaydetme (uygulamadan çağrılır, herkes çağırabilir) ──
//
//   fetch(`${API_BASE}/api/bildirim?islem=kaydet`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ token: token.value, platform: ... }),
//   });
//
// ── 2) Bildirim gönderme (sadece admin, x-admin-key veya ?anahtar= gerekli) ──
//
//   curl -X POST "https://www.katilimplus.com/api/bildirim?islem=gonder" \
//     -H "Content-Type: application/json" \
//     -H "x-admin-key: GIZLI_ANAHTARINIZ" \
//     -d '{"baslik":"Yeni Kur!", "govde":"USD/TRY güncellendi."}'
//
//   NOT (2026-07): Bazı tarayıcı ortamlarında (özellikle Safari Gizli
//   Sekme + Gelişmiş İzleme Koruması) özel HTTP header'lar ("x-admin-key"
//   gibi) fetch() içinde "SyntaxError: The string did not match the
//   expected pattern" hatasına yol açabiliyor. Bu yüzden admin anahtarı
//   HEM header HEM query param (?anahtar=) ile kabul ediliyor — tıpkı
//   alarm-kontrol uç noktasındaki gibi.
//
// ── 3) FİYAT ALARMLARI (2026-07 eklendi) ──
//
// Kullanıcı bir enstrüman için "şu fiyata gelirse" veya "%X yükselir/düşerse"
// alarmı kurabiliyor. Alarmlar Redis'te TEK bir anahtar altında (JSON dizi
// olarak — tefas-proxy/evds-proxy'deki aynı desen) tutulur, push token'a
// (cihaza) bağlıdır — uygulamanın kullanıcı hesabı olmadığı için token,
// alarmın "kime ait olduğunu" belirleyen tek kimliktir.
//
//   POST ?islem=alarm-ekle    { token, sembol, ad, tip:"hedef"|"yuzde", yon, hedefFiyat?, yuzde? }
//   POST ?islem=alarm-listele { token }                    → {alarmlar:[...]}
//   POST ?islem=alarm-sil     { token, id }
//
// ── 4) ALARM KONTROLÜ (dış tetikleyici çağırır — Vercel Cron DEĞİL) ──
//
// Vercel Hobby planında cron günde 1 kezle sınırlı (fiyat alarmı için işe
// yaramaz) — bu yüzden bu uç nokta, ücretsiz bir dış zamanlayıcı servisinin
// (örn. cron-job.org) her 5-15 dakikada bir HTTP isteğiyle tetiklemesi için
// tasarlandı. Kimlik doğrulama HEM header HEM query param ile desteklenir
// çünkü bazı ücretsiz zamanlayıcılar özel header ayarlamaya izin vermiyor:
//
//   GET/POST ?islem=alarm-kontrol&anahtar=GIZLI_ANAHTAR
//   (veya header: x-admin-key: GIZLI_ANAHTAR)
//
// Tetiklenen her alarm İÇİN SADECE O CİHAZA (kendi token'ına) push bildirimi
// gönderilir — bildirimGonder'daki gibi TÜM kullanıcılara değil. Tetiklenen
// alarm "aktif:false" yapılır (tek seferlik) — kullanıcı isterse aynı
// koşulla yeni bir alarm kurabilir.

import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";
import { admin } from "./_lib/firebaseAdmin.js";
import { kilitliCalistir } from "./_lib/kilitliOnbellek.js";

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

// Tek bir token'a push bildirimi gönderir (alarm bildirimleri için — tüm
// kullanıcılara değil, sadece alarmı kuran cihaza gider).
async function tekTokeneGonder(token, baslik, govde, veri) {
  try {
    await admin.messaging().send({
      notification: { title: baslik, body: govde },
      data: veri || {},
      token,
    });
    return true;
  } catch (e) {
    console.error("Alarm bildirimi gönderilemedi:", token, e.message);
    return false;
  }
}

async function bildirimGonder(req, res) {
  const gelenAnahtarHeader = req.headers["x-admin-key"];
  const gelenAnahtarQuery = req.query?.anahtar;
  if (
    !process.env.ADMIN_GIZLI_ANAHTAR ||
    (gelenAnahtarHeader !== process.env.ADMIN_GIZLI_ANAHTAR && gelenAnahtarQuery !== process.env.ADMIN_GIZLI_ANAHTAR)
  ) {
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

// ═══════════════════════════════════════════════════════════════════════════
// FİYAT ALARMLARI
// ═══════════════════════════════════════════════════════════════════════════

const ALARM_KV_ANAHTAR = "fiyatAlarmlari";
const ALARM_KILIT_ANAHTAR = `lock:${ALARM_KV_ANAHTAR}`;
const MAKS_AKTIF_ALARM_TOKEN_BASINA = 20;
const OZ = 31.1034768; // ons → gram dönüşüm sabiti

function fetchZamanli(url, opts, msTimeout) {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), msTimeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(zamanlayici));
}

// Yahoo Finance'ten tek bir sembolün GÜNCEL fiyatını çeker. meta.regularMarketPrice
// varsa onu kullanır (en güncel, gün içi) — yoksa son kapanışa düşer.
async function yahooGuncelFiyat(sembol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?range=1d&interval=5m`;
  try {
    const r = await fetchZamanli(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)" } }, 8000);
    if (!r.ok) return null;
    const j = await r.json();
    const sonuc = j?.chart?.result?.[0];
    const meta = sonuc?.meta;
    if (meta?.regularMarketPrice != null) return meta.regularMarketPrice;
    const kapanislar = (sonuc?.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === "number");
    return kapanislar.length ? kapanislar[kapanislar.length - 1] : null;
  } catch {
    return null;
  }
}

// GRAM_ALTIN/GRAM_GUMUS gibi sentetik semboller dahil, herhangi bir alarm
// sembolünün güncel fiyatını döner.
async function alarmFiyatGetir(sembol) {
  if (sembol === "GRAM_ALTIN" || sembol === "GRAM_GUMUS") {
    const onsSembol = sembol === "GRAM_ALTIN" ? "GC=F" : "SI=F";
    const [ons, usdTry] = await Promise.all([yahooGuncelFiyat(onsSembol), yahooGuncelFiyat("USDTRY=X")]);
    if (ons == null || usdTry == null) return null;
    return (ons * usdTry) / OZ;
  }
  return yahooGuncelFiyat(sembol);
}

async function alarmlariOku() {
  try {
    const kayit = await redis.get(ALARM_KV_ANAHTAR);
    if (Array.isArray(kayit)) return kayit;
    if (typeof kayit === "string") return JSON.parse(kayit) || [];
    return [];
  } catch {
    return [];
  }
}

async function alarmEkle(req, res) {
  const { token, sembol, ad, tip, yon, hedefFiyat, yuzde } = req.body || {};
  if (!token || !sembol || !ad || !tip || !yon) {
    res.status(400).json({ hata: "token, sembol, ad, tip, yon alanları zorunlu" });
    return;
  }
  if (tip === "hedef" && (hedefFiyat == null || isNaN(parseFloat(hedefFiyat)))) {
    res.status(400).json({ hata: "tip=hedef için geçerli bir 'hedefFiyat' gerekli" });
    return;
  }
  if (tip === "yuzde" && (yuzde == null || isNaN(parseFloat(yuzde)) || parseFloat(yuzde) <= 0)) {
    res.status(400).json({ hata: "tip=yuzde için pozitif bir 'yuzde' gerekli" });
    return;
  }

  const mevcutFiyat = await alarmFiyatGetir(sembol);
  if (mevcutFiyat == null) {
    res.status(502).json({ hata: "Bu sembol için güncel fiyat alınamadı, alarm oluşturulamadı" });
    return;
  }

  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis,
      ALARM_KILIT_ANAHTAR,
      15,
      async () => {
        const alarmlar = await alarmlariOku();

        const aktifSayisi = alarmlar.filter((a) => a.token === token && a.aktif).length;
        if (aktifSayisi >= MAKS_AKTIF_ALARM_TOKEN_BASINA) {
          return { hataKodu: 429, hata: `En fazla ${MAKS_AKTIF_ALARM_TOKEN_BASINA} aktif alarm kurabilirsiniz. Lütfen önce birkaçını silin.` };
        }

        const yeniAlarm = {
          id: randomUUID(),
          token,
          sembol,
          ad,
          tip, // "hedef" | "yuzde"
          yon, // hedef: "ustunde"|"altinda"  |  yuzde: "artis"|"dusus"
          hedefFiyat: tip === "hedef" ? parseFloat(hedefFiyat) : null,
          yuzde: tip === "yuzde" ? parseFloat(yuzde) : null,
          baslangicFiyat: mevcutFiyat,
          olusturulmaTs: Date.now(),
          aktif: true,
          tetiklenmeTs: null,
          tetiklenmeFiyat: null,
        };

        const yeniListe = [...alarmlar, yeniAlarm];
        await redis.set(ALARM_KV_ANAHTAR, yeniListe);
        return { alarm: yeniAlarm };
      },
      { denemeSayisi: 10, bekleMs: 300 }
    );

    if (!basarili) {
      res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." });
      return;
    }
    if (sonuc?.hataKodu) {
      res.status(sonuc.hataKodu).json({ hata: sonuc.hata });
      return;
    }
    res.status(200).json({ basarili: true, alarm: sonuc.alarm });
  } catch (e) {
    res.status(500).json({ hata: "Alarm oluşturulamadı", detay: e.message });
  }
}

async function alarmListele(req, res) {
  const { token } = req.body || {};
  if (!token) {
    res.status(400).json({ hata: "'token' alanı zorunlu" });
    return;
  }
  const alarmlar = await alarmlariOku();
  const kendiAlarmlarim = alarmlar
    .filter((a) => a.token === token)
    .sort((a, b) => b.olusturulmaTs - a.olusturulmaTs);
  res.status(200).json({ basarili: true, alarmlar: kendiAlarmlarim });
}

async function alarmSil(req, res) {
  const { token, id } = req.body || {};
  if (!token || !id) {
    res.status(400).json({ hata: "'token' ve 'id' alanları zorunlu" });
    return;
  }

  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis,
      ALARM_KILIT_ANAHTAR,
      15,
      async () => {
        const alarmlar = await alarmlariOku();
        const yeniListe = alarmlar.filter((a) => !(a.id === id && a.token === token));
        const silindi = yeniListe.length !== alarmlar.length;
        if (silindi) await redis.set(ALARM_KV_ANAHTAR, yeniListe);
        return { silindi };
      },
      { denemeSayisi: 10, bekleMs: 300 }
    );
    if (!basarili) {
      res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." });
      return;
    }
    res.status(200).json({ basarili: true, silindi: sonuc.silindi });
  } catch (e) {
    res.status(500).json({ hata: "Alarm silinemedi", detay: e.message });
  }
}

// Dış zamanlayıcının çağırdığı kontrol uç noktası. Tüm AKTİF alarmları
// gruplanmış sembollerle tek seferde fiyatlandırır, koşulu sağlayanlara
// SADECE KENDİ TOKEN'INA push gönderir ve alarmı "aktif:false" yapar.
async function alarmKontrol(req, res) {
  const gelenAnahtarHeader = req.headers["x-admin-key"];
  const gelenAnahtarQuery = req.query?.anahtar;
  const beklenenAnahtar = process.env.ALARM_KONTROL_ANAHTARI || process.env.ADMIN_GIZLI_ANAHTAR;
  if (!beklenenAnahtar || (gelenAnahtarHeader !== beklenenAnahtar && gelenAnahtarQuery !== beklenenAnahtar)) {
    res.status(401).json({ hata: "Yetkisiz istek" });
    return;
  }

  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis,
      ALARM_KILIT_ANAHTAR,
      60,
      async () => {
        const alarmlar = await alarmlariOku();
        const aktifAlarmlar = alarmlar.filter((a) => a.aktif);

        if (aktifAlarmlar.length === 0) {
          return { kontrolEdilenAlarm: 0, benzersizSembol: 0, tetiklenen: 0, gonderilenBildirim: 0 };
        }

        // Aynı sembolü birden fazla alarm izliyorsa fiyatı TEK kere çekelim.
        const benzersizSemboller = [...new Set(aktifAlarmlar.map((a) => a.sembol))];
        const fiyatlar = {};
        await Promise.all(
          benzersizSemboller.map(async (s) => {
            fiyatlar[s] = await alarmFiyatGetir(s);
          })
        );

        let tetiklenen = 0;
        let gonderilenBildirim = 0;
        const guncelListe = [];

        for (const alarm of alarmlar) {
          if (!alarm.aktif) {
            guncelListe.push(alarm);
            continue;
          }
          const guncelFiyat = fiyatlar[alarm.sembol];
          if (guncelFiyat == null) {
            guncelListe.push(alarm); // fiyat alınamadıysa bir sonraki kontrole bırak
            continue;
          }

          let tetiklendiMi = false;
          let mesaj = "";
          if (alarm.tip === "hedef") {
            if (alarm.yon === "ustunde" && guncelFiyat >= alarm.hedefFiyat) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} fiyatı hedefinize ulaştı/geçti: ${guncelFiyat.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} (hedef: ${alarm.hedefFiyat})`;
            } else if (alarm.yon === "altinda" && guncelFiyat <= alarm.hedefFiyat) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} fiyatı hedefinizin altına indi: ${guncelFiyat.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} (hedef: ${alarm.hedefFiyat})`;
            }
          } else if (alarm.tip === "yuzde" && alarm.baslangicFiyat) {
            const degisimYuzde = ((guncelFiyat - alarm.baslangicFiyat) / alarm.baslangicFiyat) * 100;
            if (alarm.yon === "artis" && degisimYuzde >= alarm.yuzde) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} %${degisimYuzde.toFixed(2)} yükseldi (alarm eşiği: %${alarm.yuzde})`;
            } else if (alarm.yon === "dusus" && degisimYuzde <= -alarm.yuzde) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} %${Math.abs(degisimYuzde).toFixed(2)} düştü (alarm eşiği: %${alarm.yuzde})`;
            }
          }

          if (tetiklendiMi) {
            tetiklenen++;
            const gonderildi = await tekTokeneGonder(alarm.token, `🔔 Fiyat Alarmı: ${alarm.ad}`, mesaj, {
              tip: "fiyat-alarmi",
              sembol: alarm.sembol,
              alarmId: alarm.id,
            });
            if (gonderildi) gonderilenBildirim++;
            guncelListe.push({ ...alarm, aktif: false, tetiklenmeTs: Date.now(), tetiklenmeFiyat: guncelFiyat });
          } else {
            guncelListe.push(alarm);
          }
        }

        await redis.set(ALARM_KV_ANAHTAR, guncelListe);
        return {
          kontrolEdilenAlarm: aktifAlarmlar.length,
          benzersizSembol: benzersizSemboller.length,
          tetiklenen,
          gonderilenBildirim,
        };
      },
      { denemeSayisi: 3, bekleMs: 1000 }
    );

    if (!basarili) {
      res.status(409).json({ hata: "Önceki kontrol hâlâ sürüyor, bu çağrı atlandı." });
      return;
    }
    res.status(200).json({ basarili: true, ...sonuc });
  } catch (e) {
    console.error("alarm-kontrol hatası:", e);
    res.status(500).json({ hata: "Alarm kontrolü başarısız", detay: e.message });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const islem = req.query?.islem;

  // alarm-kontrol dış zamanlayıcılardan GET olarak da çağrılabilmeli (bazı
  // ücretsiz servisler yalnızca GET destekler) — diğer tüm işlemler POST ister.
  if (islem === "alarm-kontrol") {
    try {
      await alarmKontrol(req, res);
    } catch (e) {
      console.error("bildirim.js hatası:", e);
      res.status(500).json({ hata: "Sunucu hatası oluştu", detay: String(e) });
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ hata: "Sadece POST kabul edilir" });
    return;
  }

  try {
    if (islem === "kaydet") {
      await tokenKaydet(req, res);
    } else if (islem === "gonder") {
      await bildirimGonder(req, res);
    } else if (islem === "alarm-ekle") {
      await alarmEkle(req, res);
    } else if (islem === "alarm-listele") {
      await alarmListele(req, res);
    } else if (islem === "alarm-sil") {
      await alarmSil(req, res);
    } else {
      res.status(400).json({ hata: "Geçersiz 'islem'." });
    }
  } catch (e) {
    console.error("bildirim.js hatası:", e);
    res.status(500).json({ hata: "Sunucu hatası oluştu", detay: String(e) });
  }
}
