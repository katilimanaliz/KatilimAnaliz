// api/evds-proxy.js - EVDS3 proxy

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
function normalizeTarih(t) {
  if (!t) return t;
  const parts = t.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return t;
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
  const r = await fetch(url, { headers: { "key": apiKey, "Accept": "application/json" } });
  const text = await r.text();
  if (text.trim().startsWith("<")) throw new Error(`HTML döndü (HTTP ${r.status})`);
  return JSON.parse(text);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Tüm env key'leri logla (debug)
  const apiKey = process.env.EVDS_KEY;
  const envKeys = Object.keys(process.env).filter(k => k.includes("EVDS") || k.includes("KEY"));

  if (!apiKey) {
    return res.status(500).json({
      error: "EVDS_KEY env eksik",
      bulunan_env_keys: envKeys,
      node_env: process.env.NODE_ENV,
    });
  }

  const { grafik, seri } = req.query;
  const now = Date.now();

  // GRAFİK MODU
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

  // ANLIK MOD
  if (cacheAnlik.data && now - cacheAnlik.ts < CACHE_TTL_MS)
    return res.status(200).json({ ...cacheAnlik.data, cached: true });

  try {
    const seriStr = SERILER_ANLIK.join("-");
    const path = `series=${seriStr}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=8&aggregationTypes=avg&formulas=0&deleteNullValues=true`;
    const json = await evdsFetch(path, apiKey);
    const items = json?.items || [];
    if (!items.length) throw new Error("EVDS boş yanıt");

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
