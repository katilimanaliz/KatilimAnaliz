export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900");

  const semboller = [
    "^GSPC","^DJI","^IXIC","^GDAXI","XU100.IS",
    "BZ=F","CL=F","NG=F","GC=F","SI=F","HG=F","ZW=F",
    "BTC-USD","ETH-USD",
    "^TNX","^IRX",
  ];

  try {
    const results = await Promise.allSettled(
      semboller.map(s =>
        fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" } }
        )
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) return null;
          return {
            sembol: s,
            fiyat: meta.regularMarketPrice,
            onceki: meta.chartPreviousClose,
            degisim: meta.regularMarketPrice && meta.chartPreviousClose
              ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100).toFixed(2)
              : null,
            para: meta.currency,
          };
        })
        .catch(() => null)
      )
    );

    const data = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        data[semboller[i]] = r.value;
      }
    });

    res.json({ data, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
