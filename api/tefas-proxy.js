export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    // Fonoloji: items[] içinde geliyor, limit 2000 yeterli
    const response = await fetch(
      "https://fonoloji.com/v1/funds?limit=2000",
      { headers: { "X-API-Key": API_KEY } }
    );

    if (!response.ok) {
      throw new Error(`Fonoloji API hatası: ${response.status}`);
    }

    const data = await response.json();

    // Gerçek format: { items: [...] }
    const liste = data.items ?? data.funds ?? data.data ?? (Array.isArray(data) ? data : []);

    // Fon adında "KATILIM" geçenleri filtrele
    const katilimFonlar = liste
      .filter(f => (f.name || "").toUpperCase().includes("KATILIM"))
      .map(f => ({
        kod:      f.code       || "",
        ad:       f.name       || "",
        yonetici: f.management_company || "",
        portfoy:  f.aum        || 0,
        // Fonoloji ondalık döndürüyor (0.05 = %5), biz yüzdeye çeviriyoruz
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
