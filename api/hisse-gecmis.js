// api/hisse-gecmis.js
// BİST hisse geçmiş fiyat verisi (Hisse Detayı grafiği için)
// Yahoo Finance kullanılır (BIST hisseleri için .IS uzantısı eklenir)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const { ticker, baslangic, bitis } = req.query;
  if (!ticker) {
    return res.status(400).json({ error: "ticker parametresi gerekli" });
  }

  // baslangic/bitis formatı: DD-MM-YYYY -> aralık hesapla
  const parseTarih = (s) => {
    if (!s) return null;
    const [d, m, y] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const basD = parseTarih(baslangic);
  const bitD = parseTarih(bitis) || new Date();

  let range = "1mo";
  if (basD) {
    const gunFark = Math.round((bitD.getTime() - basD.getTime()) / 86400000);
    if (gunFark > 200) range = "1y";
    else if (gunFark > 60) range = "3mo";
    else range = "1mo";
  }

  const yfSembol = ticker.includes(".") ? ticker : `${ticker}.IS`;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSembol)}?interval=1d&range=${range}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();

    const result = json?.chart?.result?.[0];
    if (!result) {
      return res.status(200).json({ data: [] });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const data = timestamps
      .map((t, i) => ({
        tarih: new Date(t * 1000).toISOString().slice(0, 10),
        kapanis: closes[i],
      }))
      .filter(p => p.kapanis != null && p.kapanis > 0);

    res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message, data: [] });
  }
}
