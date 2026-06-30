// api/gecmis.js
// Yahoo Finance üzerinden 30 günlük geçmiş fiyat verisi (Kur Grafik Modalı için)
// Sembol formatı: USDTRY=X, EURTRY=X, GC=F (altın), SI=F (gümüş), BTC-USD vb.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const { sembol } = req.query;
  if (!sembol) {
    return res.status(400).json({ error: "sembol parametresi gerekli" });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=1mo`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();

    const result = json?.chart?.result?.[0];
    if (!result) {
      return res.status(200).json({ noktalar: [], guncelFiyat: null, oncekiKapanis: null });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const meta = result.meta || {};

    const noktalar = timestamps
      .map((t, i) => ({
        tarih: new Date(t * 1000).toISOString().slice(0, 10),
        fiyat: closes[i],
      }))
      .filter(p => p.fiyat != null && p.fiyat > 0);

    const guncelFiyat = meta.regularMarketPrice ?? (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
    const oncekiKapanis = meta.previousClose ?? meta.chartPreviousClose ?? (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null);

    res.status(200).json({ noktalar, guncelFiyat, oncekiKapanis });
  } catch (e) {
    res.status(500).json({ error: e.message, noktalar: [], guncelFiyat: null, oncekiKapanis: null });
  }
}
