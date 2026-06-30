// api/fred-proxy.js
const CACHE_TTL = 12 * 3600 * 1000;
let cache = { data: null, ts: 0 };

const SERILER = [
  { id: "SOFR",        ad: "SOFR",        kaynak: "NY Fed" },
  { id: "EUR3MTD156N", ad: "EURIBOR 3M",  kaynak: "EMMI via FRED" },
  { id: "EUR6MTD156N", ad: "EURIBOR 6M",  kaynak: "EMMI via FRED" },
];

async function fredCsv(serieId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${serieId}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept": "text/csv,*/*",
    }
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(`FRED HTTP ${r.status} (${serieId})`);
    err.detay = { status: r.status, body_ilk_300: text.slice(0,300) };
    throw err;
  }
  const satirlar = text.trim().split("\n").slice(1);
  for (let i = satirlar.length - 1; i >= 0; i--) {
    const [tarih, deger] = satirlar[i].split(",");
    if (deger && deger.trim() !== "." && !isNaN(parseFloat(deger))) {
      return { tarih: tarih.trim(), deger: parseFloat(deger.trim()) };
    }
  }
  const err = new Error(`FRED: ${serieId} için geçerli veri bulunamadı`);
  err.detay = { body_ilk_300: text.slice(0,300) };
  throw err;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = req.query.debug === "1";
  const now = Date.now();
  if (!debug && cache.data && now - cache.ts < CACHE_TTL)
    return res.status(200).json({ ...cache.data, cached: true });

  try {
    const sonuclar = await Promise.allSettled(
      SERILER.map(s => fredCsv(s.id).then(v => ({ ...s, ...v })))
    );

    const veriler = {};
    const hatalar = {};
    sonuclar.forEach((r, i) => {
      const s = SERILER[i];
      if (r.status === "fulfilled") {
        veriler[s.id] = r.value;
      } else {
        veriler[s.id] = null;
        hatalar[s.id] = { mesaj: r.reason?.message, detay: r.reason?.detay };
      }
    });

    if (debug) {
      return res.status(200).json({ veriler, hatalar });
    }

    const yanit = { veriler, guncelleme: new Date().toISOString() };
    cache = { data: yanit, ts: now };
    return res.status(200).json(yanit);
  } catch (err) {
    if (cache.data) return res.status(200).json({ ...cache.data, cached: true, hata: err.message });
    return res.status(500).json({ error: err.message });
  }
}
