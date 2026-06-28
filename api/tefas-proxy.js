// api/tefas-proxy.js
// Vercel Cron: Her gün 08:30 TR (05:30 UTC) — vercel.json ile tanımlı
// Sonuç 23 saat cache'de tutulur, gün içi ek istek gitmez

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    // Parametresiz istek — ilk 50 fonu çek, içinden KATILIM filtrele
    const response = await fetch(
      "https://fonoloji.com/v1/funds?limit=50",
      {
        headers: {
          "X-API-Key": API_KEY,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fonoloji API hatası: ${response.status}`);
    }

    const d = await response.json();

    // Yanıt formatı: { items: [...] }
    const liste = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);

    // Fon adında "KATILIM" geçenleri filtrele
    const katilimFonlar = liste
      .filter(f => (f.name || "").toUpperCase().includes("KATILIM"))
      .map(f => ({
        kod:      f.code || "",
        ad:       f.name || "",
        yonetici: f.management_company || "",
        portfoy:  f.aum || 0,
        gunluk:   parseFloat(((f.return_1d  || 0) * 100).toFixed(4)),
        haftalik: parseFloat(((f.return_1w  || 0) * 100).toFixed(2)),
        aylik:    parseFloat(((f.return_1m  || 0) * 100).toFixed(2)),
        uc_aylik: parseFloat(((f.return_3m  || 0) * 100).toFixed(2)),
        ytd:      parseFloat(((f.return_ytd || 0) * 100).toFixed(2)),
        yillik:   parseFloat(((f.return_1y  || 0) * 100).toFixed(2)),
      }));

    // 23 saat cache — sabah 08:30 cron yenileyene kadar geçerli
    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      toplam: liste.length,
      guncelleme: new Date().toISOString(),
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
