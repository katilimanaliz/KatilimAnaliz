// api/hisse-proxy.js
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
  "KRDMD","ASUZU","DOHOL","ARCLK","GRSEL","ALBRK","ANSGR",
]);

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) return res.status(500).json({ success:false, error:"FONOLOJI_KEY yok" });

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Paralel: screener (temel) + stocks/list (fiyat + değişimler)
    const [sRes, lRes] = await Promise.all([
      fetch("https://fonoloji.com/v1/screener/bist?sort_by=market_cap&sort_order=desc&limit=200", { headers }),
      fetch("https://fonoloji.com/v1/stocks/list", { headers }),
    ]);

    if (!sRes.ok) throw new Error(`Screener: ${sRes.status}`);

    const sData = await sRes.json();
    const screener = sData.stocks ?? sData.items ?? sData.data ?? (Array.isArray(sData) ? sData : []);

    // Fiyat + değişim map
    const fiyatMap = {};
    if (lRes.ok) {
      const lData = await lRes.json();
      const liste = lData.stocks ?? lData.items ?? lData.data ?? (Array.isArray(lData) ? lData : []);
      for (const s of liste) {
        const t = s.ticker || s.symbol || "";
        if (t) fiyatMap[t] = s; // ham veriyi sakla
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
        degisim1g:    f.change_percent ?? f.return_1d ?? f.daily_return ?? 0,
        degisim1h:    f.return_1w ?? f.weekly_return ?? null,
        degisim1a:    f.return_1m ?? f.monthly_return ?? null,
        degisim3a:    f.return_3m ?? null,
        degisim1y:    f.return_1y ?? f.yearly_return ?? null,
        piyasaDegeri: f.market_cap ?? h.market_cap ?? 0,
        fk:           h.pe_ratio ?? h.pe ?? null,
        pddd:         h.pb_ratio ?? h.pb ?? null,
        roe:          h.return_on_equity ?? h.roe ?? null,
        temetu:       h.dividend_yield ?? null,
        katilimEndeksi: XK100_KODLARI.has(t),
        // Debug: ham alan adları (ilk çalıştırmada görmek için)
        _fKeys: Object.keys(f).join(","),
      };
    });

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h=>h.katilimEndeksi).length,
      guncelleme: new Date().toISOString(),
      // İlk hissenin ham alanlarını göster
      debugKeys: Object.keys(fiyatMap[hisseler[0]?.ticker] || {}),
      data: hisseler,
    });

  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
}
