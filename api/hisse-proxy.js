// api/hisse-proxy.js
const XK100_KODLARI = new Set([
  "ASELS","TUPRS","BIMAS","EREGL","KTLEV","GUBRF","MAGEN","ISDMR","ENJSA",
  "SASA","KCHOL","TOASO","FROTO","TTRAK","TSKB","YKBNK","SAHOL","SISE",
  "AKBNK","GARAN","ISCTR","VAKBN","HALKB","ALARK","AEFES","ARCLK","THYAO",
  "PGSUS","TCELL","TURK","TAVHL","PETKM","BRISA","CCOLA","DOHOL","EKGYO",
  "ENKAI","GESAN","SARKY","SELEC","MGROS","OTKAR","RYSAS","TTRAK","TKFEN",
  "TKNSA","TMSN","TRKCM","TURSG","ULKER","YEOTK","ZOREN","AGHOL","AKSA",
  "ATATP","BSOKE","CEMTS","DAPGM","DARDL","DCTTR","EKGYO","FORMT","GENIL",
  "GENTS","GRSEL","IDGYO","KBORU","OBAMS","PAGYO","PNLSN","POLHO","RGYAS",
  "RNPOL","SANEL","SARKY","SURGY","TARKM","TUREX","TUKAS","ULAS","VRGYO",
  "BIENY","CIMSA","DENGE","HEKTS","IHLGM","PETKM","KRDMD","ALBRK",
  "CCOLA","ANSGR","ENJSA","CLEBI","ASUZU","DOHOL","ARCLK","GRSEL",
]);

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Paralel: screener (temel veriler) + stocks/list (fiyat)
    const [screenerRes, listRes] = await Promise.all([
      fetch("https://fonoloji.com/v1/screener/bist?sort_by=market_cap&sort_order=desc&limit=200", { headers }),
      fetch("https://fonoloji.com/v1/stocks/list", { headers }),
    ]);

    if (!screenerRes.ok) throw new Error(`Screener hatası: ${screenerRes.status}`);

    const screenerData = await screenerRes.json();
    const screenerListe = screenerData.stocks ?? screenerData.items ?? screenerData.data ?? (Array.isArray(screenerData) ? screenerData : []);

    // Fiyat map'i oluştur
    const fiyatMap = {};
    if (listRes.ok) {
      const listData = await listRes.json();
      const listListe = listData.stocks ?? listData.items ?? listData.data ?? (Array.isArray(listData) ? listData : []);
      for (const s of listListe) {
        const ticker = s.ticker || s.symbol || "";
        if (ticker) {
          fiyatMap[ticker] = {
            fiyat:   s.price || s.last_price || s.close || 0,
            degisim: parseFloat((s.change_percent || s.daily_change || 0).toFixed(2)),
            piyasaDegeri: s.market_cap || 0,
          };
        }
      }
    }

    const hisseler = screenerListe.map(h => {
      const ticker = h.ticker || h.symbol || "";
      const fiyatBilgi = fiyatMap[ticker] || {};
      return {
        ticker,
        sirket:       h.name || h.company_name || "",
        sektor:       h.sector || "",
        fiyat:        fiyatBilgi.fiyat || 0,
        degisim:      fiyatBilgi.degisim || 0,
        piyasaDegeri: fiyatBilgi.piyasaDegeri || h.market_cap || 0,
        fk:           h.pe_ratio || h.pe || null,
        pddd:         h.pb_ratio || h.pb || null,
        roe:          h.return_on_equity || h.roe || null,
        temetu:       h.dividend_yield || null,
        katilimEndeksi: XK100_KODLARI.has(ticker),
      };
    });

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h => h.katilimEndeksi).length,
      guncelleme: new Date().toISOString(),
      data: hisseler,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
