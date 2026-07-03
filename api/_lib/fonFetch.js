// api/_lib/fonFetch.js
// Fonoloji'den katılım fonlarını çekip normalize eden ORTAK mantık.
// Hem cron job'ı (api/cron-fon-guncelle.js) hem de public endpoint'in
// bootstrap/fallback yolu (api/fon-getiri.js) bunu kullanır — tek kaynak,
// iki yerde ayrı ayrı bakım gerektirmez.
// NOT: Dosya adı "_lib" ile başladığı için Vercel bunu bir API route olarak
// görmez, sadece import edilebilir bir modüldür.

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

// ── Global hız sınırlayıcı ───────────────────────────────────────────────────
// KESİN TEŞHİS (Fonoloji'nin kendi hata mesajından): "Dakikada 30 istek sınırı
// aşıldı" — sabit, belgelenmiş bir kural. Önceki kademeli-gecikme denemeleri
// (kategori başına 90-150ms) bunu YETERİNCE yavaşlatmıyordu çünkü sadece
// kategoriler arası değil, TÜM isteklerin (5 Vakıf + çok sayfalı kategoriler)
// TOPLAMI dakikada 30'u aşıyordu. Artık TEK bir ortak kuyruk var: hangi istek
// olursa olsun (Vakıf kodu ya da kategori sayfası fark etmez), art arda iki
// istek arasında en az MIN_ARALIK_MS geçmeden gönderilmiyor. 27 istek/dakika
// hedefleniyor (30 sınırının altında güvenli pay).
const MIN_ARALIK_MS = 2250; // 60000/2250 ≈ 26.7 istek/dakika
let sonIstekZamaniMs = 0;
let kuyrukKilidi = Promise.resolve();
function siraliBekle() {
  const bu = kuyrukKilidi.then(async () => {
    const simdi = Date.now();
    const gerekliBekleme = Math.max(0, sonIstekZamaniMs + MIN_ARALIK_MS - simdi);
    if (gerekliBekleme > 0) await new Promise(r => setTimeout(r, gerekliBekleme));
    sonIstekZamaniMs = Date.now();
  });
  kuyrukKilidi = bu.catch(() => {});
  return bu;
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
        sonIstekZamaniMs += 3000;
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
        sonIstekZamaniMs += 3000;
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
  // Parça 1 — "Katılım" (~5 sayfa, ağır) + hafif olanlar
  {kat: "Katılım",                        tumunu: true},
  {kat: "Altın Katılım Fonu",             tumunu: true},
  {kat: "OKS Katılım Standart Fon",       tumunu: true},
  {kat: "Katılım Katkı Fonu",             tumunu: true},
  {kat: "Katılım Fonu",                   tumunu: true},
  {kat: "Katılım Standart Fon",           tumunu: true},
  {kat: "Başlangıç Katılım Fonu",         tumunu: true},
  // Parça 2 — "Katılım Değişken Fon" (~5 sayfa, ağır) + hafif olanlar
  {kat: "Katılım Değişken Fon",           tumunu: true},
  {kat: "Katılım Hisse Senedi Fonu",      tumunu: true},
  {kat: "Kira Sertifikası Katılım Fonu",  tumunu: true},
  {kat: "Hisse Senedi Şemsiye Fonu",      tumunu: false},
  {kat: "Para Piyasası Şemsiye Fonu",     tumunu: false},
  {kat: "Değişken Şemsiye Fonu",          tumunu: false},
  {kat: "Karma Şemsiye Fonu",             tumunu: false},
  // Parça 3 — tamamı hafif
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

// ── Parça (batch) bölüştürme ──────────────────────────────────────────────
// KESİN TEŞHİS: Fonoloji dakikada en fazla 30 istek kabul ediyor. Toplam ~34
// isteği (5 Vakıf + kategori sayfaları) tek çağrıda, kurala uyacak şekilde
// yavaşlatınca süre ~75-90sn'ye çıkıyor — bu, Vercel'in fonksiyon zaman aşımı
// sınırına (plana göre değişir, garanti değil) takılma riski taşıyor.
// Çözüm: 21 kategoriyi 3 PARÇAya bölüp, günde zaten var olan 3 cron saatine
// (08:00/09:00/10:00) birer parça dağıtıyoruz. Her çağrı sadece ~7 kategori
// işler (~20-25sn sürer, güvenli), ve önceki parçalardan gelen fonları SİLMEZ
// — sadece kendi getirdiği fonları üstüne yazar (tefas-proxy.js'deki birleştirme
// mantığına bkz). Sabah 10'a gelindiğinde 3 parça birikip tam liste oluşur.
const PARCALAR = [
  KATEGORILER.slice(0, 7),
  KATEGORILER.slice(7, 14),
  KATEGORILER.slice(14, 21),
];

// Fonoloji'den katılım fonlarını çeker. `parcaNo` verilirse (1/2/3) SADECE o
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
    const encKat = encodeURIComponent(kat);
    while (true) {
      const url = `https://fonoloji.com/v1/funds?category=${encKat}&limit=${PAGE_SIZE}&offset=${offset}`;
      const { res, hata } = await fetchTeshisli(url, { headers }, 2);
      if (!res) { herhangiIstekBasarisiz = true; sonHata = hata; break; }
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
  //    işlediği için düşük mutlak sayı normaldir).
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
