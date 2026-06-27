export const config = { maxDuration: 30 };

const GOLD_KEY = "goldapi-0bda84396b352918b858a294be8ea29c-io";
let goldCache = { data: null, tarih: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
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

    const simdi = new Date();
    const saat = simdi.getUTCHours() + 3;
    const dilim = saat < 8 ? 0 : saat < 13 ? 1 : saat < 18 ? 2 : 3;
    const bugun = simdi.toISOString().slice(0, 10);
    const cacheKey = `${bugun}_${dilim}`;

    let XAU_USD = null, XAU_TRY_gram = null, XAG_TRY_gram = null;

    if (goldCache.tarih === cacheKey && goldCache.data) {
      ({ XAU_USD, XAU_TRY_gram, XAG_TRY_gram } = goldCache.data);
    } else {
      try {
        const [gAltin, gGumus] = await Promise.all([
          fetch("https://www.goldapi.io/api/XAU/USD", { headers: { "x-access-token": GOLD_KEY } }),
          fetch("https://www.goldapi.io/api/XAG/USD", { headers: { "x-access-token": GOLD_KEY } })
        ]);
        const altin = await gAltin.json();
        const gumus = await gGumus.json();
        XAU_USD = altin.price;
        XAU_TRY_gram = (altin.price * USD_TRY) / 31.1035;
        XAG_TRY_gram = (gumus.price * USD_TRY) / 31.1035;
        goldCache = { tarih: cacheKey, data: { XAU_USD, XAU_TRY_gram, XAG_TRY_gram } };
      } catch(e) {}
    }

    res.status(200).json({
      USD_TRY, EUR_TRY, GBP_TRY, CHF_TRY,
      SAR_TRY, AED_TRY, JPY100_TRY, EUR_USD,
      XAU_USD, XAU_TRY_gram, XAG_TRY_gram
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
