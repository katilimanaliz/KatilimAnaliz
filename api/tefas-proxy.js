export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const response = await fetch(
      "https://fonoloji.com/v1/funds?limit=2000",
      { headers: { "X-API-Key": API_KEY } }
    );

    if (!response.ok) {
      throw new Error(`Fonoloji API hatası: ${response.status}`);
    }

    const data = await response.json();
    const liste = Array.isArray(data) ? data : (data.funds ?? data.data ?? []);

    const katilimFonlar = liste
      .filter(f => {
        const ad = (f.name || f.fund_name || f.fonunvani || "").toUpperCase();
        return ad.includes("KATILIM");
      })
      .map(f => ({
        kod:      f.code || f.fund_code || "",
        ad:       f.name || f.fund_name || "",
        yonetici: f.management_company || "",
        portfoy:  f.aum || 0,
        gunluk:   parseFloat(((f.return_1d  || 0) * 100).toFixed(4)),
        haftalik: parseFloat(((f.return_1w  || 0) * 100).toFixed(2)),
        aylik:    parseFloat(((f.return_1m  || 0) * 100).toFixed(2)),
        uc_aylik: parseFloat(((f.return_3m  || 0) * 100).toFixed(2)),
        ytd:      parseFloat(((f.return_ytd || 0) * 100).toFixed(2)),
        yillik:   parseFloat(((f.return_1y  || 0) * 100).toFixed(2)),
      }));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      guncelleme: new Date().toISOString(),
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
