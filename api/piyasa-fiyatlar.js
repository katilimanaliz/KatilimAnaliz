// api/piyasa-fiyatlar.js
// Birleştirilmiş fiyat proxy'si: altin + kripto + petrol + kur + altinapi
// Kullanım: /api/piyasa-fiyatlar?tip=altin | kripto | petrol | kur | altinapi
//
// ═══════════════════════════════════════════════════════════════════════════
// KAYNAK DEĞİŞİKLİĞİ (2026-08-08) — Yahoo/Frankfurter → AltinAPI
// ═══════════════════════════════════════════════════════════════════════════
// SORUN: Kurlar Frankfurter'dan (Avrupa Merkez Bankası GÜNLÜK REFERANS kuru,
// günde tek yayın) geliyordu. Ne serbest piyasa kuruydu ne de gün içinde
// güncelleniyordu; kullanıcının döviz bürosunda gördüğü rakamla uyuşmuyordu.
// Altın/gümüş ise Yahoo futures'tan (GC=F, SI=F) alınıp USD/TRY ile
// ÇARPILARAK gram fiyatına çevriliyordu — Kapalı Çarşı fiyatı değil,
// türetilmiş bir yaklaşıklıktı.
//
// ÇÖZÜM: Döviz + altın + gümüş tamamen AltinAPI'ye (Harem Altın verisi,
// serbest piyasa) taşındı. Investing.com ile karşılaştırıldı, fiyatlar birebir
// tutuyor. Uygulama genelinde tek kaynak kullanılıyor.
//
// ALTINAPI'DE OLMAYANLAR — bilinçli olarak eski kaynaklarında bırakıldı:
//   • Petrol (BZ=F)  → AlphaVantage, yedeği Yahoo
//   • Bitcoin        → CoinGecko
//
// ═══════════════════════════════════════════════════════════════════════════
// GÜNLÜK DEĞİŞİM: KENDİ KAPANIŞIMIZ (2026-08-08)
// ═══════════════════════════════════════════════════════════════════════════
// AltinAPI'nin "close" alanı GÜVENİLİR DEĞİL. Ölçüldü: USD/TRY için 47,297
// veriyor ama gerçek önceki kapanış 47,6087; gram altında 6.693 diyor,
// gerçek ~6.493. Bu alandan hesaplanan yüzde değişim yanlış çıkıyor, altında
// YÖN bile ters dönüyordu (biz −%0,35 derken piyasa +%2,53).
//
// ÇÖZÜM: Değişimi kendi tuttuğumuz kapanıştan hesaplıyoruz. Her gün ilk
// istekte, bir önceki günün SON gördüğümüz değeri "önceki kapanış" olarak
// sabitleniyor. Böylece gösterdiğimiz fiyat ile hesapladığımız değişim AYNI
// veriden geliyor — dış bir servise daha bağımlı olmuyoruz.
//
// İlk gün referans yoktur; değişim null döner ve arayüzde gösterilmez.
// Uydurma bir değer üretmektense hiç göstermemek doğrudur.
import { Redis } from "@upstash/redis";
import { kilitliGetir } from "./_lib/kilitliOnbellek.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── ORTAK: AltinAPI ham veri ──────────────────────────────────────────────
// Tek istekte 260+ sembol dönüyor; altin/kur/altinapi tiplerinin hepsi bunu
// kullanıyor. Her tip kendi Redis anahtarında önbelleklendiği için AltinAPI'ye
// giden istek sayısı artmıyor.
// ═══════════════════════════════════════════════════════════════════════════
// MERKEZİ ALTINAPI ÖNBELLEĞİ (2026-08-10) — HTTP 429 DÜZELTMESİ
// ═══════════════════════════════════════════════════════════════════════════
// OLAN: altin, kur ve altinapi tiplerinin ÜÇÜ DE ayrı ayrı altinApiCek()
// çağırıyordu. Her tipin kendi Redis anahtarı olduğu için aynı veri günde üç
// kez, üstelik 300sn TTL ile çekiliyordu: ~864 istek/gün. Öncesinde tek tip
// (altinapi) 3600sn TTL ile ~24 istek/gün yapıyordu. 36 katlık artış AltinAPI
// kotasını doldurdu ve servis HTTP 429 (Too Many Requests) dönmeye başladı;
// altın fiyatları uygulamada tamamen boş kaldı.
//
// ÇÖZÜM: AltinAPI'ye giden TEK bir paylaşımlı önbellek. Hangi tip isterse
// istesin aynı anahtardan okunur, dolayısıyla dış servise giden istek sayısı
// tipe göre çoğalmaz. TTL 900sn: günde ~96 istek. Fiziki altın için 15
// dakikalık tazelik yeterli, kota ise rahat.
const KV_ALTINAPI_HAM = "altinapi:ham:v2";

// ── KOTA: ÜCRETSİZ PLAN AYDA 1000 İSTEK ───────────────────────────────────
// Ölçüldü (2026-08-10): sabit TTL ile aylık istek sayısı
//    300sn -> 8.640   (limitin 8,6 katı — kotayı bitiren ayar buydu)
//    900sn -> 2.880   (hâlâ 2,9 kat aşım)
//   3600sn ->   720   (eski ayar; limitin altındaydı, bu yüzden sorunsuz çalışıyordu)
//
// Sabit 1 saat kotayı korur ama Kapalı Çarşı açıkken fiyat bir saat bayat
// kalır. Bunun yerine piyasa saatine göre ayrım: mesaide 20 dakika, dışında
// 6 saat. Aylık ~666 istek — limitin %33 altında, üstelik işlem saatlerinde
// veri eski ayardan üç kat taze.
//
// Kapalı Çarşı / serbest piyasa: hafta içi 09:00–18:00 (Türkiye saati).
// Hafta sonu ve gece fiyat hareket etmediği için uzun TTL bir kayıp değil.
// TTL: Truncgil anahtar istemiyor ve limitini ilan etmiyor. Sınırsız olduğu
// anlamına gelmez — AltinAPI'de tam bu varsayımla kota patladı. Bu yüzden yine
// piyasa saatine göre ayrım: Kapalı Çarşı açıkken (hafta içi 09:00–18:00)
// 60 saniye, dışında 1 saat. Aylık ~12.100 istek.
// Gece ve hafta sonu fiyat hareket etmediği için orada sık çekmenin faydası yok;
// tüm gün 60sn olsaydı ayda 43.200 isteğe çıkardı.
function altinApiTtl() {
  try {
    const tr = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const gun = tr.getDay();            // 0 = Pazar, 6 = Cumartesi
    const saat = tr.getHours();
    const haftaIci = gun >= 1 && gun <= 5;
    const mesai = saat >= 9 && saat < 18;
    return (haftaIci && mesai) ? 60 : 3600;
  } catch {
    return 300; // saat dilimi okunamazsa güvenli tarafta kal
  }
}

async function altinApiPaylasimli() {
  const { veri } = await kilitliGetir(redis, KV_ALTINAPI_HAM, altinApiTtl(), altinApiCek);
  if (!veri) throw new Error("AltinAPI verisi alinamadi");
  return veri;
}

// ═══════════════════════════════════════════════════════════════════════════
// KAYNAK: TRUNCGIL (2026-08-10) — AltinAPI'nin yerine
// ═══════════════════════════════════════════════════════════════════════════
// AltinAPI ücretsiz planı ayda 1000 istekle sınırlı ve kota tükendi (HTTP 429),
// altın fiyatları uygulamada tamamen boş kaldı. Truncgil anahtar istemiyor,
// alış/satış ve günlük değişimi birlikte veriyor, döviz tarafı da serbest
// piyasa (USD 47,71 — AltinAPI'nin verdiğiyle neredeyse birebir).
//
// ÇIKTI ŞEKLİ DEĞİŞMEDİ: Truncgil yanıtı AltinAPI'nin {SEMBOL:{bid,ask,close}}
// yapısına çevriliyor. Böylece frontend'de tek satır değişiklik gerekmiyor.
//
// close ALANI: Truncgil "Change" (yüzde) veriyor, close vermiyor. Frontend ise
// değişimi (orta - close)/close üzerinden hesaplıyor. Bu yüzden close, Change'
// ten GERİ TÜRETİLİYOR: close = orta / (1 + Change/100). Doğrulandı — geri
// hesap Truncgil'in yüzdesini birebir veriyor. Ayrıca AltinAPI'nin bozuk close
// alanı yüzünden eklediğimiz "%10'u aşan değişimi gizle" filtresi de artık
// gereksiz kalıyor (veri doğru).
// İKİ ADRES SIRAYLA DENENİYOR (2026-08-10): v4 adresi sunucudan HTTP 404
// döndü (tarayıcıdan çalışmasına rağmen). Hangi sürümün ayakta olduğunu
// tahmin etmek yerine ikisi de deneniyor; ilk başarılı yanıt kullanılıyor.
// Yanıt biçimleri farklı olduğu için ayrıştırıcı ikisini de tanıyor:
//   v4 → { Meta_Data:{...}, Rates:{ USD:{Buying,Selling,Change}, ... } }
//   v3 → { USD:{Alış,Satış,Değişim}, ... }  (düz, sarmalayıcısız)
const TRUNCGIL_URLLER = [
  "https://finance.truncgil.com/v4/today.json",
  "https://finance.truncgil.com/api/today.json",
];

// Her iki sürümün alan adlarını normalize eder.
function truncgilAlanlar(d) {
  if (!d || typeof d !== "object") return null;
  const al = d.Buying ?? d["Alış"] ?? d["Alis"];
  const sat = d.Selling ?? d["Satış"] ?? d["Satis"];
  const deg = d.Change ?? d["Değişim"] ?? d["Degisim"];
  const say = (v) => {
    if (v == null) return NaN;
    // v3 sayıları "6.638,81" gibi metin olabilir
    if (typeof v === "string") return Number(v.replace(/\./g, "").replace(",", "."));
    return Number(v);
  };
  return { bid: say(al), ask: say(sat), change: say(deg) };
}

// Truncgil sembolü → uygulamanın kullandığı (AltinAPI kökenli) sembol adı.
const TRUNCGIL_ESLEME = {
  GRA: "ALTIN", HAS: "KULCEALTIN", YIA: "AYAR22", "14AYARALTIN": "AYAR14",
  CEYREKALTIN: "CEYREK_YENI", YARIMALTIN: "YARIM_YENI", TAMALTIN: "TEK_YENI",
  ATAALTIN: "ATA_YENI", BESLIALTIN: "ATA5_YENI", GREMSEALTIN: "GREMESE_YENI",
  GUMUS: "GUMUSTRY", GPL: "PLATIN", PAL: "PALADYUM",
};

// ── ESKİ SARRAFİYE FİYATI TÜRETME ─────────────────────────────────────────
// Truncgil eski/yeni ayrımı yapmıyor, tek fiyat veriyor. Uygulamada bu ayrım
// var. 8 Ağustos AltinAPI verisinden ürün bazlı oranlar çıkarıldı:
//   Çeyrek 0,9908/0,9872 · Yarım 0,9876/0,9862 · Tam 0,9930/0,9857
//   Ata 1,0000/0,9910 · Beşli 1,0000/0,9925 · Gremse 0,9889/0,9914
// Ata ve Beşli'de ALIŞ oranı tam 1,0000 — sarraf bunları alırken eski/yeni
// ayrımı yapmıyor, yalnızca satarken yapıyor. Oranların rastgele değil gerçek
// piyasa davranışını yansıttığının işareti.
//
// ⚠️ Bu fiyatlar TÜRETİLMİŞ, kaynaktan gelen gerçek fiyat değil. Oranlar tek
// günün verisinden çıktı; piyasa sertleştiğinde eski-yeni farkı açılabilir ve
// bunu fark edemeyiz (karşılaştıracak gerçek veri yok). Oran bandı dar
// (0,986–1,000) olduğu için sapma sınırlı kalıyor ama sıfır değil.
const ESKI_ORAN = {
  CEYREK_YENI:  { hedef: "CEYREK_ESKI",  bid: 0.99079, ask: 0.98716 },
  YARIM_YENI:   { hedef: "YARIM_ESKI",   bid: 0.98763, ask: 0.98623 },
  TEK_YENI:     { hedef: "TEK_ESKI",     bid: 0.99304, ask: 0.98572 },
  ATA_YENI:     { hedef: "ATA_ESKI",     bid: 1.00000, ask: 0.99101 },
  ATA5_YENI:    { hedef: "ATA5_ESKI",    bid: 1.00000, ask: 0.99252 },
  GREMESE_YENI: { hedef: "GREMESE_ESKI", bid: 0.98886, ask: 0.99137 },
};

async function altinApiCek() {
  let json = null, sonHata = "";
  for (const url of TRUNCGIL_URLLER) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      });
      if (!r.ok) { sonHata = "HTTP " + r.status; continue; }
      const j = await r.json();
      // Geçerli bir yanıt mı? (v4'te Rates, v3'te doğrudan sembol anahtarları)
      if (j && (j.Rates || j.USD || j.GRA)) { json = j; break; }
      sonHata = "beklenmeyen yanit bicimi";
    } catch (e) { sonHata = e.message; }
  }
  if (!json) throw new Error("Truncgil alinamadi (" + sonHata + ")");

  // v4 sarmalayıcısı varsa Rates'i, yoksa nesnenin kendisini kullan
  const rates = json.Rates || json;

  const harita = {};
  const ekle = (sembol, bid, ask, change) => {
    const b = Number(bid), a = Number(ask);
    if (!isFinite(a) || a <= 0) return;
    // Yuvarlama: JPY 100 ile çarpılınca 0.30219999999999997 gibi kayan nokta
    // artığı çıkıyor; 4 haneye yuvarlanıyor (kurlar için yeterli hassasiyet).
    const yuv = (v) => Math.round(v * 10000) / 10000;
    const gecerliBid = yuv(isFinite(b) && b > 0 ? b : a);
    const askY = yuv(a);
    const orta = (gecerliBid + askY) / 2;
    const ch = Number(change);
    const close = isFinite(ch) && (1 + ch / 100) !== 0 ? yuv(orta / (1 + ch / 100)) : null;
    harita[sembol] = { symbol: sembol, bid: gecerliBid, ask: askY, close };
  };

  // 1) Kıymetli madenler
  for (const [tSembol, uSembol] of Object.entries(TRUNCGIL_ESLEME)) {
    const a = truncgilAlanlar(rates[tSembol]);
    if (a) ekle(uSembol, a.bid, a.ask, a.change);
  }

  // 2) Eski sarrafiye — yeni fiyattan oranla türetiliyor
  for (const [kaynak, k] of Object.entries(ESKI_ORAN)) {
    const y = harita[kaynak];
    if (!y) continue;
    harita[k.hedef] = {
      symbol: k.hedef,
      bid: Math.round(y.bid * k.bid * 100) / 100,
      ask: Math.round(y.ask * k.ask * 100) / 100,
      close: y.close != null ? Math.round(y.close * k.ask * 100) / 100 : null,
      turetilmis: true,   // arayüz isterse "tahmini" işareti koyabilir
    };
  }

  // 3) Döviz — Truncgil "USD" gibi düz kodlar veriyor, uygulama "USDTRY"
  //    bekliyor. JPY ÖLÇEK HATASI: Truncgil 1 JPY için 0,003022 veriyor, oysa
  //    gerçek ~0,3024 (USD 47,71 ÷ USD/JPY 157,8). Tam 100 kat küçük —
  //    doğrulandı. Bu yüzden JPY 100 ile çarpılıyor.
  const DOVIZ = ["USD","EUR","GBP","CHF","CAD","AUD","SAR","AED","RUB","CNY","JPY",
                 "DKK","SEK","NOK","KWD","ZAR","BHD","QAR","INR","PKR","AZN"];
  for (const kod of DOVIZ) {
    const a = truncgilAlanlar(rates[kod]);
    if (!a) continue;
    const carpan = kod === "JPY" ? 100 : 1;
    ekle(kod + "TRY", a.bid * carpan, a.ask * carpan, a.change);
  }

  if (!Object.keys(harita).length) throw new Error("Truncgil yaniti bos");

  // 4) ONS ALTIN / ONS GÜMÜŞ — Truncgil'de "ONS" sembolü 0 dönüyor, ons
  //    cinsinden gümüş hiç yok. Fiziki Altın ekranı bu ikisini istiyor, bu
  //    yüzden Yahoo futures'tan (GC=F, SI=F) tamamlanıyor. Tek fiyat geldiği
  //    için alış = satış; makas yok.
  try {
    const [gc, si] = await Promise.allSettled([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);
    const oku = async (res) => {
      if (res.status !== "fulfilled" || !res.value.ok) return null;
      const j = await res.value.json();
      const m = j?.chart?.result?.[0]?.meta;
      return m ? { fiyat: Number(m.regularMarketPrice), onceki: Number(m.chartPreviousClose ?? m.previousClose) } : null;
    };
    const altin = await oku(gc), gumus = await oku(si);
    if (altin && isFinite(altin.fiyat) && altin.fiyat > 0) {
      harita.ONS = { symbol: "ONS", bid: altin.fiyat, ask: altin.fiyat,
        close: isFinite(altin.onceki) && altin.onceki > 0 ? altin.onceki : null };
    }
    if (gumus && isFinite(gumus.fiyat) && gumus.fiyat > 0) {
      harita.XAGUSD = { symbol: "XAGUSD", bid: gumus.fiyat, ask: gumus.fiyat,
        close: isFinite(gumus.onceki) && gumus.onceki > 0 ? gumus.onceki : null };
    }
  } catch { /* ons verisi gelmezse diğer semboller yine döner */ }

  return harita;
}

// Sembolden sayı çıkarır. AltinAPI bazı sembolleri 0/null döndürüyor
// (örn. USDRUB bid=ask=0); bunlar geçersiz sayılıp null dönüyor.
function fiyat(harita, sembol, alan) {
  const it = harita[sembol];
  if (!it) return null;
  const v = Number(it[alan]);
  return isFinite(v) && v > 0 ? v : null;
}
const satis = (h, s) => fiyat(h, s, "ask");   // kullanıcı alırken ödediği
const alis  = (h, s) => fiyat(h, s, "bid");   // kullanıcı bozdururken aldığı

// ─── GÜNLÜK KAPANIŞ TAKİBİ ─────────────────────────────────────────────────
// Redis'te tek kayıt: { tarih, oncekiKapanis:{sembol:fiyat}, son:{sembol:fiyat} }
// Gün değişince "son" → "oncekiKapanis" olur. Türkiye saatine göre.
const KV_GUNLUK = "piyasa:gunluk:v1";
// Değişimi hesaplanacak semboller (satış fiyatı üzerinden takip edilir)
const TAKIP_SEMBOLLER = [
  "USDTRY","EURTRY","GBPTRY","CHFTRY","SARTRY","JPYTRY","CADTRY","AUDTRY",
  "EURUSD","XAUUSD","XAGUSD","ALTIN","GUMUSTRY","AYAR22","AYAR14",
  "CEYREK_YENI","YARIM_YENI","TEK_YENI","ATA_YENI","ONS",
];

function bugunTR() {
  return new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
}

// Güncel değerleri kaydeder, önceki günün kapanışını döndürür.
// Redis erişilemezse null döner — değişim gösterilmez ama fiyatlar akmaya
// devam eder. Fiyat akışı hiçbir koşulda bu yüzden durmamalı.
async function gunlukReferansAlVeYaz(h) {
  const bugun = bugunTR();
  const simdiki = {};
  for (const s of TAKIP_SEMBOLLER) {
    const v = satis(h, s);
    if (v != null) simdiki[s] = v;
  }

  let kayit = null;
  try { kayit = await redis.get(KV_GUNLUK); } catch {}

  if (!kayit || kayit.tarih !== bugun) {
    const oncekiKapanis = (kayit && kayit.son) || null;   // dünkü SON değer
    try { await redis.set(KV_GUNLUK, { tarih: bugun, oncekiKapanis, son: simdiki }); } catch {}
    return oncekiKapanis;
  }

  try { await redis.set(KV_GUNLUK, { ...kayit, son: simdiki }); } catch {}
  return kayit.oncekiKapanis || null;
}

// Bir sembol için alış/satış/kapanış/değişim paketi
// Bir sembol için alış/satış/kapanış/değişim paketi.
// KAPANIŞ ÖNCELİĞİ (2026-08-10): Truncgil "Change" veriyor ve bundan geri
// türetilen close, kaynağın kendi yüzdesini birebir veriyor. Bu yüzden önce
// haritadaki close kullanılıyor; kendi tuttuğumuz günlük referans (ref) yalnız
// yedek. AltinAPI döneminde close güvenilmez olduğu için tersi geçerliydi.
function cift(h, sembol, ref) {
  const a = alis(h, sembol), s = satis(h, sembol);
  const kaynakClose = h && h[sembol] ? Number(h[sembol].close) : NaN;
  const k = isFinite(kaynakClose) && kaynakClose > 0
    ? kaynakClose
    : (ref && ref[sembol] != null ? ref[sembol] : null);
  return {
    alis: a,
    satis: s,
    kapanis: k,
    degisim: s != null && k != null && k > 0 ? Math.round((s - k) / k * 10000) / 100 : null,
  };
}

// ─── ALTIN (Kaynak: AltinAPI) ──────────────────────────────────────────────
// Alan adları BİREBİR korundu (XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram,
// XAG_TRY_gram). Tek fark: gram fiyatları artık ons × kur ile HESAPLANMIYOR,
// doğrudan Kapalı Çarşı verisinden (ALTIN / GUMUSTRY) geliyor.
async function altinTaze() {
  const h = await altinApiPaylasimli();
  const ref = await gunlukReferansAlVeYaz(h);

  const XAU_USD = satis(h, "XAUUSD");
  const XAG_USD = satis(h, "XAGUSD");
  const USD_TRY = satis(h, "USDTRY");
  const XAU_TRY_gram = satis(h, "ALTIN");
  const XAG_TRY_gram = satis(h, "GUMUSTRY");

  if (XAU_USD == null) throw new Error("XAUUSD (ons altın) alınamadı");
  if (XAU_TRY_gram == null) throw new Error("ALTIN (gram altın) alınamadı");
  if (USD_TRY == null) throw new Error("USDTRY alınamadı");
  if (XAG_USD != null && XAG_USD >= XAU_USD) {
    throw new Error(`Gümüş/Altın oranı anormal (XAG=${XAG_USD}, XAU=${XAU_USD}) — kaynak veri şüpheli`);
  }

  return {
    XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram, XAG_TRY_gram,
    detay: {
      ons_altin:  cift(h, "XAUUSD", ref),
      ons_gumus:  cift(h, "XAGUSD", ref),
      gram_altin: cift(h, "ALTIN", ref),
      gram_gumus: cift(h, "GUMUSTRY", ref),
      ayar22:     cift(h, "AYAR22", ref),
      ceyrek:     cift(h, "CEYREK_YENI", ref),
      yarim:      cift(h, "YARIM_YENI", ref),
      tam:        cift(h, "TEK_YENI", ref),
    },
    referansVar: ref != null,
    ts: new Date().toISOString(),
  };
}

// ─── KRİPTO (Kaynak: CoinGecko — AltinAPI'de kripto yok) ───────────────────
async function kriptoTaze() {
  const r = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,try"
  );
  if (!r.ok) throw new Error("CoinGecko error");
  const data = await r.json();
  return {
    btc_usd: data.bitcoin?.usd,
    btc_try: data.bitcoin?.try,
    eth_usd: data.ethereum?.usd,
    eth_try: data.ethereum?.try,
    ts: new Date().toISOString(),
  };
}

// ─── PETROL (Kaynak: AlphaVantage, yedek Yahoo — AltinAPI'de petrol yok) ───
async function petrolTaze() {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (apiKey) {
    try {
      const url = "https://www.alphavantage.co/query?function=BRENT&interval=daily&apikey=" + apiKey;
      const r = await fetch(url);
      if (r.ok) {
        const json = await r.json();
        const veri = ((json && json.data) || []).filter(function(n) {
          return n.value !== "." && n.value != null && !isNaN(parseFloat(n.value));
        });
        if (veri.length >= 2) {
          const price = parseFloat(veri[0].value);
          const prev = parseFloat(veri[1].value);
          return {
            brent_usd: price,
            prev_usd: prev,
            change_pct: ((price - prev) / prev * 100).toFixed(2),
            ts: new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      // Alpha Vantage basarisiz olursa asagidaki Yahoo yoluna dusulur
    }
  }

  const r = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1d&range=1d",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!r.ok) throw new Error("Yahoo Finance error");
  const data = await r.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const prev  = data?.chart?.result?.[0]?.meta?.chartPreviousClose;
  return {
    brent_usd: price,
    prev_usd: prev,
    change_pct: price && prev ? ((price - prev) / prev * 100).toFixed(2) : null,
    ts: new Date().toISOString(),
  };
}

// ─── ALTINAPI (ham, tüm semboller) ─────────────────────────────────────────
const ALTINAPI_GARANTI = [
  "ALTIN","ONS","AYAR22","AYAR14","CEYREK_YENI","CEYREK_ESKI","YARIM_YENI",
  "YARIM_ESKI","TEK_YENI","TEK_ESKI","ATA_YENI","ATA_ESKI","XAGUSD",
  "GUMUSTRY","XPTUSD","PLATIN","XPDUSD","PALADYUM","USDTRY","EURTRY",
];

async function altinApiTaze() {
  const harita = await altinApiPaylasimli();
  const sonuc = {};
  for (const sembol of Object.keys(harita)) {
    const i = harita[sembol];
    sonuc[sembol] = { bid: i.bid, ask: i.ask, close: i.close };
  }
  for (const sembol of ALTINAPI_GARANTI) {
    if (!(sembol in sonuc)) sonuc[sembol] = null;
  }
  return sonuc;
}

// ─── KUR (Kaynak: AltinAPI; Bitcoin için CoinGecko) ────────────────────────
// Ana alanlar (USD_TRY, EUR_TRY …) SATIŞ fiyatını taşıyor — ana ekranda
// gösterilen budur. Alış/satış ayrımı ve günlük değişim "detay" altında.
//
// RUB/CNY/AED: AltinAPI'de ana sembol boş dönüyor (USDRUB bid=ask=0), bu
// yüzden DS_ önekli karşılıkları yedek olarak kullanılıyor.
// ─── KUR (Kaynak: Truncgil — merkezi önbellekten; Bitcoin/ons Yahoo) ──────
// Truncgil döviz de veriyor ve SERBEST PİYASA kuru (USD 47,71 — AltinAPI'nin
// verdiğiyle neredeyse birebir; Frankfurter'ın ECB referans kuru ise gün içinde
// hiç güncellenmiyordu). Üstelik altınla AYNI yanıtta geldiği için merkezi
// önbellekten okunuyor: kur için ek bir dış istek yapılmıyor.
//
// Truncgil'de OLMAYANLAR eski kaynaklarında bırakıldı:
//   • Ons altın/gümüş (ONS sembolü 0 dönüyor) → Yahoo GC=F / SI=F
//   • Bitcoin → CoinGecko
async function kurTaze() {
  const [haritaRes, gcRes, siRes, btcRes] = await Promise.allSettled([
    altinApiPaylasimli(),
    fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d", {headers:{"User-Agent":"Mozilla/5.0"}}),
    fetch("https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d", {headers:{"User-Agent":"Mozilla/5.0"}}),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
  ]);

  if (haritaRes.status !== "fulfilled") {
    throw new Error("Truncgil alınamadı: " + (haritaRes.reason?.message || "bilinmeyen hata"));
  }
  const h = haritaRes.value;

  const gcData = gcRes.status==="fulfilled" && gcRes.value.ok ? await gcRes.value.json() : null;
  const siData = siRes.status==="fulfilled" && siRes.value.ok ? await siRes.value.json() : null;
  const btcData = btcRes.status==="fulfilled" && btcRes.value.ok ? await btcRes.value.json() : null;

  const USD_TRY = satis(h, "USDTRY");
  if (USD_TRY == null) throw new Error("USDTRY alınamadı");

  const JPY = satis(h, "JPYTRY");   // kaynakta 100 ile çarpılmış hâliyle geliyor

  return {
    USD_TRY,
    EUR_TRY: satis(h, "EURTRY"),
    GBP_TRY: satis(h, "GBPTRY"),
    CHF_TRY: satis(h, "CHFTRY"),
    SAR_TRY: satis(h, "SARTRY"),
    RUB_TRY: satis(h, "RUBTRY"),
    AED_TRY: satis(h, "AEDTRY"),
    CNY_TRY: satis(h, "CNYTRY"),
    JPY_TRY: JPY,
    JPY100_TRY: JPY != null ? Math.round(JPY * 100 * 10000) / 10000 : null,
    CAD_TRY: satis(h, "CADTRY"),
    AUD_TRY: satis(h, "AUDTRY"),
    EUR_USD: (() => { const e = satis(h, "EURTRY"); return e && USD_TRY ? Math.round(e / USD_TRY * 10000) / 10000 : null; })(),
    XAU_USD: gcData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null,
    XAU_TRY_gram: satis(h, "ALTIN"),
    XAG_TRY_gram: satis(h, "GUMUSTRY"),
    BTC_USD: btcData?.bitcoin?.usd ?? null,
    detay: {
      USD_TRY: cift(h, "USDTRY", null), EUR_TRY: cift(h, "EURTRY", null),
      GBP_TRY: cift(h, "GBPTRY", null), CHF_TRY: cift(h, "CHFTRY", null),
      SAR_TRY: cift(h, "SARTRY", null), RUB_TRY: cift(h, "RUBTRY", null),
      AED_TRY: cift(h, "AEDTRY", null), CNY_TRY: cift(h, "CNYTRY", null),
      JPY_TRY: cift(h, "JPYTRY", null), CAD_TRY: cift(h, "CADTRY", null),
      AUD_TRY: cift(h, "AUDTRY", null),
      XAU_TRY_gram: cift(h, "ALTIN", null), XAG_TRY_gram: cift(h, "GUMUSTRY", null),
    },
    ts: new Date().toISOString(),
  };
}

// ─── Tip → { Redis anahtarı, TTL, taze() fonksiyonu, Cache-Control } ───────
// Anahtarlar v3'e yükseltildi (günlük değişim eklendi) — aksi halde eski
// şekildeki önbellek dönmeye devam eder ve değişiklik görünmez.
const YAPILANDIRMA = {
  // altin/altinapi TTL 900: ikisi de MERKEZİ altinapi:ham:v1 önbelleğinden
  // besleniyor, dolayısıyla dış servise giden istek burada değil orada
  // sınırlanıyor. Yine de bu iki anahtarın TTL'i merkezi TTL'den kısa olursa
  // gereksiz yeniden hesaplama olur; eşit tutuldu.
  altin:    { anahtar: "altin:v5",    ttl: 60,   fn: altinTaze,    cacheControl: "s-maxage=60" },
  kripto:   { anahtar: "kripto:v1",   ttl: 300,  fn: kriptoTaze,   cacheControl: "s-maxage=300" },
  petrol:   { anahtar: "petrol:v1",   ttl: 1800, fn: petrolTaze,   cacheControl: "s-maxage=1800" },
  // kur AltinAPI kullanmıyor (bkz. kurTaze notu) — eski 300sn TTL'ine döndü.
  kur:      { anahtar: "kur:v4",      ttl: 300,  fn: kurTaze,      cacheControl: "s-maxage=300" },
  altinapi: { anahtar: "altinapi:v7", ttl: 60,   fn: altinApiTaze, cacheControl: "s-maxage=60" },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const tip = req.query.tip;
  const conf = YAPILANDIRMA[tip];
  if (!conf) {
    return res.status(400).json({
      error: `Geçersiz veya eksik 'tip' parametresi (gelen: ${tip ?? "yok"}). Kullanım: /api/piyasa-fiyatlar?tip=altin|kripto|petrol|kur|altinapi`,
    });
  }

  res.setHeader("Cache-Control", conf.cacheControl);
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = req.query.debug === "1";

  try {
    const { veri, cached } = await kilitliGetir(redis, conf.anahtar, conf.ttl, conf.fn, { debug });
    return res.status(200).json({ ...veri, cached });
  } catch (e) {
    try {
      const eskiOnbellek = await redis.get(conf.anahtar);
      if (eskiOnbellek) return res.status(200).json({ ...eskiOnbellek, cached: true, hata: e.message });
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}
