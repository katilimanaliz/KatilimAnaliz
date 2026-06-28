// api/hisse-proxy.js
// BIST Hisse Tarayıcı — Fonoloji /v1/screener/bist endpoint'i
// Katılım endeksi filtresi için XK100 kodları hardcode (3 ayda bir güncellenir)
// Vercel Cron: Her gün 08:31 TR (05:31 UTC) — vercel.json'a eklenecek

// BIST Katılım 100 Endeksi (XK100) — Mayıs 2026 - Ekim 2026 dönemi
// Kaynak: BIST + PDF değişiklik listesi
const XK100_KODLARI = new Set([
  "ASELS","TUPRS","BIMAS","EREGL","KTLEV","GUBRF","MAGEN","ISDMR","ENJSA",
  "SASA","KCHOL","TOASO","FROTO","TTRAK","TSKB","YKBNK","SAHOL","SISE",
  "AKBNK","GARAN","ISCTR","VAKBN","HALKB","ALARK","AEFES","ARCLK","THYAO",
  "PGSUS","TCELL","TURK","TAVHL","PETKM","BRISA","CCOLA","DOHOL","EKGYO",
  "ENKAI","GESAN","GOLTS","HEKTS","IPEKE","KRDMD","METRO","MGROS","NETAS",
  "OTKAR","PRKME","RYSAS","SARKY","SELEC","SILVR","TATGD","TCELL","TKFEN",
  "TKNSA","TMSN","TRILC","TRKCM","TURSG","ULKER","USAK","VESTL","YEOTK",
  "ZOREN","AGHOL","AGROT","AKENR","AKFGY","AKSA","ALGYO","ANSEN","ASUZU",
  "ATATP","BERA","BIENY","BINHO","BSOKE","BUCIM","CEMTS","CIMSA","DAPGM",
  "DARDL","DCTTR","DENGE","DNISI","EKGYO","FORMT","GENIL","GENTS","GRSEL",
  "IDGYO","IHLGM","KBORU","KTLEV","OBAMS","OFSYM","PAGYO","PNLSN","POLHO",
  "QUAGR","RGYAS","RNPOL","SANEL","SURGY","TARKM","TUREX","TUKAS","ULAS",
  "VRGYO","ZA2XX","CEMTS","BIENY","DCTTR","POLHO",
]);

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Tüm BIST hisselerini market cap'e göre sıralı çek (max 200)
    const [r1, r2] = await Promise.all([
      fetch("https://fonoloji.com/v1/screener/bist?sort_by=market_cap&sort_order=desc&limit=200", { headers }),
      fetch("https://fonoloji.com/v1/screener/bist/sectors", { headers }),
    ]);

    if (!r1.ok) throw new Error(`Fonoloji screener hatası: ${r1.status}`);

    const data = await r1.json();
    const sektorData = r2.ok ? await r2.json() : null;

    // Yanıt formatı: { stocks: [...] } veya dizi
    const liste = data.stocks ?? data.items ?? data.data ?? (Array.isArray(data) ? data : []);

    const hisseler = liste.map(h => ({
      ticker:      h.ticker || h.symbol || "",
      sirket:      h.name || h.company_name || "",
      sektor:      h.sector || "",
      fiyat:       h.price || h.last_price || 0,
      degisim:     parseFloat(((h.change_percent || h.daily_change || 0)).toFixed(2)),
      piyasaDegeri:h.market_cap || 0,
      fk:          h.pe_ratio || h.pe || null,
      pddd:        h.pb_ratio || h.pb || null,
      roe:         h.return_on_equity || h.roe || null,
      temetu:      h.dividend_yield || null,
      katilimEndeksi: XK100_KODLARI.has(h.ticker || h.symbol || ""),
    }));

    const sektorler = sektorData?.sectors ?? sektorData ?? [];

    // 23 saat cache
    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h => h.katilimEndeksi).length,
      guncelleme: new Date().toISOString(),
      sektorler,
      data: hisseler,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
