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

export default async function handler(req, res) {
  try {
    const FONOLOJI_KEY = process.env.FONOLOJI_KEY;

    const [midasRes, screenerRes] = await Promise.all([
      fetch("https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data?sortId=&return=table", {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      }),
      FONOLOJI_KEY ? fetch(
        "https://fonoloji.com/v1/screener/bist?sort_by=market_cap&sort_order=desc&limit=200",
        { headers: { "X-API-Key": FONOLOJI_KEY } }
      ) : Promise.resolve(null),
    ]);

    // Midas double-encoded JSON — text al, 2 kez parse et
    const fiyatMap = {};
    if (midasRes.ok) {
      const text = await midasRes.text();
      let liste = [];
      try {
        const parsed = JSON.parse(text);
        // Bazen string olarak geliyor, tekrar parse et
        liste = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
        if (!Array.isArray(liste)) liste = [];
      } catch(e) {}

      for (const h of liste) {
        const kod = h.Code || "";
        if (!kod || kod.startsWith("X")) continue; // Endeks kodları atla
        fiyatMap[kod] = {
          fiyat:      h.Last || h.Close || 0,
          degisim1g:  h.DailyChangePercent || 0,
          degisim1h:  h.WeeklyChangePercent ?? null,
          degisim1a:  h.MOMChangePercent ?? h.MonthlyChangePercent ?? null,
          degisim1y:  h.YearlyChangePercent ?? h.YearlyChange ?? null,
          yuksek:     h.High || 0,
          dusuk:      h.Low || 0,
          hacim:      h.TotalVolume || 0,
          fk:         h.PriceEarning || null, // Midas'ta F/K var!
          serbest:    h.FreeFloatRate || null,
        };
      }
    }

    // Fonoloji temel veriler
    const temelMap = {};
    if (screenerRes && screenerRes.ok) {
      const sData = await screenerRes.json();
      const liste = sData.stocks ?? sData.items ?? sData.data ?? [];
      for (const h of liste) {
        const t = h.ticker || "";
        if (t) temelMap[t] = {
          sirket:      h.name || "",
          sektor:      h.sector || "",
          fk:          h.pe_ratio ?? h.pe ?? null,
          pddd:        h.pb_ratio ?? h.pb ?? null,
          roe:         h.return_on_equity ?? h.roe ?? null,
          temetu:      h.dividend_yield ?? null,
          piyasaDegeri: h.market_cap || 0,
        };
      }
    }

    const hisseler = Object.entries(fiyatMap).map(([kod, f]) => {
      const t = temelMap[kod] || {};
      return {
        ticker:       kod,
        sirket:       t.sirket || kod,
        sektor:       t.sektor || "",
        fiyat:        f.fiyat,
        degisim1g:    parseFloat((f.degisim1g || 0).toFixed(2)),
        degisim1h:    f.degisim1h != null ? parseFloat(f.degisim1h.toFixed(2)) : null,
        degisim1a:    f.degisim1a != null ? parseFloat(f.degisim1a.toFixed(2)) : null,
        degisim1y:    f.degisim1y != null ? parseFloat(f.degisim1y.toFixed(2)) : null,
        yuksek:       f.yuksek,
        dusuk:        f.dusuk,
        hacim:        f.hacim,
        piyasaDegeri: t.piyasaDegeri || 0,
        fk:           t.fk ?? f.fk ?? null,
        pddd:         t.pddd ?? null,
        roe:          t.roe ?? null,
        temetu:       t.temetu ?? null,
        katilimEndeksi: XK100_KODLARI.has(kod),
      };
    }).sort((a,b) => (b.piyasaDegeri||0) - (a.piyasaDegeri||0));

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
