// api/piyasa-fiyatlar.js
// Birleştirilmiş fiyat proxy'si: altin + kripto + petrol + kur + altinapi
// Kullanım: /api/piyasa-fiyatlar?tip=altin | kripto | petrol | kur | altinapi
//
// ═══════════════════════════════════════════════════════════════════════════
// KAYNAK DEĞİŞİKLİĞİ (2026-08-08) — Yahoo/Frankfurter → AltinAPI
// ═══════════════════════════════════════════════════════════════════════════
// SORUN: Kurlar Frankfurter'dan (Avrupa Merkez Bankası GÜNLÜK REFERANS kuru,
// günde tek yayın) geliyordu. Ne serbest piyasa kuruydu ne de gün içinde
// güncelleniyordu; kullanıcının döviz bürosunda gördüğü rakamla uyuşmuyordu.
// Altın/gümüş ise Yahoo futures'tan (GC=F, SI=F) alınıp USD/TRY ile
// ÇARPILARAK gram fiyatına çevriliyordu — Kapalı Çarşı fiyatı değil,
// türetilmiş bir yaklaşıklıktı.
//
// ÇÖZÜM: Döviz + altın + gümüş tamamen AltinAPI'ye (Harem Altın verisi,
// serbest piyasa) taşındı. Investing.com ile karşılaştırıldı, fiyatlar birebir
// tutuyor. Uygulama genelinde tek kaynak kullanılıyor.
//
// ALTINAPI'DE OLMAYANLAR — bilinçli olarak eski kaynaklarında bırakıldı:
//   • Petrol (BZ=F)  → AlphaVantage, yedeği Yahoo
//   • Bitcoin        → CoinGecko
//
// ═══════════════════════════════════════════════════════════════════════════
// GÜNLÜK DEĞİŞİM: KENDİ KAPANIŞIMIZ (2026-08-08)
// ═══════════════════════════════════════════════════════════════════════════
// AltinAPI'nin "close" alanı GÜVENİLİR DEĞİL. Ölçüldü: USD/TRY için 47,297
// veriyor ama gerçek önceki kapanış 47,6087; gram altında 6.693 diyor,
// gerçek ~6.493. Bu alandan hesaplanan yüzde değişim yanlış çıkıyor, altında
// YÖN bile ters dönüyordu (biz −%0,35 derken piyasa +%2,53).
//
// ÇÖZÜM: Değişimi kendi tuttuğumuz kapanıştan hesaplıyoruz. Her gün ilk
// istekte, bir önceki günün SON gördüğümüz değeri "önceki kapanış" olarak
// sabitleniyor. Böylece gösterdiğimiz fiyat ile hesapladığımız değişim AYNI
// veriden geliyor — dış bir servise daha bağımlı olmuyoruz.
//
// İlk gün referans yoktur; değişim null döner ve arayüzde gösterilmez.
// Uydurma bir değer üretmektense hiç göstermemek doğrudur.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── ORTAK: AltinAPI ham veri ──────────────────────────────────────────────
// Tek istekte 260+ sembol dönüyor; altin/kur/altinapi tiplerinin hepsi bunu
// kullanıyor. Her tip kendi Redis anahtarında önbelleklendiği için AltinAPI'ye
// giden istek sayısı artmıyor.
async function altinApiCek() {
  const apiKey = process.env.ALTINAPI_KEY;
  if (!apiKey) throw new Error("ALTINAPI_KEY tanimli degil");
  const r = await fetch("https://altinapi.com/api/v1/prices", {
    headers: { "X-API-Key": apiKey },
  });
  if (!r.ok) throw new Error("AltinAPI HTTP " + r.status);
  const json = await r.json();
  const items = (json && json.data) || [];
  const harita = {};
  for (const item of items) {
    if (!item || !item.symbol) continue;
    harita[item.symbol] = item;
  }
  return harita;
}

// Sembolden sayı çıkarır. AltinAPI bazı sembolleri 0/null döndürüyor
// (örn. USDRUB bid=ask=0); bunlar geçersiz sayılıp null dönüyor.
function fiyat(harita, sembol, alan) {
  const it = harita[sembol];
  if (!it) return null;
  const v = Number(it[alan]);
  return isFinite(v) && v > 0 ? v : null;
}
const satis = (h, s) => fiyat(h, s, "ask");   // kullanıcı alırken ödediği
const alis  = (h, s) => fiyat(h, s, "bid");   // kullanıcı bozdururken aldığı

// ─── GÜNLÜK KAPANIŞ TAKİBİ ─────────────────────────────────────────────────
// Redis'te tek kayıt: { tarih, oncekiKapanis:{sembol:fiyat}, son:{sembol:fiyat} }
// Gün değişince "son" → "oncekiKapanis" olur. Türkiye saatine göre.
const KV_GUNLUK = "piyasa:gunluk:v1";
// Değişimi hesaplanacak semboller (satış fiyatı üzerinden takip edilir)
const TAKIP_SEMBOLLER = [
  "USDTRY","EURTRY","GBPTRY","CHFTRY","SARTRY","JPYTRY","CADTRY","AUDTRY",
  "EURUSD","XAUUSD","XAGUSD","ALTIN","GUMUSTRY","AYAR22","AYAR14",
  "CEYREK_YENI","YARIM_YENI","TEK_YENI","ATA_YENI","ONS",
];

function bugunTR() {
  return new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
}

// Güncel değerleri kaydeder, önceki günün kapanışını döndürür.
// Redis erişilemezse null döner — değişim gösterilmez ama fiyatlar akmaya
// devam eder. Fiyat akışı hiçbir koşulda bu yüzden durmamalı.
async function gunlukReferansAlVeYaz(h) {
  const bugun = bugunTR();
  const simdiki = {};
  for (const s of TAKIP_SEMBOLLER) {
    const v = satis(h, s);
    if (v != null) simdiki[s] = v;
  }

  let kayit = null;
  try { kayit = await redis.get(KV_GUNLUK); } catch {}

  if (!kayit || kayit.tarih !== bugun) {
    const oncekiKapanis = (kayit && kayit.son) || null;   // dünkü SON değer
    try { await redis.set(KV_GUNLUK, { tarih: bugun, oncekiKapanis, son: simdiki }); } catch {}
    return oncekiKapanis;
  }

  try { await redis.set(KV_GUNLUK, { ...kayit, son: simdiki }); } catch {}
  return kayit.oncekiKapanis || null;
}

// Bir sembol için alış/satış/kapanış/değişim paketi
function cift(h, sembol, ref) {
  const a = alis(h, sembol), s = satis(h, sembol);
  const k = ref && ref[sembol] != null ? ref[sembol] : null;
  return {
    alis: a,
    satis: s,
    kapanis: k,
    degisim: s != null && k != null && k > 0 ? Math.round((s - k) / k * 10000) / 100 : null,
  };
}

// ─── ALTIN (Kaynak: AltinAPI) ──────────────────────────────────────────────
// Alan adları BİREBİR korundu (XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram,
// XAG_TRY_gram). Tek fark: gram fiyatları artık ons × kur ile HESAPLANMIYOR,
// doğrudan Kapalı Çarşı verisinden (ALTIN / GUMUSTRY) geliyor.
async function altinTaze() {
  const h = await altinApiCek();
  const ref = await gunlukReferansAlVeYaz(h);

  const XAU_USD = satis(h, "XAUUSD");
  const XAG_USD = satis(h, "XAGUSD");
  const USD_TRY = satis(h, "USDTRY");
  const XAU_TRY_gram = satis(h, "ALTIN");
  const XAG_TRY_gram = satis(h, "GUMUSTRY");

  if (XAU_USD == null) throw new Error("XAUUSD (ons altın) alınamadı");
  if (XAU_TRY_gram == null) throw new Error("ALTIN (gram altın) alınamadı");
  if (USD_TRY == null) throw new Error("USDTRY alınamadı");
  if (XAG_USD != null && XAG_USD >= XAU_USD) {
    throw new Error(`Gümüş/Altın oranı anormal (XAG=${XAG_USD}, XAU=${XAU_USD}) — kaynak veri şüpheli`);
  }

  return {
    XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram, XAG_TRY_gram,
    detay: {
      ons_altin:  cift(h, "XAUUSD", ref),
      ons_gumus:  cift(h, "XAGUSD", ref),
      gram_altin: cift(h, "ALTIN", ref),
      gram_gumus: cift(h, "GUMUSTRY", ref),
      ayar22:     cift(h, "AYAR22", ref),
      ceyrek:     cift(h, "CEYREK_YENI", ref),
      yarim:      cift(h, "YARIM_YENI", ref),
      tam:        cift(h, "TEK_YENI", ref),
    },
    referansVar: ref != null,
    ts: new Date().toISOString(),
  };
}

// ─── KRİPTO (Kaynak: CoinGecko — AltinAPI'de kripto yok) ───────────────────
async function kriptoTaze() {
  const r = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,try"
  );
  if (!r.ok) throw new Error("CoinGecko error");
  const data = await r.json();
  return {
    btc_usd: data.bitcoin?.usd,
    btc_try: data.bitcoin?.try,
    eth_usd: data.ethereum?.usd,
    eth_try: data.ethereum?.try,
    ts: new Date().toISOString(),
  };
}

// ─── PETROL (Kaynak: AlphaVantage, yedek Yahoo — AltinAPI'de petrol yok) ───
async function petrolTaze() {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (apiKey) {
    try {
      const url = "https://www.alphavantage.co/query?function=BRENT&interval=daily&apikey=" + apiKey;
      const r = await fetch(url);
      if (r.ok) {
        const json = await r.json();
        const veri = ((json && json.data) || []).filter(function(n) {
          return n.value !== "." && n.value != null && !isNaN(parseFloat(n.value));
        });
        if (veri.length >= 2) {
          const price = parseFloat(veri[0].value);
          const prev = parseFloat(veri[1].value);
          return {
            brent_usd: price,
            prev_usd: prev,
            change_pct: ((price - prev) / prev * 100).toFixed(2),
            ts: new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      // Alpha Vantage basarisiz olursa asagidaki Yahoo yoluna dusulur
    }
  }

  const r = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1d&range=1d",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!r.ok) throw new Error("Yahoo Finance error");
  const data = await r.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const prev  = data?.chart?.result?.[0]?.meta?.chartPreviousClose;
  return {
    brent_usd: price,
    prev_usd: prev,
    change_pct: price && prev ? ((price - prev) / prev * 100).toFixed(2) : null,
    ts: new Date().toISOString(),
  };
}

// ─── ALTINAPI (ham, tüm semboller) ─────────────────────────────────────────
const ALTINAPI_GARANTI = [
  "ALTIN","ONS","AYAR22","AYAR14","CEYREK_YENI","CEYREK_ESKI","YARIM_YENI",
  "YARIM_ESKI","TEK_YENI","TEK_ESKI","ATA_YENI","ATA_ESKI","XAGUSD",
  "GUMUSTRY","XPTUSD","PLATIN","XPDUSD","PALADYUM","USDTRY","EURTRY",
];

async function altinApiTaze() {
  const harita = await altinApiCek();
  const sonuc = {};
  for (const sembol of Object.keys(harita)) {
    const i = harita[sembol];
    sonuc[sembol] = { bid: i.bid, ask: i.ask, close: i.close };
  }
  for (const sembol of ALTINAPI_GARANTI) {
    if (!(sembol in sonuc)) sonuc[sembol] = null;
  }
  return sonuc;
}

// ─── KUR (Kaynak: AltinAPI; Bitcoin için CoinGecko) ────────────────────────
// Ana alanlar (USD_TRY, EUR_TRY …) SATIŞ fiyatını taşıyor — ana ekranda
// gösterilen budur. Alış/satış ayrımı ve günlük değişim "detay" altında.
//
// RUB/CNY/AED: AltinAPI'de ana sembol boş dönüyor (USDRUB bid=ask=0), bu
// yüzden DS_ önekli karşılıkları yedek olarak kullanılıyor.
async function kurTaze() {
  const [haritaRes, btcRes] = await Promise.allSettled([
    altinApiCek(),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
  ]);

  if (haritaRes.status !== "fulfilled") {
    throw new Error("AltinAPI alınamadı: " + (haritaRes.reason?.message || "bilinmeyen hata"));
  }
  const h = haritaRes.value;
  const ref = await gunlukReferansAlVeYaz(h);

  const btcData = btcRes.status === "fulfilled" && btcRes.value.ok ? await btcRes.value.json() : null;
  const BTC_USD = btcData?.bitcoin?.usd ?? null;

  const kurSatis = (ana, yedek) => satis(h, ana) ?? (yedek ? satis(h, yedek) : null);
  const kurCift  = (ana, yedek) => (satis(h, ana) != null ? cift(h, ana, ref) : (yedek ? cift(h, yedek, ref) : cift(h, ana, ref)));

  const USD_TRY = kurSatis("USDTRY");
  if (USD_TRY == null) throw new Error("USDTRY alınamadı");

  const JPY = kurSatis("JPYTRY");

  return {
    USD_TRY,
    EUR_TRY: kurSatis("EURTRY"),
    GBP_TRY: kurSatis("GBPTRY"),
    CHF_TRY: kurSatis("CHFTRY"),
    SAR_TRY: kurSatis("SARTRY"),
    RUB_TRY: kurSatis("RUBTRY", "DS_RUBTRY"),
    AED_TRY: kurSatis("AEDTRY", "DS_AEDTRY"),
    CNY_TRY: kurSatis("CNYTRY", "DS_CNYTRY"),
    JPY_TRY: JPY,
    JPY100_TRY: JPY != null ? Math.round(JPY * 100 * 10000) / 10000 : null,
    CAD_TRY: kurSatis("CADTRY"),
    AUD_TRY: kurSatis("AUDTRY"),
    EUR_USD: kurSatis("EURUSD"),
    XAU_USD: satis(h, "XAUUSD"),
    XAU_TRY_gram: satis(h, "ALTIN"),
    XAG_TRY_gram: satis(h, "GUMUSTRY"),
    BTC_USD,
    detay: {
      USD_TRY: kurCift("USDTRY"),
      EUR_TRY: kurCift("EURTRY"),
      GBP_TRY: kurCift("GBPTRY"),
      CHF_TRY: kurCift("CHFTRY"),
      SAR_TRY: kurCift("SARTRY"),
      RUB_TRY: kurCift("RUBTRY", "DS_RUBTRY"),
      AED_TRY: kurCift("AEDTRY", "DS_AEDTRY"),
      CNY_TRY: kurCift("CNYTRY", "DS_CNYTRY"),
      JPY_TRY: kurCift("JPYTRY"),
      CAD_TRY: kurCift("CADTRY"),
      AUD_TRY: kurCift("AUDTRY"),
      EUR_USD: kurCift("EURUSD"),
      XAU_USD: cift(h, "XAUUSD", ref),
      XAG_USD: cift(h, "XAGUSD", ref),
      XAU_TRY_gram: cift(h, "ALTIN", ref),
      XAG_TRY_gram: cift(h, "GUMUSTRY", ref),
    },
    // Arayüz, referans yokken (ilk gün) değişim alanlarını gizlemek için bakar
    referansVar: ref != null,
    ts: new Date().toISOString(),
  };
}

// ─── Tip → { Redis anahtarı, TTL, taze() fonksiyonu, Cache-Control } ───────
// Anahtarlar v3'e yükseltildi (günlük değişim eklendi) — aksi halde eski
// şekildeki önbellek dönmeye devam eder ve değişiklik görünmez.
const YAPILANDIRMA = {
  altin:    { anahtar: "altin:v3",    ttl: 300,  fn: altinTaze,    cacheControl: "s-maxage=300" },
  kripto:   { anahtar: "kripto:v1",   ttl: 300,  fn: kriptoTaze,   cacheControl: "s-maxage=300" },
  petrol:   { anahtar: "petrol:v1",   ttl: 1800, fn: petrolTaze,   cacheControl: "s-maxage=1800" },
  kur:      { anahtar: "kur:v3",      ttl: 300,  fn: kurTaze,      cacheControl: "s-maxage=300" },
  altinapi: { anahtar: "altinapi:v5", ttl: 300,  fn: altinApiTaze, cacheControl: "s-maxage=300" },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const tip = req.query.tip;
  const conf = YAPILANDIRMA[tip];
  if (!conf) {
    return res.status(400).json({
      error: `Geçersiz veya eksik 'tip' parametresi (gelen: ${tip ?? "yok"}). Kullanım: /api/piyasa-fiyatlar?tip=altin|kripto|petrol|kur|altinapi`,
    });
  }

  res.setHeader("Cache-Control", conf.cacheControl);
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = req.query.debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, conf.anahtar, conf.ttl, conf.fn, { debug });
    return res.status(200).json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(conf.anahtar);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}
