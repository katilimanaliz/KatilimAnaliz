// api/kripto.js - CoinGecko ücretsiz API
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,try"
    );
    if (!r.ok) throw new Error("CoinGecko error");
    const data = await r.json();
    res.json({
      btc_usd: data.bitcoin?.usd,
      btc_try: data.bitcoin?.try,
      eth_usd: data.ethereum?.usd,
      eth_try: data.ethereum?.try,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
