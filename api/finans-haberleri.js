// api/finans-haberleri.js
// Kaynaklar: Bloomberg HT + CNBC-e RSS feed'leri (Sözcü Ekonomi 2026-07'de kaldırıldı — bkz. v3 notu)
// REDIS/KV + KİLİT KORUMASI (2026-07) — bkz. kripto.js'deki aynı not.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
// NOT (2026-07-05): v1 → v2 → v3 sürüm geçmişi:
//  v2: TARİH PARSE DÜZELTMESİ eklendi (aşağıda) — Sözcü kaynağının entity-encode
//      edilmiş pubDate'i parseRSS()'i çökertip o kaynağın TÜM haberlerini
//      sessizce siliyordu.
//  v3: Sözcü Ekonomi kaynak listesinden tamamen çıkarıldı (yalnızca Bloomberg
//      HT + CNBC-e kullanılıyor). Kaynak seti değiştiği için eski cache'in
//      (Sözcü içeren/içermeyen) taşınmadan taze hesaplanması adına versiyon
//      tekrar artırıldı.
const KV_ANAHTAR = "finans-haberleri:v3";
const KV_TTL_SANIYE = 15 * 60;

const KAYNAKLAR = [
  { ad: "Bloomberg HT", url: "https://www.bloomberght.com/rss" },
  { ad: "CNBC-e",       url: "https://www.cnbce.com/rss" },
];

function htmlEntityCoz(metin) {
  if (!metin) return metin;
  const NAMED = { amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:" ", rsquo:"'", lsquo:"'", rdquo:'"', ldquo:'"', ndash:"–", mdash:"—", hellip:"…" };
  return metin
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, ad) => (NAMED[ad] !== undefined ? NAMED[ad] : m));
}

// ── TARİH PARSE DÜZELTMESİ (2026-07-05) ─────────────────────────────────────
// Kök neden (o zamanki kaynak listesinde Sözcü de vardı): Sözcü'nün RSS'i
// <pubDate> içinde "+0300" yerine HTML/XML numerik karakter referansı
// kullanıyordu: "Sun, 05 Jul 2026 05:30:13 &#x2B;0300". Eski kod xmlEtiketAl()
// ile bu metni ÇÖZÜMLEMEDEN (yalnızca <tag> temizleyerek) doğrudan
// `new Date(tarihStr).toISOString()`'e veriyordu. "&#x2B;0300" geçerli bir
// saat dilimi değil → new Date(...) "Invalid Date" döner → .toISOString()
// RangeError FIRLATIR. Bu hata parseRSS() içinde YAKALANMADIĞI için
// kaynaktanCek() dışına taşıyor, oradaki try/catch tüm kaynağı (o kaynağın
// TÜM haberlerini) sessizce [] olarak yutuyordu.
//
// Sözcü artık kaynak listesinde değil (bkz. KAYNAKLAR), ama bu savunma kodu
// bilerek KORUNUYOR: Bloomberg HT veya CNBC-e ileride benzer bir entity/format
// tuhaflığı gönderirse, TEK bir bozuk tarih yine o kaynağın TÜM haberlerini
// silmesin diye. Düzeltme: (1) tarih metnini önce htmlEntityCoz ile çöz,
// (2) Invalid Date durumunda throw etmek yerine null döndür — haberin tarihi
// null kalır (sıralamada en sona düşer), ama liste düşmez.
function guvenliTarihISO(tarihStr) {
  if (!tarihStr) return null;
  const cozulmus = htmlEntityCoz(tarihStr);
  const d = new Date(cozulmus);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function xmlEtiketAl(blok, etiket) {
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
        baslik: htmlEntityCoz(baslik),
        link: htmlEntityCoz(link),
        tarih: guvenliTarihISO(tarihStr),
        ozet: aciklama ? htmlEntityCoz(aciklama.slice(0, 200)) : "",
        kategori: kategori || null,
        kaynak: kaynakAdi,
      });
    }
  }
  return items;
}

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
    const controller = new AbortController();
    const zamanlayici = setTimeout(() => controller.abort(), 6000);
    const r = await fetch(kaynak.url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal,
    }).finally(() => clearTimeout(zamanlayici));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    return parseRSS(xml, kaynak.ad);
  } catch (e) {
    return [];
  }
}

function originIzinliMi(origin) {
  if (!origin) return false;
  if (/^https:\/\/katilim-analiz(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}
function corsAyarla(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", originIzinliMi(origin) ? origin : "https://katilim-analiz.vercel.app");
  res.setHeader("Vary", "Origin");
}

async function taze() {
  const sonuclar = await Promise.all(KAYNAKLAR.map(kaynaktanCek));
  const hepsi = tekillestir(
    sonuclar.flat().sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
  ).slice(0, 40);

  if (hepsi.length === 0) throw new Error("Hiçbir kaynaktan haber alınamadı");

  const basariliKaynaklar = KAYNAKLAR
    .map((k, i) => (sonuclar[i].length > 0 ? k.ad : null))
    .filter(Boolean);

  return {
    success: true,
    count: hepsi.length,
    guncelleme: new Date().toISOString(),
    kaynak: basariliKaynaklar.join(" + ") || "Bilinmiyor",
    data: hepsi,
  };
}

export default async function handler(req, res) {
  corsAyarla(req, res);
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const debug = req.query.debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, KV_ANAHTAR, KV_TTL_SANIYE, taze, { debug });
    return res.status(200).json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(KV_ANAHTAR);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    return res.status(500).json({ success: false, error: e.message });
  }
}
