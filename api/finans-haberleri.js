// api/finans-haberleri.js
// Kaynaklar: Bloomberg HT + CNBC-e + Sözcü Ekonomi RSS feed'leri (üçü de resmi, ücretsiz, key gerektirmez)
// NOT: Bloomberg HT'nin RSS'i zaman zaman uzun süre yenilenmiyor (tespit edildi: 1 Temmuz
// 18:47'den itibaren donmuş kaldı; CNBC-e de benzer şekilde saatlerce güncellenmeyebiliyor).
// Sözcü Ekonomi test edildiğinde dakikalar içinde güncelleniyordu — en taze kaynak. Tek
// kaynağa bağımlı kalmamak için üç kaynak da çekilip birleştiriliyor; hangi kaynak daha
// güncelse haberler ondan öne çıkıyor. Biri/ikisi erişilemez olursa kalanla devam edilir.
const CACHE_TTL = 15 * 60 * 1000; // 15 dakika
let cache = { data: null, ts: 0 };

const KAYNAKLAR = [
  { ad: "Bloomberg HT", url: "https://www.bloomberght.com/rss" },
  { ad: "CNBC-e",       url: "https://www.cnbce.com/rss" },
  { ad: "Sözcü Ekonomi", url: "https://www.sozcu.com.tr/feeds-rss-category-ekonomi" },
];

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

function parseRSS(xml, kaynakAdi) {
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
        kaynak: kaynakAdi,
      });
    }
  }
  return items;
}

// Aynı/çok benzer başlıkları (iki kaynak da aynı haberi geçmiş olabilir) sadeleştir
function tekillestir(items) {
  const gorulen = new Set();
  const sonuc = [];
  for (const it of items) {
    const anahtar = it.baslik.toLowerCase().replace(/[^a-z0-9ığüşöç]/gi, "").slice(0, 60);
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    sonuc.push(it);
  }
  return sonuc;
}

async function kaynaktanCek(kaynak) {
  try {
    const r = await fetch(kaynak.url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, application/xml, text/xml" }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    return parseRSS(xml, kaynak.ad);
  } catch (e) {
    return []; // bu kaynak başarısız oldu, diğerleriyle devam
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const sonuclar = await Promise.all(KAYNAKLAR.map(kaynaktanCek));
    const hepsi = tekillestir(
      sonuclar.flat().sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
    ).slice(0, 40);

    if (hepsi.length === 0) throw new Error("Hiçbir kaynaktan haber alınamadı");

    const basariliKaynaklar = KAYNAKLAR
      .map((k, i) => (sonuclar[i].length > 0 ? k.ad : null))
      .filter(Boolean);

    const yanit = {
      success: true,
      count: hepsi.length,
      guncelleme: new Date().toISOString(),
      kaynak: basariliKaynaklar.join(" + ") || "Bilinmiyor",
      data: hepsi,
    };
    cache = { data: yanit, ts: now };
    return res.status(200).json(yanit);

  } catch (e) {
    if (cache.data) return res.status(200).json({ ...cache.data, cached: true, hata: e.message });
    return res.status(500).json({ success: false, error: e.message });
  }
}
