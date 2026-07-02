export const config = { maxDuration: 30 };

// api/altin.js
// Kaynak: gold-api.com — ücretsiz, kimlik doğrulama gerektirmiyor, istek limiti yok.
// (Daha önce goldapi.io kullanılıyordu; aylık 100 istek limitine takıldı.)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // 8 saatte bir cache (28800 saniye)
  res.setHeader("Cache-Control", "public, s-maxage=28800, stale-while-revalidate=3600");
  if (req.method === "OPTIONS") return res.status(200).end();

  const GRAM_ONS = 31.1035; // 1 ons = 31.1035 gram

  try {
    const usdRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY");
    if (!usdRes.ok) throw new Error(`USD/TRY kuru alınamadı (HTTP ${usdRes.status})`);
    const usdData = await usdRes.json();
    const USD_TRY = Number(usdData?.rates?.TRY);
    if (!isFinite(USD_TRY) || USD_TRY <= 0) throw new Error("USD/TRY kuru geçersiz döndü");

    const [altinRes, gumusRes] = await Promise.all([
      fetch("https://api.gold-api.com/price/XAU"),
      fetch("https://api.gold-api.com/price/XAG"),
    ]);
    if (!altinRes.ok) throw new Error(`Altın fiyatı alınamadı (HTTP ${altinRes.status})`);
    if (!gumusRes.ok) throw new Error(`Gümüş fiyatı alınamadı (HTTP ${gumusRes.status})`);

    const altin = await altinRes.json();
    const gumus = await gumusRes.json();

    const XAU_USD = Number(altin?.price);
    const XAG_USD = Number(gumus?.price);
    if (!isFinite(XAU_USD) || XAU_USD <= 0) throw new Error("Altın fiyatı geçersiz veri döndürdü: " + JSON.stringify(altin));
    if (!isFinite(XAG_USD) || XAG_USD <= 0) throw new Error("Gümüş fiyatı geçersiz veri döndürdü: " + JSON.stringify(gumus));

    // Sağlık kontrolü: gümüş, ons başına altından pahalı olamaz.
    // Kaynak veri karışırsa (ör. sembol yer değiştirmesi) burada yakalanır.
    if (XAG_USD >= XAU_USD) throw new Error(`Gümüş/Altın oranı anormal (XAG=${XAG_USD}, XAU=${XAU_USD}) — kaynak veri şüpheli`);

    const XAU_TRY_gram = (XAU_USD * USD_TRY) / GRAM_ONS;
    const XAG_TRY_gram = (XAG_USD * USD_TRY) / GRAM_ONS;

    res.status(200).json({
      XAU_USD,
      XAG_USD,
      USD_TRY,
      XAU_TRY_gram,
      XAG_TRY_gram,
    });
  } catch (e) {
    // Hata durumunda 500 dön — frontend bunu null olarak ele alıp
    // son bilinen/fallback değeri kullanıyor. Asla bozuk veriyi 200 ile döndürme.
    res.status(500).json({ error: e.message });
  }
}
