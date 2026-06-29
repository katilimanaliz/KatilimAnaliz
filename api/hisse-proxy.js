// api/hisse-proxy.js
// Midas API (getmidas.com) — kayıtsız, ücretsiz BIST fiyatları
// Fonoloji screener — F/K, PD/DD, ROE, temettü
// Vercel Cron: Her gün 08:31 TR (05:31 UTC)

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

    // Paralel: Midas (fiyat) + Fonoloji screener (temel veriler)
    const [midasRes, screenerRes] = await Promise.all([
      fetch("https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data?sortId=&return=table", {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      }),
      FONOLOJI_KEY ? fetch(
        "https://fonoloji.com/v1/screener/bist?sort_by=market_cap&sort_order=desc&limit=200",
        { headers: { "X-API-Key": FONOLOJI_KEY, "Accept": "application/json" } }
      ) : Promise.resolve(null),
    ]);

    // Midas fiyat map'i
    const fiyatMap = {};
    if (midasRes.ok) {
      const midasData = await midasRes.json();
      const liste = Array.isArray(midasData) ? midasData : [];
      for (const h of liste) {
        const kod = h.Code || "";
        if (kod && !kod.startsWith("X")) { // Endeks kodlarını (XU100 vb.) atla
          fiyatMap[kod] = {
            fiyat:     h.Last || 0,
            degisim1g: h.DailyChangePercent || 0,
            degisim1h: h.WeeklyChangePercent || null,
            degisim1a: h.MonthlyChangePercent || null,
            degisim1y: h.YearlyChangePercent || null,
            yuksek:    h.High || 0,
            dusuk:     h.Low || 0,
            oncekiKapanis: h.PreviousClose || 0,
          };
        }
      }
    }

    // Fonoloji temel veriler map'i
    const temelMap = {};
    if (screenerRes && screenerRes.ok) {
      const sData = await screenerRes.json();
      const liste = sData.stocks ?? sData.items ?? sData.data ?? [];
      for (const h of liste) {
        const t = h.ticker || h.symbol || "";
        if (t) {
          temelMap[t] = {
            sirket:  h.name || h.company_name || "",
            sektor:  h.sector || "",
            fk:      h.pe_ratio ?? h.pe ?? null,
            pddd:    h.pb_ratio ?? h.pb ?? null,
            roe:     h.return_on_equity ?? h.roe ?? null,
            temetu:  h.dividend_yield ?? null,
            piyasaDegeri: h.market_cap || 0,
          };
        }
      }
    }

    // Midas'tan gelen tüm hisseleri birleştir
    const hisseler = Object.entries(fiyatMap).map(([kod, fiyatBilgi]) => {
      const temel = temelMap[kod] || {};
      return {
        ticker:       kod,
        sirket:       temel.sirket || kod,
        sektor:       temel.sektor || "",
        fiyat:        fiyatBilgi.fiyat,
        degisim1g:    parseFloat((fiyatBilgi.degisim1g || 0).toFixed(2)),
        degisim1h:    fiyatBilgi.degisim1h != null ? parseFloat(fiyatBilgi.degisim1h.toFixed(2)) : null,
        degisim1a:    fiyatBilgi.degisim1a != null ? parseFloat(fiyatBilgi.degisim1a.toFixed(2)) : null,
        degisim1y:    fiyatBilgi.degisim1y != null ? parseFloat(fiyatBilgi.degisim1y.toFixed(2)) : null,
        yuksek:       fiyatBilgi.yuksek,
        dusuk:        fiyatBilgi.dusuk,
        oncekiKapanis: fiyatBilgi.oncekiKapanis,
        piyasaDegeri: temel.piyasaDegeri || 0,
        fk:           temel.fk ?? null,
        pddd:         temel.pddd ?? null,
        roe:          temel.roe ?? null,
        temetu:       temel.temetu ?? null,
        katilimEndeksi: XK100_KODLARI.has(kod),
      };
    });

    // Piyasa değerine göre sırala
    hisseler.sort((a, b) => (b.piyasaDegeri || 0) - (a.piyasaDegeri || 0));

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h => h.katilimEndeksi).length,
      midasOk: midasRes.ok,
      guncelleme: new Date().toISOString(),
      data: hisseler,
    });

  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
