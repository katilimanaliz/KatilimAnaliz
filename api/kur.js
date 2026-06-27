export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const [dovizRes, metalRes] = await Promise.all([
      fetch("https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP,CHF,SAR,AED,JPY"),
      fetch("https://metals.live/api/spot")
    ]);
    const d = await dovizRes.json();
    const metals = await metalRes.json();

    const USD_TRY = d.rates.TRY;
    const EUR_TRY = USD_TRY / d.rates.EUR;
    const GBP_TRY = USD_TRY / d.rates.GBP;
    const CHF_TRY = USD_TRY / d.rates.CHF;
    const SAR_TRY = USD_TRY / d.rates.SAR;
    const AED_TRY = USD_TRY / d.rates.AED;
    const JPY100_TRY = (USD_TRY / d.rates.JPY) * 100;
    const EUR_USD = 1 / d.rates.EUR;

    const XAU_USD = metals?.find(m => m.symbol === "XAU")?.price || null;
    const XAG_USD = metals?.find(m => m.symbol === "XAG")?.price || null;
    const XAU_TRY_gram = XAU_USD ? (XAU_USD * USD_TRY) / 31.1035 : null;
    const XAG_TRY_gram = XAG_USD ? (XAG_USD * USD_TRY) / 31.1035 : null;

    res.status(200).json({
      USD_TRY, EUR_TRY, GBP_TRY, CHF_TRY,
      SAR_TRY, AED_TRY, JPY100_TRY, EUR_USD,
      XAU_USD, XAU_TRY_gram, XAG_TRY_gram
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

