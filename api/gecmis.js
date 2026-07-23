// api/gecmis.js
// Yahoo Finance üzerinden 30 günlük geçmiş fiyat verisi (Kur Grafik Modalı için)
// REDIS/KV + KİLİT KORUMASI (2026-07) — bkz. kripto.js'deki aynı not. Her sembol
// kendi kilidini/önbelleğini kullanır (aynı sembole binlerce kişi aynı anda
// bakabilir, farklı semboller birbirini beklemez).
//
// ÇAPRAZ KUR FALLBACK (2026-07): Yahoo Finance bazı TRY paritelerini doğrudan
// desteklemiyor (örn. "CNYTRY=X", "RUBTRY=X", "SARTRY=X", "SEKTRY=X",
// "NOKTRY=X", "DKKTRY=X", "ZARTRY=X", "AZNTRY=X", "KWDTRY=X" — Yahoo'da arama
// yapıldığında "No results" dönüyor), bu yüzden bu semboller kalıcı olarak
// "—" görünüyordu. Doğrudan istek boş dönerse, GRAM_ALTIN'daki ile aynı
// mantıkla USD üzerinden çapraz kur türetiyoruz:
//   XXX/TRY = (USD/TRY) / (USD/XXX)
// Yahoo'da "XXX=X" formatı USD/XXX veriyor (örn. "CNY=X" → USD/CNY, arama
// sonuçlarıyla doğrulandı) — GRAM_ALTIN/GRAM_GUMUS zaten bunu ons için
// kullanıyordu, aynı yaklaşım burada döviz için de uygulanıyor.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_TTL_SANIYE = 900; // 15 dakika

function originIzinliMi(origin) {
  if (!origin) return false;
  if (/^https:\/\/katilim-analiz(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
  if (/^https:\/\/(www\.)?katilimplus\.com$/i.test(origin)) return true;
  // Native uygulama (Capacitor iOS/Android) origin'leri — 2026-07-23:
  // native WebView istekleri capacitor://localhost veya ionic://localhost
  // origin'iyle gelir; beyaz listede olmadıklari için BIST/haber/grafik
  // verileri native'de "Load failed" veriyordu.
  if (/^(capacitor|ionic):\/\/localhost$/i.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}
function corsAyarla(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", originIzinliMi(origin) ? origin : "https://katilim-analiz.vercel.app");
  res.setHeader("Vary", "Origin");
}

// Sembolü doğrudan Yahoo Finance chart API'sinden çeker, ham "result" nesnesini
// döner (bulunamazsa null). Hem doğrudan hem çapraz kur hesaplarında ortak.
async function yahooChartCek(sembol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=1mo`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return null;
  const json = await r.json();
  return json?.chart?.result?.[0] || null;
}
function noktalarCikar(result) {
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  return timestamps
    .map((t, i) => ({ tarih: new Date(t * 1000).toISOString().slice(0, 10), fiyat: closes[i] }))
    .filter(p => p.fiyat != null && p.fiyat > 0);
}

// "XXXTRY=X" formatındaki bir sembolden 3 harfli para birimi kodunu çıkarır
// (örn. "CNYTRY=X" → "CNY"). Eşleşmezse null.
function dovizKoduCikar(sembol) {
  const m = /^([A-Z]{3})TRY=X$/.exec(String(sembol || "").toUpperCase());
  return m ? m[1] : null;
}

// Sembolü doğrudan Yahoo'dan çeker (GRAM_ALTIN/GRAM_GUMUS DIŞINDAKİ genel yol).
async function dogrudanCek(sembol) {
  const result = await yahooChartCek(sembol);
  if (!result) return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };

  const noktalar = noktalarCikar(result);
  const meta = result.meta || {};
  const guncelFiyat = meta.regularMarketPrice ?? (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
  const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
    ?? meta.previousClose ?? meta.chartPreviousClose ?? null;

  return { noktalar, guncelFiyat, oncekiKapanis };
}

// XXX/TRY = (USD/TRY) / (USD/XXX) — Yahoo'da "XXX=X" formatı USD/XXX verir.
async function caprazKurHesapla(xxxKodu) {
  const [usdTryResult, usdXxxResult] = await Promise.all([
    yahooChartCek("USDTRY=X"),
    yahooChartCek(`${xxxKodu}=X`),
  ]);
  if (!usdTryResult || !usdXxxResult) return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };

  const usdTryNoktalar = noktalarCikar(usdTryResult);
  const usdXxxNoktalar = noktalarCikar(usdXxxResult);
  const usdXxxMap = {};
  usdXxxNoktalar.forEach(n => { usdXxxMap[n.tarih] = n.fiyat; });

  // USD/XXX her gün için bulunamayabilir (piyasa tatilleri farklı olabilir) —
  // GRAM_ALTIN'daki "sonUsdTry" mantığıyla aynı: bulunamayan günde son bilinen
  // değeri ileri taşı.
  let sonUsdXxx = null;
  const noktalar = usdTryNoktalar
    .map(n => {
      const usdXxx = usdXxxMap[n.tarih] ?? sonUsdXxx;
      if (usdXxx != null) sonUsdXxx = usdXxx;
      if (usdXxx == null || usdXxx === 0) return null;
      return { tarih: n.tarih, fiyat: Math.round((n.fiyat / usdXxx) * 10000) / 10000 };
    })
    .filter(p => p !== null && p.fiyat > 0);

  const usdTryMeta = usdTryResult.meta || {};
  const usdXxxMeta = usdXxxResult.meta || {};
  const guncelUsdTry = usdTryMeta.regularMarketPrice ?? (usdTryNoktalar.length ? usdTryNoktalar[usdTryNoktalar.length - 1].fiyat : null);
  const guncelUsdXxx = usdXxxMeta.regularMarketPrice ?? (usdXxxNoktalar.length ? usdXxxNoktalar[usdXxxNoktalar.length - 1].fiyat : null);
  const guncelFiyat = (guncelUsdTry != null && guncelUsdXxx)
    ? Math.round((guncelUsdTry / guncelUsdXxx) * 10000) / 10000
    : (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);

  const oncekiUsdTry = usdTryMeta.previousClose ?? usdTryMeta.chartPreviousClose;
  const oncekiUsdXxx = usdXxxMeta.previousClose ?? usdXxxMeta.chartPreviousClose;
  const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
    ?? ((oncekiUsdTry != null && oncekiUsdXxx) ? Math.round((oncekiUsdTry / oncekiUsdXxx) * 10000) / 10000 : null);

  return { noktalar, guncelFiyat, oncekiKapanis };
}

async function veriHesapla(sembol) {
  const GRAM_ONS = 31.1034768;

  if (sembol === "GRAM_ALTIN" || sembol === "GRAM_GUMUS") {
    const onsSembol = sembol === "GRAM_ALTIN" ? "GC=F" : "SI=F";
    const [onsRes, usdRes] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${onsSembol}?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);
    const onsJson = await onsRes.json();
    const usdJson = await usdRes.json();

    const onsResult = onsJson?.chart?.result?.[0];
    const usdResult = usdJson?.chart?.result?.[0];
    if (!onsResult || !usdResult) {
      return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };
    }

    const usdMap = {};
    (usdResult.timestamp || []).forEach((t, i) => {
      const tarih = new Date(t * 1000).toISOString().slice(0, 10);
      const c = usdResult.indicators?.quote?.[0]?.close?.[i];
      if (c != null) usdMap[tarih] = c;
    });

    const onsTimestamps = onsResult.timestamp || [];
    const onsCloses = onsResult.indicators?.quote?.[0]?.close || [];

    let sonUsdTry = null;
    const noktalar = onsTimestamps
      .map((t, i) => {
        const tarih = new Date(t * 1000).toISOString().slice(0, 10);
        const onsFiyat = onsCloses[i];
        const usdTry = usdMap[tarih] ?? sonUsdTry;
        if (usdTry != null) sonUsdTry = usdTry;
        if (onsFiyat == null || usdTry == null) return null;
        const gramTL = (onsFiyat * usdTry) / GRAM_ONS;
        return { tarih, fiyat: Math.round(gramTL * 100) / 100 };
      })
      .filter(p => p !== null && p.fiyat > 0);

    const onsMeta = onsResult.meta || {};
    const usdMeta = usdResult.meta || {};
    const guncelOns = onsMeta.regularMarketPrice ?? null;
    const guncelUsd = usdMeta.regularMarketPrice;
    const oncekiOnsMeta = onsMeta.previousClose ?? onsMeta.chartPreviousClose;
    const oncekiUsdMeta = usdMeta.previousClose ?? usdMeta.chartPreviousClose;

    const guncelFiyat = (guncelOns != null && guncelUsd != null)
      ? Math.round((guncelOns * guncelUsd / GRAM_ONS) * 100) / 100
      : (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
    const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
      ?? ((oncekiOnsMeta != null && oncekiUsdMeta != null)
        ? Math.round((oncekiOnsMeta * oncekiUsdMeta / GRAM_ONS) * 100) / 100
        : null);

    return { noktalar, guncelFiyat, oncekiKapanis };
  }

  // 1) Önce Yahoo'dan doğrudan dene (mevcut/eski davranış — çoğu parite için
  //    zaten çalışıyor: USDTRY=X, EURTRY=X, GBPTRY=X, JPYTRY=X, CADTRY=X, AUDTRY=X…).
  const dogrudan = await dogrudanCek(sembol);
  if (dogrudan.guncelFiyat != null || dogrudan.noktalar.length > 0) {
    return dogrudan;
  }

  // 2) Doğrudan veri yoksa ve "XXXTRY=X" formatında bir paritesiyse, USD
  //    üzerinden çapraz kur türetmeyi dene (CNY, RUB, SAR, SEK, NOK, DKK,
  //    ZAR, AZN, KWD gibi Yahoo'da doğrudan karşılığı olmayan pariteler için).
  const xxx = dovizKoduCikar(sembol);
  if (xxx && xxx !== "USD") {
    try {
      const capraz = await caprazKurHesapla(xxx);
      if (capraz.guncelFiyat != null || capraz.noktalar.length > 0) {
        return capraz;
      }
    } catch {
      // çapraz kur da başarısızsa aşağıda boş sonuç dönülür
    }
  }

  return dogrudan; // ikisi de başarısızsa eskisi gibi boş sonuç
}

export default async function handler(req, res) {
  corsAyarla(req, res);
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const { sembol, debug } = req.query;
  if (!sembol) {
    return res.status(400).json({ error: "sembol parametresi gerekli" });
  }

  const kvAnahtar = `gecmis:v1:${sembol}`;
  const debugMi = debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, kvAnahtar, KV_TTL_SANIYE, () => veriHesapla(sembol), { debug: debugMi });
    res.status(200).json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(kvAnahtar);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    res.status(500).json({ error: e.message, noktalar: [], guncelFiyat: null, oncekiKapanis: null });
  }
}
