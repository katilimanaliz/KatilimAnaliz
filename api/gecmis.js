// api/gecmis.js - Yahoo Finance geçmiş fiyat verisi
export default async function handler(req, res) {
 res.setHeader("Access-Control-Allow-Origin", "*");
 res.setHeader("Cache-Control", "s-maxage=3600");

 const { sembol } = req.query;
 if (!sembol) return res.status(400).json({ error: "sembol gerekli" });

 const gramMod = sembol === "GC=F" || sembol === "SI=F";

 try {
   const fetchler = [
     fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
   ];
   if (gramMod) {
     fetchler.push(fetch("https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=1mo", { headers: { "User-Agent": "Mozilla/5.0" } }));
   }

   const [r, kurR] = await Promise.all(fetchler);
   if (!r.ok) throw new Error("Yahoo error");

   const data = await r.json();
   const kurData = kurR && kurR.ok ? await kurR.json() : null;

   const result = data?.chart?.result?.[0];
   const timestamps = result?.timestamp ?? [];
   const closes = result?.indicators?.quote?.[0]?.close ?? [];
   const meta = result?.meta ?? {};

   const kurTimestamps = kurData?.chart?.result?.[0]?.timestamp ?? [];
   const kurCloses = kurData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
   const kurMap = {};
   kurTimestamps.forEach((ts, i) => {
     const gun = new Date(ts * 1000).toDateString();
     kurMap[gun] = kurCloses[i];
   });

   const bolum = sembol === "GC=F" ? 31.1035 : sembol === "SI=F" ? 32.1507 : 1;
   const guncelUsdTry = kurData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;

   const noktalar = timestamps.map((ts, i) => {
     const fiyatUsd = closes[i];
     if (!fiyatUsd) return null;
     const gun = new Date(ts * 1000).toDateString();
     const usdTry = kurMap[gun] ?? guncelUsdTry ?? 46.5;
     const fiyat = gramMod
       ? Math.round(fiyatUsd * usdTry / bolum * 100) / 100
       : Math.round(fiyatUsd * 10000) / 10000;
     return {
       tarih: new Date(ts * 1000).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
       fiyat,
     };
   }).filter(n => n && n.fiyat !== null);

   const guncelFiyat = gramMod && guncelUsdTry
     ? Math.round(meta.regularMarketPrice * guncelUsdTry / bolum * 100) / 100
     : meta.regularMarketPrice;

   const oncekiFiyat = gramMod && guncelUsdTry
     ? Math.round(meta.chartPreviousClose * guncelUsdTry / bolum * 100) / 100
     : meta.chartPreviousClose;

   res.json({
     sembol,
     para: gramMod ? "TRY" : meta.currency,
     guncelFiyat,
     oncekiKapanis: oncekiFiyat,
     noktalar,
   });
 } catch (e) {
   res.status(500).json({ error: e.message });
 }
}
