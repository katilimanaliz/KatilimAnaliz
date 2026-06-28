export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Strateji: Sadece YAT (Yatırım Fonu) tipini çek, max 50
    // Fonoloji'de type filtresi varsa çok daha az fon gelir
    // Ardından isim filtresi uygula
    const denemeler = [
      "https://fonoloji.com/v1/funds?type=YAT&limit=50",
      "https://fonoloji.com/v1/funds?fund_type=YAT&limit=50",
      "https://fonoloji.com/v1/funds?category=katilim&limit=50",
      "https://fonoloji.com/v1/funds?limit=50&offset=0",
      "https://fonoloji.com/v1/funds?limit=50&offset=500",
      "https://fonoloji.com/v1/funds?limit=50&offset=1000",
      "https://fonoloji.com/v1/funds?limit=50&offset=1500",
    ];

    const sonuclar = await Promise.all(
      denemeler.map(url =>
        fetch(url, { headers })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    const gorulmuKodlar = new Set();
    let tumFonlar = [];

    for (const d of sonuclar) {
      if (!d) continue;
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
      for (const f of items) {
        const kod = f.code || f.fund_code || "";
        if (kod && gorulmuKodlar.has(kod)) continue;
        gorulmuKodlar.add(kod);
        tumFonlar.push(f);
      }
    }

    const katilimFonlar = tumFonlar
      .filter(f => (f.name || "").toUpperCase().includes("KATILIM"))
      .map(f => ({
        kod:      f.code || "",
        ad:       f.name || "",
        yonetici: (f.management_company || "").trim(),
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
