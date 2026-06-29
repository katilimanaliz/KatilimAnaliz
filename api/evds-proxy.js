// api/evds-proxy.js — DEBUG versiyonu
// Önce tek basit seri ile test, sonra tam listeye geçilecek

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.EVDS_KEY;
  if (!apiKey) return res.status(500).json({ error: "EVDS_KEY env eksik" });

  const { test, seri } = req.query;

  // DEBUG: Ham yanıtı göster
  if (test === "1") {
    const seriKodu = seri || "TP.DK.USD.A"; // varsayılan: USD kuru (kesinlikle var)
    const bugun = new Date();
    const otuzGunOnce = new Date(); otuzGunOnce.setDate(bugun.getDate() - 30);
    const fmt = d => `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;

    const url = `https://evds3.tcmb.gov.tr/service/evds/series=${seriKodu}&startDate=${fmt(otuzGunOnce)}&endDate=${fmt(bugun)}&type=json&frequency=5`;

    try {
      const r = await fetch(url, { headers: { "key": apiKey } });
      const text = await r.text();
      const isHtml = text.trim().startsWith("<");
      return res.status(200).json({
        url,
        http_status: r.status,
        is_html: isHtml,
        preview: text.substring(0, 500),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(200).json({ mesaj: "Debug proxy aktif. ?test=1 ekle" });
}
