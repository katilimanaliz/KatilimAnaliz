// api/evds-proxy.js - Seri kodu keşif + production

const CACHE_TTL_MS = 12 * 3600 * 1000;
let cacheAnlik = { data: null, ts: 0 };
let cacheTarihsel = {};
const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";

// Kredi faiz seri kodları - birden fazla alternatif deneyeceğiz
const SERI_ALTERNATIFLERI = {
  konut_tum:    ["TP.KTF10", "TP.KO10", "TP.KRF.KNT.TM"],
  tasit_tum:    ["TP.KTF11", "TP.TK11", "TP.KRF.TST.TM"],
  ihtiyac_tum:  ["TP.KTF12", "TP.IH12", "TP.KRF.IHT.TM"],
  mevduat:      ["TP.TL.MT3", "TP.MT3", "TP.MF.TL.MT3"],
};

function tarihStr(d) {
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function onceki(gun) {
  const d = new Date(); d.setDate(d.getDate() - gun); return tarihStr(d);
}

async function tekSeriTest(seri, apiKey) {
  const url = `${BASE}/series=${seri}&startDate=${onceki(30)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`;
  const r = await fetch(url, { headers: { "key": apiKey } });
  const text = await r.text();
  if (text.trim().startsWith("<")) return { seri, sonuc: "HTML", items: 0 };
  const json = JSON.parse(text);
  return { seri, sonuc: "JSON", items: json?.items?.length || 0, totalCount: json?.totalCount };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.EVDS_KEY;
  if (!apiKey) return res.status(500).json({ error: "EVDS_KEY eksik" });

  const { mod, seri } = req.query;

  // Seri kodu keşif modu
  if (mod === "keşif") {
    const testSeriler = [
      // Kredi faiz oranları - eski kodlar
      "TP.KTF10", "TP.KTF11", "TP.KTF12", "TP.KTF17",
      // Alternatif formatlar
      "TP.KO.KONUT", "TP.KRFAIZ.KNT",
      // Mevduat
      "TP.TL.MT3", "TP.MB.MT3", "TP.MF.MT3",
      // Çalıştığını bildiğimiz kur serisi (kontrol)
      "TP.DK.USD.A",
    ];
    const sonuclar = await Promise.all(testSeriler.map(s => tekSeriTest(s, apiKey)));
    return res.status(200).json({ sonuclar });
  }

  // Tek seri test
  if (mod === "tek" && seri) {
    const sonuc = await tekSeriTest(seri, apiKey);
    return res.status(200).json(sonuc);
  }

  // Kategori listesi
  if (mod === "kategori") {
    const url = `${BASE}/categories/type=json`;
    const r = await fetch(url, { headers: { "key": apiKey } });
    const text = await r.text();
    if (text.trim().startsWith("<")) return res.status(200).json({ html: true });
    return res.status(200).json(JSON.parse(text));
  }

  // Veri grubu listesi - kredi faiz içeren grupları bul
  if (mod === "gruplar") {
    const url = `${BASE}/datagroups/mode=0&type=json`;
    const r = await fetch(url, { headers: { "key": apiKey } });
    const text = await r.text();
    if (text.trim().startsWith("<")) return res.status(200).json({ html: true });
    const json = JSON.parse(text);
    // Kredi/faiz ile ilgili grupları filtrele
    const faizGruplari = json.filter(g =>
      (g.DATAGROUP_NAME || "").match(/[Kk]redi|[Ff]aiz|[Mm]evduat|[Kk]atılım|[Ff]inansman/)
    );
    return res.status(200).json({ toplam: json.length, faiz_gruplari: faizGruplari });
  }

  return res.status(200).json({
    mesaj: "Mod parametresi girin",
    modlar: {
      "?mod=keşif": "Bilinen seri kodlarını test et",
      "?mod=kategori": "EVDS kategori listesi",
      "?mod=gruplar": "Faiz/kredi veri grupları",
      "?mod=tek&seri=TP.DK.USD.A": "Tek seri test",
    }
  });
}
