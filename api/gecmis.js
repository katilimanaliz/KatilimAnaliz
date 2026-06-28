// api/gecmis.js - Yahoo Finance geçmiş fiyat verisi
export default async function handler(req, res) {
 res.setHeader("Access-Control-Allow-Origin", "*");
 res.setHeader("Cache-Control", "s-maxage=3600");

 const { sembol } = req.query;
 if (!sembol) return res.status(400).json({ error: "sembol gerekli" });

 try {
   const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=1mo`;
   const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
   if (!r.ok) throw new Error("Yahoo error");
   const data = await r.json();

   const result = data?.chart?.result?.[0];
   const timestamps = result?.timestamp ?? [];
   const closes = result?.indicators?.quote?.[0]?.close ?? [];
   const meta = result?.meta ?? {};

   const noktalar = timestamps.map((ts, i) => ({
     tarih: new Date(ts * 1000).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
     fiyat: closes[i] ? Math.round(closes[i] * 10000) / 10000 : null,
   })).filter(n => n.fiyat !== null);

   res.json({
     sembol,
     para: meta.currency,
     guncelFiyat: meta.regularMarketPrice,
     oncekiKapanis: meta.chartPreviousClose,
     noktalar,
   });
 } catch (e) {
   res.status(500).json({ error: e.message });
 }
}
