// api/getiri.js
//
// Üç işlem tek dosyada (Vercel 12 fonksiyon sınırı nedeniyle):
//
// 1) Getiri Karşılaştırma verisi:
//    GET /api/getiri?aralik=1hafta|1ay|3ay|6ay|1yil|ybb[&ekstra=SYM1,SYM2]
//    → { basarili, aralik, donem, getiriler:[{kod,ad,getiri,ilk,son}], ekstraGetiriler }
//
// 2) Haftalık Piyasa Özeti (arşivli):
//    GET /api/getiri?islem=haftalik-ozet
//    → { basarili, guncel:{hafta,donem,satirlar,fonHafta}, arsiv:[...] }
//    Bu haftanın anlık verisi hesaplanır ve Redis'te hafta anahtarıyla saklanır;
//    arşivde HER ZAMAN son 4 hafta tutulur (yeni hafta gelince en eski silinir).
//
// 3) Haftalık "Piyasalarda Ne Etkili Oldu?" metni (2026-10-03):
//    GET /api/getiri?islem=haftalik-neden&hafta=2026-W40
//    Arşivdeki haftanın hareketlerinin NEDENLERİNİ Gemini + Google Search ile
//    (yalnızca kaynakta açıkça geçenleri) üretir ve arşiv kaydına `nedenler`
//    olarak yazar; haftada bir kez üretilir, sonra herkese Redis'ten gelir.
//    Ekran bunu haftalik-ozet yanıtı geldikten SONRA, eksikse tetikler —
//    böylece asıl özet yavaşlamaz. Ayrıntı ve güvenlik kuralları:
//    api/_lib/haftalikNeden.js. Kapatmak için Vercel'de HAFTALIK_NEDEN=kapali.
//
// Veri kaynağı: Yahoo Finance v8 chart API. Gram Altın/Gümüş sentetik:
// (ons USD) × (USD/TRY) / 31.1034768.
//
// ANA MENÜ İLE TUTARLILIK (2026-10-03): Haftalık özet tablosunda USD/TRY, EUR/TRY,
// Gram Altın, Gram Gümüş, Ons Altın, Ons Gümüş (ve EUR/USD) satırları, ana menünün
// kullandığı kaynaktan (Truncgil / Kapalı Çarşı; api/piyasa-fiyatlar.js) gelir.
// Truncgil'in geçmiş verisi olmadığı için piyasa-fiyatlar her gün kendi değerlerini
// Redis'e yazar (piyasa:gunsonu:v1); haftalık özet "bu Cuma" ve "önceki Cuma"
// kayıtlarını oradan okur. İki kayıttan biri yoksa o satır eskisi gibi Yahoo'dan
// hesaplanır (satır başına `kaynak` alanı hangisi olduğunu gösterir).
// BIST / Katılım Endeksi / S&P 500 / Brent bu değişikliğin DIŞINDA kaldı.

import { Redis } from "@upstash/redis";
import { NEDEN_SURUM, NEDEN_MODEL, nedenPromptlari, nedenCozumle } from "./_lib/haftalikNeden.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const ARALIK_MAP = {
  "1hafta": "5d", // Yahoo'da 1 hafta = son 5 işlem günü
  "1ay":  "1mo",
  "3ay":  "3mo",
  "6ay":  "6mo",
  "1yil": "1y",
  "ybb":  "ytd",
};

async function yahooGetiri(sembol, range, p1, p2) {
  // p1/p2 (unix sn) verilirse sabit tarih penceresi, verilmezse range kullanılır
  const q = p1 && p2
    ? `period1=${p1}&period2=${p2}&interval=1d`
    : `range=${range}&interval=1d`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?${q}`;
  const ac = new AbortController();
  const zamanAsimi = setTimeout(() => ac.abort(), 6000); // tek istek 6sn'yi geçerse iptal — toplu bekleme kilitlenmesin
  let r;
  try {
    r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)" },
      signal: ac.signal,
    });
  } catch {
    clearTimeout(zamanAsimi);
    return null;
  }
  clearTimeout(zamanAsimi);
  if (!r.ok) return null;
  const j = await r.json();
  const sonuc = j?.chart?.result?.[0];
  const kapanis = sonuc?.indicators?.quote?.[0]?.close;
  const zamanlar = sonuc?.timestamp;
  if (!Array.isArray(kapanis)) return null;
  const seri = [];
  for (let i = 0; i < kapanis.length; i++) {
    const v = kapanis[i];
    if (typeof v === "number" && isFinite(v)) {
      seri.push({ f: v, t: Array.isArray(zamanlar) ? zamanlar[i] : null });
    }
  }
  if (seri.length < 2) return null;
  const ilk = seri[0];
  const son = seri[seri.length - 1];
  if (!ilk.f) return null;
  return {
    getiri: (son.f - ilk.f) / ilk.f,
    ad: sonuc?.meta?.shortName || sonuc?.meta?.symbol || sembol,
    ilk: ilk.f,
    son: son.f,
    ilkTs: ilk.t,
    sonTs: son.t,
    kaynak: "yahoo",
  };
}

const yzd = (v) => (v == null ? null : Math.round(v * 10000) / 100);

// ── BRENT: Alpha Vantage (2026-08-01) ─────────────────────────────────────
// 23 Temmuz'da Yahoo'nun "BZ=F" sembolünün ICE'nin likit Brent kontratı DEĞİL,
// NYMEX'te işlem gören düşük hacimli bir türev olduğu tespit edilmiş ve hem
// ana ekran (piyasa-fiyatlar.js) hem Emtia sekmesi (gecmis.js) Alpha
// Vantage'a geçirilmişti — ama BU DOSYA ATLANMIŞ. Sonuç: aynı uygulamada
// iki farklı Brent fiyatı (ana sayfa 91,82 / haftalık özet 90,12).
// Alpha Vantage verisi 2-3 gün gecikmeli olabildiği için pencereyi tam
// dolduramazsa Yahoo'ya düşülüyor — eksik göstermektense yaklaşık göster.
async function alphaVantageBrent(p1, p2) {
  const anahtar = process.env.ALPHA_VANTAGE_KEY;
  if (!anahtar) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(
      `https://www.alphavantage.co/query?function=BRENT&interval=daily&apikey=${anahtar}`,
      { signal: ac.signal }
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const ham = Array.isArray(j?.data) ? j.data : [];
    // Alpha Vantage en yeniden eskiye sıralı verir; pencereye düşenleri al.
    const noktalar = ham
      .map((d) => ({ ts: Math.floor(new Date(d.date + "T00:00:00Z").getTime() / 1000), f: parseFloat(d.value) }))
      .filter((d) => isFinite(d.f) && d.f > 0 && d.ts >= p1 && d.ts <= p2)
      .sort((a, b) => a.ts - b.ts);
    if (noktalar.length < 2) return null;
    const ilk = noktalar[0], son = noktalar[noktalar.length - 1];
    return {
      getiri: (son.f - ilk.f) / ilk.f,
      ad: "Brent Petrol",
      ilk: ilk.f, son: son.f,
      ilkTs: ilk.ts, sonTs: son.ts,
      kaynak: "alphavantage",
    };
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── TANI ALANLARI (2026-10-03) ─────────────────────────────────────────────
// Haftalık tablodaki her satırın SON mumunun (Türkiye) tarihi ve veri kaynağı
// satıra yazılır: "bu satır gerçekten Cuma kapanışını mı gösteriyor, ana
// menüdeki değerle neden farklı" sorularını tahminsiz yanıtlamak için.
// Ekran bu alanları kullanmaz; /api/getiri?islem=haftalik-ozet çıktısında görünür.
const gunTR = (ts) => (ts ? new Date(ts * 1000 + 3 * 3600 * 1000).toISOString().slice(0, 10) : null);

// ISO hafta anahtarından ("2026-W40") o haftanın CUMA tarihi (YYYY-MM-DD)
function haftaCumasi(h) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(h || ""));
  if (!m) return null;
  const y = Number(m[1]), w = Number(m[2]);
  const gun = new Date(Date.UTC(y, 0, 4)).getUTCDay() || 7;
  const pzt1 = Date.UTC(y, 0, 4 - (gun - 1)); // ISO 1. haftanın Pazartesisi
  return new Date(pzt1 + ((w - 1) * 7 + 4) * 86400000).toISOString().slice(0, 10);
}

// Kayıt, haftanın CUMA kapanışını içeriyor mu? (dönem tarihi BIST'in son mumundan gelir)
function cumaKapanisiVarMi(k) {
  const cuma = haftaCumasi(k?.hafta);
  const sonGun = k?.donem?.sonTarih ? new Date(new Date(k.donem.sonTarih).getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10) : null;
  return !!cuma && sonGun === cuma;
}

function tarihEkle(iso, gun) {
  return new Date(Date.parse(iso + "T00:00:00Z") + gun * 86400000).toISOString().slice(0, 10);
}

// "Cuma kapanışı" kaydı: Cuma 18:00'den (TR) sonra görülmüş Cuma kaydı varsa o; yoksa
// Cumartesi, sonra Pazar kaydı (hafta sonu fiyatlar Cuma kapanışında donuk kalır);
// hiçbiri yoksa (kayıt Cuma gündüzü) Cuma kaydı.
function gunSonuSec(gunler, cuma) {
  if (!gunler || !cuma) return null;
  const f = gunler[cuma];
  const kapanis = Date.parse(cuma + "T15:00:00Z"); // 18:00 TR
  if (f && typeof f.ts === "number" && f.ts >= kapanis) return f;
  return gunler[tarihEkle(cuma, 1)] || gunler[tarihEkle(cuma, 2)] || f || null;
}

const ANA_MENU_ESLEME = {
  USDTRY: "USDTRY", EURTRY: "EURTRY",
  GRAM_ALTIN: "ALTIN", GRAM_GUMUS: "GUMUSTRY",
  ONS_ALTIN: "ONS", ONS_GUMUS: "XAGUSD",
};
const sayiMi = (v) => typeof v === "number" && isFinite(v) && v > 0;

// Yahoo'dan hesaplanan satırların ilk/son/getirisini, mümkünse ana menünün kendi
// gün sonu kayıtlarıyla DEĞİŞTİRİR. İki kayıt arası 4–10 gün olmalı (haftalık değişim);
// aksi halde (geçmiş yetersiz) hiçbir satıra dokunulmaz.
async function anaMenuUygula(satirlar, cuma) {
  let gunler = null;
  try {
    const k = await redis.get("piyasa:gunsonu:v1");
    gunler = k && k.gunler && typeof k.gunler === "object" ? k.gunler : null;
  } catch {}
  if (!gunler || !cuma) return satirlar;
  const son = gunSonuSec(gunler, cuma);
  const ilk = gunSonuSec(gunler, tarihEkle(cuma, -7));
  if (!son || !ilk || typeof son.ts !== "number" || typeof ilk.ts !== "number") return satirlar;
  const gunFarki = (son.ts - ilk.ts) / 86400000;
  if (gunFarki < 4 || gunFarki > 10) return satirlar;

  const yeniSatir = (s, i, z) => ({
    ...s, ilk: i, son: z, getiri: yzd((z - i) / i), sonGun: cuma, kaynak: "ana-menu",
  });
  return satirlar.map((s) => {
    const anahtar = ANA_MENU_ESLEME[s.kod];
    if (anahtar && sayiMi(ilk[anahtar]) && sayiMi(son[anahtar])) {
      return yeniSatir(s, ilk[anahtar], son[anahtar]);
    }
    if (s.kod === "EURUSD" && sayiMi(ilk.EURTRY) && sayiMi(ilk.USDTRY) && sayiMi(son.EURTRY) && sayiMi(son.USDTRY)) {
      return yeniSatir(s, ilk.EURTRY / ilk.USDTRY, son.EURTRY / son.USDTRY);
    }
    return s;
  });
}

// Cuma'yı izleyen SALI 00:00'dan (Türkiye) itibaren kayıt "kararlı" sayılır: o zamana
// kadar Cuma mumu hâlâ yoksa bu gerçek bir tatil/veri boşluğudur, kayıt artık donar.
function kayitKararliMi(k) {
  const cuma = haftaCumasi(k?.hafta);
  if (!cuma) return true;
  const trSimdi = Date.now() + 3 * 3600 * 1000;
  return trSimdi >= Date.parse(cuma + "T00:00:00Z") + 4 * 86400000;
}

// Ana enstrüman setini verilen aralık (veya sabit p1/p2 penceresi) için hesaplar.
// genis=true → haftalık özet için ek küresel enstrümanlar da dahil edilir.
async function hesaplaGetiriler(range, ekstraSemboller = [], p1, p2, genis = false) {
  const [usd, eur, onsAltin, onsGumus, xu100, xk100, brent, eurusd, sp500, ...ekstraSonuclar] = await Promise.all([
    yahooGetiri("USDTRY=X", range, p1, p2),
    yahooGetiri("EURTRY=X", range, p1, p2),
    yahooGetiri("GC=F", range, p1, p2),
    yahooGetiri("SI=F", range, p1, p2),
    yahooGetiri("XU100.IS", range, p1, p2),
    yahooGetiri("XK100.IS", range, p1, p2),
    genis
      ? (p1 && p2
          ? alphaVantageBrent(p1, p2).then((av) => av || yahooGetiri("BZ=F", range, p1, p2))
          : yahooGetiri("BZ=F", range, p1, p2))
      : Promise.resolve(null),
    genis ? yahooGetiri("EURUSD=X", range, p1, p2) : Promise.resolve(null),
    genis ? yahooGetiri("^GSPC", range, p1, p2) : Promise.resolve(null),
    ...ekstraSemboller.map((s) => yahooGetiri(s, range, p1, p2)),
  ]);

  const gramAltin =
    onsAltin?.getiri != null && usd?.getiri != null
      ? (1 + onsAltin.getiri) * (1 + usd.getiri) - 1
      : null;
  const gramGumus =
    onsGumus?.getiri != null && usd?.getiri != null
      ? (1 + onsGumus.getiri) * (1 + usd.getiri) - 1
      : null;

  const OZ = 31.1034768;
  const gAltinIlk = onsAltin && usd ? (onsAltin.ilk * usd.ilk) / OZ : null;
  const gAltinSon = onsAltin && usd ? (onsAltin.son * usd.son) / OZ : null;
  const gGumusIlk = onsGumus && usd ? (onsGumus.ilk * usd.ilk) / OZ : null;
  const gGumusSon = onsGumus && usd ? (onsGumus.son * usd.son) / OZ : null;

  const getiriler = [
    { kod: "USDTRY",     ad: "USD/TRY",          getiri: yzd(usd?.getiri),      ilk: usd?.ilk ?? null,      son: usd?.son ?? null,      sonGun: gunTR(usd?.sonTs),      kaynak: usd?.kaynak ?? null },
    { kod: "EURTRY",     ad: "EUR/TRY",          getiri: yzd(eur?.getiri),      ilk: eur?.ilk ?? null,      son: eur?.son ?? null,      sonGun: gunTR(eur?.sonTs),      kaynak: eur?.kaynak ?? null },
    { kod: "ONS_ALTIN",  ad: "Ons Altın ($)",    getiri: yzd(onsAltin?.getiri), ilk: onsAltin?.ilk ?? null, son: onsAltin?.son ?? null, sonGun: gunTR(onsAltin?.sonTs), kaynak: onsAltin?.kaynak ?? null },
    { kod: "GRAM_ALTIN", ad: "Gram Altın (₺)",   getiri: yzd(gramAltin),        ilk: gAltinIlk,             son: gAltinSon,             sonGun: gunTR(onsAltin?.sonTs), kaynak: "sentetik (ons × USD/TRY)" },
    { kod: "ONS_GUMUS",  ad: "Ons Gümüş ($)",    getiri: yzd(onsGumus?.getiri), ilk: onsGumus?.ilk ?? null, son: onsGumus?.son ?? null, sonGun: gunTR(onsGumus?.sonTs), kaynak: onsGumus?.kaynak ?? null },
    { kod: "GRAM_GUMUS", ad: "Gram Gümüş (₺)",   getiri: yzd(gramGumus),        ilk: gGumusIlk,             son: gGumusSon,             sonGun: gunTR(onsGumus?.sonTs), kaynak: "sentetik (ons × USD/TRY)" },
    { kod: "XU100",      ad: "BIST 100",         getiri: yzd(xu100?.getiri),    ilk: xu100?.ilk ?? null,    son: xu100?.son ?? null,    sonGun: gunTR(xu100?.sonTs),    kaynak: xu100?.kaynak ?? null },
    { kod: "XK100",      ad: "Katılım Endeksi",  getiri: yzd(xk100?.getiri),    ilk: xk100?.ilk ?? null,    son: xk100?.son ?? null,    sonGun: gunTR(xk100?.sonTs),    kaynak: xk100?.kaynak ?? null },
  ];

  if (genis) {
    getiriler.push(
      { kod: "BRENT",  ad: "Brent Petrol ($)",  getiri: yzd(brent?.getiri),  ilk: brent?.ilk ?? null,  son: brent?.son ?? null,  sonGun: gunTR(brent?.sonTs),  kaynak: brent?.kaynak ?? null },
      { kod: "EURUSD", ad: "EUR/USD",           getiri: yzd(eurusd?.getiri), ilk: eurusd?.ilk ?? null, son: eurusd?.son ?? null, sonGun: gunTR(eurusd?.sonTs), kaynak: eurusd?.kaynak ?? null },
      { kod: "SP500",  ad: "S&P 500",           getiri: yzd(sp500?.getiri),  ilk: sp500?.ilk ?? null,  son: sp500?.son ?? null,  sonGun: gunTR(sp500?.sonTs),  kaynak: sp500?.kaynak ?? null },
    );
  }

  const ekstraGetiriler = ekstraSemboller.map((sembol, i) => ({
    sembol,
    ad: ekstraSonuclar[i]?.ad || sembol,
    getiri: yzd(ekstraSonuclar[i]?.getiri),
    ilk: ekstraSonuclar[i]?.ilk ?? null,
    son: ekstraSonuclar[i]?.son ?? null,
  }));

  // Dönem tarihleri ÖNCE BIST'ten alınıyor (2026-08-01 düzeltmesi).
  // Önceden referans USD/TRY idi; forex 7/24 işlem gördüğü için Yahoo
  // cumartesi/pazar damgalı mum da döndürebiliyor ve başlık "1 Ağustos"
  // gibi hafta sonu tarihi gösteriyordu — oysa hafta cuma kapanışında
  // bitiyor. Borsa endeksi yalnızca işlem günlerinde mum ürettiği için
  // tarih etiketi olarak daha güvenilir.
  const ref = xu100 || eur || usd;
  const donem = {
    ilkTarih: ref?.ilkTs ? new Date(ref.ilkTs * 1000).toISOString() : null,
    sonTarih: ref?.sonTs ? new Date(ref.sonTs * 1000).toISOString() : null,
  };

  return { getiriler, ekstraGetiriler, donem };
}

// ISO hafta anahtarı: "2026-W28" — arşivde haftaları ayırt etmek için
function isoHafta(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const gun = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - gun);
  const yilBasi = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const hafta = Math.ceil(((t - yilBasi) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(hafta).padStart(2, "0")}`;
}

// Para piyasası katılım fonlarının haftalık ortalaması (kendi tefas-proxy'mizden)
async function fonHaftalikOrt(host) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const r = await fetch(`https://${host}/api/tefas-proxy`, { signal: ac.signal }).finally(() => clearTimeout(t));
    if (!r.ok) return null;
    const j = await r.json();
    const fonlar = (j?.data || []).filter((f) => {
      const kat = String(f.kategori || "").toLocaleUpperCase("tr-TR");
      const ad = String(f.ad || "").toLocaleUpperCase("tr-TR");
      return kat.includes("PARA") || ad.includes("PARA");
    });
    const v = fonlar.map((f) => f?.haftalik).filter((x) => typeof x === "number" && isFinite(x) && x !== 0);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
  } catch {
    return null;
  }
}

// Haftanın öne çıkan haber başlıkları (kendi finans-haberleri endpoint'imizden)
async function haftaninHaberleri(host) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const r = await fetch(`https://${host}/api/finans-haberleri`, { signal: ac.signal }).finally(() => clearTimeout(t));
    if (!r.ok) return [];
    const j = await r.json();
    const liste = j?.success && Array.isArray(j.data) ? j.data : [];
    return liste.slice(0, 5).map((h) => ({
      baslik: String(h?.baslik || "").slice(0, 200),
      kaynak: h?.kaynak ? String(h.kaynak).slice(0, 60) : null,
    })).filter((h) => h.baslik);
  } catch {
    return [];
  }
}

const ARSIV_ANAHTAR = "haftalikOzetArsiv";
const ARSIV_BOYU = 4; // her zaman son 4 hafta tutulur

// Bu endpoint 9 paralel Yahoo isteği + fon/haber isteklerini birlikte
// çalıştırır; Vercel planı izin veriyorsa süre sınırını uzatır (Hobby
// planda üst sınır 10sn'de sabit kalır, bu satır zararsızdır).
export const config = { maxDuration: 30 };

async function haftalikOzet(req, res) {
  // Yazma yapan işlem — CDN'de kısa cache yeterli
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");

  // ── Hedef hafta: HER ZAMAN son TAMAMLANMIŞ Pazartesi–Cuma haftası ──
  // Kural (Türkiye saatiyle): hafta içi (Pzt–Cum) bir ÖNCEKİ haftanın
  // Pzt–Cum'u gösterilir; Cumartesi'den itibaren yeni biten hafta gösterilir.
  // Örn: 9 Temmuz Perşembe → 29 Haz–3 Tem; 11 Temmuz Cumartesi → 6–10 Tem.
  const trSimdi = new Date(Date.now() + 3 * 3600 * 1000); // UTC+3
  const gun = trSimdi.getUTCDay(); // 0=Paz ... 6=Cmt
  let pazartesiyeGeri;
  if (gun === 6) pazartesiyeGeri = 5;        // Cumartesi → bu haftanın Pzt'si
  else if (gun === 0) pazartesiyeGeri = 6;   // Pazar → bu haftanın Pzt'si
  else pazartesiyeGeri = (gun - 1) + 7;      // Pzt–Cum → önceki haftanın Pzt'si
  const pzt = new Date(Date.UTC(trSimdi.getUTCFullYear(), trSimdi.getUTCMonth(), trSimdi.getUTCDate() - pazartesiyeGeri));

  // ⚠️ PENCERE DÜZELTMESİ (2026-08-01): Önceden p1 = Pazartesi 00:00 idi ve
  // Yahoo'dan gelen İLK günlük mum PAZARTESİ KAPANIŞI oluyordu. Haftalık
  // değişim pazartesi kapanışından cuma kapanışına ölçülüyordu — yani
  // PAZARTESİ GÜNÜ İÇİNDEKİ HAREKET TAMAMEN KAYBOLUYORDU. Piyasa standardı
  // önceki hafta CUMA KAPANIŞINDAN bu hafta cuma kapanışına ölçmektir.
  // Artık pencere önceki Cuma 00:00'da başlıyor; ilk mum önceki cuma
  // kapanışı, son mum bu cuma kapanışı oluyor.
  // Tablodaki başlangıç sütunu bu yüzden pazartesi değil ÖNCEKİ CUMA
  // tarihini gösterir — kasıtlıdır, getiri hesabının doğrusu budur.
  const oncekiCuma = new Date(pzt.getTime() - 3 * 86400 * 1000);   // Pzt − 3 gün
  const p1 = Math.floor(oncekiCuma.getTime() / 1000);     // Önceki Cuma 00:00 UTC
  const p2 = Math.floor(pzt.getTime() / 1000) + 5 * 86400 + 43200; // Cumartesi 12:00 UTC
  const hafta = isoHafta(pzt);

  // Arşivi oku — hedef hafta zaten kayıtlıysa OLDUĞU GİBİ kullan.
  // (Tamamlanmış haftanın fiyatları değişmez; yeniden hesaplamak hem gereksiz
  // hem de fon ortalamasını sonraki haftanın verisiyle bozabilir.)
  let arsiv = [];
  try {
    const ham = await redis.get(ARSIV_ANAHTAR);
    if (Array.isArray(ham)) arsiv = ham;
    else if (typeof ham === "string") arsiv = JSON.parse(ham) || [];
  } catch {}

  // v:3 (2026-08-01) → pencere önceki Cuma kapanışından başlıyor, Brent
  // Alpha Vantage'tan geliyor, dönem tarihi BIST referanslı. Sürüm
  // artırılmazsa arşivdeki v:2 kayıtlar ESKİ YÖNTEMLE hesaplanmış hâlde
  // kalır ve sekmeler arasında karışık yöntem görünürdü.
  let guncel = arsiv.find((k) => k && k.hafta === hafta && k.v === 3 && Array.isArray(k.satirlar) && k.satirlar.length > 0);

  // ⚠️ CUMA KAPANIŞI KONTROLÜ (2026-10-03, kullanıcı raporu: tablo "25 Eylül – 1 Ekim"
  // gösteriyordu, oysa hafta 2 Ekim Cuma'da bitiyor). Hafta Cumartesi 00:00'dan
  // itibaren hesaplanır ama Yahoo, Cuma'nın son mumunu (BIST) o saatte henüz
  // vermemiş olabilir; kayıt bu eksik veriyle arşive yazılınca "tamamlanmış hafta
  // değişmez" kuralı yüzünden hep eksik kalıyordu. Artık: kayıtta haftanın CUMA
  // mumu yoksa ve Cuma'yı izleyen Salı 00:00 (TR) gelmediyse arşivdeki kayıt
  // KULLANILMAZ, yeniden hesaplanır (Salı'dan sonra hâlâ yoksa gerçek tatil/veri
  // boşluğu kabul edilip kayıt donar). Yeniden hesaplanan kayıtta eski `nedenler`
  // otomatik düşer; yeni veriye göre yeniden üretilir.
  if (guncel && !cumaKapanisiVarMi(guncel) && !kayitKararliMi(guncel)) {
    guncel = undefined;
  }

  if (!guncel) {
    // Üç ayrı veri kaynağı (Yahoo, kendi tefas-proxy, kendi finans-haberleri)
    // önceden SIRAYLA bekleniyordu — toplam süre Vercel'in fonksiyon zaman
    // aşımına (hobby planda ~10sn) yaklaşıp isteği kesebiliyordu. Artık
    // paralel çalıştırılıyor; haber/fon kaynaklarından biri yavaş/hatalı
    // olsa bile (kendi içlerinde try/catch ile null/[] döner) ana veri
    // etkilenmez.
    const [{ getiriler: yahooSatirlar, donem }, fonHafta, haberler] = await Promise.all([
      hesaplaGetiriler(null, [], p1, p2, true), // genis: Brent, EUR/USD, S&P 500 dahil
      fonHaftalikOrt(req.headers.host),
      haftaninHaberleri(req.headers.host),
    ]);
    // Ana menüyle aynı kaynaktan (Truncgil gün sonu kayıtları) gelen satırlar Yahoo'nun
    // yerine geçer; Yahoo'su başarısız olmuş (getiri null) ama kaydı olan satır da kurtarılır.
    const getiriler = await anaMenuUygula(yahooSatirlar, haftaCumasi(hafta));
    guncel = {
      v: 3,
      hafta,
      donem,
      satirlar: getiriler.filter((g) => g.getiri != null),
      fonHafta,
      haberler,
      guncellemeTs: Date.now(),
    };
    // Sadece geçerli veri geldiyse arşive yaz
    if (guncel.satirlar.length > 0) {
      const yeni = [...arsiv.filter((k) => k && k.hafta !== hafta), guncel]
        .sort((a, b) => String(a.hafta).localeCompare(String(b.hafta)))
        .slice(-ARSIV_BOYU); // en eski hafta otomatik düşer (her zaman son 4)
      try { await redis.set(ARSIV_ANAHTAR, JSON.stringify(yeni)); } catch {}
      arsiv = yeni;
    }
  }

  // Eski sürümlü (v<3) arşiv kayıtları gösterilmiyor: farklı yöntemle
  // hesaplandıkları için aynı ekranda yan yana durmaları yanıltıcı olur.
  // Zamanla yerlerini v:3 kayıtlar alır.
  const gecmis = arsiv
    .filter((k) => k && k.hafta !== hafta && k.v === 3)
    .sort((a, b) => String(b.hafta).localeCompare(String(a.hafta)));

  res.status(200).json({ basarili: true, guncel, arsiv: gecmis });
}

// ── HAFTALIK NEDEN METNİ (2026-10-03) ─────────────────────────────────────
// Gemini + Google Search ile üretilir. Kurallar ve ayrıştırma: _lib/haftalikNeden.js.
// Hata durumunda geriye { hata } döner; çağıran taraf kullanıcıya hiçbir şey
// göstermez (ekran bölümü gizler) ve 30 dk soğuma uygular.
async function nedenUret(kayit) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { hata: "anahtar-yok" };
  const { sistem, kullanici, kodlar } = nedenPromptlari(kayit);
  if (kodlar.size === 0) return { hata: "veri-yok" };

  const ac = new AbortController();
  const zamanAsimi = setTimeout(() => ac.abort(), 24000);
  let r, j;
  try {
    r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${NEDEN_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistem }] },
          contents: [{ role: "user", parts: [{ text: kullanici }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }),
        signal: ac.signal,
      }
    );
    j = await r.json().catch(() => null);
  } catch {
    clearTimeout(zamanAsimi);
    return { hata: "ag" };
  }
  clearTimeout(zamanAsimi);
  // Hata gövdesinin ilk 120 karakteri: neden gizli kaldığını TAHMİNSİZ görmek için (api yanıtındaki `sebep`)
  if (!r.ok) return { hata: "gemini-" + r.status + ": " + String(j?.error?.message || "").replace(/\s+/g, " ").slice(0, 120) };

  const aday = j?.candidates?.[0];
  // Parçalar "" ile birleştirilir: grounding bayt ofsetleri bu birleşik metne göre
  const metin = (aday?.content?.parts || [])
    .filter((p) => p && !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  const sonuc = nedenCozumle(metin, aday?.groundingMetadata, kodlar);
  if (sonuc.hata) return sonuc;
  return {
    nedenler: {
      v: NEDEN_SURUM,
      ts: Date.now(),
      model: NEDEN_MODEL,
      kaynaklar: sonuc.kaynaklar,
      satirlar: sonuc.satirlar,
    },
  };
}

async function arsivOku() {
  try {
    const ham = await redis.get(ARSIV_ANAHTAR);
    if (Array.isArray(ham)) return ham;
    if (typeof ham === "string") return JSON.parse(ham) || [];
  } catch {}
  return [];
}

async function haftalikNeden(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (String(process.env.HAFTALIK_NEDEN || "").toLowerCase() === "kapali") {
    res.status(200).json({ basarili: false, kapali: true });
    return;
  }
  const hedef = String(req.query?.hafta || "");
  if (!/^\d{4}-W\d{2}$/.test(hedef)) {
    res.status(400).json({ basarili: false, hata: "Geçersiz hafta" });
    return;
  }

  const bul = (liste) => liste.find((k) => k && k.hafta === hedef && k.v === 3 && Array.isArray(k.satirlar) && k.satirlar.length > 0);
  const kayit = bul(await arsivOku());
  if (!kayit) {
    res.status(404).json({ basarili: false, hata: "Hafta arşivde yok" });
    return;
  }
  // Haftanın Cuma kapanışı henüz verilerde yoksa sebep ÜRETME (eksik tabloya sebep yazılmasın)
  if (!cumaKapanisiVarMi(kayit) && !kayitKararliMi(kayit)) {
    res.status(200).json({ basarili: false, eksik: true });
    return;
  }
  // Zaten üretilmişse (boş sonuç dahil) tekrar çağrı YOK — Gemini'ye haftada bir gidilir
  if (kayit.nedenler && kayit.nedenler.v === NEDEN_SURUM) {
    res.status(200).json({ basarili: true, nedenler: kayit.nedenler });
    return;
  }

  // Herkese açık uç nokta: kötüye kullanımı önle — hafta başına tek eşzamanlı üretim
  // (kilit) ve başarısızlıktan sonra 30 dk soğuma.
  const kilit = "haftalikNedenKilit:" + hedef;
  const sogu = "haftalikNedenSogu:" + hedef;
  try {
    const sonHata = await redis.get(sogu);
    // ⚠️ Upstash, "1" gibi sayıya benzeyen metni SAYI (1) olarak geri verir (otomatik JSON
    // ayrıştırma) — bu yüzden sonHata her zaman String()'e çevrilip karşılaştırılır.
    // "1": önceki sürümün sebepsiz soğuma işareti — eski kayıt, YOK sayılır (bir kez yeniden
    // denenir ve gerçek hata sebebi yakalanır); yeni kayıtlar sebep metni taşır.
    const sonHataMetin = sonHata == null ? "" : String(sonHata);
    if (sonHataMetin && sonHataMetin !== "1") {
      res.status(200).json({ basarili: false, beklemede: true, sebep: sonHataMetin });
      return;
    }
    const aldi = await redis.set(kilit, "1", { nx: true, ex: 90 });
    if (!aldi) {
      res.status(200).json({ basarili: false, uretiliyor: true });
      return;
    }
  } catch {
    // Redis kilidi okunamazsa üretime GİTME (kontrolsüz Gemini çağrısı riski)
    res.status(200).json({ basarili: false });
    return;
  }

  try {
    const sonuc = await nedenUret(kayit);
    if (sonuc.hata) {
      console.error("haftalik-neden hata:", hedef, sonuc.hata);
      try { await redis.set(sogu, String(sonuc.hata).slice(0, 160), { ex: 1800 }); } catch {}
      res.status(200).json({ basarili: false, sebep: sonuc.hata });
      return;
    }
    // Üretim sırasında arşiv değişmiş olabilir → yeniden oku, yalnızca bu haftanın kaydına yaz
    const guncelArsiv = await arsivOku();
    const hedefKayit = bul(guncelArsiv);
    if (hedefKayit) {
      hedefKayit.nedenler = sonuc.nedenler;
      try { await redis.set(ARSIV_ANAHTAR, JSON.stringify(guncelArsiv)); } catch {}
    }
    res.status(200).json({ basarili: true, nedenler: sonuc.nedenler });
  } catch (e) {
    console.error("haftalik-neden istisna:", e);
    try { await redis.set(sogu, "istisna: " + String(e?.message || e).slice(0, 120), { ex: 1800 }); } catch {}
    res.status(200).json({ basarili: false, sebep: "istisna" });
  } finally {
    try { await redis.del(kilit); } catch {}
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    if (String(req.query?.islem || "") === "haftalik-ozet") {
      await haftalikOzet(req, res);
      return;
    }
    if (String(req.query?.islem || "") === "haftalik-neden") {
      await haftalikNeden(req, res);
      return;
    }

    // ── Standart getiri karşılaştırma akışı ──
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

    const aralik = String(req.query?.aralik || "1ay");
    const range = ARALIK_MAP[aralik];
    if (!range) {
      res.status(400).json({ basarili: false, hata: "Geçersiz aralık. 1hafta|1ay|3ay|6ay|1yil|ybb" });
      return;
    }

    const ekstraHam = String(req.query?.ekstra || "");
    const ekstraSemboller = ekstraHam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s.length <= 15 && /^[A-Z0-9.\-=^]+$/.test(s))
      .slice(0, 8);

    const { getiriler, ekstraGetiriler, donem } = await hesaplaGetiriler(range, ekstraSemboller);

    res.status(200).json({ basarili: true, aralik, donem, getiriler, ekstraGetiriler });
  } catch (e) {
    console.error("getiri.js hatası:", e);
    res.status(500).json({ basarili: false, hata: "Sunucu hatası", detay: String(e) });
  }
}
