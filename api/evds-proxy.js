// api/evds-proxy.js
// TCMB EVDS3 API proxy
// Endpoint: evds3.tcmb.gov.tr/igmevdsms-dis/
// Key: HTTP header

const CACHE_TTL_MS = 12 * 3600 * 1000;
let cacheAnlik = { data: null, ts: 0 };
let cacheTarihsel = {};

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";

const SERILER_ANLIK = [
  "TP.KTF10","TP.KTF101","TP.KTF102","TP.KTF103",
  "TP.KTF11","TP.KTF111","TP.KTF112","TP.KTF113",
  "TP.KTF12","TP.KTF121","TP.KTF122","TP.KTF123",
  "TP.KTF17","TP.KTF171","TP.KTF172",
  "TP.TL.MT3","TP.TL.MT3.K","TP.TL.MT3.O","TP.TL.MT3.KT",
];

function tarihStr(d) {
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function onceki(gun) {
  const d = new Date(); d.setDate(d.getDate() - gun); return tarihStr(d);
}

// EVDS tarihi "2026-5" veya "2026-06-13" formatında gelebiliyor
// Normalize et → "13-06-2026"
function normalizeTarih(t) {
  if (!t) return t;
  // "2026-5" (yıl-hafta) → olduğu gibi bırak, UI handle eder
  // "2026-06-13" → "13-06-2026"
  const parts = t.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return t; // haftalık format (2026-5 gibi) aynen dön
}

function sonDeger(items, seri) {
  const key = seri.replace(/\./g, "_");
  for (let i = items.length - 1; i >= 0; i--) {
    const v = items[i][key] ?? items[i][seri];
    if (v !== null && v !== undefined && v !== "")
      return { deger: parseFloat(v), tarih: normalizeTarih(items[i].Tarih) };
  }
  return null;
}

function tumDegerler(items, seri) {
  const key = seri.replace(/\./g, "_");
  return items.map(row => {
    const v = row[key] ?? row[seri];
    if (v !== null && v !== undefined && v !== "")
      return { deger: parseFloat(v), tarih: normalizeTarih(row.Tarih) };
    return null;
  }).filter(Boolean);
}

async function evdsFetch(path, apiKey) {
  const url = `${BASE}/${path}`;
  const r = await fetch(url, {
    headers: { "key": apiKey, "Accept": "application/json" }
  });
  const text = await r.text();
  if (text.trim().startsWith("<"))
    throw new Error(`HTML döndü (HTTP ${r.status})`);
  return JSON.parse(text);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.EVDS_KEY;
  if (!apiKey) return res.status(500).json({ error: "EVDS_KEY env eksik" });

  const { grafik, seri } = req.query;
  const now = Date.now();

  // ── GRAFİK MODU: tek seri, 12 hafta tarihsel ──
  if (grafik === "1" && seri) {
    const c = cacheTarihsel[seri];
    if (c && now - c.ts < CACHE_TTL_MS)
      return res.status(200).json({ tarihsel: { [seri]: c.data }, cached: true });
    try {
      const path = `series=${seri}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=8&aggregationTypes=avg&formulas=0&deleteNullValues=true`;
      const json = await evdsFetch(path, apiKey);
      const items = json?.items || [];
      const degerler = tumDegerler(items, seri);
      cacheTarihsel[seri] = { data: degerler, ts: now };
      return res.status(200).json({ tarihsel: { [seri]: degerler } });
    } catch (err) {
      const c2 = cacheTarihsel[seri];
      if (c2) return res.status(200).json({ tarihsel: { [seri]: c2.data }, cached: true });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── ANLIK MOD: tüm seriler son değer ──
  if (cacheAnlik.data && now - cacheAnlik.ts < CACHE_TTL_MS)
    return res.status(200).json({ ...cacheAnlik.data, cached: true });

  try {
    const seriStr = SERILER_ANLIK.join("-");
    const path = `series=${seriStr}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=8&aggregationTypes=avg&formulas=0&deleteNullValues=true`;
    const json = await evdsFetch(path, apiKey);
    const items = json?.items || [];
    if (!items.length) throw new Error("EVDS boş yanıt — seri kodları hatalı olabilir");

    const sonuclar = {};
    for (const s of SERILER_ANLIK) sonuclar[s] = sonDeger(items, s);

    const yanit = { tarih: tarihStr(new Date()), seriler: sonuclar };
    cacheAnlik = { data: yanit, ts: now };
    return res.status(200).json(yanit);
  } catch (err) {
    if (cacheAnlik.data)
      return res.status(200).json({ ...cacheAnlik.data, cached: true, hata: err.message });
    return res.status(500).json({ error: err.message });
  }
}
