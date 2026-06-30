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

// Midas yanıtında şirket adı için olası alan adları
function sirketAdiBul(h) {
  return h.Name || h.StockName || h.Description || h.LongName ||
         h.CompanyName || h.Title || h.FullName || h.SecurityName ||
         h.Sirket || h.sirket_adi || null;
}

export default async function handler(req, res) {
  try {
    const debug = req.query.debug === "1";

    const midasRes = await fetch(
      "https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data?sortId=&return=table",
      { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } }
    );

    let midasListe = [];
    if (midasRes.ok) {
      const text = await midasRes.text();
      try {
        const parsed = JSON.parse(text);
        midasListe = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
        if (!Array.isArray(midasListe)) midasListe = [];
      } catch(e) {}
    }

    // DEBUG MODU: Midas'tan gelen ham kaydın tüm alanlarını göster
    if (debug) {
      return res.status(200).json({
        midas_ornek_kayit: midasListe[0] || null,
        midas_tum_alan_adlari: midasListe[0] ? Object.keys(midasListe[0]) : [],
        midas_kayit_sayisi: midasListe.length,
      });
    }

    const hisseler = midasListe
      .filter(h => h.Code && !h.Code.startsWith("X")) // endeks kodlarını atla
      .map(h => {
        const kod = h.Code;
        return {
          ticker:       kod,
          sirket:       sirketAdiBul(h) || kod,
          sektor:       h.Sector || h.SectorName || "",
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
          piyasaDegeri: h.MarketCap || h.MarketValue || 0,
          fk:           h.PriceEarning || null,
          pddd:         h.PriceToBookValue || h.PBRatio || null,
          roe:          h.ReturnOnEquity || h.ROE || null,
          temetu:       h.DividendYield || null,
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
