export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // category=Katılım çalışıyor! Ücretsiz plan max 50/istek
    // 2 sayfa × 50 = 100 fon — tüm katılım fonlarını kapsar
    const [r1, r2, r3] = await Promise.all([
      fetch("https://fonoloji.com/v1/funds?category=Kat%C4%B1l%C4%B1m&limit=50&offset=0",   { headers }),
      fetch("https://fonoloji.com/v1/funds?category=Kat%C4%B1l%C4%B1m&limit=50&offset=50",  { headers }),
      fetch("https://fonoloji.com/v1/funds?category=Kat%C4%B1l%C4%B1m&limit=50&offset=100", { headers }),
    ]);

    const gorulmuKodlar = new Set();
    let katilimFonlar = [];

    for (const r of [r1, r2, r3]) {
      if (!r.ok) continue;
      const d = await r.json();
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
      for (const f of items) {
        const kod = f.code || "";
        if (kod && gorulmuKodlar.has(kod)) continue;
        gorulmuKodlar.add(kod);
        if ((f.name || "").toUpperCase().includes("KATILIM")) {
          katilimFonlar.push(mapFon(f));
        }
      }
    }

    // Vakıf Katılım öncelikli sıralama (proxy'de de uygula)
    const VAKIF_KODLARI = ["VLT","VHS","VKK","VKV","VPA"];
    katilimFonlar.sort((a, b) => {
      const aV = VAKIF_KODLARI.includes(a.kod) ? 0 : 1;
      const bV = VAKIF_KODLARI.includes(b.kod) ? 0 : 1;
      return aV - bV;
    });

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

function mapFon(f) {
  // Yönetici adı boşsa fon adından veya koddan çıkar
  let yonetici = (f.management_company || "").trim();
  if (!yonetici) {
    const ad = f.name || "";
    const kod = f.code || "";
    const VAKIF_KODLARI = ["VLT","VHS","VKK","VKV","VPA","VYA","VBK","VEK"];
    if (VAKIF_KODLARI.includes(kod) || ad.includes("VAKIF KATILIM")) 
      yonetici = "Vakıf Katılım Portföy Yönetimi A.Ş.";
    else if (ad.includes("KUVEYT")) yonetici = "Kuveyt türk Portföy Yönetimi A.Ş.";
    else if (ad.includes("ZİRAAT")) yonetici = "Ziraat Portföy Yönetimi A.Ş.";
  }
  return {
    kod:      f.code || "",
    ad:       f.name || "",
    yonetici,
    portfoy:  f.aum || 0,
    gunluk:   parseFloat(((f.return_1d  || 0) * 100).toFixed(4)),
    haftalik: parseFloat(((f.return_1w  || 0) * 100).toFixed(2)),
    aylik:    parseFloat(((f.return_1m  || 0) * 100).toFixed(2)),
    uc_aylik: parseFloat(((f.return_3m  || 0) * 100).toFixed(2)),
    ytd:      parseFloat(((f.return_ytd || 0) * 100).toFixed(2)),
    yillik:   parseFloat(((f.return_1y  || 0) * 100).toFixed(2)),
  };
}
