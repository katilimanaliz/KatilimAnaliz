export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir?fontip=YAT",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          "Referer": "https://www.tefas.gov.tr/",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TEFAS yanıt hatası: ${response.status}`);
    }

    const data = await response.json();

    const liste = Array.isArray(data) ? data : (data.data ?? []);
    const katilimFonlar = liste.filter((f) => {
      const ad = (f.fonunvani || f.FonUnvani || f.fon_adi || f.FONUNVANI || "").toUpperCase();
      return ad.includes("KATILIM");
    });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ 
      success: true, 
      count: katilimFonlar.length,
      data: katilimFonlar 
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
