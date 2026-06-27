export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // 8 saatte bir cache (28800 saniye)
  res.setHeader("Cache-Control", "public, s-maxage=28800, stale-while-revalidate=3600");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const GOLD_KEY = "goldapi-0bda84396b352918b858a294be8ea29c-io";
    const usdRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY");
    const usdData = await usdRes.json();
    const USD_TRY = usdData.rates.TRY;

    const [altinRes, gumusRes] = await Promise.all([
      fetch("https://www.goldapi.io/api/XAU/USD", { headers: { "x-access-token": GOLD_KEY } }),
      fetch("https://www.goldapi.io/api/XAG/USD", { headers: { "x-access-token": GOLD_KEY } })
    ]);
    const altin = await altinRes.json();
    const gumus = await gumusRes.json();

    res.status(200).json({
      XAU_USD: altin.price,
      XAU_TRY_gram: (altin.price * USD_TRY) / 31.1035,
      XAG_TRY_gram: (gumus.price * USD_TRY) / 31.1035
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
