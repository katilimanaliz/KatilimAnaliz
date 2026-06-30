// api/fred-proxy.js
const CACHE_TTL = 12 * 3600 * 1000;
let cache = { data: null, ts: 0 };

const SERILER = [
  { id: "SOFR",        ad: "SOFR",        kaynak: "NY Fed" },
  { id: "EUR3MTD156N", ad: "EURIBOR 3M",  kaynak: "EMMI via FRED" },
  { id: "EUR6MTD156N", ad: "EURIBOR 6M",  kaynak: "EMMI via FRED" },
];

const TIMEOUT_MS = 8000; // her FRED isteği en fazla 5sn beklesin

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fredCsv(serieId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${serieId}`;
  let r;
  try {
    r = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/csv,*/*",
      }
    }, TIMEOUT_MS);
  } catch (e) {
    throw new Error(`FRED timeout/network hatası (${serieId}): ${e.message}`);
  }
  const text = await r.text();
  if (!r.ok) throw new Error(`FRED HTTP ${r.status} (${serieId})`);

  const satirlar = text.trim().split("\n").slice(1);
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

  const debug = req.query.debug === "1";
  const now = Date.now();
  if (!debug && cache.data && now - cache.ts < CACHE_TTL)
    return res.status(200).json({ ...cache.data, cached: true });

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
      hatalar[s.id] = r.reason?.message || "bilinmeyen hata";
    }
  });

  if (debug) {
    return res.status(200).json({ veriler, hatalar });
  }

  const yanit = { veriler, guncelleme: new Date().toISOString() };
  // En az bir seri başarılıysa cache'le
  if (Object.values(veriler).some(v => v !== null)) {
    cache = { data: yanit, ts: now };
  }
  return res.status(200).json(yanit);
}
