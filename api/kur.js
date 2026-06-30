// api/kur.js - Döviz + Altın + Bitcoin
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  try {
    const [dovizRes, erApiRes, gcRes, siRes, btcRes] = await Promise.allSettled([
      fetch("https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP,CHF,JPY"),
      fetch("https://open.er-api.com/v6/latest/USD"), // SAR, RUB, AED dahil geniş kapsam - key gerektirmez
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d", {headers:{"User-Agent":"Mozilla/5.0"}}),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d", {headers:{"User-Agent":"Mozilla/5.0"}}),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
    ]);

    const doviz = dovizRes.status==="fulfilled" && dovizRes.value.ok ? await dovizRes.value.json() : null;
    const erApi = erApiRes.status==="fulfilled" && erApiRes.value.ok ? await erApiRes.value.json() : null;
    const gcData = gcRes.status==="fulfilled" && gcRes.value.ok ? await gcRes.value.json() : null;
    const siData = siRes.status==="fulfilled" && siRes.value.ok ? await siRes.value.json() : null;
    const btcData = btcRes.status==="fulfilled" && btcRes.value.ok ? await btcRes.value.json() : null;

    const rates = doviz?.rates ?? {};
    const erRates = erApi?.rates ?? {}; // base: USD

    // USD_TRY öncelik: Frankfurter, yoksa open.er-api
    const USD_TRY = rates.TRY ?? erRates.TRY ?? null;

    const gcFiyat = gcData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    const siFiyat = siData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    const XAU_TRY_gram = gcFiyat && USD_TRY ? Math.round(gcFiyat * USD_TRY / 31.1035 * 100) / 100 : null;
    const XAG_TRY_gram = siFiyat && USD_TRY ? Math.round(siFiyat * USD_TRY / 32.1507 * 100) / 100 : null;
    const BTC_USD = btcData?.bitcoin?.usd ?? null;

    // SAR ve RUB için open.er-api kullan (Frankfurter desteklemiyor)
    const SAR_TRY = USD_TRY && erRates.SAR ? Math.round(USD_TRY / erRates.SAR * 10000) / 10000 : null;
    const RUB_TRY = USD_TRY && erRates.RUB ? Math.round(USD_TRY / erRates.RUB * 10000) / 10000 : null;
    const AED_TRY = USD_TRY && (rates.AED ?? erRates.AED) ? Math.round(USD_TRY / (rates.AED ?? erRates.AED) * 10000) / 10000 : null;

    res.json({
      USD_TRY,
      EUR_TRY: USD_TRY && rates.EUR ? Math.round(USD_TRY / rates.EUR * 10000) / 10000 : null,
      GBP_TRY: USD_TRY && rates.GBP ? Math.round(USD_TRY / rates.GBP * 10000) / 10000 : null,
      CHF_TRY: USD_TRY && rates.CHF ? Math.round(USD_TRY / rates.CHF * 10000) / 10000 : null,
      SAR_TRY,
      RUB_TRY,
      AED_TRY,
      JPY100_TRY: USD_TRY && rates.JPY ? Math.round(USD_TRY / rates.JPY * 100 * 10000) / 10000 : null,
      EUR_USD: rates.EUR ? Math.round(1 / rates.EUR * 10000) / 10000 : null,
      XAU_USD: gcFiyat,
      XAU_TRY_gram,
      XAG_TRY_gram,
      BTC_USD,
    });
  } catch(e) {
    res.status(500).json({error: e.message});
  }
}
