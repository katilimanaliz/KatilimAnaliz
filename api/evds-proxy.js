// api/evds-proxy.js - Genişletilmiş seri keşfi

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";

async function testSeri(seri, apiKey) {
  const bugun = new Date();
  const once = new Date(); once.setDate(once.getDate() - 60);
  const fmt = d => `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  const url = `${BASE}/series=${seri}&startDate=${fmt(once)}&endDate=${fmt(bugun)}&type=json&frequency=8`;
  const r = await fetch(url, { headers: { "key": apiKey } });
  const text = await r.text();
  if (text.trim().startsWith("<")) return { seri, items: 0, hata: "HTML" };
  const json = JSON.parse(text);
  const items = json?.items || [];
  // Son non-null değeri bul
  const key = seri.replace(/\./g, "_");
  let sonDeger = null;
  for (let i = items.length - 1; i >= 0; i--) {
    const v = items[i][key] ?? items[i][seri];
    if (v !== null && v !== undefined && v !== "") { sonDeger = parseFloat(v); break; }
  }
  return { seri, items: items.length, totalCount: json?.totalCount, sonDeger };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const apiKey = process.env.EVDS_KEY;
  if (!apiKey) return res.status(500).json({ error: "EVDS_KEY eksik" });

  // Geniş test - özel/yabancı/mevduat/katılma alternatifleri
  const testSeriler = [
    // Kredi faiz - kamu/özel/yabancı alternatifleri
    "TP.KTF101","TP.KTF102","TP.KTF103",
    "TP.KTF1.K","TP.KTF1.O","TP.KTF1.Y",
    "TP.KTF10.K","TP.KTF10.O","TP.KTF10.Y",
    // Taşıt
    "TP.KTF11","TP.KTF111","TP.KTF112","TP.KTF113",
    "TP.KTF11.K","TP.KTF11.O",
    // İhtiyaç
    "TP.KTF12","TP.KTF121","TP.KTF122","TP.KTF123",
    // Katılım
    "TP.KTF17","TP.KTF171","TP.KTF172",
    "TP.KTF17.K","TP.KTF17.T","TP.KTF17.A",
    // Mevduat - çeşitli formatlar
    "TP.TL.MT3","TP.MT.MT3","TP.MT3","TP.TLMT3",
    "TP.MF.T03","TP.MT100.T03","TP.MT100",
    // Katılma hesabı
    "TP.KTH.MT3","TP.KAT.MT3","TP.KT.MT3",
  ];

  const sonuclar = await Promise.all(testSeriler.map(s => testSeri(s, apiKey)));
  const calisan = sonuclar.filter(s => s.items > 0);
  const calismayan = sonuclar.filter(s => s.items === 0);

  return res.status(200).json({ calisan, calismayan_count: calismayan.length });
}
