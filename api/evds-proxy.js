// api/evds-proxy.js
// TCMB EVDS API proxy — CORS bypass + cache
// Vercel env: EVDS_KEY

const CACHE_TTL_MS = 12 * 3600 * 1000; // 12 saat
let cacheAnlik = { data: null, ts: 0 };
let cacheTarihsel = {};

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

function sonDeger(items, seri) {
  const key = seri.replace(/\./g, "_");
  for (let i = items.length - 1; i >= 0; i--) {
    const v = items[i][key] ?? items[i][seri];
    if (v !== null && v !== undefined && v !== "") {
      return { deger: parseFloat(v), tarih: items[i].Tarih };
    }
  }
  return null;
}

function tumDegerler(items, seri) {
  const key = seri.replace(/\./g, "_");
  return items.map(row => {
    const v = row[key] ?? row[seri];
    if (v !== null && v !== undefined && v !== "")
      return { deger: parseFloat(v), tarih: row.Tarih };
    return null;
  }).filter(Boolean);
}

async function evdsFetch(url) {
  const r = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    }
  });
  const text = await r.text();
  // HTML döndüyse hata ver
  if (text.trim().startsWith("<")) {
    throw new Error(`EVDS HTML döndü (HTTP ${r.status}) — seri kodu veya key hatalı olabilir`);
  }
  return JSON.parse(text);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key = process.env.EVDS_KEY;
  if (!key) return res.status(500).json({ error: "EVDS_KEY env eksik" });

  const { grafik, seri } = req.query;
  const now = Date.now();

  // ── GRAFİK MODU ──
  if (grafik === "1" && seri) {
    const c = cacheTarihsel[seri];
    if (c && now - c.ts < CACHE_TTL_MS)
      return res.status(200).json({ tarihsel: { [seri]: c.data }, cached: true });

    try {
      // EVDS3 doğru endpoint formatı
      const url = `https://evds3.tcmb.gov.tr/service/evds/series=${encodeURIComponent(seri)}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&key=${key}&frequency=8&aggregationTypes=avg&formulas=0&deleteNullValues=true`;
      const json = await evdsFetch(url);
      const items = json?.items || [];
      const degerler = tumDegerler(items, seri);
      cacheTarihsel[seri] = { data: degerler, ts: now };
      return res.status(200).json({ tarihsel: { [seri]: degerler } });
    } catch (err) {
      const c2 = cacheTarihsel[seri];
      if (c2) return res.status(200).json({ tarihsel: { [seri]: c2.data }, cached: true, hata: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── ANLIK MOD ──
  if (cacheAnlik.data && now - cacheAnlik.ts < CACHE_TTL_MS)
    return res.status(200).json({ ...cacheAnlik.data, cached: true });

  try {
    const seriStr = SERILER_ANLIK.join("-");
    const url = `https://evds3.tcmb.gov.tr/service/evds/series=${seriStr}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&key=${key}&frequency=8&aggregationTypes=avg&formulas=0&deleteNullValues=true`;
    const json = await evdsFetch(url);
    const items = json?.items || [];
    if (!items.length) throw new Error("EVDS boş yanıt döndü — seri kodları kontrol edilmeli");

    const sonuclar = {};
    for (const s of SERILER_ANLIK) {
      sonuclar[s] = sonDeger(items, s);
    }
    const yanit = { tarih: tarihStr(new Date()), seriler: sonuclar };
    cacheAnlik = { data: yanit, ts: now };
    return res.status(200).json(yanit);
  } catch (err) {
    if (cacheAnlik.data)
      return res.status(200).json({ ...cacheAnlik.data, cached: true, hata: err.message });
    return res.status(500).json({ error: err.message });
  }
}
