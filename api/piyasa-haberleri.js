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

// Sık geçen başlıkları Türkçeleştirmek için eşleştirme (kısmi eşleşme bazlı)
const BASLIK_CEVIRI = [
  [/interest rate decision/i, "Faiz Kararı"],
  [/rate decision/i, "Faiz Kararı"],
  [/press conference/i, "Basın Toplantısı"],
  [/\bCPI\b.*y\/y/i, "TÜFE (Yıllık)"],
  [/\bCPI\b.*m\/m/i, "TÜFE (Aylık)"],
  [/\bCPI\b/i, "TÜFE"],
  [/Core CPI/i, "Çekirdek TÜFE"],
  [/\bGDP\b.*q\/q/i, "GSYİH (Çeyreklik)"],
  [/\bGDP\b/i, "GSYİH"],
  [/Unemployment Rate/i, "İşsizlik Oranı"],
  [/Non-Farm Employment Change/i, "Tarım Dışı İstihdam"],
  [/Retail Sales m\/m/i, "Perakende Satışlar (Aylık)"],
  [/Retail Sales/i, "Perakende Satışlar"],
  [/Trade Balance/i, "Dış Ticaret Dengesi"],
  [/Industrial Production/i, "Sanayi Üretimi"],
  [/PPI\b/i, "ÜFE"],
  [/Consumer Confidence/i, "Tüketici Güveni"],
  [/Manufacturing PMI/i, "İmalat PMI"],
  [/Services PMI/i, "Hizmet PMI"],
  [/Speaks/i, "Konuşma Yapıyor"],
  [/Statement/i, "Açıklama"],
  [/Minutes/i, "Toplantı Tutanakları"],
  [/Building Permits/i, "İnşaat İzinleri"],
  [/Housing Starts/i, "Konut Başlangıçları"],
  [/Durable Goods Orders/i, "Dayanıklı Mal Siparişleri"],
  [/JOLTS Job Openings/i, "Açık İş Pozisyonları (JOLTS)"],
  [/ADP Non-Farm Employment Change/i, "ADP İstihdam Değişimi"],
  [/Prelim/i, "Öncü"],
  [/Final/i, "Nihai"],
];

function baslikCevir(baslik) {
  for (const [regex, ceviri] of BASLIK_CEVIRI) {
    if (regex.test(baslik)) {
      return baslik.replace(regex, ceviri);
    }
  }
  return baslik; // eşleşme yoksa orijinal kalsın
}

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

    // Önem sırası: TRY > USD/EUR (FED/ECB) > diğerleri
    const ONCELIKLI_ULKELER = new Set(["TRY", "USD", "EUR"]);

    const olaylar = (Array.isArray(raw) ? raw : [])
      .filter(e => (e.impact === "High" || e.impact === "Medium") && ONCELIKLI_ULKELER.has(e.country))
      .map(e => ({
        tarih: e.date,
        ulke: e.country,
        ulkeAdi: ULKE_TR[e.country] || e.country,
        baslik: baslikCevir(e.title),
        baslikOrijinal: e.title,
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
