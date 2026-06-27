export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP,CHF,SAR,AED,JPY");
    const d = await r.json();
    const USD_TRY = d.rates.TRY;
    res.status(200).json({
      USD_TRY,
      EUR_TRY: USD_TRY / d.rates.EUR,
      GBP_TRY: USD_TRY / d.rates.GBP,
      CHF_TRY: USD_TRY / d.rates.CHF,
      SAR_TRY: USD_TRY / d.rates.SAR,
      AED_TRY: USD_TRY / d.rates.AED,
      JPY100_TRY: (USD_TRY / d.rates.JPY) * 100,
      EUR_USD: 1 / d.rates.EUR,
      XAU_USD: null, XAU_TRY_gram: null, XAG_TRY_gram: null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
