// api/evds-proxy.js - Seri listesi keşif modu

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";

async function evdsFetch(path, apiKey) {
  const url = `${BASE}/${path}`;
  const r = await fetch(url, { headers: { "key": apiKey, "Accept": "application/json" } });
  const text = await r.text();
  if (text.trim().startsWith("<")) throw new Error(`HTML döndü`);
  return JSON.parse(text);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const apiKey = process.env.EVDS_KEY;
  if (!apiKey) return res.status(500).json({ error: "EVDS_KEY eksik" });

  const { grup } = req.query;

  // Veri grubundaki serileri listele
  if (grup) {
    const json = await evdsFetch(`serieList/datagroup=${grup}&type=json`, apiKey);
    return res.status(200).json(json);
  }

  // Varsayılan: kredi faiz akım gruplarını listele
  const [kredi, katilim, mevduat] = await Promise.all([
    evdsFetch("serieList/datagroup=bie_kt100h&type=json", apiKey),
    evdsFetch("serieList/datagroup=bie_kt200h&type=json", apiKey),
    evdsFetch("serieList/datagroup=bie_mt100h&type=json", apiKey),
  ]);

  return res.status(200).json({
    kredi_faiz_akım: kredi,
    katilim_kar_akım: katilim,
    mevduat_faiz_akım: mevduat,
  });
}
