export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { ticker, baslangic, bitis } = req.query;
  if (!ticker) return res.status(400).json({ error: "ticker gerekli" });

  try {
    const url = `https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?hisse=${ticker}&startdate=${baslangic}&enddate=${bitis}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
    });

    if (!r.ok) return res.status(502).json({ error: "İş Yatırım veri hatası" });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ error: "JSON parse hatası" }); }

    const points = (data.value || []).map(p => ({
      tarih:   (p.HGDG_TARIH   || "").slice(0, 10),
      acilis:  parseFloat(p.HGDG_ACILIS)  || null,
      yuksek:  parseFloat(p.HGDG_YUKSEK)  || null,
      dusuk:   parseFloat(p.HGDG_DUSUK)   || null,
      kapanis: parseFloat(p.HGDG_KAPANIS) || 0,
      hacim:   parseFloat(p.HGDG_HACIM)   || null,
    })).filter(p => p.kapanis > 0);

    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json({ success: true, ticker, data: points });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
