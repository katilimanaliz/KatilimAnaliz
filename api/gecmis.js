// api/gecmis.js
// 30 günlük geçmiş fiyat serisi + güncel fiyat (Kur Grafik Modalı ve Piyasa tablosu)
//
// ═══════════════════════════════════════════════════════════════════════════
// GÜNCEL FİYAT ARTIK ALTINAPI'DEN (2026-08-08)
// ═══════════════════════════════════════════════════════════════════════════
// SORUN: Bu uç her şeyi Yahoo Finance'ten alıyordu. Yahoo'nun "USDTRY=X"
// sembolü BANKALARARASI (interbank) kuru verir — kullanıcının döviz
// bürosunda gördüğü SERBEST PİYASA kuru değildir. Ayrıca alış/satış ayrımı
// yoktur, tek fiyat döner. Gram altın da ons × kur ile HESAPLANIYORDU,
// yani Kapalı Çarşı fiyatı değil türetilmiş bir yaklaşıklıktı.
//
// ÇÖZÜM — GÖREV BÖLÜMÜ:
//   • GEÇMİŞ SERİ (30 günlük grafik) → Yahoo'da KALDI. AltinAPI yalnızca
//     anlık fiyat veriyor, geçmiş veri sunmuyor. Grafiğin şekli zaten
//     doğru; sorun hiçbir zaman geçmişte değildi.
//   • GÜNCEL FİYAT + ALIŞ/SATIŞ → AltinAPI (Harem Altın, serbest piyasa).
//     Investing.com ile karşılaştırıldı, birebir tutuyor.
//
// ORTAK ÖNBELLEK: Fiyat verisi piyasa-fiyatlar.js'in yazdığı MERKEZİ
// "altinapi:ham:v2" Redis anahtarından okunuyor. Bu uç her sembol için ayrı
// çağrıldığından (tabloda 10+ satır = 10+ istek), her seferinde AltinAPI'ye
// gitmek kotayı hızla tüketirdi. Anahtar boşsa (henüz yazılmamışsa) bir kez
// doldurulup paylaşılıyor.
//
// AltinAPI karşılığı OLMAYAN semboller (BIST hisseleri, fonlar, kripto,
// petrol, endeksler) eskisi gibi tamamen Yahoo/AlphaVantage'ten geliyor.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_TTL_SANIYE = 900; // 15 dakika

// Bir serinin "bayat" sayılması için gereken gecikme. Hafta sonu + resmî
// tatil üst üste gelirse Cuma kapanışı Salı sabahı 4 günlük görünebilir,
// bu yüzden eşik cömert tutuldu; asıl yakalanmak istenen 8+ günlük sapma.
const BAYATLIK_ESIGI_GUN = 5;

// ─── ALTINAPI EŞLEMESİ ─────────────────────────────────────────────────────
// Yahoo sembolü → AltinAPI sembolü. Burada olmayan semboller Yahoo'da kalır.
// DS_ önekliler: AltinAPI'nin ana sembolü boş döndürdüğü pariteler
// (örn. USDRUB bid=ask=0), farklı sağlayıcıdan gelen yedek seri.
const ALTINAPI_ESLEME = {
  // YALNIZCA KIYMETLİ MADEN (2026-08-10): Kur sembolleri bu tablodan
  // ÇIKARILDI. Kur artık AltinAPI'den değil Yahoo/Frankfurter'dan geliyor —
  // üç ayrı tipin aynı servisi çağırması kotayı doldurup HTTP 429'a yol
  // açmıştı. Altın/gümüşün AltinAPI'de kalması kritik: Kapalı Çarşı fiyatının
  // başka kaynağı yok, Yahoo yalnızca ons × kur ile TÜRETİLMİŞ değer verir.
  // Truncgil'de ONS sembolü 0 dönüyor; ons altın/gümüş Yahoo'da kaldı.
  "GRAM_ALTIN": "ALTIN",
  "GRAM_GUMUS": "GUMUSTRY",
  // KUR SEMBOLLERİ GERİ EKLENDİ (2026-08-10): AltinAPI döneminde kota
  // baskısı yüzünden çıkarılmışlardı. Truncgil'de o kısıt yok ve veri zaten
  // MERKEZİ önbellekten okunuyor — kur eklemek ek istek doğurmuyor. Ana
  // sayfadaki Piyasa Özeti bu uçtan beslendiği için kurlar da artık serbest
  // piyasa fiyatı gösteriyor (Yahoo'nun interbank kuru yerine).
  "USDTRY=X": "USDTRY", "EURTRY=X": "EURTRY", "GBPTRY=X": "GBPTRY",
  "CHFTRY=X": "CHFTRY", "SARTRY=X": "SARTRY", "JPYTRY=X": "JPYTRY",
  "CADTRY=X": "CADTRY", "AUDTRY=X": "AUDTRY", "CNYTRY=X": "CNYTRY",
  "RUBTRY=X": "RUBTRY", "AEDTRY=X": "AEDTRY",
};

// ─── MAKAS AKIL KONTROLÜ ───────────────────────────────────────────────────
// AltinAPI bazı sembollerde bozuk alış/satış döndürüyor. Ölçüldü (2026-08-08):
//   DKKTRY  alış 1,4754  satış 7,2206  → makas %389
//   SEKTRY  alış 3,5365  satış 5,0236  → makas %42
//   NOKTRY  alış 3,5293  satış 5,0065  → makas %42
//   DS_USDCNY alış 6,137 satış 7,304   → makas %19
// Normal bir döviz makası %0,2–3 aralığındadır (USD/TRY %0,2).
// Makas eşiği aşarsa YALNIZCA alış değil, SATIŞ da şüphelidir — bu yüzden
// zenginleştirme tamamen atlanır ve Yahoo değeri korunur. Bozuk fiyat
// göstermektense doğru ama serbest piyasa olmayan fiyatı göstermek yeğdir.
//
// İKİ AYRI EŞİK: Kıymetli madende makas doğal olarak geniştir — Kapalı
// Çarşı'da gram gümüş alış 94,31 / satış 102,27 (%8,4) gerçek bir fiyattır,
// düşük likiditeden gelir. Dövizdeki %5 eşiği burada uygulanırsa gümüş
// yanlışlıkla elenir. Bu yüzden kıymetli maden için eşik %12.
const MAKAS_ESIGI_DOVIZ = 5;
const MAKAS_ESIGI_KIYMETLI = 12;
const KIYMETLI_SEMBOLLER = new Set(["ALTIN","GUMUSTRY","XAUUSD","XAGUSD"]);

const KV_ALTINAPI = "altinapi:ham:v2"; // piyasa-fiyatlar.js MERKEZİ önbelleği (Truncgil)

// ⚠️ AYRI YEDEK ANAHTAR (2026-08-10) — MERKEZİ ANAHTARA YAZMA
// Bu dosyanın aşağıdaki yedek yolu Truncgil'den YALNIZCA ihtiyaç duyduğu 13
// sembolü (gram altın/gümüş + kurlar) çıkarıyor: ONS, AYAR22, çeyrek/yarım/
// tam/ata, platin YOK. Önceden bu daraltılmış harita doğrudan KV_ALTINAPI'ye
// yazılıyordu. Sonuç: gecmis.js önce çağrılırsa piyasa-fiyatlar.js aynı
// anahtardan bu eksik haritayı okuyup Fiziki Altın tablosunu TTL boyunca
// (mesai dışında 1 saate kadar) yarı boş gösteriyordu — üstelik hata
// vermeden. Devir belgesindeki "sessiz veri bayatlaması" deseninin aynısı.
//
// Kural: merkezi anahtarı YALNIZCA onu tam dolduran dosya yazar. Buradaki
// yedek kendi anahtarına yazar; okuma sırası önce merkezi, sonra yedek.
const KV_ALTINAPI_YEDEK = "gecmis:altin:ham:v1";

async function altinApiHaritaGetir() {
  try {
    const onbellek = await redis.get(KV_ALTINAPI);
    if (onbellek && typeof onbellek === "object") return onbellek;
  } catch { /* Redis erişilemezse aşağıda yedeğe/taze çekime düşülür */ }

  // Merkezi önbellek boşsa önce KENDİ yedeğimize bak — böylece her istekte
  // Truncgil'e gitmiyoruz (bu uç sembol başına ayrı çağrılıyor: tabloda 10+
  // satır = 10+ istek).
  try {
    const yedek = await redis.get(KV_ALTINAPI_YEDEK);
    if (yedek && typeof yedek === "object") return yedek;
  } catch { /* yedek de okunamazsa taze çekilir */ }

  // İkisi de boşsa Truncgil'den taze çek. (AltinAPI kotası dolduğu
  // için 2026-08-10'da kaynak Truncgil'e taşındı; anahtar gerektirmiyor.)
  try {
    // İki adres sırayla denenir: v4 sunucudan 404 dönebiliyor (tarayıcıdan
    // çalışsa bile). Yanıt biçimi de sürüme göre değişiyor, ikisi de tanınır.
    let json = null;
    for (const url of ["https://finance.truncgil.com/v4/today.json",
                       "https://finance.truncgil.com/api/today.json"]) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } });
        if (!r.ok) continue;
        const j = await r.json();
        if (j && (j.Rates || j.GRA)) { json = j; break; }
      } catch { /* sıradaki adrese geç */ }
    }
    if (!json) return null;
    const rates = json.Rates || json;
    const ESL = {
      GRA: "ALTIN", GUMUS: "GUMUSTRY",
      USD: "USDTRY", EUR: "EURTRY", GBP: "GBPTRY", CHF: "CHFTRY",
      SAR: "SARTRY", JPY: "JPYTRY", CAD: "CADTRY", AUD: "AUDTRY",
      CNY: "CNYTRY", RUB: "RUBTRY", AED: "AEDTRY",
    };
    const harita = {};
    for (const [t, u] of Object.entries(ESL)) {
      const d = rates[t];
      if (!d) continue;
      const say = (v) => (typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : Number(v));
      const b = say(d.Buying ?? d["Alış"]), a = say(d.Selling ?? d["Satış"]), ch = say(d.Change ?? d["Değişim"]);
      if (!isFinite(a) || a <= 0) continue;
      // JPY ölçek: Truncgil 1 JPY için 0,003022 veriyor, gerçek ~0,3024 —
      // tam 100 kat küçük. piyasa-fiyatlar.js ile aynı düzeltme.
      const carpan = t === "JPY" ? 100 : 1;
      const bid = (isFinite(b) && b > 0 ? b : a) * carpan;
      const askD = a * carpan;
      const orta = (bid + askD) / 2;
      harita[u] = {
        bid: Math.round(bid * 10000) / 10000,
        ask: Math.round(askD * 10000) / 10000,
        close: isFinite(ch) ? Math.round(orta / (1 + ch / 100) * 10000) / 10000 : null,
      };
    }
    if (!Object.keys(harita).length) return null;
    // TTL merkezi önbellekle aynı mantıkta: mesaide 60sn, dışında 1 saat.
    const _tr = (() => { try {
      const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
      return { gun: t.getDay(), saat: t.getHours() };
    } catch { return null; } })();
    const _ttl = _tr && _tr.gun >= 1 && _tr.gun <= 5 && _tr.saat >= 9 && _tr.saat < 18 ? 60 : 3600;
    // MERKEZİ anahtara DEĞİL, kendi yedeğimize yazıyoruz (yukarıdaki nota bak).
    try { await redis.set(KV_ALTINAPI_YEDEK, harita, { ex: _ttl }); } catch {}
    return harita;
  } catch { return null; }
}

function gecerliSayi(v) {
  const n = Number(v);
  return isFinite(n) && n > 0 ? n : null;
}

// Yahoo sonucunun üstüne AltinAPI güncel fiyatını/alış-satışını bindirir.
// Geçmiş seri (noktalar) DEĞİŞMEZ — yalnızca "şu anki" değerler tazelenir.
async function altinApiIleZenginlestir(sembol, sonuc) {
  const apiSembol = ALTINAPI_ESLEME[sembol];
  if (!apiSembol) return sonuc;

  const harita = await altinApiHaritaGetir();
  if (!harita) return sonuc;

  const kayit = harita[apiSembol];
  if (!kayit) return sonuc;

  const alis = gecerliSayi(kayit.bid);
  const satis = gecerliSayi(kayit.ask);
  if (satis == null) return sonuc; // veri yoksa Yahoo değeri korunur

  // Makas akıl kontrolü — bozuk veriyi tamamen reddet, Yahoo'ya bırak.
  if (alis != null) {
    const makas = ((satis - alis) / alis) * 100;
    const esik = KIYMETLI_SEMBOLLER.has(apiSembol) ? MAKAS_ESIGI_KIYMETLI : MAKAS_ESIGI_DOVIZ;
    if (!isFinite(makas) || makas < 0 || makas > esik) return sonuc;
  }

  return {
    ...sonuc,
    // Ana fiyat SATIŞ: kullanıcı döviz/altın ALIRKEN ödediği fiyat budur.
    guncelFiyat: satis,
    alis,
    satis,
    fiyatKaynagi: "altinapi",
    // oncekiKapanis Yahoo serisinin sondan ikinci noktası olarak KALIYOR:
    // AltinAPI'nin "close" alanı ölçüldü ve güvenilir değil (USD/TRY için
    // 47,297 veriyor, gerçek önceki kapanış 47,6087; gram altında yön bile
    // ters çıkıyordu). Yahoo'nun günlük kapanış serisi bu iş için doğru.
  };
}

function originIzinliMi(origin) {
  if (!origin) return false;
  if (/^https:\/\/katilim-analiz(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true;
  if (/^https:\/\/(www\.)?katilimplus\.com$/i.test(origin)) return true;
  // Native uygulama (Capacitor iOS/Android) origin'leri — 2026-07-23:
  // native WebView istekleri capacitor://localhost veya ionic://localhost
  // origin'iyle gelir; beyaz listede olmadıklari için BIST/haber/grafik
  // verileri native'de "Load failed" veriyordu.
  if (/^(capacitor|ionic):\/\/localhost$/i.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  return false;
}
function corsAyarla(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", originIzinliMi(origin) ? origin : "https://katilim-analiz.vercel.app");
  res.setHeader("Vary", "Origin");
}

// Sembolü doğrudan Yahoo Finance chart API'sinden çeker, ham "result" nesnesini
// döner (bulunamazsa null). Hem doğrudan hem çapraz kur hesaplarında ortak.
async function yahooChartCek(sembol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=1mo`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return null;
  const json = await r.json();
  return json?.chart?.result?.[0] || null;
}
function noktalarCikar(result) {
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  return timestamps
    .map((t, i) => ({ tarih: new Date(t * 1000).toISOString().slice(0, 10), fiyat: closes[i] }))
    .filter(p => p.fiyat != null && p.fiyat > 0);
}

// "XXXTRY=X" formatındaki bir sembolden 3 harfli para birimi kodunu çıkarır
// (örn. "CNYTRY=X" → "CNY"). Eşleşmezse null.
function dovizKoduCikar(sembol) {
  const m = /^([A-Z]{3})TRY=X$/.exec(String(sembol || "").toUpperCase());
  return m ? m[1] : null;
}

// Sembolü doğrudan Yahoo'dan çeker (GRAM_ALTIN/GRAM_GUMUS DIŞINDAKİ genel yol).
async function dogrudanCek(sembol) {
  const result = await yahooChartCek(sembol);
  if (!result) return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };

  const noktalar = noktalarCikar(result);
  const meta = result.meta || {};
  const guncelFiyat = meta.regularMarketPrice ?? (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
  const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
    ?? meta.previousClose ?? meta.chartPreviousClose ?? null;

  return { noktalar, guncelFiyat, oncekiKapanis };
}

// XXX/TRY = (USD/TRY) / (USD/XXX) — Yahoo'da "XXX=X" formatı USD/XXX verir.
async function caprazKurHesapla(xxxKodu) {
  const [usdTryResult, usdXxxResult] = await Promise.all([
    yahooChartCek("USDTRY=X"),
    yahooChartCek(`${xxxKodu}=X`),
  ]);
  if (!usdTryResult || !usdXxxResult) return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };

  const usdTryNoktalar = noktalarCikar(usdTryResult);
  const usdXxxNoktalar = noktalarCikar(usdXxxResult);
  const usdXxxMap = {};
  usdXxxNoktalar.forEach(n => { usdXxxMap[n.tarih] = n.fiyat; });

  // USD/XXX her gün için bulunamayabilir (piyasa tatilleri farklı olabilir) —
  // GRAM_ALTIN'daki "sonUsdTry" mantığıyla aynı: bulunamayan günde son bilinen
  // değeri ileri taşı.
  let sonUsdXxx = null;
  const noktalar = usdTryNoktalar
    .map(n => {
      const usdXxx = usdXxxMap[n.tarih] ?? sonUsdXxx;
      if (usdXxx != null) sonUsdXxx = usdXxx;
      if (usdXxx == null || usdXxx === 0) return null;
      return { tarih: n.tarih, fiyat: Math.round((n.fiyat / usdXxx) * 10000) / 10000 };
    })
    .filter(p => p !== null && p.fiyat > 0);

  const usdTryMeta = usdTryResult.meta || {};
  const usdXxxMeta = usdXxxResult.meta || {};
  const guncelUsdTry = usdTryMeta.regularMarketPrice ?? (usdTryNoktalar.length ? usdTryNoktalar[usdTryNoktalar.length - 1].fiyat : null);
  const guncelUsdXxx = usdXxxMeta.regularMarketPrice ?? (usdXxxNoktalar.length ? usdXxxNoktalar[usdXxxNoktalar.length - 1].fiyat : null);
  const guncelFiyat = (guncelUsdTry != null && guncelUsdXxx)
    ? Math.round((guncelUsdTry / guncelUsdXxx) * 10000) / 10000
    : (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);

  const oncekiUsdTry = usdTryMeta.previousClose ?? usdTryMeta.chartPreviousClose;
  const oncekiUsdXxx = usdXxxMeta.previousClose ?? usdXxxMeta.chartPreviousClose;
  const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
    ?? ((oncekiUsdTry != null && oncekiUsdXxx) ? Math.round((oncekiUsdTry / oncekiUsdXxx) * 10000) / 10000 : null);

  return { noktalar, guncelFiyat, oncekiKapanis };
}

async function alphaVantageBrentCek() {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) throw new Error("ALPHA_VANTAGE_KEY tanimli degil");
  const url = "https://www.alphavantage.co/query?function=BRENT&interval=daily&apikey=" + apiKey;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Alpha Vantage HTTP " + r.status);
  const json = await r.json();
  const veri = (json && json.data) || [];
  const temiz = veri.filter(function(n) {
    return n.value !== "." && n.value != null && !isNaN(parseFloat(n.value));
  });
  const noktalar = temiz.slice(0, 30).reverse().map(function(n) {
    return { tarih: n.date, fiyat: parseFloat(n.value) };
  });
  const guncelFiyat = noktalar.length ? noktalar[noktalar.length - 1].fiyat : null;
  const oncekiKapanis = noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null;
  return { noktalar: noktalar, guncelFiyat: guncelFiyat, oncekiKapanis: oncekiKapanis };
}

// Bir serinin en yeni noktasının kaç gün geride kaldığı.
function seriGecikmesiGun(noktalar) {
  if (!noktalar || !noktalar.length) return Infinity;
  const son = noktalar[noktalar.length - 1]?.tarih;
  if (!son) return Infinity;
  const t = Date.parse(son + "T00:00:00Z");
  if (!isFinite(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86400000);
}

async function veriHesapla(sembol) {
  const GRAM_ONS = 31.1034768;

  // ── BRENT: ALPHA VANTAGE ARTIK BİRİNCİL DEĞİL, YEDEK (2026-08-04) ────────
  // ÖNCEKİ DAVRANIŞ: BZ=F için Yahoo'ya HİÇ gidilmiyordu; Alpha Vantage'ın
  // BRENT ucu birincil kaynaktı ve yalnız o çökerse Yahoo devreye giriyordu.
  //
  // SORUN: AV'nin BRENT ucu piyasa verisi değil, referans/makro serisi —
  // gecikmeli yayınlanıyor. 4 Ağustos'ta seri 27 Temmuz'da bitiyordu, yani
  // 8 gün geride. Uygulamadaki diğer TÜM semboller Yahoo'dan canlı geldiği
  // için Brent tek başına bayat kalıyordu ve bu hiçbir yerde belli olmuyordu.
  //
  // İKİNCİ ETKİ: AV yolu `slice(0, 30)` ile 30 KAYIT alıyor; bunlar iş günü
  // olduğu için ~42 takvim gününe yayılıyor. Ekranda "Son 30 Gün" yazarken
  // grafik 41 günü gösteriyordu. Yahoo'nun `range=1mo` çağrısı ise 30 takvim
  // günü döndürüyor — yani Yahoo'ya geçmek etiketi de doğruya çeviriyor.
  //
  // ÜÇÜNCÜ ETKİ: `oncekiKapanis` serinin sondan ikinci noktası olduğu için
  // "Günlük Değişim" 24→27 Temmuz hareketini (−%8,46) bugünün hareketi gibi
  // gösteriyordu.
  //
  // YENİ SIRA: Yahoo önce. Yahoo boş dönerse VEYA serisi belirgin şekilde
  // bayatsa AV'ye düşülüyor — AV'nin eklenmiş olmasının bir sebebi vardı,
  // o güvenlik ağı korunuyor.
  if (sembol === "BZ=F") {
    let yahooSonuc = null;
    try {
      yahooSonuc = await dogrudanCek(sembol);
    } catch { /* aşağıda AV denenecek */ }

    const yahooTaze = yahooSonuc
      && yahooSonuc.noktalar.length > 1
      && seriGecikmesiGun(yahooSonuc.noktalar) <= BAYATLIK_ESIGI_GUN;

    if (yahooTaze) return { ...yahooSonuc, kaynak: "yahoo" };

    try {
      const av = await alphaVantageBrentCek();
      if (av.guncelFiyat != null) {
        return { ...av, kaynak: "alpha-vantage", gecikmeGun: seriGecikmesiGun(av.noktalar) };
      }
    } catch (e) {
      // AV de başarısızsa Yahoo'dan ne geldiyse onu döndür (boş bile olsa).
    }
    if (yahooSonuc) return { ...yahooSonuc, kaynak: "yahoo-bayat", gecikmeGun: seriGecikmesiGun(yahooSonuc.noktalar) };
  }

  if (sembol === "GRAM_ALTIN" || sembol === "GRAM_GUMUS") {
    const onsSembol = sembol === "GRAM_ALTIN" ? "GC=F" : "SI=F";
    const [onsRes, usdRes] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${onsSembol}?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);
    const onsJson = await onsRes.json();
    const usdJson = await usdRes.json();

    const onsResult = onsJson?.chart?.result?.[0];
    const usdResult = usdJson?.chart?.result?.[0];
    if (!onsResult || !usdResult) {
      return { noktalar: [], guncelFiyat: null, oncekiKapanis: null };
    }

    const usdMap = {};
    (usdResult.timestamp || []).forEach((t, i) => {
      const tarih = new Date(t * 1000).toISOString().slice(0, 10);
      const c = usdResult.indicators?.quote?.[0]?.close?.[i];
      if (c != null) usdMap[tarih] = c;
    });

    const onsTimestamps = onsResult.timestamp || [];
    const onsCloses = onsResult.indicators?.quote?.[0]?.close || [];

    let sonUsdTry = null;
    const noktalar = onsTimestamps
      .map((t, i) => {
        const tarih = new Date(t * 1000).toISOString().slice(0, 10);
        const onsFiyat = onsCloses[i];
        const usdTry = usdMap[tarih] ?? sonUsdTry;
        if (usdTry != null) sonUsdTry = usdTry;
        if (onsFiyat == null || usdTry == null) return null;
        const gramTL = (onsFiyat * usdTry) / GRAM_ONS;
        return { tarih, fiyat: Math.round(gramTL * 100) / 100 };
      })
      .filter(p => p !== null && p.fiyat > 0);

    const onsMeta = onsResult.meta || {};
    const usdMeta = usdResult.meta || {};
    const guncelOns = onsMeta.regularMarketPrice ?? null;
    const guncelUsd = usdMeta.regularMarketPrice;
    const oncekiOnsMeta = onsMeta.previousClose ?? onsMeta.chartPreviousClose;
    const oncekiUsdMeta = usdMeta.previousClose ?? usdMeta.chartPreviousClose;

    const guncelFiyat = (guncelOns != null && guncelUsd != null)
      ? Math.round((guncelOns * guncelUsd / GRAM_ONS) * 100) / 100
      : (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
    const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
      ?? ((oncekiOnsMeta != null && oncekiUsdMeta != null)
        ? Math.round((oncekiOnsMeta * oncekiUsdMeta / GRAM_ONS) * 100) / 100
        : null);

    return { noktalar, guncelFiyat, oncekiKapanis };
  }

  // 1) Önce Yahoo'dan doğrudan dene (mevcut/eski davranış — çoğu parite için
  //    zaten çalışıyor: USDTRY=X, EURTRY=X, GBPTRY=X, JPYTRY=X, CADTRY=X, AUDTRY=X…).
  const dogrudan = await dogrudanCek(sembol);
  if (dogrudan.guncelFiyat != null || dogrudan.noktalar.length > 0) {
    return dogrudan;
  }

  // 2) Doğrudan veri yoksa ve "XXXTRY=X" formatında bir paritesiyse, USD
  //    üzerinden çapraz kur türetmeyi dene (CNY, RUB, SAR, SEK, NOK, DKK,
  //    ZAR, AZN, KWD gibi Yahoo'da doğrudan karşılığı olmayan pariteler için).
  const xxx = dovizKoduCikar(sembol);
  if (xxx && xxx !== "USD") {
    try {
      const capraz = await caprazKurHesapla(xxx);
      if (capraz.guncelFiyat != null || capraz.noktalar.length > 0) {
        return capraz;
      }
    } catch {
      // çapraz kur da başarısızsa aşağıda boş sonuç dönülür
    }
  }

  return dogrudan; // ikisi de başarısızsa eskisi gibi boş sonuç
}

// Yahoo hesabının üstüne AltinAPI bindirmesi. veriHesapla'yı sarmalıyor ki
// önbellek de zenginleştirilmiş hâli tutsun.
async function veriHesaplaVeZenginlestir(sembol) {
  const temel = await veriHesapla(sembol);
  return await altinApiIleZenginlestir(sembol, temel);
}

export default async function handler(req, res) {
  corsAyarla(req, res);
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const { sembol, debug } = req.query;
  if (!sembol) {
    return res.status(400).json({ error: "sembol parametresi gerekli" });
  }

  // v1 → v2 (2026-08-04): Brent kaynak sırası değişti.
  // v2 → v3 (2026-08-08): Güncel fiyat + alış/satış AltinAPI'den geliyor;
  // eski önbellekteki Yahoo fiyatının TTL'i dolana kadar beklenmesin.
  const kvAnahtar = `gecmis:v6:${sembol}`;
  const debugMi = debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, kvAnahtar, KV_TTL_SANIYE, () => veriHesaplaVeZenginlestir(sembol), { debug: debugMi });
    res.status(200).json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(kvAnahtar);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    res.status(500).json({ error: e.message, noktalar: [], guncelFiyat: null, oncekiKapanis: null });
  }
}
