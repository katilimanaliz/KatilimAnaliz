// api/tefas-proxy.js
// Vercel Cron: Her gün 08:30 TR (05:30 UTC)
// 23 saat cache — gün içi ek istek gitmez

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // 20 sayfa × 50 = 1000 fon — katılım fonlarının tamamını kapsar (~260 adet)
    const sayfalar = [0,50,100,150,200,250,300,350,400,450,500,550,600,650,700,750,800,850,900,950];

    const sonuclar = await Promise.all(
      sayfalar.map(offset =>
        fetch(`https://fonoloji.com/v1/funds?limit=50&offset=${offset}`, { headers })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    let tumFonlar = [];
    for (const d of sonuclar) {
      if (!d) continue;
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
      tumFonlar = tumFonlar.concat(items);
    }

    // Fon adında "KATILIM" geçenleri filtrele
    const katilimFonlar = tumFonlar
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

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      toplam: tumFonlar.length,
      guncelleme: new Date().toISOString(),
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
