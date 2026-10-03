// api/finans-haberleri.js
// Kaynaklar: CNBC-e + Investing.com Türkiye "Ekonomi Haberleri" + Bloomberg HT "Tüm Haberler" RSS feed'leri
// (Sözcü Ekonomi ve Bloomberg HT 2026-07'de kaldırılmıştı — bkz. v3/v4 notları, kaldırılma nedeni
//  bu dosyada kayıtlı DEĞİL. Bloomberg HT 2026-10-03'te kullanıcı isteğiyle YENİDEN eklendi; aşağıdaki
//  "BLOOMBERG HT" notuna bakın. Sözcü Ekonomi hâlâ kapalı.)
// REDIS/KV + KİLİT KORUMASI (2026-07) — bkz. kripto.js'deki aynı not.
// ⚠️ 2026-09-27: taze() artık gerçekten yeni bir başlık tespit edince
// otomatik push bildirimi de gönderiyor — bkz. aşağıdaki "OTOMATİK BİLDİRİM"
// bölümü ve ./_lib/haberBildirimi.js (api/bildirim.js ile PAYLAŞILAN kod).
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";
import { admin } from "./_lib/firebaseAdmin.js";
import { haberleriGonder, haberKategorileriBul } from "./_lib/haberBildirimi.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
// v5 → v6 (2026-10-03): kaynak listesine Bloomberg HT eklendi; önbellek sürümü artırılmazsa liste
// 15 dk boyunca eski kaynaklarla kalırdı.
const KV_ANAHTAR = "finans-haberleri:v6";
const KV_TTL_SANIYE = 15 * 60;

// ═══ BLOOMBERG HT (2026-10-03, kullanıcı isteği: "Haberler alanına Bloomberg HT de eklenebilir mi") ═══
// Adres https://www.bloomberght.com/rss → /rss/tum-haberler.xml'e yönleniyor; yönlendirme adımı
// olmasın diye son adres kullanılıyor. Standart RSS 2.0 (CDATA başlık/özet, pubDate GMT) → mevcut
// parseRSS değişmeden çalışıyor. Feed GENEL "Tüm Haberler" (ekonomi + dış haber + şirket haberi karışık;
// <category> hep "Haberler"), bu yüzden OTOMATİK PUSH'ta bu kaynağın haberleri yalnızca bir bildirim
// kategorisine uyuyorsa gönderilir (bkz. SADECE_KATEGORILI_KAYNAKLAR) — aksi halde "Rivian satış
// rekoru" gibi haberler filtre seçmemiş herkese push olurdu. Liste ekranında hepsi görünür.
// ⚠️ Temmuz'da neden kaldırıldığı kayıtlı değil (engelleme/boş yanıt olabilir). Kaynak başarısız olursa
// kaynaktanCek [] döner, diğer kaynaklar etkilenmez; çalıştığını yanıttaki `kaynak` alanı gösterir.
const KAYNAKLAR = [
  { ad: "CNBC-e", url: "https://www.cnbce.com/rss" },
  { ad: "Investing.com", url: "https://tr.investing.com/rss/news_14.rss" },
  { ad: "Bloomberg HT", url: "https://www.bloomberght.com/rss/tum-haberler.xml" },
];
const SADECE_KATEGORILI_KAYNAKLAR = ["Bloomberg HT"];

function htmlEntityCoz(metin) {
  if (!metin) return metin;
  const NAMED = { amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:" ", rsquo:"'", lsquo:"'", rdquo:'"', ldquo:'"', ndash:"–", mdash:"—", hellip:"…" };
  return metin
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, ad) => (NAMED[ad] !== undefined ? NAMED[ad] : m));
}

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

// Başlığı normalize edip kısa bir "parmak izi" üretir — hem tekillestir()
// (aynı haberin iki kaynaktan gelen farklı yazımlarını birleştirmek için)
// hem de OTOMATİK BİLDİRİM (aşağıda) "bu başlığı daha önce gördük mü?"
// kontrolü için AYNI fonksiyonu kullanıyor — ikisi ayrı ayrı normalize
// etseydi, aynı haber birinde "yeni" birinde "eski" sayılabilirdi.
function haberAnahtari(baslik) {
  return baslik.toLowerCase().replace(/[^a-z0-9ığüşöç]/gi, "").slice(0, 60);
}

function tekillestir(items) {
  const gorulen = new Set();
  const sonuc = [];
  for (const it of items) {
    const anahtar = haberAnahtari(it.baslik);
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
  if (/^https:\/\/(www\.)?katilimplus\.com$/i.test(origin)) return true;
  if (/^(capacitor|ionic):\/\/localhost$/i.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}
function corsAyarla(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", originIzinliMi(origin) ? origin : "https://katilim-analiz.vercel.app");
  res.setHeader("Vary", "Origin");
}

// ═══════════════════════════════════════════════════════════════════════════
// OTOMATİK BİLDİRİM (2026-09-27) ─ Yeni bir başlık tespit edilince push
// ═══════════════════════════════════════════════════════════════════════════
// taze() SADECE kilitliGetir'in KV_TTL_SANIYE (15 dk) önbelleği dolduğunda
// VE en az bir istemci bu uca uğradığında çalışır (bkz. dosya başındaki
// Redis/kilit notu) — yani otomatik bildirim de dolaylı olarak bu ritme
// bağlı: ayrı bir cron YOK, organik trafiğe (uygulamayı açan kullanıcılar)
// biniyor. Aktif bir kullanıcı tabanında bu, çoğu zaman 15 dk'dan daha sık
// tetiklenir; uzun süre kimse uğramazsa o dönemde bildirim de gecikir —
// bilinçli bir basitlik tercihi (alarm-kontrol'deki gibi ayrı bir dış
// zamanlayıcı KURULMADI).
//
// "Daha önce görülen" başlıkların parmak izleri TEK bir Redis anahtarında
// (dizi, en yeni başta) tutuluyor — duyuruArsiv/DUYURU_ARSIV_ANAHTAR
// (api/bildirim.js) ile AYNI desen. İLK ÇALIŞTIRMADA (anahtar boşsa) hiçbir
// şey GÖNDERİLMEZ, sadece mevcut başlıklar "görülmüş" olarak kaydedilir —
// aksi halde ilk deploy'da (veya cache tamamen temizlendiğinde) elimizdeki
// 40 haberin TAMAMI "yeni" sayılıp herkese 40 ayrı push giderdi.
//
// KATEGORİ (2026-09-28): RSS <category> alanı güvenilir olmadığı için haber,
// BAŞLIĞINDAKİ anahtar kelimelerle sınıflandırılıyor (haberKategorileriBul,
// bkz. _lib/haberBildirimi.js) ve haberleriGonder'e kategoriler:[...] olarak
// veriliyor: filtre seçmemiş aboneler her haberi alır, filtre seçmiş (Pro)
// aboneler yalnızca kesişen kategorideki haberi alır, hiçbir kategoriye
// uymayan haber SADECE filtre seçmemiş abonelere gider. (Önceden kategori
// gönderilmiyordu → kategori seçimi bu bildirimlerde etkisizdi.)
// v1 → v2 (2026-10-03): yeni kaynak eklenince onun MEVCUT başlıkları "yeni" sayılıp 3 eski haber push
// olarak gider; anahtar sıfırlanınca ilk turda (ilkCalistirma) HİÇBİR ŞEY gönderilmez, tüm başlıklar
// yalnızca "görülmüş" diye kaydedilir.
const KV_BILDIRILEN_ANAHTAR = "finans-haberleri:bildirilenler:v2";
const BILDIRILEN_MAKS_SAKLA = 200;   // saklanan parmak izi sayısı (bellek/Redis boyutu için tavan)
const YENI_HABER_MAKS_BILDIRIM = 3;  // bir turda en fazla kaç YENİ başlık için push gönderilsin (spam koruması)

async function yeniHaberleriBildir(hepsi) {
  try {
    let bilinenler = [];
    const ham = await redis.get(KV_BILDIRILEN_ANAHTAR);
    if (Array.isArray(ham)) bilinenler = ham;

    const ilkCalistirma = bilinenler.length === 0;
    const bilinenSet = new Set(bilinenler);
    const yeniOlanlar = ilkCalistirma ? [] : hepsi
      .filter((h) => !bilinenSet.has(haberAnahtari(h.baslik)))
      // Genel akışlı kaynaklarda (Bloomberg HT) yalnızca bir bildirim kategorisine uyan haber push olur
      .filter((h) => !SADECE_KATEGORILI_KAYNAKLAR.includes(h.kaynak) || haberKategorileriBul(h.baslik, h.ozet).length > 0);

    if (!ilkCalistirma && yeniOlanlar.length > 0) {
      // hepsi zaten en yeniden eskiye sıralı geliyor (taze() bunu garanti
      // ediyor) — bu yüzden İLK N eleman otomatik olarak "en yeni N".
      const gonderilecekler = yeniOlanlar.slice(0, YENI_HABER_MAKS_BILDIRIM);
      for (const h of gonderilecekler) {
        try {
          await haberleriGonder({
            redis, admin,
            baslik: `📰 ${h.baslik}`,
            govde: h.ozet || h.kaynak || "Yeni haber",
            kategoriler: haberKategorileriBul(h.baslik, h.ozet),
            veri: { tip: "finans-haberi", link: h.link || "", kaynak: h.kaynak || "" },
          });
        } catch (e) {
          // TEK bir haberin gönderimi başarısız olsa bile diğerleri denenmeye
          // devam etsin — bkz. dosyanın genelindeki "biri patlarsa hepsini
          // düşürme" prensibi.
          console.error("Haber bildirimi gonderilemedi:", h.baslik?.slice(0, 60), e.message);
        }
      }
    }

    // Görülenler listesi HER turda güncellenir (ilk çalıştırma dahil) —
    // yeni turdaki TÜM başlıklar (sadece gönderilenler değil) parmak izi
    // listesine eklenir, en yeni BILDIRILEN_MAKS_SAKLA kadarı saklanır.
    const guncelParmakIzleri = hepsi.map((h) => haberAnahtari(h.baslik));
    const birlesik = [...new Set([...guncelParmakIzleri, ...bilinenler])].slice(0, BILDIRILEN_MAKS_SAKLA);
    await redis.set(KV_BILDIRILEN_ANAHTAR, birlesik);
  } catch (e) {
    // Bildirim akışındaki HERHANGİ bir hata, ana haber verisini (kullanıcıya
    // dönen yanıtı) ASLA etkilememeli — bu yüzden en dış katmanda da yutuluyor.
    console.error("Otomatik haber bildirimi turu basarisiz:", e.message);
  }
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

  // Yanıtı geciktirmemek İÇİN DEĞİL — tam tersi, kilitliGetir'in ZATEN
  // sağladığı "bu ağır iş en fazla 15 dk'da bir, TEK bir istekte çalışır"
  // garantisinden yararlanmak için burada, taze() BAŞARIYLA sonuçlandıktan
  // hemen sonra çağrılıyor. Kendi içinde try/catch'li (yukarı bkz.), bu
  // yüzden burada await edilmesi ana yanıtı asla riske atmıyor.
  await yeniHaberleriBildir(hepsi);

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
  const debug = req.query.debug === "1";

  res.setHeader("Cache-Control", debug ? "no-store" : "s-maxage=900, stale-while-revalidate=300");

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
