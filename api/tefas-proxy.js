export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY };
    let tumFonlar = [];
    let offset = 0;
    const limit = 50; // Ücretsiz plan max
    let devam = true;

    // Tüm sayfaları çek (pagination)
    while (devam) {
      const r = await fetch(
        `https://fonoloji.com/v1/funds?limit=${limit}&offset=${offset}`,
        { headers }
      );

      if (!r.ok) throw new Error(`Fonoloji API hatası: ${r.status}`);

      const d = await r.json();
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);

      if (items.length === 0) break;

      tumFonlar = tumFonlar.concat(items);
      offset += limit;

      // 50'den az döndüyse son sayfa
      if (items.length < limit) devam = false;

      // Rate limit: 30 istek/dakika — kısa bekle
      if (devam) await new Promise(ok => setTimeout(ok, 200));
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

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      toplam_fon: tumFonlar.length,
      guncelleme: new Date().toISOString(),
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
