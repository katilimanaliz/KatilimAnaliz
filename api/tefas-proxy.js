export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Önce /v1/funds/codes ile tüm fon kodlarını çek (saatte 5 istek limiti var)
    // Tek istek — tüm kodlar gelir
    const codesRes = await fetch("https://fonoloji.com/v1/funds/codes", { headers });

    if (!codesRes.ok) {
      throw new Error(`Fonoloji codes API hatası: ${codesRes.status}`);
    }

    const codesData = await codesRes.json();
    // Yanıt: { codes: ["VPA","KLU",...] } veya string dizisi
    const tumKodlar = codesData.codes ?? codesData.funds ?? (Array.isArray(codesData) ? codesData : []);

    // Katılım fon kodlarını bul — site üzerinden bilinen kodlar + API'den gelenler
    // Kodları filtreleyemiyoruz çünkü sadece kod var, isim yok
    // Bu yüzden bilinen katılım kodlarını hardcode edip API'den detay çekeceğiz
    // Şimdilik category parametresini dene
    const categoryRes = await fetch(
      "https://fonoloji.com/v1/funds?category=Kat%C4%B1l%C4%B1m&limit=50",
      { headers }
    );

    let katilimFonlar = [];

    if (categoryRes.ok) {
      const d = await categoryRes.json();
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
      katilimFonlar = items
        .filter(f => (f.name || "").toUpperCase().includes("KATILIM"))
        .map(mapFon);
    }

    // Eğer category çalışmadıysa fallback: offset 0-500 sıralı
    if (katilimFonlar.length === 0) {
      for (let offset = 0; offset <= 450; offset += 50) {
        const r = await fetch(
          `https://fonoloji.com/v1/funds?limit=50&offset=${offset}`,
          { headers }
        );
        if (!r.ok) break;
        const d = await r.json();
        const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
        for (const f of items) {
          if ((f.name || "").toUpperCase().includes("KATILIM")) {
            katilimFonlar.push(mapFon(f));
          }
        }
        if (items.length < 50) break;
        await new Promise(ok => setTimeout(ok, 300));
      }
    }

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      toplam: tumKodlar.length,
      guncelleme: new Date().toISOString(),
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

function mapFon(f) {
  return {
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
  };
}
