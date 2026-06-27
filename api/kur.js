export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    // Ücretsiz kur API - key gerektirmez
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP,CHF,SAR,AED,JPY");
    const d = await r.json();
    const USD_TRY = d.rates.TRY;
    const EUR_TRY = USD_TRY / d.rates.EUR;
    const GBP_TRY = USD_TRY / d.rates.GBP;
    const CHF_TRY = USD_TRY / d.rates.CHF;
    const SAR_TRY = USD_TRY / d.rates.SAR;
    const AED_TRY = USD_TRY / d.rates.AED;
    const JPY100_TRY = (USD_TRY / d.rates.JPY) * 100;
    const EUR_USD = 1 / d.rates.EUR;
    res.status(200).json({
      USD_TRY, EUR_TRY, GBP_TRY, CHF_TRY,
      SAR_TRY, AED_TRY, JPY100_TRY, EUR_USD,
      XAU_USD: null, XAU_TRY_gram: null, XAG_TRY_gram: null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
