// api/evds-proxy.js - Seri listesi keşif v2

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

  const { mod, grup } = req.query;

  // Farklı endpoint formatlarını dene
  if (mod === "test") {
    const grupKodu = grup || "bie_kt100h";
    const denemeler = await Promise.allSettled([
      evdsFetch(`serieList/datagroup=${grupKodu}&type=json`, apiKey),
      evdsFetch(`serieList?datagroup=${grupKodu}&type=json`, apiKey),
      evdsFetch(`series/datagroup=${grupKodu}&type=json`, apiKey),
      evdsFetch(`datagroup/series?code=${grupKodu}&type=json`, apiKey),
    ]);
    return res.status(200).json(
      denemeler.map((d, i) => ({
        format: i,
        durum: d.status,
        sonuc: d.status === "fulfilled" ? d.value : d.reason?.message,
      }))
    );
  }

  // Tek seri veri testi - çalıştığını bildiğimiz format
  if (mod === "veri") {
    const seri = req.query.seri || "TP.KTF10";
    const bugun = new Date();
    const once = new Date(); once.setDate(once.getDate() - 60);
    const fmt = d => `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
    const path = `series=${seri}&startDate=${fmt(once)}&endDate=${fmt(bugun)}&type=json&frequency=8`;
    try {
      const json = await evdsFetch(path, apiKey);
      return res.status(200).json({ seri, items: json?.items?.length, totalCount: json?.totalCount, ilk: json?.items?.[0], son: json?.items?.[json?.items?.length-1] });
    } catch(e) {
      return res.status(200).json({ seri, hata: e.message });
    }
  }

  // Birden fazla seri aynı anda test et
  if (mod === "multi") {
    const bugun = new Date();
    const once = new Date(); once.setDate(once.getDate() - 60);
    const fmt = d => `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;

    const testSeriler = [
      "TP.KTF10", "TP.KTF10.H", "TP.KO10", // konut tüm
      "TP.KTF101","TP.KTF102","TP.KTF103",  // kamu/özel/yabancı
      "TP.KTF17",                             // katılım konut
      "TP.TL.MT3","TP.MT.MT3",               // mevduat
    ];

    const sonuclar = await Promise.allSettled(
      testSeriler.map(seri =>
        evdsFetch(`series=${seri}&startDate=${fmt(once)}&endDate=${fmt(bugun)}&type=json&frequency=8`, apiKey)
          .then(json => ({ seri, items: json?.items?.length || 0, totalCount: json?.totalCount }))
          .catch(e => ({ seri, hata: e.message }))
      )
    );

    return res.status(200).json(sonuclar.map(r => r.value || r.reason));
  }

  return res.status(200).json({
    mesaj: "Kullanım",
    modlar: {
      "?mod=test": "serieList endpoint formatlarını dene",
      "?mod=test&grup=bie_kt100h": "belirli grup için",
      "?mod=veri&seri=TP.KTF10": "tek seri veri çek",
      "?mod=multi": "çoklu seri test",
    }
  });
}
