// api/piyasa-haberleri.js
// Kaynak: Forex Factory haftalık ekonomik takvim (resmi CDN, key gerektirmez)
const CACHE_TTL = 3 * 3600 * 1000; // 3 saat
let cache = { data: null, ts: 0 };

const ULKE_TR = {
  USD: "ABD", EUR: "Euro Bölgesi", GBP: "İngiltere", JPY: "Japonya",
  CNY: "Çin", CHF: "İsviçre", CAD: "Kanada", AUD: "Avustralya",
  NZD: "Yeni Zelanda", TRY: "Türkiye", ALL: "Tüm Ülkeler",
};

const ETKI_TR = { High: "Yüksek", Medium: "Orta", Low: "Düşük", Holiday: "Tatil" };
const ETKI_RENK = { High: "#D32F2F", Medium: "#F57C00", Low: "#388E3C", Holiday: "#757575" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=3600");

  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const r = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();

    const olaylar = (Array.isArray(raw) ? raw : [])
      .filter(e => e.impact === "High" || e.impact === "Medium")
      .map(e => ({
        tarih: e.date,           // ISO string
        ulke: e.country,
        ulkeAdi: ULKE_TR[e.country] || e.country,
        baslik: e.title,
        etki: e.impact,
        etkiAdi: ETKI_TR[e.impact] || e.impact,
        etkiRenk: ETKI_RENK[e.impact] || "#757575",
        tahmin: e.forecast || null,
        onceki: e.previous || null,
        gerceklesen: e.actual || null,
      }))
      .sort((a, b) => new Date(a.tarih) - new Date(b.tarih));

    const yanit = {
      success: true,
      count: olaylar.length,
      guncelleme: new Date().toISOString(),
      data: olaylar,
    };
    cache = { data: yanit, ts: now };
    return res.status(200).json(yanit);

  } catch (e) {
    if (cache.data) return res.status(200).json({ ...cache.data, cached: true, hata: e.message });
    return res.status(500).json({ success: false, error: e.message });
  }
}
