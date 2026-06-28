export default async function handler(req, res) {
  try {
    // Bugünün tarihini al
    const bugun = new Date();
    const bitisTarihi = bugun.toLocaleDateString("tr-TR").split(".").reverse().join("-");
    // 2 gün geriye git (hafta sonu/tatil ihtimaline karşı)
    bugun.setDate(bugun.getDate() - 2);
    const baslangicTarihi = bugun.toLocaleDateString("tr-TR").split(".").reverse().join("-");

    const url = `https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir?fontip=YAT&baslangicTarihi=${baslangicTarihi}&bitisTarihi=${bitisTarihi}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Referer": "https://www.tefas.gov.tr/",
        "Origin": "https://www.tefas.gov.tr",
      },
    });

    if (!response.ok) throw new Error(`TEFAS yanıt hatası: ${response.status}`);

    const data = await response.json();

    const liste = Array.isArray(data) ? data : (data.data ?? []);

    // Fon adında "KATILIM" geçenleri filtrele
    const katilimFonlar = liste.filter((f) => {
      const ad = (
        f.fonunvani || f.FonUnvani || f.fon_adi ||
        f.FONUNVANI || f.fund_name || ""
      ).toUpperCase();
      return ad.includes("KATILIM");
    });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      tarih: { baslangicTarihi, bitisTarihi },
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
