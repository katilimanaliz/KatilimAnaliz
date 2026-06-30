const XK100_KODLARI = new Set([
  "ASELS","TUPRS","BIMAS","EREGL","KTLEV","GUBRF","MAGEN","ISDMR","ENJSA",
  "SASA","KCHOL","TOASO","FROTO","TTRAK","TSKB","YKBNK","SAHOL","SISE",
  "AKBNK","GARAN","ISCTR","VAKBN","HALKB","ALARK","AEFES","ARCLK","THYAO",
  "PGSUS","TCELL","TAVHL","PETKM","BRISA","CCOLA","DOHOL","EKGYO","ENKAI",
  "GESAN","SARKY","SELEC","MGROS","OTKAR","RYSAS","TTRAK","TKFEN","TKNSA",
  "TURSG","ULKER","YEOTK","ZOREN","AGHOL","AKSA","ATATP","BSOKE","CEMTS",
  "DAPGM","DARDL","DCTTR","FORMT","GENIL","GENTS","GRSEL","IDGYO","KBORU",
  "OBAMS","PAGYO","PNLSN","POLHO","RGYAS","RNPOL","SANEL","SURGY","TARKM",
  "TUREX","TUKAS","ULAS","VRGYO","BIENY","CIMSA","DENGE","HEKTS","IHLGM",
  "KRDMD","ASUZU","ARCLK","GRSEL","ALBRK","ANSGR","CLEBI","DOHOL",
]);

const CACHE_TTL = 12 * 3600 * 1000; // şirket adları 12 saat cache
let isimCache = { data: null, ts: 0 };

async function sirketIsimleriniGetir() {
  const now = Date.now();
  if (isimCache.data && now - isimCache.ts < CACHE_TTL) return isimCache.data;

  try {
    const r = await fetch("https://bigpara.hurriyet.com.tr/api/v1/hisse/list", {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    if (!r.ok) return isimCache.data || {};
    const json = await r.json();
    const liste = json?.data || [];

    const isimMap = {};
    for (const h of liste) {
      if (h.kod && h.ad) isimMap[h.kod] = h.ad;
    }
    isimCache = { data: isimMap, ts: now };
    return isimMap;
  } catch (e) {
    return isimCache.data || {};
  }
}

export default async function handler(req, res) {
  try {
    const debug = req.query.debug === "1";

    const [midasRes, isimMap] = await Promise.all([
      fetch("https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data?sortId=&return=table", {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      }),
      sirketIsimleriniGetir(),
    ]);

    let midasListe = [];
    if (midasRes.ok) {
      const text = await midasRes.text();
      try {
        const parsed = JSON.parse(text);
        midasListe = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
        if (!Array.isArray(midasListe)) midasListe = [];
      } catch(e) {}
    }

    if (debug) {
      return res.status(200).json({
        midas_kayit_sayisi: midasListe.length,
        isim_kaynagi_kayit_sayisi: Object.keys(isimMap).length,
        eslesen_ornek: midasListe.slice(0, 5).map(h => ({
          kod: h.Code,
          bulunan_isim: isimMap[h.Code] || "BULUNAMADI"
        })),
      });
    }

    const hisseler = midasListe
      .filter(h => h.Code && !h.Code.startsWith("X"))
      .map(h => {
        const kod = h.Code;
        return {
          ticker:       kod,
          sirket:       isimMap[kod] || kod,
          sektor:       "",
          fiyat:        h.Last || h.Close || 0,
          degisim1g:    parseFloat((h.DailyChangePercent || 0).toFixed(2)),
          degisim1h:    h.WeeklyChangePercent != null ? parseFloat(h.WeeklyChangePercent.toFixed(2)) : null,
          degisim1a:    (h.MOMChangePercent ?? h.MonthlyChangePercent) != null
                          ? parseFloat((h.MOMChangePercent ?? h.MonthlyChangePercent).toFixed(2)) : null,
          degisim1y:    (h.YearlyChangePercent ?? h.YearlyChange) != null
                          ? parseFloat((h.YearlyChangePercent ?? h.YearlyChange).toFixed(2)) : null,
          yuksek:       h.High || 0,
          dusuk:        h.Low || 0,
          hacim:        h.TotalVolume || 0,
          piyasaDegeri: h.MarketValue || 0,
          fk:           h.PriceEarning || null,
          pddd:         h.PriceBookValue || null,
          roe:          h.ReturnOnEquity != null ? h.ReturnOnEquity * 100 : null,
          temetu:       null,
          katilimEndeksi: XK100_KODLARI.has(kod),
        };
      })
      .sort((a,b) => (b.piyasaDegeri||0) - (a.piyasaDegeri||0));

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h=>h.katilimEndeksi).length,
      guncelleme: new Date().toISOString(),
      data: hisseler,
    });

  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
}
