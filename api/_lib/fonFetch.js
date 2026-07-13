// api/_lib/fonFetch.js
// Fonoloji'den katılım fonlarını çekip normalize eden ORTAK mantık.
// Hem cron job'ı (api/tefas-proxy.js) hem de public endpoint'in
// bootstrap/fallback yolu bunu kullanır — tek kaynak, iki yerde ayrı ayrı
// bakım gerektirmez.
// NOT: Dosya adı "_lib" ile başladığı için Vercel bunu bir API route olarak
// görmez, sadece import edilebilir bir modüldür.
//
// DEĞİŞİKLİK (2026-07-13) — "bizde olmayan fonlar var" raporu (NSA, FTL, MPE,
// DNP, EP1 Fonoloji'de görünüp uygulamada yoktu). İki düzeltme:
//   1) SAYFALAMA DİRENCİ: pagination döngüsü bir sayfada hata (özellikle
//      hızlı-vazgeçilen 429) alınca `break` ile kategorinin KALAN TÜM
//      sayfalarını o günlük kaybediyordu — kuyruktaki fonlar hiç çekilmiyordu.
//      Artık başarısız sayfa, 5sn ek bekleme sonrası BİR kez daha denenir;
//      yine olmazsa o zaman vazgeçilir (eski davranış). Tek seferlik geçici
//      429'lar artık kuyruk kaybına yol açmaz.
//   2) ADAY KATEGORİLER: bazı katılım fonlarının Fonoloji kategorisi mevcut
//      21'lik listede olmayabilir. İki muhtemel TEFAS şemsiye adı eklendi
//      ("Katılım Şemsiye Fonu", "Para Piyasası Katılım Şemsiye Fonu").
//      Kategori Fonoloji'de yoksa maliyeti 1 boş istek (~2sn) — ucuz.
//      Hangi kategorinin gerçekte kaç fon getirdiği artık kategoriTeshis ile
//      KV'ye yazılıp /api/tefas-proxy yanıtında görülebiliyor (bkz.
//      tefas-proxy.js) — bir sonraki teşhis turu kör tahmin gerektirmez.

import { Redis } from "@upstash/redis";

// Hız sınırlayıcı için ayrı bir Redis istemcisi — tefas-proxy.js'deki KV
// istemcisiyle aynı Upstash veritabanına bağlanır (aynı env var'lar), ama
// bağımsız bir bağlantı nesnesidir (Upstash REST tabanlı olduğu için bunun
// bir maliyeti/havuzlama sorunu yok).
const hizRedis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TATILLER_2026 = new Set([
  "2026-01-01","2026-04-02","2026-04-03","2026-04-04","2026-04-05",
  "2026-06-05","2026-06-06","2026-06-07","2026-06-08",
  "2026-10-29","2026-12-31"
]);
const TATILLER_2025 = new Set([
  "2025-01-01","2025-03-29","2025-03-30","2025-03-31","2025-04-01",
  "2025-05-19","2025-06-04","2025-06-05","2025-06-06","2025-06-07",
  "2025-10-29"
]);

function isTakasGunu(d) {
  const gun = d.getDay();
  if (gun === 0 || gun === 6) return false;
  const str = d.toISOString().slice(0,10);
  return !TATILLER_2026.has(str) && !TATILLER_2025.has(str);
}

function sonTakasGunuAralik() {
  const bugun = new Date();
  bugun.setHours(12,0,0,0);
  let sonTakas = new Date(bugun);
  while (!isTakasGunu(sonTakas)) sonTakas.setDate(sonTakas.getDate() - 1);
  let oncekiTakas = new Date(sonTakas);
  oncekiTakas.setDate(oncekiTakas.getDate() - 1);
  while (!isTakasGunu(oncekiTakas)) oncekiTakas.setDate(oncekiTakas.getDate() - 1);
  const farkMs = sonTakas - oncekiTakas;
  return Math.round(farkMs / (1000*60*60*24));
}

function fetchZamanAsimli(url, opts, msTimeout) {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), msTimeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(zamanlayici));
}

// ── Global hız sınırlayıcı — DÜZELTME (2026-07): Redis tabanlı, GERÇEKTEN
// paylaşılan sıra ──────────────────────────────────────────────────────────
// KÖK NEDEN (gerçek log'la doğrulandı — "Katılım Değişken Fon" tek başına
// izole edilmiş bir parça olduğu hâlde yine 280sn'de zaman aşımına uğradı):
// eski MIN_ARALIK_MS/sonIstekZamaniMs/kuyrukKilidi mekanizması sadece BELLEKTE
// tutuluyordu — yani sadece TEK bir fonksiyon çalıştırması (invocation)
// içinde geçerliydi. Aynı anda birden fazla çalıştırma olduğunda (örn. cron
// tetiklemesiyle aynı sırada manuel "Run" testi, ya da Vercel'in aynı anda
// birden fazla instance başlatması), her biri kendi başına "dakikada 27
// istek hakkım var" sanıp gönderiyordu — Fonoloji'nin sunucusunda GERÇEKTE
// bunların TOPLAMI dakikada 30'u kolayca aşıyordu. Sonuç: art arda 429'lar,
// her 429 sonrası yeniden deneme, bu da toplam süreyi 280sn sınırına kadar
// şişiriyordu.
//
// ÇÖZÜM: "Bir sonraki uygun istek zamanı" artık Redis'te TEK bir anahtarda
// tutuluyor ve bir Lua script ile ATOMİK olarak okunup güncelleniyor (EVAL,
// Redis'te tek seferde, bölünmeden çalışır — aynı anda 100 çağrı gelse bile
// hepsi FARKLI, çakışmayan zaman dilimleri alır). Böylece kaç eşzamanlı
// fonksiyon çalıştırması olursa olsun (cron + manuel test bir arada dahi),
// Fonoloji'ye giden istekler gerçekten TEK bir ortak sıradan geçiyor.
const MIN_ARALIK_MS = 2250; // 60000/2250 ≈ 26.7 istek/dakika (30 sınırının altında güvenli pay)
const HIZ_SINIRLAYICI_ANAHTAR = "tefas:hiz-sinirlayici:sonraki-uygun-slot-ms";

// Redis'e ulaşılamazsa (nadir bir durum) diye yerel bir yedek — bu durumda en
// azından BU tek invocation içinde sıralama korunur (eski davranışa düşer).
let sonIstekZamaniMsYerel = 0;

const SIRA_REZERVASYON_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minGap = tonumber(ARGV[2])
local last = tonumber(redis.call('GET', key) or "0")
local nextSlot = now
if (last + minGap) > nextSlot then
  nextSlot = last + minGap
end
redis.call('SET', key, tostring(nextSlot), 'PX', 120000)
return tostring(nextSlot)
`;

async function siraliBekle() {
  const simdi = Date.now();
  let uygunSlot;
  try {
    const sonuc = await hizRedis.eval(
      SIRA_REZERVASYON_LUA,
      [HIZ_SINIRLAYICI_ANAHTAR],
      [String(simdi), String(MIN_ARALIK_MS)]
    );
    uygunSlot = Number(sonuc);
    if (!Number.isFinite(uygunSlot)) throw new Error("Lua script geçersiz değer döndürdü");
  } catch (e) {
    // Redis/eval başarısız olursa yerel yedek mekanizmaya düş.
    uygunSlot = Math.max(simdi, sonIstekZamaniMsYerel + MIN_ARALIK_MS);
  }
  sonIstekZamaniMsYerel = uygunSlot;
  const bekleme = Math.max(0, uygunSlot - Date.now());
  if (bekleme > 0) await new Promise(r => setTimeout(r, bekleme));
}

// 429 alındığında paylaşılan sırayı (Redis'teki ortak anahtarı) ekstraMs kadar
// ileri iter — böylece bu invocation'da değil, TÜM eşzamanlı çalıştırmalarda
// bir sonraki istek daha geç gönderilir. Eskiden bu sadece yerel bir değişkeni
// güncelliyordu (sonIstekZamaniMs += 3000), bu yüzden başka bir eşzamanlı
// invocation bundan habersiz kalıp hemen yeni istek gönderebiliyordu.
async function ekstraGecikmeEkle(ekstraMs) {
  try {
    await hizRedis.eval(
      `
      local key = KEYS[1]
      local ekstra = tonumber(ARGV[1])
      local last = tonumber(redis.call('GET', key) or "0")
      local yeni = last + ekstra
      redis.call('SET', key, tostring(yeni), 'PX', 120000)
      return tostring(yeni)
      `,
      [HIZ_SINIRLAYICI_ANAHTAR],
      [String(ekstraMs)]
    );
  } catch (e) {
    sonIstekZamaniMsYerel += ekstraMs;
  }
}

async function fetchTekrarli(url, opts, deneme = 2, msTimeout = 8000) {
  for (let i = 0; i < deneme; i++) {
    await siraliBekle();
    try {
      const r = await fetchZamanAsimli(url, opts, msTimeout);
      if (r.ok) return r;
      if (r.status === 429) {
        // ARTIK UZUN BEKLEMİYORUZ: önceki sürüm Fonoloji'nin bildirdiği
        // retryAfterSec'i (53-65sn) HER başarısız istek için ayrı ayrı
        // bekliyordu. Bu, art arda birkaç istek 429 alırsa tek bir çağrının
        // dakikalarca (hatta hiç bitmeyecekmiş gibi) asılı kalmasına yol
        // açtı — çünkü bizim iç sayacımız (sonIstekZamaniMs) sadece BU
        // invocation'a özel, Fonoloji'nin hesap bazlı gerçek kotasından
        // habersiz. Artık 429 gelirse HEMEN vazgeçiyoruz (hızlı başarısız);
        // paylaşılan sıraya biraz ekstra boşluk ekleyip devam ediyoruz.
        await ekstraGecikmeEkle(3000);
        return null;
      }
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i === deneme - 1) return null;
    }
  }
  return null;
}

// Teşhis amaçlı: fetchTekrarli gibi ama başarısızlıkta SESSİZCE null dönmek yerine
// gerçek HTTP durum kodunu / hata mesajını da bildiriyor. "kategoriTeshis"teki
// agHatasi:true'nun ARDINDAKİ gerçek sebebi (400/404/429/500/timeout) görmek için.
async function fetchTeshisli(url, opts, deneme = 2, msTimeout = 8000) {
  let sonHata = null;
  for (let i = 0; i < deneme; i++) {
    await siraliBekle();
    try {
      const r = await fetchZamanAsimli(url, opts, msTimeout);
      if (r.ok) return { res: r, hata: null };
      if (r.status === 429) {
        // Bkz. fetchTekrarli'deki not — uzun beklemek yerine hızlı vazgeçiyoruz.
        await ekstraGecikmeEkle(3000);
        return { res: null, hata: "HTTP 429 — dakikalık istek sınırı (hemen vazgeçildi, uzun beklenmedi)" };
      }
      let govde = "";
      try { govde = (await r.clone().text()).slice(0, 200); } catch {}
      sonHata = `HTTP ${r.status}${govde ? " — " + govde : ""}`;
      if (i === deneme - 1) return { res: null, hata: sonHata };
    } catch (e) {
      sonHata = e.name === "AbortError" ? "Zaman aşımı" : String(e.message || e);
      if (i === deneme - 1) return { res: null, hata: sonHata };
    }
  }
  return { res: null, hata: sonHata };
}

function mapFon(f, vakif, takasAraligi) {
  let yonetici = (f.management_company || "").trim();
  if (!yonetici || vakif) yonetici = "Vakıf Katılım Portföy Yönetimi A.Ş.";
  return {
    kod:      f.code || "",
    ad:       f.name || "",
    yonetici,
    oncelik:   vakif ? 1 : 2,
    kategori:  f.category || f.fund_type || "",
    katilimUygun: !!(f.is_participation || f.participation ||
      (f.name||"").toUpperCase().includes("KATILIM") ||
      (f.category||"").toUpperCase().includes("KATILIM")),
    kaynakKategori: f.category || "",
    yatirimci: f.investor_count || f.investors || 0,
    portfoy:   f.aum || 0,
    takasAraligi: takasAraligi,
    gunluk:   parseFloat(((f.return_1d  || 0) * 100).toFixed(4)),
    gunlukNorm: f.return_1d ? parseFloat(((f.return_1d / takasAraligi) * 100).toFixed(4)) : 0,
    haftalik: parseFloat(((f.return_1w  || 0) * 100).toFixed(2)),
    aylik:    parseFloat(((f.return_1m  || 0) * 100).toFixed(2)),
    uc_aylik: parseFloat(((f.return_3m  || 0) * 100).toFixed(2)),
    ytd:      parseFloat(((f.return_ytd || 0) * 100).toFixed(2)),
    yillik:   parseFloat(((f.return_1y  || 0) * 100).toFixed(2)),
    yillikHesap: f.return_1d ? parseFloat(((f.return_1d / takasAraligi) * 252 * 100).toFixed(2)) : null,
  };
}

const KATEGORILER = [
  {kat: "Katılım",                        tumunu: true},
  {kat: "Altın Katılım Fonu",             tumunu: true},
  {kat: "OKS Katılım Standart Fon",       tumunu: true},
  {kat: "Katılım Katkı Fonu",             tumunu: true},
  {kat: "Katılım Fonu",                   tumunu: true},
  {kat: "Katılım Standart Fon",           tumunu: true},
  {kat: "Başlangıç Katılım Fonu",         tumunu: true},
  {kat: "Katılım Değişken Fon",           tumunu: true},
  {kat: "Katılım Hisse Senedi Fonu",      tumunu: true},
  {kat: "Kira Sertifikası Katılım Fonu",  tumunu: true},
  // ADAY KATEGORİLER (2026-07-13, eksik fon teşhisi): Fonoloji'de bu adlarla
  // kategori yoksa boş döner (1 istek, zararsız); varsa NSA/FTL/MPE/DNP/EP1
  // gibi kayıp fonları kapsama alır. Gerçek sonuç kategoriTeshis'ten izlenecek.
  {kat: "Katılım Şemsiye Fonu",           tumunu: true},
  {kat: "Para Piyasası Katılım Şemsiye Fonu", tumunu: true},
  {kat: "Hisse Senedi Şemsiye Fonu",      tumunu: false},
  {kat: "Para Piyasası Şemsiye Fonu",     tumunu: false},
  {kat: "Değişken Şemsiye Fonu",          tumunu: false},
  {kat: "Karma Şemsiye Fonu",             tumunu: false},
  {kat: "Fon Sepeti Şemsiye Fonu",        tumunu: false},
  {kat: "Altın Şemsiye Fonu",             tumunu: false},
  {kat: "Kıymetli Madenler Şemsiye Fonu", tumunu: false},
  {kat: "Endeks Şemsiye Fonu",            tumunu: false},
  {kat: "Serbest Şemsiye Fonu",           tumunu: false},
  {kat: "Altın Fonu",                     tumunu: false},
  {kat: "Kıymetli Madenler",              tumunu: false},
];

const VAKIF_KODLARI = ["VPA","VLT","VHS","VKK","VKV"];
const PAGE_SIZE = 100;
const ŞÜPHELİ_EŞİK = 100; // normal günde 150+ fon beklenir (TÜM parçalar birleştiğinde)

// ── Parça (batch) bölüştürme — DÜZELTME 2 (2026-07) ─────────────────────────
// KÖK NEDEN (gerçek log'la doğrulandı): Eski 3-parça bölüşümünde Parça 1
// içinde HEM 5 Vakıf fonu HEM "Katılım" kategorisi (kendi başına ~5 sayfa,
// "ağır" diye zaten yorumla işaretliydi) HEM 6 kategori daha vardı. Bunların
// toplamı — özellikle "Katılım" kategorisinin gerçekte tahmin edilenden çok
// daha fazla sayfa çekmesi ve/veya 429'lar yüzünden tekrar denemelerin
// eklenmesiyle — 280 saniyelik fonksiyon süresini AŞTI ve Vercel Runtime
// Timeout ile öldürüldü (log: "Task timed out after 280 seconds"). Fonksiyon
// hiçbir zaman kv.set()'e ulaşamadığı için veri günlerce güncellenmeden kaldı.
//
// ÇÖZÜM: 3 parça yerine 8 DAHA KÜÇÜK parçaya bölündü. En kritik değişiklik:
// bilinen İKİ "ağır" kategori ("Katılım" ve "Katılım Değişken Fon") artık
// KENDİ BAŞLARINA, tek başına bir parça olarak çalışıyor — başka hiçbir
// kategoriyle aynı çağrıda yarışmıyorlar, tüm 280sn'lik bütçeyi tek başlarına
// kullanabiliyorlar. Vakıf fonları (hızlı, 5 istek) en hafif parçaya (1) taşındı.
// vercel.json'da buna karşılık gelen 8 ayrı cron saati tanımlandı — Vercel
// Hobby planı HER cron girdisinin kendi başına günde bir kez çalışmasına izin
// verdiği için (toplam sayı değil, her girdinin kendi sıklığı sınırlanıyor)
// bu sorun teşkil etmiyor.
// SAAT DEĞİŞİKLİĞİ (2026-07-13): pencere 05-12 UTC'den (08-15 TR) 08-15
// UTC'ye (11-18 TR) kaydırıldı — Fonoloji güne ait TEFAS fiyatlarını ~11:00
// TR'de işlediği için eski pencerede parçaların çoğu (özellikle 09:00 TR'deki
// "Katılım") bir önceki günün verisini çekiyordu; kullanıcılar gün boyu bayat
// veri görüyordu (13 Tem pazartesi raporu: uygulama cuma verisi, Fonoloji
// pazartesi verisi gösteriyordu).
const PARCALAR = [
  // Parça 1: Vakıf fonları (5 istek, hızlı) + en hafif 2 kategori
  [
    {kat: "Altın Katılım Fonu",             tumunu: true},
    {kat: "OKS Katılım Standart Fon",       tumunu: true},
  ],
  // Parça 2: "Katılım" — TEK BAŞINA (bilinen en ağır kategori, ~5+ sayfa)
  [
    {kat: "Katılım",                        tumunu: true},
  ],
  // Parça 3: "Katılım Değişken Fon" — TEK BAŞINA (bilinen ikinci ağır kategori)
  [
    {kat: "Katılım Değişken Fon",           tumunu: true},
  ],
  // Parça 4 (+ aday kategori "Katılım Şemsiye Fonu")
  [
    {kat: "Katılım Katkı Fonu",             tumunu: true},
    {kat: "Katılım Fonu",                   tumunu: true},
    {kat: "Katılım Standart Fon",           tumunu: true},
    {kat: "Katılım Şemsiye Fonu",           tumunu: true},
  ],
  // Parça 5 (+ aday kategori "Para Piyasası Katılım Şemsiye Fonu")
  [
    {kat: "Başlangıç Katılım Fonu",         tumunu: true},
    {kat: "Katılım Hisse Senedi Fonu",      tumunu: true},
    {kat: "Kira Sertifikası Katılım Fonu",  tumunu: true},
    {kat: "Para Piyasası Katılım Şemsiye Fonu", tumunu: true},
  ],
  // Parça 6
  [
    {kat: "Hisse Senedi Şemsiye Fonu",      tumunu: false},
    {kat: "Para Piyasası Şemsiye Fonu",     tumunu: false},
    {kat: "Değişken Şemsiye Fonu",          tumunu: false},
    {kat: "Karma Şemsiye Fonu",             tumunu: false},
  ],
  // Parça 7
  [
    {kat: "Fon Sepeti Şemsiye Fonu",        tumunu: false},
    {kat: "Altın Şemsiye Fonu",             tumunu: false},
    {kat: "Kıymetli Madenler Şemsiye Fonu", tumunu: false},
    {kat: "Endeks Şemsiye Fonu",            tumunu: false},
  ],
  // Parça 8
  [
    {kat: "Serbest Şemsiye Fonu",           tumunu: false},
    {kat: "Altın Fonu",                     tumunu: false},
    {kat: "Kıymetli Madenler",              tumunu: false},
  ],
];

// Fonoloji'den katılım fonlarını çeker. `parcaNo` verilirse (1-8) SADECE o
// parçadaki kategorileri işler (Vakıf kodları sadece 1. parçada çekilir).
// `parcaNo` verilmezse TÜMÜNÜ işler (uzun sürer — sadece elle/test amaçlı kullan).
async function fonVerisiCek(parcaNo = null) {
  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) throw new Error("FONOLOJI_KEY tanımlı değil");
  const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };
  const takasAraligi = sonTakasGunuAralik();

  const isleneckKategoriler = parcaNo ? PARCALAR[parcaNo - 1] : KATEGORILER;
  const vakifIsle = !parcaNo || parcaNo === 1; // Vakıf kodları sadece 1. parçada

  const gorulmuKodlar = new Set();
  let katilimFonlar = [];

  if (vakifIsle) {
    const vakifRes = await Promise.all(
      VAKIF_KODLARI.map(kod =>
        fetchTekrarli(`https://fonoloji.com/v1/funds/${kod}`, { headers }, 2)
          .then(r => r ? r.json() : null).catch(() => null)
      )
    );
    for (const d of vakifRes) {
      if (!d) continue;
      const f = d.fund ?? d;
      const kod = f.code || "";
      if (!kod || gorulmuKodlar.has(kod)) continue;
      gorulmuKodlar.add(kod);
      katilimFonlar.push(mapFon(f, true, takasAraligi));
    }
  }

  const kategoriPromises = isleneckKategoriler.map(async ({kat, tumunu}) => {
    const sonuclar = [];
    let offset = 0;
    let herhangiIstekBasarisiz = false;
    let sonHata = null;
    let sayfaTekrarKaldi = 1; // SAYFALAMA DİRENCİ: kategori başına 1 ek sayfa hakkı
    const encKat = encodeURIComponent(kat);
    while (true) {
      const url = `https://fonoloji.com/v1/funds?category=${encKat}&limit=${PAGE_SIZE}&offset=${offset}`;
      const { res, hata } = await fetchTeshisli(url, { headers }, 2);
      if (!res) {
        // DÜZELTME (2026-07-13): eskiden burada doğrudan `break` vardı —
        // sayfalama ortasındaki tek bir geçici 429/timeout, kategorinin
        // KALAN TÜM sayfalarını o günlük kaybettiriyordu (NSA/FTL gibi
        // kuyruktaki fonlar hiç çekilmiyordu). Artık aynı offset, 5sn ek
        // bekleme sonrası bir kez daha denenir; ancak o da başarısızsa
        // vazgeçilir. Ek maliyet: kategori başına en fazla 1 tekrar.
        if (sayfaTekrarKaldi > 0) {
          sayfaTekrarKaldi--;
          await new Promise(r => setTimeout(r, 5000));
          continue; // aynı offset'i tekrar dene
        }
        herhangiIstekBasarisiz = true; sonHata = hata; break;
      }
      const d = await res.json().catch(() => null);
      if (!d) { herhangiIstekBasarisiz = true; sonHata = "JSON parse hatası"; break; }
      const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
      if (!items.length) break;
      for (const f of items) {
        if (f.trading_status && f.trading_status !== "AKTİF") continue;
        if (!tumunu) {
          const isim = (f.name || "").toUpperCase();
          if (!isim.includes("KATILIM")) continue;
        }
        sonuclar.push(f);
      }
      if (items.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return { kat, sonuclar, herhangiIstekBasarisiz, sonHata };
  });

  const tumKategoriSonuclari = await Promise.all(kategoriPromises);
  // Teşhis: hangi kategori kaç ham fon getirdi, hangisi ağ hatasıyla tamamen boş kaldı.
  // Sayı düşük çıktığında ("gelmeyen fonlar var") bu, hangi kategorinin sorunlu
  // olduğunu tek tek göstererek kör tahmin yerine kesin teşhis sağlar.
  const kategoriTeshis = {};
  for (const {kat, sonuclar, herhangiIstekBasarisiz, sonHata} of tumKategoriSonuclari) {
    kategoriTeshis[kat] = { hamAdet: sonuclar.length, agHatasi: herhangiIstekBasarisiz, hata: sonHata };
  }
  for (const {sonuclar} of tumKategoriSonuclari) {
    for (const f of sonuclar) {
      const kod = f.code || "";
      if (!kod || gorulmuKodlar.has(kod)) continue;
      const mapped = mapFon(f, false, takasAraligi);
      if (!mapped.katilimUygun) continue;
      gorulmuKodlar.add(kod);
      katilimFonlar.push(mapped);
    }
  }

  const kategoriSayac = {};
  for (const f of katilimFonlar) {
    const k = f.kategori || "Bilinmiyor";
    kategoriSayac[k] = (kategoriSayac[k] || 0) + 1;
  }

  // "Eksik görünüyor" tanımı parça moduna göre değişir:
  //  - Tam mod (parcaNo yok): toplam fon sayısı 100'ün altındaysa şüpheli.
  //  - Parça modu: bu parçadaki kategorilerin YARISINDAN FAZLASI ağ hatası
  //    verdiyse şüpheli (mutlak sayı değil, oran — bir parça zaten az kategori
  //    işlediği için düşük mutlak sayı normaldir). Tek kategorili parçalarda
  //    (2 ve 3) bu, o TEK kategori hata verirse şüpheli sayılır demektir.
  const hataliKategoriSayisi = Object.values(kategoriTeshis).filter(k => k.agHatasi).length;
  const eksikGorunuyor = parcaNo
    ? hataliKategoriSayisi > isleneckKategoriler.length / 2
    : katilimFonlar.length < ŞÜPHELİ_EŞİK;

  return {
    success: true,
    parca: parcaNo,
    count: katilimFonlar.length,
    eksikGorunuyor,
    guncelleme: new Date().toISOString(),
    kategori_dagilim: kategoriSayac,
    kategoriTeshis, // her kategori için {hamAdet, agHatasi} — hangi kategori sorunlu, kesin teşhis
    data: katilimFonlar,
  };
}

export { fonVerisiCek, ŞÜPHELİ_EŞİK, PARCALAR };
