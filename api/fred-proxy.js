// api/fred-proxy.js
// SOFR → FRED: SOFR (Secured Overnight Financing Rate)
// EURIBOR 3M → FRED: EUR3MTD156N
// EURIBOR 6M → FRED: EUR6MTD156N
// API key gerektirmiyor, günlük güncelleme, T+1 gecikme

const CACHE_TTL = 12 * 3600 * 1000; // 12 saat
let cache = { data: null, ts: 0 };

const SERILER = [
  { id: "SOFR",        ad: "SOFR",        kaynak: "NY Fed" },
  { id: "EUR3MTD156N", ad: "EURIBOR 3M",  kaynak: "EMMI via FRED" },
  { id: "EUR6MTD156N", ad: "EURIBOR 6M",  kaynak: "EMMI via FRED" },
];

async function fredCsv(serieId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${serieId}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimAnaliz/1.0)" }
  });
  if (!r.ok) throw new Error(`FRED HTTP ${r.status} (${serieId})`);
  const text = await r.text();
  // CSV format: DATE,VALUE\n2026-06-27,5.31\n...
  const satirlar = text.trim().split("\n").slice(1); // başlık satırını atla
  // Sondan geriye doğru ilk geçerli değeri bul
  for (let i = satirlar.length - 1; i >= 0; i--) {
    const [tarih, deger] = satirlar[i].split(",");
    if (deger && deger.trim() !== "." && !isNaN(parseFloat(deger))) {
      return { tarih: tarih.trim(), deger: parseFloat(deger.trim()) };
    }
  }
  throw new Error(`FRED: ${serieId} için geçerli veri bulunamadı`);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL)
    return res.status(200).json({ ...cache.data, cached: true });

  try {
    const sonuclar = await Promise.allSettled(
      SERILER.map(s => fredCsv(s.id).then(v => ({ ...s, ...v })))
    );

    const veriler = {};
    sonuclar.forEach((r, i) => {
      const s = SERILER[i];
      if (r.status === "fulfilled") {
        veriler[s.id] = r.value;
      } else {
        veriler[s.id] = null; // hata durumunda null
      }
    });

    const yanit = { veriler, guncelleme: new Date().toISOString() };
    cache = { data: yanit, ts: now };
    return res.status(200).json(yanit);
  } catch (err) {
    if (cache.data) return res.status(200).json({ ...cache.data, cached: true, hata: err.message });
    return res.status(500).json({ error: err.message });
  }
}
