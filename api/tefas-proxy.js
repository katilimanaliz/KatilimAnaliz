export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Vakıf Katılım fonlarını direkt koddan çek (yeni ihraç, kategori listesinde görünmüyor)
    const VAKIF_KODLARI = ["VPA","VLT","VHS","VKK","VKV"];

    const [kategoriRes, ...vakifRes] = await Promise.all([
      fetch("https://fonoloji.com/v1/funds?category=Kat%C4%B1l%C4%B1m&limit=50&offset=0", { headers }),
      ...VAKIF_KODLARI.map(kod =>
        fetch(`https://fonoloji.com/v1/funds/${kod}`, { headers })
          .then(r => r.ok ? r.json() : null).catch(() => null)
      )
    ]);

    const gorulmuKodlar = new Set();
    let katilimFonlar = [];

    // Önce Vakıf Katılım fonlarını ekle (öncelikli)
    for (const d of vakifRes) {
      if (!d) continue;
      const f = d.fund ?? d; // /funds/:code yanıtı { fund: {...} } formatında
      const kod = f.code || "";
      if (!kod || gorulmuKodlar.has(kod)) continue;
      gorulmuKodlar.add(kod);
      katilimFonlar.push(mapFon(f, true));
    }

    // Sonra kategori listesinden gelenleri ekle
    if (kategoriRes.ok) {
      const d = await kategoriRes.json();
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
      for (const f of items) {
        const kod = f.code || "";
        if (!kod || gorulmuKodlar.has(kod)) continue;
        if (!(f.name || "").toUpperCase().includes("KATILIM")) continue;
        gorulmuKodlar.add(kod);
        katilimFonlar.push(mapFon(f, false));
      }
    }

    res.setHeader("Cache-Control", "s-maxage=82800, stale-while-revalidate=3600");
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

function mapFon(f, vakif) {
  let yonetici = (f.management_company || "").trim();
  if (!yonetici || vakif) yonetici = "Vakıf Katılım Portföy Yönetimi A.Ş.";
  return {
    kod:      f.code || "",
    ad:       f.name || "",
    yonetici,
    oncelik:  vakif ? 1 : 2,
    portfoy:  f.aum || 0,
    gunluk:   parseFloat(((f.return_1d  || 0) * 100).toFixed(4)),
    haftalik: parseFloat(((f.return_1w  || 0) * 100).toFixed(2)),
    aylik:    parseFloat(((f.return_1m  || 0) * 100).toFixed(2)),
    uc_aylik: parseFloat(((f.return_3m  || 0) * 100).toFixed(2)),
    ytd:      parseFloat(((f.return_ytd || 0) * 100).toFixed(2)),
    yillik:   parseFloat(((f.return_1y  || 0) * 100).toFixed(2)),
  };
}
