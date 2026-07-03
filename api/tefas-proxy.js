// api/tefas-proxy.js
// TEK fonksiyon, İKİ rol:
//  1) Normal kullanıcı isteği (GET, header/param yok) → KV'den okur, hızlı yanıt verir
//  2) Vercel Cron tetiklemesi (?cron=1&parca=1|2|3) → Fonoloji'den O PARÇANIN
//     kategorilerini çekip KV'deki mevcut veriyle BİRLEŞTİRİR (üzerine tamamen
//     yazmaz — fon kodu bazında upsert yapar)
//
// NEDEN PARÇALARA BÖLÜNDÜ: Fonoloji "dakikada en fazla 30 istek" sınırı
// uyguluyor (kendi hata mesajından doğrulandı: "Dakikada 30 istek sınırı
// aşıldı"). Toplam ~34 isteği (5 Vakıf + 21 kategori + pagination) tek çağrıda
// bu kurala uyacak şekilde yavaşlatınca süre ~75-90sn'ye çıkıyor — bu, Vercel
// fonksiyon zaman aşımı sınırına (plana göre değişir) takılma riski taşıyor.
// Çözüm: 21 kategori 3 dengeli PARÇAya bölündü (_lib/fonFetch.js'deki
// KATEGORILER sıralamasına bkz), günde zaten var olan 3 cron saatine
// (08:00/09:00/10:00 TR) birer parça dağıtıldı. Her çağrı ~20-45sn sürer,
// güvenli. Sabah 10'a gelindiğinde 3 parça birikip tam liste oluşur.
//
// NEDEN TEK DOSYA (ayrı bir cron-*.js değil): Vercel Hobby plan deployment
// başına en fazla 12 Serverless Function'a izin veriyor (bu repo zaten
// sınırda). Cron mantığını buraya taşıyarak fonksiyon sayısı artmıyor.
//
// KURULUM GEREKSİNİMİ: Vercel projesine Upstash (Redis) bağlanmalı
// (Vercel Dashboard → Storage → Marketplace → Upstash → Redis → projeye bağla).
// Paket: `npm install @upstash/redis`

import { Redis } from "@upstash/redis";
import { fonVerisiCek, ŞÜPHELİ_EŞİK } from "./_lib/fonFetch.js";

// Bir parça normal koşulda ~20-45sn sürüyor; yine de pay bırakıyoruz.
export const config = { maxDuration: 60 };

// Vercel'in enjekte ettiği env var adı entegrasyon şekline göre değişebiliyor,
// ikisini de kontrol ediyoruz.
const kv = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "tefas:katilim-fonlari";
const BAYATLIK_SINIRI_SAAT = 20;

// Yeni parçanın fonlarını mevcut kayıtla birleştirir: aynı `kod`a sahip fon
// varsa taze veriyle DEĞİŞTİRİLİR, yoksa eklenir. Diğer parçalardan gelen
// (bu çağrıda dokunulmayan) fonlar olduğu gibi korunur.
function birlestir(eskiData, yeniData) {
  const map = new Map();
  for (const f of (eskiData || [])) map.set(f.kod, f);
  for (const f of yeniData) map.set(f.kod, f);
  return [...map.values()];
}

function kategoriDagilimHesapla(data) {
  const d = {};
  for (const f of data) {
    const k = f.kategori || "Bilinmiyor";
    d[k] = (d[k] || 0) + 1;
  }
  return d;
}

async function cronYaz(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const gelenAuth = req.headers.authorization;
  const vercelCronMu = req.headers["x-vercel-cron"] === "1";
  if (cronSecret && !vercelCronMu && gelenAuth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Yetkisiz" });
  }

  const parcaNo = req.query?.parca ? parseInt(req.query.parca, 10) : null;

  try {
    const yeni = await fonVerisiCek(parcaNo);
    const eski = await kv.get(KV_ANAHTAR).catch(() => null);

    let sonucData, sonucSayim;
    if (yeni.eksikGorunuyor && eski?.data?.length) {
      // Bu parça bozuk geldi (kategorilerin yarısından fazlası hata verdi) —
      // eski veriyi bu parça için EZME, olduğu gibi bırak.
      sonucData = eski.data;
      sonucSayim = eski.data.length;
    } else if (parcaNo) {
      sonucData = birlestir(eski?.data, yeni.data);
      sonucSayim = sonucData.length;
    } else {
      // parça belirtilmeden (tam mod) çağrıldıysa eskisi gibi komple değiştir.
      sonucData = yeni.data;
      sonucSayim = yeni.data.length;
    }

    const kaydedilecek = {
      success: true,
      count: sonucSayim,
      guncelleme: new Date().toISOString(),
      kategori_dagilim: kategoriDagilimHesapla(sonucData),
      data: sonucData,
    };
    await kv.set(KV_ANAHTAR, kaydedilecek);

    return res.status(200).json({
      success: true,
      mod: "cron-yazma",
      parca: parcaNo,
      buParcaninGetirdigi: yeni.count,
      toplamSayim: sonucSayim,
      eskiToplamSayim: eski?.data?.length ?? null,
      eksikGorunuyor: yeni.eksikGorunuyor,
      kategoriTeshis: yeni.kategoriTeshis,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function herkesOku(req, res) {
  try {
    let kayit = await kv.get(KV_ANAHTAR).catch(() => null);
    const bayatMi = !kayit || (Date.now() - new Date(kayit.guncelleme).getTime()) > BAYATLIK_SINIRI_SAAT*3600*1000;

    if (bayatMi && !kayit) {
      // KV tamamen boş (ilk kurulum) — bir kerelik hızlı bootstrap dene.
      // NOT: parça vermeden çağırıyoruz, bu yüzden ~75-90sn sürebilir; sadece
      // "hiç veri yok"tan "en azından bir şey var"a geçmek için, tek seferlik.
      try {
        const taze = await fonVerisiCek();
        if (taze.count > 0) {
          const paket = {
            success: true,
            count: taze.count,
            guncelleme: taze.guncelleme,
            kategori_dagilim: taze.kategori_dagilim,
            data: taze.data,
          };
          if (taze.count >= ŞÜPHELİ_EŞİK) await kv.set(KV_ANAHTAR, paket).catch(() => {});
          kayit = paket;
        }
      } catch (e) { /* elimizde ne varsa onu döneceğiz */ }
    }

    if (!kayit) {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=30");
      return res.status(200).json({
        success: false,
        error: "Veri henüz mevcut değil. Cron parçalarının (?cron=1&parca=1/2/3) en az bir kez çalıştığını kontrol edin.",
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
