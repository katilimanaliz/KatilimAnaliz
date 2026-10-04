import { Redis } from "@upstash/redis";

// NOT: Vercel KV entegrasyonu UPSTASH_* yerine KV_REST_API_* isimlerini kullanıyor;
// diğer api dosyalarındaki desenin aynısı, fallback'li.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ═══════════════════════════════════════════════════════════════════════
// KATILIM BANKALARI KUR MAKASI — OTOMATİK TOPLAYICI (2026-10-04)
// Hesapla > Hazine > "Kur Makası ve Marj" ekranının veri kaynağı.
//
//   GET /api/banka-kurlari                         → son işlem gününün MEDYAN ölçümü (uygulama bunu okur)
//   GET /api/banka-kurlari?islem=topla&anahtar=... → bir ölçüm alır (cron-job.org çağırır; anahtar zorunlu)
//
// KAYNAK: kur.doviz.com banka sayfaları (her sayfada TÜM bankaların alış/satış tablosu var → USD ve EUR için 2 istek).
// ⚠️ Üçüncü taraf ticari siteden otomatik okuma: kullanım koşulu / engellenme riski kullanıcıya bildirildi.
//    Önlemler: yalnız mesai saatinde, yalnız 30 dk'da bir, USD+EUR için tek tek istek, dürüst User-Agent,
//    BANKA_KURLARI=kapali acil anahtarı; engellenirse (403/429) sessizce durur ve uygulama elle JSON'a düşer.
// DOĞRULAMA: her satır kendi içinde tutarlı olmalı (satış>alış, makas=satış−alış, makas%=makas÷alış) — tutmayan satır ATILIR.
// SAYFA YAPISI DEĞİŞİRSE parser satır bulamaz → boş döner (yanlış veri yazmaz); uygulama elle JSON'a düşer.
// ═══════════════════════════════════════════════════════════════════════

const HEDEF_BANKALAR = [
  { ad: "Albaraka Türk",  desen: "Albaraka Türk" },
  { ad: "Dünya Katılım",  desen: "Dünya Katılım" },
  { ad: "Emlak Katılım",  desen: "Emlak Katılım" },
  { ad: "Hayat Finans",   desen: "Hayat Finans" },
  { ad: "Kuveyt Türk",    desen: "Kuveyt Türk" },
  { ad: "T.O.M. Katılım", desen: "(?:TOM Bank(?: Hadi)?|T\\.?O\\.?M\\.? Katılım|TOM Katılım)" },
  { ad: "Türkiye Finans", desen: "Türkiye Finans" },
  { ad: "Vakıf Katılım",  desen: "Vakıf Katılım" },
  { ad: "Ziraat Katılım", desen: "Ziraat Katılım" },
  { ad: "Adil Katılım",   desen: "Adil Katılım" },
];
const PARALAR = {
  USD: ["amerikan-dolari"],
  EUR: ["euro"],
  XAU: [],   // gram altın: altin.doviz.com tablosundan (altinTopla)
  XAG: [],   // gram gümüş: her bankanın KENDİ sayfasındaki tek satırdan (gumusTopla)
};
const DOVIZ_PARALARI = ["USD", "EUR"];
// Tablo her banka sayfasında aynı; ilk sayfada eksik banka kalırsa sıradaki sayfalar denenir (en çok 4 istek/para).
const SAYFA_BANKALARI = ["kuveyt-turk", "albaraka-turk", "vakif-katilim", "ziraat-katilim"];
const KAYNAK_ADRES = (banka, para) => `https://kur.doviz.com/${banka}/${para}`;
// Kıymetli madenler: her bankanın sayfasında hem "Gram Altın Banka Kurları" tablosu hem de o bankanın kendi "Gram Gümüş" satırı var.
const ALTIN_SAYFALARI = ["kuveyt-turk", "albaraka-turk", "vakif-katilim", "dunya-katilim", "emlak-katilim", "ziraat-katilim"];
const ALTIN_ADRES = (banka) => `https://altin.doviz.com/${banka}/gram-altin`;
const SAYFA_BANKA_AD = { "kuveyt-turk": "Kuveyt Türk", "albaraka-turk": "Albaraka Türk", "vakif-katilim": "Vakıf Katılım", "dunya-katilim": "Dünya Katılım", "emlak-katilim": "Emlak Katılım", "ziraat-katilim": "Ziraat Katılım" };
const USER_AGENT = "KatilimPlus-KurMakasi/1.0 (+https://www.katilimplus.com)";
const ZAMAN_ASIMI_MS = 12000;

const MESAI_BASLANGIC_DK = 10 * 60;        // 10:00 TR
const MESAI_BITIS_DK = 17 * 60 + 30;       // 17:30 TR
const SAKLAMA_GUN = 12;
const ANAHTAR_ORNEK = (gun) => `bankakur:ornek:${gun}`;
const ANAHTAR_SON_GUN = "bankakur:songun";
const ANAHTAR_DURUM = "bankakur:durum";

// ── Yardımcılar ────────────────────────────────────────────────────────
function trZaman(d = new Date()) {
  // Europe/Istanbul (UTC+3, DST yok)
  const t = new Date(d.getTime() + 3 * 3600 * 1000);
  const gun = t.toISOString().slice(0, 10);
  const dk = t.getUTCHours() * 60 + t.getUTCMinutes();
  const haftaGunu = t.getUTCDay(); // 0 Pzr … 6 Cmt
  return { gun, dk, haftaGunu, saat: t.toISOString().slice(11, 16) };
}
function mesaiMi(z) {
  return z.haftaGunu >= 1 && z.haftaGunu <= 5 && z.dk >= MESAI_BASLANGIC_DK && z.dk <= MESAI_BITIS_DK;
}
function trSayi(s) {
  // "1.234,5678" → 1234.5678 ; "48,9550" → 48.955
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function medyan(dizi) {
  const a = dizi.filter((x) => typeof x === "number" && x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const o = Math.floor(a.length / 2);
  return a.length % 2 ? a[o] : (a[o - 1] + a[o]) / 2;
}
const yuvarla4 = (x) => (x === null ? null : Math.round(x * 10000) / 10000);

// HTML → düz metin (etiketler boşluğa, varlıklar çözülür)
function duzMetin(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x?[0-9a-f]+;/gi, " ")
    .replace(/\s+/g, " ");
}

// Tablo satırı: "<banka adı> alış satış makas %makas%" — banka adı satırda iki kez geçebilir, sayılara bitişik olan eşleşir.
const SAYI = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2,4})";
export function bankaSatirlariniCikar(html) {
  const metin = duzMetin(html);
  const sonuc = {};
  for (const b of HEDEF_BANKALAR) {
    const re = new RegExp(`${b.desen}\\s+${SAYI}\\s+${SAYI}\\s+${SAYI}\\s+%\\s*(\\d+,\\d+)`, "g");
    let m;
    while ((m = re.exec(metin)) !== null) {
      const alis = trSayi(m[1]), satis = trSayi(m[2]), makas = trSayi(m[3]), makasYuzde = trSayi(m[4]);
      if (alis === null || satis === null || makas === null || makasYuzde === null) continue;
      // tutarlılık: satış>alış, makas=satış−alış (yuvarlama payı), makas%=makas÷alış×100
      if (!(satis > alis)) continue;
      if (Math.abs((satis - alis) - makas) > 0.0025 + satis * 0.00002) continue;
      if (Math.abs(makas / alis * 100 - makasYuzde) > 0.03) continue;
      sonuc[b.ad] = { alis, satis };
      break; // ilk tutarlı satır
    }
  }
  return sonuc;
}

// "<Banka> Gram Gümüş Gram Gümüş 97,65 100,23" — bankanın KENDİ gümüş satırı (makas sütunu yok)
export function gumusSatiriniCikar(html, bankaAd) {
  const b = HEDEF_BANKALAR.find((x) => x.ad === bankaAd);
  if (!b) return null;
  const metin = duzMetin(html);
  const re = new RegExp(`${b.desen}\\s+Gram Gümüş\\s+Gram Gümüş\\s+${SAYI}\\s+${SAYI}`);
  const m = re.exec(metin);
  if (!m) return null;
  const alis = trSayi(m[1]), satis = trSayi(m[2]);
  if (alis === null || satis === null || !(satis > alis) || satis > alis * 1.5) return null; // mantıksız satır atılır
  return { alis, satis };
}

// Gram altın (karşılaştırma tablosu) + gram gümüş (bankanın kendi satırı). Her sayfa isteği hem altını hem o bankanın gümüşünü verir.
export async function madenTopla(getir = sayfaGetir) {
  const altin = {}, gumus = {}, hatalar = [];
  let istek = 0;
  for (const slug of ALTIN_SAYFALARI) {
    istek++;
    try {
      const html = await getir(ALTIN_ADRES(slug));
      const satirlar = bankaSatirlariniCikar(html);
      for (const [ad, v] of Object.entries(satirlar)) if (!altin[ad]) altin[ad] = v;
      const g = gumusSatiriniCikar(html, SAYFA_BANKA_AD[slug]);
      if (g) gumus[SAYFA_BANKA_AD[slug]] = g;
    } catch (e) {
      hatalar.push(`${slug}/gram-altin: ${e.message}`);
      if (e.durum === 403 || e.durum === 429) return { altin, gumus, hatalar, istek, engellendi: true };
    }
  }
  return { altin, gumus, hatalar, istek, engellendi: false };
}

async function sayfaGetir(adres) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ZAMAN_ASIMI_MS);
  try {
    const r = await fetch(adres, { headers: { "User-Agent": USER_AGENT, "Accept": "text/html", "Accept-Language": "tr-TR,tr;q=0.9" }, signal: ctl.signal, redirect: "follow" });
    if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.durum = r.status; throw e; }
    return await r.text();
  } finally { clearTimeout(t); }
}

// Bir para birimi için tüm hedef bankaların satırlarını toplar
export async function paraTopla(para, getir = sayfaGetir) {
  if (!DOVIZ_PARALARI.includes(para)) return { toplam: {}, hatalar: [], istek: 0, engellendi: false };
  const toplam = {};
  const hatalar = [];
  let istek = 0;
  for (const banka of SAYFA_BANKALARI) {
    if (Object.keys(toplam).length >= HEDEF_BANKALAR.length - 1) break; // Adil Katılım gibi tabloda hiç olmayanlar için sonsuz denemeyiz
    for (const slug of PARALAR[para]) {
      istek++;
      try {
        const html = await getir(KAYNAK_ADRES(banka, slug));
        const satirlar = bankaSatirlariniCikar(html);
        for (const [ad, v] of Object.entries(satirlar)) if (!toplam[ad]) toplam[ad] = v;
      } catch (e) {
        hatalar.push(`${banka}/${slug}: ${e.message}`);
        if (e.durum === 403 || e.durum === 429) return { toplam, hatalar, istek, engellendi: true };
      }
    }
    // Hedef bankaların çoğu bulunduysa daha fazla sayfa istenmez
    if (Object.keys(toplam).length >= HEDEF_BANKALAR.length - 2) break;
  }
  return { toplam, hatalar, istek, engellendi: false };
}

// Gün içindeki örneklerden banka başına MEDYAN alış/satış
export function gunMedyani(ornekler) {
  const sonuc = [];
  for (const b of HEDEF_BANKALAR) {
    const satir = { ad: b.ad };
    for (const para of Object.keys(PARALAR)) {
      const alislar = [], satislar = [];
      for (const o of ornekler) {
        const v = o.v && o.v[b.ad] && o.v[b.ad][para];
        if (v && v.alis > 0 && v.satis > v.alis) { alislar.push(v.alis); satislar.push(v.satis); }
      }
      const a = medyan(alislar), s = medyan(satislar);
      satir[para] = a !== null && s !== null && s > a ? { alis: yuvarla4(a), satis: yuvarla4(s), n: alislar.length } : { alis: null, satis: null, n: 0 };
    }
    sonuc.push(satir);
  }
  return sonuc;
}

async function redisKapali() { return false; }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (process.env.BANKA_KURLARI === "kapali") return res.status(200).json({ kapali: true, bankalar: [] });
    const islem = String((req.query && req.query.islem) || "");

    // ── ÖLÇÜM AL (cron) ────────────────────────────────────────────────
    if (islem === "topla") {
      const beklenen = process.env.BANKA_KURLARI_ANAHTAR;
      if (!beklenen || String(req.query.anahtar || "") !== beklenen) return res.status(401).json({ hata: "yetkisiz" });
      const z = trZaman();
      const zorla = req.query.zorla === "1"; // test: mesai dışında da ölç
      if (!mesaiMi(z) && !zorla) return res.status(200).json({ atlandi: "mesai disi", zaman: `${z.gun} ${z.saat}` });
      const v = {};
      const durum = { zaman: `${z.gun} ${z.saat}`, hatalar: [], istek: 0, engellendi: false };
      for (const para of Object.keys(PARALAR)) {
        const s = await paraTopla(para);
        durum.istek += s.istek; durum.hatalar.push(...s.hatalar); if (s.engellendi) durum.engellendi = true;
        for (const [ad, d] of Object.entries(s.toplam)) { (v[ad] = v[ad] || {})[para] = d; }
        if (s.engellendi) break;
      }
      // Kıymetli madenler: yük azaltmak için SAATTE BİR (saat başı çağrısında, dakika 0-29)
      if (!durum.engellendi && (z.dk % 60 < 30 || zorla)) {
        const mt = await madenTopla();
        durum.istek += mt.istek; durum.hatalar.push(...mt.hatalar); if (mt.engellendi) durum.engellendi = true;
        for (const [ad, d] of Object.entries(mt.altin)) { (v[ad] = v[ad] || {}).XAU = d; }
        for (const [ad, d] of Object.entries(mt.gumus)) { (v[ad] = v[ad] || {}).XAG = d; }
        durum.maden = { altin: Object.keys(mt.altin).length, gumus: Object.keys(mt.gumus).length };
      }
      const bulunan = Object.keys(v).length;
      durum.bulunanBanka = bulunan;
      if (bulunan > 0) {
        const anahtar = ANAHTAR_ORNEK(z.gun);
        await redis.rpush(anahtar, JSON.stringify({ t: `${z.gun}T${z.saat}`, v }));
        await redis.expire(anahtar, SAKLAMA_GUN * 86400);
        await redis.set(ANAHTAR_SON_GUN, z.gun, { ex: SAKLAMA_GUN * 86400 });
      }
      await redis.set(ANAHTAR_DURUM, JSON.stringify({ ...durum, ts: new Date().toISOString() }), { ex: SAKLAMA_GUN * 86400 });
      return res.status(200).json({ ...durum, kaydedildi: bulunan > 0 });
    }

    // ── OKU (uygulama) ─────────────────────────────────────────────────
    const gun = await redis.get(ANAHTAR_SON_GUN);
    const durumRaw = await redis.get(ANAHTAR_DURUM);
    const durum = typeof durumRaw === "string" ? JSON.parse(durumRaw) : durumRaw;
    if (!gun) return res.status(200).json({ guncelleme: null, bankalar: [], tani: durum || null });
    const ham = await redis.lrange(ANAHTAR_ORNEK(String(gun)), 0, -1);
    const ornekler = (ham || []).map((x) => (typeof x === "string" ? JSON.parse(x) : x));
    const bankalar = gunMedyani(ornekler);
    const saatler = ornekler.map((o) => String(o.t).slice(11, 16)).sort();
    return res.status(200).json({
      guncelleme: String(gun),
      olcumNotu: ornekler.length ? `mesai içi ${ornekler.length} ölçümün medyanı (${saatler[0]}–${saatler[saatler.length - 1]})` : null,
      ornekSayisi: ornekler.length,
      kaynak: "doviz.com",
      kaynakNotu: "Bankaların ilan ettiği gösterge döviz kurları (kaynak: doviz.com banka kurları sayfaları); mesai içi ölçümlerin medyanı.",
      bankalar,
      tani: durum || null,
    });
  } catch (e) {
    console.error("banka-kurlari hata:", e);
    return res.status(200).json({ guncelleme: null, bankalar: [], hata: String(e && e.message ? e.message : e) });
  }
}
