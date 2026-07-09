// api/getiri.js
//
// İki işlem tek dosyada (Vercel 12 fonksiyon sınırı nedeniyle):
//
// 1) Getiri Karşılaştırma verisi:
//    GET /api/getiri?aralik=1hafta|1ay|3ay|6ay|1yil|ybb[&ekstra=SYM1,SYM2]
//    → { basarili, aralik, donem, getiriler:[{kod,ad,getiri,ilk,son}], ekstraGetiriler }
//
// 2) Haftalık Piyasa Özeti (arşivli):
//    GET /api/getiri?islem=haftalik-ozet
//    → { basarili, guncel:{hafta,donem,satirlar,fonHafta}, arsiv:[...] }
//    Bu haftanın anlık verisi hesaplanır ve Redis'te hafta anahtarıyla saklanır;
//    arşivde HER ZAMAN son 4 hafta tutulur (yeni hafta gelince en eski silinir).
//
// Veri kaynağı: Yahoo Finance v8 chart API. Gram Altın/Gümüş sentetik:
// (ons USD) × (USD/TRY) / 31.1034768.

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const ARALIK_MAP = {
  "1hafta": "5d", // Yahoo'da 1 hafta = son 5 işlem günü
  "1ay":  "1mo",
  "3ay":  "3mo",
  "6ay":  "6mo",
  "1yil": "1y",
  "ybb":  "ytd",
};

async function yahooGetiri(sembol, range, p1, p2) {
  // p1/p2 (unix sn) verilirse sabit tarih penceresi, verilmezse range kullanılır
  const q = p1 && p2
    ? `period1=${p1}&period2=${p2}&interval=1d`
    : `range=${range}&interval=1d`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?${q}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const sonuc = j?.chart?.result?.[0];
  const kapanis = sonuc?.indicators?.quote?.[0]?.close;
  const zamanlar = sonuc?.timestamp;
  if (!Array.isArray(kapanis)) return null;
  const seri = [];
  for (let i = 0; i < kapanis.length; i++) {
    const v = kapanis[i];
    if (typeof v === "number" && isFinite(v)) {
      seri.push({ f: v, t: Array.isArray(zamanlar) ? zamanlar[i] : null });
    }
  }
  if (seri.length < 2) return null;
  const ilk = seri[0];
  const son = seri[seri.length - 1];
  if (!ilk.f) return null;
  return {
    getiri: (son.f - ilk.f) / ilk.f,
    ad: sonuc?.meta?.shortName || sonuc?.meta?.symbol || sembol,
    ilk: ilk.f,
    son: son.f,
    ilkTs: ilk.t,
    sonTs: son.t,
  };
}

const yzd = (v) => (v == null ? null : Math.round(v * 10000) / 100);

// Ana enstrüman setini verilen aralık (veya sabit p1/p2 penceresi) için hesaplar
async function hesaplaGetiriler(range, ekstraSemboller = [], p1, p2) {
  const [usd, eur, onsAltin, onsGumus, xu100, xk100, ...ekstraSonuclar] = await Promise.all([
    yahooGetiri("USDTRY=X", range, p1, p2),
    yahooGetiri("EURTRY=X", range, p1, p2),
    yahooGetiri("GC=F", range, p1, p2),
    yahooGetiri("SI=F", range, p1, p2),
    yahooGetiri("XU100.IS", range, p1, p2),
    yahooGetiri("XK100.IS", range, p1, p2),
    ...ekstraSemboller.map((s) => yahooGetiri(s, range, p1, p2)),
  ]);

  const gramAltin =
    onsAltin?.getiri != null && usd?.getiri != null
      ? (1 + onsAltin.getiri) * (1 + usd.getiri) - 1
      : null;
  const gramGumus =
    onsGumus?.getiri != null && usd?.getiri != null
      ? (1 + onsGumus.getiri) * (1 + usd.getiri) - 1
      : null;

  const OZ = 31.1034768;
  const gAltinIlk = onsAltin && usd ? (onsAltin.ilk * usd.ilk) / OZ : null;
  const gAltinSon = onsAltin && usd ? (onsAltin.son * usd.son) / OZ : null;
  const gGumusIlk = onsGumus && usd ? (onsGumus.ilk * usd.ilk) / OZ : null;
  const gGumusSon = onsGumus && usd ? (onsGumus.son * usd.son) / OZ : null;

  const getiriler = [
    { kod: "USDTRY",     ad: "USD/TRY",          getiri: yzd(usd?.getiri),      ilk: usd?.ilk ?? null,      son: usd?.son ?? null },
    { kod: "EURTRY",     ad: "EUR/TRY",          getiri: yzd(eur?.getiri),      ilk: eur?.ilk ?? null,      son: eur?.son ?? null },
    { kod: "ONS_ALTIN",  ad: "Ons Altın ($)",    getiri: yzd(onsAltin?.getiri), ilk: onsAltin?.ilk ?? null, son: onsAltin?.son ?? null },
    { kod: "GRAM_ALTIN", ad: "Gram Altın (₺)",   getiri: yzd(gramAltin),        ilk: gAltinIlk,             son: gAltinSon },
    { kod: "ONS_GUMUS",  ad: "Ons Gümüş ($)",    getiri: yzd(onsGumus?.getiri), ilk: onsGumus?.ilk ?? null, son: onsGumus?.son ?? null },
    { kod: "GRAM_GUMUS", ad: "Gram Gümüş (₺)",   getiri: yzd(gramGumus),        ilk: gGumusIlk,             son: gGumusSon },
    { kod: "XU100",      ad: "BIST 100",         getiri: yzd(xu100?.getiri),    ilk: xu100?.ilk ?? null,    son: xu100?.son ?? null },
    { kod: "XK100",      ad: "Katılım Endeksi",  getiri: yzd(xk100?.getiri),    ilk: xk100?.ilk ?? null,    son: xk100?.son ?? null },
  ];

  const ekstraGetiriler = ekstraSemboller.map((sembol, i) => ({
    sembol,
    ad: ekstraSonuclar[i]?.ad || sembol,
    getiri: yzd(ekstraSonuclar[i]?.getiri),
    ilk: ekstraSonuclar[i]?.ilk ?? null,
    son: ekstraSonuclar[i]?.son ?? null,
  }));

  const ref = usd || xu100 || eur;
  const donem = {
    ilkTarih: ref?.ilkTs ? new Date(ref.ilkTs * 1000).toISOString() : null,
    sonTarih: ref?.sonTs ? new Date(ref.sonTs * 1000).toISOString() : null,
  };

  return { getiriler, ekstraGetiriler, donem };
}

// ISO hafta anahtarı: "2026-W28" — arşivde haftaları ayırt etmek için
function isoHafta(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const gun = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - gun);
  const yilBasi = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const hafta = Math.ceil(((t - yilBasi) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(hafta).padStart(2, "0")}`;
}

// Para piyasası katılım fonlarının haftalık ortalaması (kendi tefas-proxy'mizden)
async function fonHaftalikOrt(host) {
  try {
    const r = await fetch(`https://${host}/api/tefas-proxy`);
    if (!r.ok) return null;
    const j = await r.json();
    const fonlar = (j?.data || []).filter((f) => {
      const kat = String(f.kategori || "").toLocaleUpperCase("tr-TR");
      const ad = String(f.ad || "").toLocaleUpperCase("tr-TR");
      return kat.includes("PARA") || ad.includes("PARA");
    });
    const v = fonlar.map((f) => f?.haftalik).filter((x) => typeof x === "number" && isFinite(x) && x !== 0);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
  } catch {
    return null;
  }
}

const ARSIV_ANAHTAR = "haftalikOzetArsiv";
const ARSIV_BOYU = 4; // her zaman son 4 hafta tutulur

async function haftalikOzet(req, res) {
  // Yazma yapan işlem — CDN'de kısa cache yeterli
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");

  // ── Hedef hafta: HER ZAMAN son TAMAMLANMIŞ Pazartesi–Cuma haftası ──
  // Kural (Türkiye saatiyle): hafta içi (Pzt–Cum) bir ÖNCEKİ haftanın
  // Pzt–Cum'u gösterilir; Cumartesi'den itibaren yeni biten hafta gösterilir.
  // Örn: 9 Temmuz Perşembe → 29 Haz–3 Tem; 11 Temmuz Cumartesi → 6–10 Tem.
  const trSimdi = new Date(Date.now() + 3 * 3600 * 1000); // UTC+3
  const gun = trSimdi.getUTCDay(); // 0=Paz ... 6=Cmt
  let pazartesiyeGeri;
  if (gun === 6) pazartesiyeGeri = 5;        // Cumartesi → bu haftanın Pzt'si
  else if (gun === 0) pazartesiyeGeri = 6;   // Pazar → bu haftanın Pzt'si
  else pazartesiyeGeri = (gun - 1) + 7;      // Pzt–Cum → önceki haftanın Pzt'si
  const pzt = new Date(Date.UTC(trSimdi.getUTCFullYear(), trSimdi.getUTCMonth(), trSimdi.getUTCDate() - pazartesiyeGeri));
  const p1 = Math.floor(pzt.getTime() / 1000);            // Pazartesi 00:00 UTC
  const p2 = p1 + 5 * 86400 + 43200;                      // Cumartesi 12:00 UTC (Cuma kapanışı dahil)
  const hafta = isoHafta(pzt);

  // Arşivi oku — hedef hafta zaten kayıtlıysa OLDUĞU GİBİ kullan.
  // (Tamamlanmış haftanın fiyatları değişmez; yeniden hesaplamak hem gereksiz
  // hem de fon ortalamasını sonraki haftanın verisiyle bozabilir.)
  let arsiv = [];
  try {
    const ham = await redis.get(ARSIV_ANAHTAR);
    if (Array.isArray(ham)) arsiv = ham;
    else if (typeof ham === "string") arsiv = JSON.parse(ham) || [];
  } catch {}

  let guncel = arsiv.find((k) => k && k.hafta === hafta && Array.isArray(k.satirlar) && k.satirlar.length > 0);

  if (!guncel) {
    const { getiriler, donem } = await hesaplaGetiriler(null, [], p1, p2);
    const fonHafta = await fonHaftalikOrt(req.headers.host);
    guncel = {
      hafta,
      donem,
      satirlar: getiriler.filter((g) => g.getiri != null),
      fonHafta,
      guncellemeTs: Date.now(),
    };
    // Sadece geçerli veri geldiyse arşive yaz
    if (guncel.satirlar.length > 0) {
      const yeni = [...arsiv.filter((k) => k && k.hafta !== hafta), guncel]
        .sort((a, b) => String(a.hafta).localeCompare(String(b.hafta)))
        .slice(-ARSIV_BOYU); // en eski hafta otomatik düşer (her zaman son 4)
      try { await redis.set(ARSIV_ANAHTAR, JSON.stringify(yeni)); } catch {}
      arsiv = yeni;
    }
  }

  const gecmis = arsiv
    .filter((k) => k && k.hafta !== hafta)
    .sort((a, b) => String(b.hafta).localeCompare(String(a.hafta)));

  res.status(200).json({ basarili: true, guncel, arsiv: gecmis });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    if (String(req.query?.islem || "") === "haftalik-ozet") {
      await haftalikOzet(req, res);
      return;
    }

    // ── Standart getiri karşılaştırma akışı ──
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

    const aralik = String(req.query?.aralik || "1ay");
    const range = ARALIK_MAP[aralik];
    if (!range) {
      res.status(400).json({ basarili: false, hata: "Geçersiz aralık. 1hafta|1ay|3ay|6ay|1yil|ybb" });
      return;
    }

    const ekstraHam = String(req.query?.ekstra || "");
    const ekstraSemboller = ekstraHam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s.length <= 15 && /^[A-Z0-9.\-=^]+$/.test(s))
      .slice(0, 8);

    const { getiriler, ekstraGetiriler, donem } = await hesaplaGetiriler(range, ekstraSemboller);

    res.status(200).json({ basarili: true, aralik, donem, getiriler, ekstraGetiriler });
  } catch (e) {
    console.error("getiri.js hatası:", e);
    res.status(500).json({ basarili: false, hata: "Sunucu hatası", detay: String(e) });
  }
}
