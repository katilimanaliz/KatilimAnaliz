// api/petrol.js - Yahoo Finance gayri resmi endpoint
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800");

  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1d&range=1d",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!r.ok) throw new Error("Yahoo Finance error");
    const data = await r.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    const prev  = data?.chart?.result?.[0]?.meta?.chartPreviousClose;
    res.json({
      brent_usd: price,
      prev_usd: prev,
      change_pct: price && prev ? ((price - prev) / prev * 100).toFixed(2) : null,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
