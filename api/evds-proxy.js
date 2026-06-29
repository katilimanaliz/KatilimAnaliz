// api/evds-proxy.js
// TCMB EVDS API proxy — CORS bypass + cache
// Vercel env: EVDS_KEY

const CACHE_TTL_SAAT = 12;
let cacheAnlik = { data: null, ts: 0 };
let cacheTarihsel = {}; // seriKodu → { data, ts }

// Anlık seri listesi
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

function oncekiTarih(gun) {
  const d = new Date();
  d.setDate(d.getDate() - gun);
  return tarihStr(d);
}

function sonDeger(items, seri) {
  const key = seri.replace(/\./g,"_");
  for (let i = items.length - 1; i >= 0; i--) {
    const row = items[i];
    const val = row[key] ?? row[seri];
    if (val !== null && val !== undefined && val !== "") {
      return { deger: parseFloat(val), tarih: row.Tarih };
    }
  }
  return null;
}

function tumDegerler(items, seri) {
  const key = seri.replace(/\./g,"_");
  return items
    .map(row => {
      const val = row[key] ?? row[seri];
      if (val !== null && val !== undefined && val !== "") {
        return { deger: parseFloat(val), tarih: row.Tarih };
      }
      return null;
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if (req.method==="OPTIONS") return res.status(200).end();

  const key = process.env.EVDS_KEY;
  if (!key) return res.status(500).json({ error: "EVDS_KEY env eksik" });

  const { grafik, seri } = req.query;
  const now = Date.now();
  const TTL = CACHE_TTL_SAAT * 3600 * 1000;

  // ── GRAFİK MODU: tek seri tarihsel (12 hafta = ~84 gün) ──
  if (grafik === "1" && seri) {
    const c = cacheTarihsel[seri];
    if (c && now - c.ts < TTL) {
      return res.status(200).json({ tarihsel: { [seri]: c.data }, cached: true });
    }
    try {
      const url = `https://evds3.tcmb.gov.tr/service/evds/series=${seri}`
        + `&startDate=${oncekiTarih(90)}&endDate=${tarihStr(new Date())}`
        + `&type=json&key=${key}&frequency=8`;
      const r = await fetch(url, { headers: { Accept: "application/json" }});
      if (!r.ok) throw new Error(`EVDS HTTP ${r.status}`);
      const json = await r.json();
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
  if (cacheAnlik.data && now - cacheAnlik.ts < TTL) {
    return res.status(200).json({ ...cacheAnlik.data, cached: true });
  }
  try {
    const seriStr = SERILER_ANLIK.join("-");
    const url = `https://evds3.tcmb.gov.tr/service/evds/series=${seriStr}`
      + `&startDate=${oncekiTarih(60)}&endDate=${tarihStr(new Date())}`
      + `&type=json&key=${key}&frequency=8`;
    const r = await fetch(url, { headers: { Accept: "application/json" }});
    if (!r.ok) throw new Error(`EVDS HTTP ${r.status}`);
    const json = await r.json();
    const items = json?.items || [];
    if (!items.length) throw new Error("EVDS boş yanıt");

    const sonuclar = {};
    for (const s of SERILER_ANLIK) {
      sonuclar[s] = sonDeger(items, s);
    }
    const yanit = { tarih: tarihStr(new Date()), seriler: sonuclar };
    cacheAnlik = { data: yanit, ts: now };
    return res.status(200).json(yanit);
  } catch (err) {
    if (cacheAnlik.data) return res.status(200).json({ ...cacheAnlik.data, cached: true, hata: err.message });
    return res.status(500).json({ error: err.message });
  }
}
