// api/finans-haberleri.js
// Kaynak: Bloomberg HT RSS feed (resmi, ücretsiz, key gerektirmez)
const CACHE_TTL = 15 * 60 * 1000; // 15 dakika
let cache = { data: null, ts: 0 };

function xmlEtiketAl(blok, etiket) {
  // <etiket>içerik</etiket> veya <etiket><![CDATA[içerik]]></etiket>
  const cdataRegex = new RegExp(`<${etiket}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${etiket}>`, "i");
  const normalRegex = new RegExp(`<${etiket}[^>]*>([\\s\\S]*?)<\\/${etiket}>`, "i");
  const m1 = blok.match(cdataRegex);
  if (m1) return m1[1].trim();
  const m2 = blok.match(normalRegex);
  if (m2) return m2[1].replace(/<[^>]+>/g, "").trim();
  return "";
}

function parseRSS(xml) {
  const items = [];
  const itemBloklari = xml.split(/<item[\s>]/i).slice(1);
  for (const blokRaw of itemBloklari) {
    const blok = "<item " + blokRaw.split(/<\/item>/i)[0] + "</item>";
    const baslik = xmlEtiketAl(blok, "title");
    const link = xmlEtiketAl(blok, "link");
    const tarihStr = xmlEtiketAl(blok, "pubDate");
    const aciklama = xmlEtiketAl(blok, "description");
    const kategori = xmlEtiketAl(blok, "category");
    if (baslik) {
      items.push({
        baslik,
        link,
        tarih: tarihStr ? new Date(tarihStr).toISOString() : null,
        ozet: aciklama ? aciklama.slice(0, 200) : "",
        kategori: kategori || null,
      });
    }
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const r = await fetch("https://www.bloomberght.com/rss", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, application/xml, text/xml" }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    const haberler = parseRSS(xml).slice(0, 30);

    const yanit = {
      success: true,
      count: haberler.length,
      guncelleme: new Date().toISOString(),
      kaynak: "Bloomberg HT",
      data: haberler,
    };
    cache = { data: yanit, ts: now };
    return res.status(200).json(yanit);

  } catch (e) {
    if (cache.data) return res.status(200).json({ ...cache.data, cached: true, hata: e.message });
    return res.status(500).json({ success: false, error: e.message });
  }
}
