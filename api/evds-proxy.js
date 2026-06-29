// api/evds-proxy.js - FINAL v3
// Doğrulanmış seri kodları (EVDS3, frequency=8 haftalık veya 9 aylık):
//
// HAFTALIK AKİM (frequency=8):
// TP.KTF10  → Konut - Tüm Mevduat+Kalkınma+Yatırım Bankaları
// TP.KTF11  → Taşıt - Tüm
// TP.KTF12  → İhtiyaç - Tüm
// TP.KTF17  → Katılım - Konut kâr oranı
// TP.KTF171 → Katılım - Taşıt
// TP.KTF172 → Katılım - İhtiyaç
// TP.KTF101 → Kamu Bankaları - Konut
//
// AYLIK STOK (frequency=9):
// TP_BKR_TRY_KTF10 → Konut - Mevduat Bankaları (stok)
// TP_BKR_TRY_17    → Taşıt - Mevduat Bankaları
// TP_BKR_TRY_18    → İhtiyaç - Mevduat Bankaları
// TP_KKP_TRY_KTF10 → Konut - Katılım (stok)
// TP_KKP_TRY_17    → Taşıt - Katılım
// TP_KKP_TRY_18    → İhtiyaç - Katılım
// TP_KBK_TRY_KBTF10→ Konut - Kamu Bankaları (stok)
// TP_KBK_TRY_17    → Taşıt - Kamu
// TP_KBK_TRY_18    → İhtiyaç - Kamu
// TP_MT210AGS_TRY_MT01 → TL Mevduat faizi (stok)

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";
const CACHE_TTL_MS = 12 * 3600 * 1000;
let cacheAnlik = { data: null, ts: 0 };
let cacheTarihsel = {};

// Haftalık seriler (nokta formatı)
const HAFTALIK = ["TP.KTF10","TP.KTF11","TP.KTF12","TP.KTF17","TP.KTF171","TP.KTF172","TP.KTF101"];
// Aylık seriler (alt çizgi formatı - EVDS'de bu şekilde)
const AYLIK = ["TP_BKR_TRY_KTF10","TP_BKR_TRY_17","TP_BKR_TRY_18",
               "TP_KKP_TRY_KTF10","TP_KKP_TRY_17","TP_KKP_TRY_18",
               "TP_KBK_TRY_KBTF10","TP_KBK_TRY_17","TP_KBK_TRY_18",
               "TP_MT210AGS_TRY_MT01"];

function tarihStr(d) {
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function onceki(gun) {
  const d = new Date(); d.setDate(d.getDate() - gun); return tarihStr(d);
}
function normalizeTarih(t) {
  if (!t) return t;
  const s = String(t);
  if (/^\d{4}-\d{2}$/.test(s)) { const [y,m]=s.split("-"); return `01-${m}-${y}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y,m,d]=s.split("-"); return `${d}-${m}-${y}`; }
  return s;
}
function sonDeger(items, seri) {
  const keys = [seri, seri.replace(/\./g,"_"), seri.replace(/_/g,".")];
  for (let i = items.length-1; i>=0; i--) {
    for (const k of keys) {
      const v = items[i][k];
      if (v !== null && v !== undefined && v !== "")
        return { deger: parseFloat(v), tarih: normalizeTarih(items[i].Tarih) };
    }
  }
  return null;
}
function tumDegerler(items, seri) {
  const keys = [seri, seri.replace(/\./g,"_"), seri.replace(/_/g,".")];
  return items.map(row => {
    for (const k of keys) {
      const v = row[k];
      if (v !== null && v !== undefined && v !== "")
        return { deger: parseFloat(v), tarih: normalizeTarih(row.Tarih) };
    }
    return null;
  }).filter(Boolean);
}
async function evdsFetch(url, apiKey) {
  const r = await fetch(url, { headers: { "key": apiKey, "Accept": "application/json" } });
  const text = await r.text();
  if (text.trim().startsWith("<")) throw new Error(`HTML döndü (HTTP ${r.status})`);
  return JSON.parse(text);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  const apiKey = process.env.EVDS_KEY;
  if (!apiKey) return res.status(500).json({ error: "EVDS_KEY eksik" });

  const { grafik, seri } = req.query;
  const now = Date.now();

  // GRAFİK MODU
  if (grafik === "1" && seri) {
    const c = cacheTarihsel[seri];
    if (c && now - c.ts < CACHE_TTL_MS)
      return res.status(200).json({ tarihsel: { [seri]: c.data }, cached: true });
    try {
      // Haftalık mi aylık mı?
      const isHaftalik = seri.includes(".");
      const freq = isHaftalik ? "8" : "9";
      const period = isHaftalik ? 180 : 400;
      const url = `${BASE}/series=${seri}&startDate=${onceki(period)}&endDate=${tarihStr(new Date())}&type=json&frequency=${freq}`;
      const json = await evdsFetch(url, apiKey);
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
    const [haftalikJson, aylikJson] = await Promise.all([
      evdsFetch(`${BASE}/series=${HAFTALIK.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=8`, apiKey),
      evdsFetch(`${BASE}/series=${AYLIK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=9`, apiKey),
    ]);

    const haftalikItems = haftalikJson?.items || [];
    const aylikItems = aylikJson?.items || [];

    const sonuclar = {};
    for (const s of HAFTALIK) sonuclar[s] = sonDeger(haftalikItems, s);
    for (const s of AYLIK) sonuclar[s] = sonDeger(aylikItems, s);

    const yanit = { tarih: tarihStr(new Date()), seriler: sonuclar };
    cacheAnlik = { data: yanit, ts: now };
    return res.status(200).json(yanit);
  } catch (err) {
    if (cacheAnlik.data)
      return res.status(200).json({ ...cacheAnlik.data, cached: true, hata: err.message });
    return res.status(500).json({ error: err.message });
  }
}
