export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };
    const gorulmuKodlar = new Set();
    let katilimFonlar = [];
    let toplam = 0;

    // Sıralı istek — aralarında 300ms bekle (rate limit: 30/dakika = 2sn/istek)
    // Vercel serverless max 10sn — 10 sayfa × 300ms = 3sn, güvenli
    for (let offset = 0; offset <= 450; offset += 50) {
      const r = await fetch(
        `https://fonoloji.com/v1/funds?limit=50&offset=${offset}`,
        { headers }
      );

      if (!r.ok) {
        // 429 rate limit — o ana kadar topladıklarımızla devam et
        if (r.status === 429) break;
        continue;
      }

      const d = await r.json();
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
      toplam += items.length;

      for (const f of items) {
        const kod = f.code || "";
        if (kod && gorulmuKodlar.has(kod)) continue;
        gorulmuKodlar.add(kod);

        if ((f.name || "").toUpperCase().includes("KATILIM")) {
          katilimFonlar.push({
            kod,
            ad:       f.name || "",
            yonetici: (f.management_company || "").trim(),
            portfoy:  f.aum || 0,
            gunluk:   parseFloat(((f.return_1d  || 0) * 100).toFixed(4)),
            haftalik: parseFloat(((f.return_1w  || 0) * 100).toFixed(2)),
            aylik:    parseFloat(((f.return_1m  || 0) * 100).toFixed(2)),
            uc_aylik: parseFloat(((f.return_3m  || 0) * 100).toFixed(2)),
            ytd:      parseFloat(((f.return_ytd || 0) * 100).toFixed(2)),
            yillik:   parseFloat(((f.return_1y  || 0) * 100).toFixed(2)),
          });
        }
      }

      // Son sayfaysa dur
      if (items.length < 50) break;

      // 300ms bekle
      await new Promise(ok => setTimeout(ok, 300));
    }

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      toplam,
      guncelleme: new Date().toISOString(),
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
