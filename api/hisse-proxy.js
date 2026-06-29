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
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) return res.status(500).json({ success:false, error:"FONOLOJI_KEY yok" });

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Paralel: screener + market movers (günlük değişim içeriyor)
    const [sRes, mRes] = await Promise.all([
      fetch("https://fonoloji.com/v1/screener/bist?sort_by=market_cap&sort_order=desc&limit=200", { headers }),
      fetch("https://fonoloji.com/v1/market/stock-movers", { headers }),
    ]);

    if (!sRes.ok) throw new Error(`Screener: ${sRes.status}`);

    const sData = await sRes.json();
    const screener = sData.stocks ?? sData.items ?? sData.data ?? (Array.isArray(sData) ? sData : []);

    // Fiyat map'i - movers'dan doldur
    const fiyatMap = {};
    if (mRes.ok) {
      const mData = await mRes.json();
      // movers yapısı: { gainers: [...], losers: [...] } veya düz dizi
      const gainers = mData.gainers ?? [];
      const losers  = mData.losers  ?? [];
      const all     = mData.stocks  ?? mData.items ?? (Array.isArray(mData) ? mData : []);
      for (const s of [...gainers, ...losers, ...all]) {
        const t = s.ticker || s.symbol || "";
        if (t && !fiyatMap[t]) fiyatMap[t] = s;
      }
    }

    const hisseler = screener.map(h => {
      const t = h.ticker || h.symbol || "";
      const f = fiyatMap[t] || {};
      return {
        ticker:       t,
        sirket:       h.name || h.company_name || "",
        sektor:       h.sector || "",
        fiyat:        f.price ?? f.last_price ?? f.close ?? 0,
        degisim1g:    parseFloat((f.change_percent ?? f.return_1d ?? f.daily_change ?? 0).toFixed(2)),
        degisim1h:    f.return_1w ?? null,
        degisim1a:    f.return_1m ?? null,
        degisim3a:    f.return_3m ?? null,
        degisim1y:    f.return_1y ?? null,
        piyasaDegeri: f.market_cap ?? h.market_cap ?? 0,
        fk:           h.pe_ratio ?? h.pe ?? null,
        pddd:         h.pb_ratio ?? h.pb ?? null,
        roe:          h.return_on_equity ?? h.roe ?? null,
        temetu:       h.dividend_yield ?? null,
        katilimEndeksi: XK100_KODLARI.has(t),
        _moversKeys:  Object.keys(f).slice(0,10).join(","),
      };
    });

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h=>h.katilimEndeksi).length,
      moversStatus: mRes.status,
      ornek_moversKeys: hisseler[0]?._moversKeys,
      guncelleme: new Date().toISOString(),
      data: hisseler,
    });

  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
}
