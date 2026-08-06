// api/_lib/fonFetch.js
// Fonoloji'den katılım fonlarını çekip normalize eden ORTAK mantık.
// Hem cron job'ı (api/tefas-proxy.js) hem de public endpoint'in
// bootstrap/fallback yolu bunu kullanır — tek kaynak, iki yerde ayrı ayrı
// bakım gerektirmez.
// NOT: Dosya adı "_lib" ile başladığı için Vercel bunu bir API route olarak
// görmez, sadece import edilebilir bir modüldür.
//
// DEĞİŞİKLİK (2026-07-14 öğleden sonra) — SAYFALAMANIN KIRIK OLDUĞU KESİNLEŞTİ.
// 13:51 TR taraması kanıtı: 39 sayfa, hamAdet:3900, hamBenzersiz:134,
// mukerrer:3766 → Fonoloji `offset` parametresini tamamen YOK SAYIYOR, her
// istek aynı ilk sayfayı döndürüyor. Filtre suçlu DEĞİL (DNP/EP1/FTL'in ham
// verisi aranilanKayipFonlar'da görüldü: isimlerinde "KATILIM" var, yani
// mapFon.katilimUygun görüldükleri anda geçiriyor — sorun HİÇ görülmemeleri).
// ÜÇ KATMANLI YENİ MİMARİ:
//   FAZ 1 — UYARLANIR LİSTE TARAMASI: önce limit=2000 denenir (API büyük
//     sayfaya izin veriyorsa 2 istekte tüm evren biter). API limit'i 100'e
//     kırparsa klasik akışa düşülür. Sayfalama ilerlemiyorsa (yeni benzersiz
//     kod gelmiyorsa) offset yerine bir kez `page` parametresi denenir —
//     birçok API offset değil page ile sayfalar. O da ilerlemezse liste
//     taraması "kırık" ilan edilip 3-4 istekte terk edilir (eskiden 39 istek
//     çöpe gidiyordu).
//   FAZ 3 — BİLİNEN KATILIM FONLARINI TAZELEME: bilinen katılım fon kodları
//     KV'de tutulur (katilim:bilinen-kodlar). Liste taraması evreni
//     kapsayamadıysa, süre bütçesinin %70'i ÖNCE bu bilinen fonların tekil
//     (/funds/:kod) tazelenmesine harcanır — ekranın umursadığı ~150 fonun
//     TAZELİĞİ garanti altına alınır. Dönen imleç (katilim:tazeleme-imleci)
//     her taramada kaldığı yerden devam eder; ~2-3 taramada tüm bilinenler
//     bir tur tazelenir.
//   FAZ 4 — KEŞİF: kalan bütçe /funds/codes diff'inden rastgele tekil çekime
//     harcanır — henüz bilinmeyen katılım fonları (NSA gibi) zamanla bulunur
//     ve bilinen listesine eklenir. Aranan teşhis kodları her zaman öncelikli.
//
// DEĞİŞİKLİK (2026-07-13) — "bizde olmayan fonlar var" raporu (NSA, FTL, MPE,
// DNP, EP1 Fonoloji'de görünüp uygulamada yoktu): kategori bazlı çekim
// kaldırılıp tam tarama gelmişti; katılım filtresi (isim/kategori "KATILIM" +
// is_participation bayrağı) bizde uygulanıyor. `parcaNo` geriye dönük uyum
// için duruyor (cron URL'leri ?parca=N gönderiyor) ama yok sayılıyor.
// tefas-proxy'nin kod bazlı merge'ü bilerek korunuyor: kısmi tarama eski
// fonları SİLMEZ, sadece bu sefer çekilenleri günceller — FAZ 3/4'ün kısmi
// sonuçları bu sayede güvenle yazılabiliyor.
//
// DEĞİŞİKLİK (2026-07-14 akşam) — FON FİYATI (birim pay değeri) EKLENDİ:
// Fonoloji'nin /funds ve /funds/:code yanıtlarında `current_price` alanı
// zaten geliyormuş (resmi API dokümanında GET /funds/PHE örneğinde
// "current_price": 2.816142 olarak görülüyor) — mapFon() bunu şimdiye kadar
// hiç okumuyordu, bu yüzden uygulama tarafında fon fiyatı hep boş kalıyordu.
// Artık `fiyat` alanı olarak dışa aktarılıyor. Not: bulk `/funds?limit=...`
// liste taramasının HER satırda bu alanı içerdiği garanti değil (dokümanda
// örnek sadece tekil /funds/:code için verilmiş) — ama FAZ 2.5/3/4 zaten
// tekil /funds/:code çağırıyor, o fonlar için current_price kesin gelir.
// Liste taramasından gelenlerde alan yoksa `fiyat` null kalır, frontend
// bunu zaten "—" göstererek nazikçe karşılıyor.

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

// ── Global hız sınırlayıcı — Redis tabanlı, GERÇEKTEN paylaşılan sıra ──────
// KÖK NEDEN (gerçek log'la doğrulandı): eski MIN_ARALIK_MS/sonIstekZamaniMs
// mekanizması sadece BELLEKTE tutuluyordu — yani sadece TEK bir fonksiyon
// çalıştırması (invocation) içinde geçerliydi. Aynı anda birden fazla
// çalıştırma olduğunda her biri kendi başına "dakikada 27 istek hakkım var"
// sanıp gönderiyordu — Fonoloji tarafında TOPLAM dakikada 30'u aşıyordu.
//
// ÇÖZÜM: "Bir sonraki uygun istek zamanı" Redis'te TEK bir anahtarda tutulur
// ve bir Lua script ile ATOMİK olarak okunup güncellenir — kaç eşzamanlı
// çalıştırma olursa olsun istekler tek ortak sıradan geçer.
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
// ileri iter — böylece TÜM eşzamanlı çalıştırmalarda bir sonraki istek daha
// geç gönderilir.
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
        // 429 gelirse HEMEN vazgeçiyoruz (hızlı başarısız); paylaşılan sıraya
        // biraz ekstra boşluk ekleyip devam ediyoruz. Uzun retryAfter
        // beklemeleri tek bir çağrıyı dakikalarca asılı bırakıyordu.
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
// gerçek HTTP durum kodunu / hata mesajını da bildiriyor.
async function fetchTeshisli(url, opts, deneme = 2, msTimeout = 8000) {
  let sonHata = null;
  for (let i = 0; i < deneme; i++) {
    await siraliBekle();
    try {
      const r = await fetchZamanAsimli(url, opts, msTimeout);
      if (r.ok) return { res: r, hata: null };
      if (r.status === 429) {
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
    // Birim pay değeri (NAV) — Fonoloji'nin resmi API dokümanında
    // current_price olarak dönüyor. Liste taramasında her satırda garanti
    // olmayabilir; o durumda null kalır, frontend bunu "—" gösterir.
    fiyat:    (typeof f.current_price === "number") ? f.current_price : null,
    fiyatTarihi: f.current_date || null,
    takasAraligi: takasAraligi,
    gunluk:   parseFloat(((f.return_1d  || 0) * 100).toFixed(4)),
    gunlukNorm: f.return_1d ? parseFloat(((f.return_1d / takasAraligi) * 100).toFixed(4)) : 0,
    haftalik: parseFloat(((f.return_1w  || 0) * 100).toFixed(2)),
    aylik:    parseFloat(((f.return_1m  || 0) * 100).toFixed(2)),
    uc_aylik: parseFloat(((f.return_3m  || 0) * 100).toFixed(2)),
    ytd:      parseFloat(((f.return_ytd || 0) * 100).toFixed(2)),
    yillik:   parseFloat(((f.return_1y  || 0) * 100).toFixed(2)),
    yillikHesap: f.return_1d ? parseFloat(((f.return_1d / takasAraligi) * 252 * 100).toFixed(2)) : null,

    // ── ZATEN GELEN AMA KULLANILMAYAN ALANLAR (2026-08-05 eklendi) ─────────
    // Fonoloji liste ucu fon başına 42 alan döndürüyor; bunların 27'si
    // haritalanmadığı için kotayla çekilip atılıyordu. Hepsi aşağıda.
    // ⚠️ EK KOTA MALİYETİ YOK — veri zaten aynı yanıtta geliyordu.

    // Yüzde alanları API'de ONDALIK oran (0.0915 = %9,15). Getirilerle aynı
    // dönüşüm uygulanıyor; null gelen alan null kalıyor ki ekranda "—" çıksın.
    altiAylik:    (typeof f.return_6m === "number") ? parseFloat((f.return_6m * 100).toFixed(2)) : null,
    // Enflasyondan arındırılmış yıllık getiri. Türkiye'de nominal getiriden
    // çok daha anlamlı — nominal %60, reel %5 olabiliyor.
    reelYillik:   (typeof f.real_return_1y === "number") ? parseFloat((f.real_return_1y * 100).toFixed(2)) : null,

    // ── KARŞILAŞTIRMA BAYRAKLARI ──────────────────────────────────────────
    // ⚠️ GÜVENİLMEZ — EKRANDA GÖSTERİLMİYOR (2026-08-06).
    // Detay ucunda hepsi null; liste ucunda false geliyor ama KUT örneğinde
    // reelYillik +23,77 iken beats_tufe=false döndü. Reel getiri pozitifse
    // fon enflasyonu yenmiştir — yani değer matematiksel olarak yanlış.
    // Alan haritalanmaya devam ediyor (ek maliyeti yok); Fonoloji düzeltirse
    // FonDetay'daki rozet bloğu geri açılabilir.
    yendi: {
      altin:    f.beats_altin    ?? null,
      bist100:  f.beats_bist100  ?? null,
      kategori: f.beats_kategori ?? null,
      mevduat:  f.beats_mevduat  ?? null,
      tufe:     f.beats_tufe     ?? null,
    },

    // ── RİSK GÖSTERGELERİ ─────────────────────────────────────────────────
    // riskSkoru: TEFAS'ın resmî 1–7 ölçeği (1 en düşük risk).
    // sharpe/volatilite: 90 günlük. maksDusus: son 1 yılın en derin düşüşü.
    riskSkoru:  (typeof f.risk_score === "number") ? f.risk_score : null,
    sharpe90:   (typeof f.sharpe_90 === "number") ? parseFloat(f.sharpe_90.toFixed(2)) : null,
    volatilite90: (typeof f.volatility_90 === "number") ? parseFloat((f.volatility_90 * 100).toFixed(2)) : null,
    maksDusus1y:  (typeof f.max_drawdown_1y === "number") ? parseFloat((f.max_drawdown_1y * 100).toFixed(2)) : null,

    // ── FON BÜYÜKLÜĞÜ DEĞİŞİMİ ────────────────────────────────────────────
    // ⚠️ BU DEĞERLER TL DEĞİL, ORAN (2026-08-06'da ölçülerek doğrulandı).
    // KUT için gelen: hafta -0,0175 · ay -0,0872 · ucAy -0,1656
    // Yani -%1,75 / -%8,72 / -%16,56. İlk sürümde TL sanılıp para birimiyle
    // biçimlendirilmişti ve ekranda "−0 ₺" gibi anlamsız değerler çıkıyordu.
    // Ekranda ×100 ile yüzdeye çevriliyor. Pozitif = fona para giriyor.
    akis: {
      hafta: (typeof f.flow_1w === "number") ? f.flow_1w : null,
      ay:    (typeof f.flow_1m === "number") ? f.flow_1m : null,
      ucAy:  (typeof f.flow_3m === "number") ? f.flow_3m : null,
    },

    // ── PORTFÖY KIRILIMI (yüzde) ──────────────────────────────────────────
    // Fonun neye yatırdığı. Katılım fonlarında ÖZELLİKLE önemli:
    // devlet tahvili/hazine bonosu dolu bir "katılım" fonu şüphe uyandırır.
    // portfoyTarihi kırılımın ait olduğu tarih — fiyat tarihinden eskidir.
    dagilim: {
      hisse:        f.stock ?? null,
      altin:        f.gold ?? null,
      devletTahvili: f.government_bond ?? null,
      ozelTahvil:   f.corporate_bond ?? null,
      eurobond:     f.eurobond ?? null,
      hazineBonosu: f.treasury_bill ?? null,
      nakit:        f.cash ?? null,
      diger:        f.other ?? null,
    },
    portfoyTarihi: f.portfolio_date || null,

    // ── KİMLİK / DURUM ────────────────────────────────────────────────────
    isin:      f.isin || null,
    kapUrl:    f.kap_url || null,
    islemDurumu: f.trading_status || null,   // "AKTİF" vb.
    ilkGorulme: f.first_seen || null,        // fonun TEFAS'ta ilk görüldüğü tarih
  };
}

const VAKIF_KODLARI = ["VPA","VLT","VHS","VKK","VKV"];
// Aranan fonların ham verisi filtre kararından ÖNCE rapora düşürülür — API'nin
// gerçek name/category/is_participation alanları /api/tefas-proxy yanıtındaki
// aranilanKayipFonlar altında görülür (14 Tem 13:51'de DNP/EP1/FTL YAKALANDI:
// is_participation:null ama isimde "KATILIM" var → filtre onları geçiriyor).
// Sonuç bu eşiğin altındaysa tarama "şüpheli" sayılır ve tefas-proxy eski
// veriyi korur. Gerçek sayı bugün 434; 100 rahat bir alt sınır.
const ŞÜPHELİ_EŞİK = 100;

// ESKİ MİMARİDEN KALAN: PARCALAR artık kullanılmıyor. Başka bir modül import
// ediyorsa kırılmasın diye boş dizi olarak export ediliyor.
const PARCALAR = [];

// ═══════════════════════════════════════════════════════════════════════════
// FON VERİSİ ÇEKME — TEK İSTEK (2026-08-03 yeniden yazıldı)
// ═══════════════════════════════════════════════════════════════════════════
// ÖNCEKİ MİMARİ NEDEN SİLİNDİ:
// Fonoloji'de katılım süzgeci olmadığı varsayımıyla TÜM evren (3.450 fon)
// sayfa sayfa çekilip katılım fonları YERELDE süzülüyordu. Bunun için dört
// fazlı (liste taraması + /funds/codes + Vakıf garantili çekim + dönen imleçli
// tazeleme + keşif) ~350 satırlık bir mekanizma vardı.
//
// 3 Ağustos 2026 ölçümü bu mimarinin ÇALIŞMADIĞINI kanıtladı:
//   • sayfalamaModu:"kirik" — offset de page de yok sayılıyordu
//   • 3 sayfada 6.000 kayıt geldi, sadece 2.079'u benzersiz (3.921 mükerrer)
//   • hedefToplam 3.439 iken 2.079'da kalındı → 1.319 fon HİÇ görülmedi
//   • Kaçanlar arasında KLU (Kuveyt Türk Para Piyasası Katılım), EP1 (Emlak
//     Katılım Para Piyasası), PPG (Albaraka Para Piyasası) gibi AKTİF fonlar
//     vardı — ekranda 279 fon görünürken gerçek sayı 434'tü.
//
// YENİ MİMARİ: Fonoloji 3 Ağustos'ta sunucu-taraflı ?katilim=1 süzgecini
// duyurdu. Tek istekte 434 fonun tamamı geliyor, sayfalamaya hiç gerek yok:
//
//   GET /v1/funds?katilim=1&limit=500   →  434 kayıt, quota_cost 434
//
// Kota etkisi: eski mimari tarama başına ~3.600 kayıt yakıyordu (8 cron ile
// aylık ~864.000, kota 30.000). Yeni mimari tarama başına 434 — günde 2
// tarama ile aylık ~26.000.
//
// ⚠️ SÜZGEÇ ARTIK YERELDE UYGULANMIYOR. Sunucu zaten süzdüğü için gelen her
// kayıt katılım fonudur. mapFon.katilimUygun'a göre TEKRAR elemek, adında
// "KATILIM" geçmeyen meşru fonları düşürürdü (Fonoloji'nin tespiti ad VEYA
// kategori eşleşmesine bakıyor, bizimki de aynıydı — ama sunucunun kararına
// güvenmek doğrusu).
//
// NOT: is_participation / participation alanları Fonoloji yanıtlarında HİÇ
// dönmüyor (3 Ağustos'ta ölçüldü: 0/434). mapFon'daki kontrolleri savunma
// amaçlı bıraktık ama hiçbir zaman tetiklenmiyorlar.
const KATILIM_URL = "https://fonoloji.com/v1/funds?katilim=1&limit=500";
const FIYATSIZ_TAMAMLAMA_TAVANI = 30;  // fiyatı boş gelen fon için tekil çekim

// Fonoloji'den katılım fonlarını çeker.
// `parcaNo` yok sayılır — eski parçalı mimariden kalma, cron URL'leri hâlâ
// ?parca=N gönderdiği için imzada duruyor.
async function fonVerisiCek(parcaNo = null) {
  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) throw new Error("FONOLOJI_KEY tanımlı değil");
  const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };
  const takasAraligi = sonTakasGunuAralik();

  const taramaBaslangicMs = Date.now();
  const SURE_BUTCESI_MS = 190000;   // maxDuration 280 sn; güvenli pay bırakılıyor
  const butceDoldu = () => Date.now() - taramaBaslangicMs > SURE_BUTCESI_MS;

  // ── TEK İSTEK ────────────────────────────────────────────────────────────
  // 434 kayıt tek yanıtta geliyor; 25 sn zaman aşımı bolca yeter.
  const { res, hata } = await fetchTeshisli(KATILIM_URL, { headers }, 3, 25000);

  if (!res) {
    // Ağ hatası: eksikGorunuyor=true dönüyoruz. tefas-proxy bunu görünce
    // KV'deki mevcut listeyi KORUYOR — boş liste yazıp ekranı boşaltmıyor.
    return {
      data: [],
      eksikGorunuyor: true,
      kategoriTeshis: { "Katılım Taraması": { hamAdet: 0, agHatasi: true, hata } },
    };
  }

  const govde = await res.json().catch(() => null);
  const kayitlar = govde?.items ?? govde?.funds ?? govde?.data ?? (Array.isArray(govde) ? govde : []);

  // ── KIRPILMA KONTROLÜ ────────────────────────────────────────────────────
  // Kota yetmezse Fonoloji isteği REDDETMİYOR; yettiği kadar kayıt döndürüp
  // _meta.capped=true işaretliyor. Bu sessiz eksilme, TCMB rezerv olayının
  // aynısı — yakalanmazsa aylarca fark edilmez. Kırpılma varsa listeyi
  // "eksik" ilan edip mevcut veriyi koruyoruz.
  const kirpildi = !!(govde?._meta?.capped);
  const maliyet = res.headers.get("x-ratelimit-cost");
  const kalanAylik = res.headers.get("x-ratelimit-remaining-monthly");
  const kalanGunluk = res.headers.get("x-ratelimit-remaining-daily");

  // ── NORMALLEŞTİRME ───────────────────────────────────────────────────────
  // Sunucu zaten süzdüğü için katilimUygun'a göre TEKRAR eleme YAPILMIYOR.
  const katilimFonlar = [];
  const gorulenKodlar = new Set();
  for (const f of kayitlar) {
    const kod = f?.code;
    if (!kod || gorulenKodlar.has(kod)) continue;   // mükerrer koruması
    gorulenKodlar.add(kod);
    katilimFonlar.push(mapFon(f, VAKIF_KODLARI.includes(kod), takasAraligi));
  }

  // ── FİYATSIZ FONLARI TAMAMLA ─────────────────────────────────────────────
  // Ölçümde 434 kaydın 425'inde current_price doluydu; 9'unda boştu. Bunlar
  // tekil uçtan çekiliyor (fon başına 1 kota). Tavan ve süre bütçesi var:
  // beklenmedik bir günde 200 fon fiyatsız gelirse tarama kilitlenmesin.
  const fiyatsizlar = katilimFonlar.filter((x) => x.fiyat == null);
  let tamamlanan = 0;
  for (const fon of fiyatsizlar.slice(0, FIYATSIZ_TAMAMLAMA_TAVANI)) {
    if (butceDoldu()) break;
    const { res: tekRes } = await fetchTeshisli(
      `https://fonoloji.com/v1/funds/${encodeURIComponent(fon.kod)}`, { headers }, 1);
    if (!tekRes) continue;
    const td = await tekRes.json().catch(() => null);
    const ham = td?.fund ?? td;
    if (ham && ham.code) {
      const guncel = mapFon(ham, VAKIF_KODLARI.includes(fon.kod), takasAraligi);
      const i = katilimFonlar.findIndex((x) => x.kod === fon.kod);
      if (i >= 0) { katilimFonlar[i] = guncel; if (guncel.fiyat != null) tamamlanan++; }
    }
  }

  // ── ŞÜPHE KONTROLÜ ───────────────────────────────────────────────────────
  // Sonuç beklenenin çok altındaysa ya da kırpıldıysa "eksik" işaretlenir;
  // tefas-proxy bu durumda eski veriyle BİRLEŞTİRİR, üzerine yazmaz.
  const eksikGorunuyor = kirpildi || katilimFonlar.length < ŞÜPHELİ_EŞİK;

  const kategoriDagilim = {};
  for (const x of katilimFonlar) {
    const k = x.kategori || "(bos)";
    kategoriDagilim[k] = (kategoriDagilim[k] || 0) + 1;
  }

  return {
    data: katilimFonlar,
    eksikGorunuyor,
    // Teşhis /api/tefas-proxy yanıtında kategoriTeshis altında görünür.
    // Kota alanları bilerek buraya kondu: kalan kotanın düştüğü fark
    // edilmezse, kırpılma başladığında sebebi aramak zaman alırdı.
    kategoriTeshis: {
      "Katılım Taraması": {
        hamAdet: kayitlar.length,
        benzersiz: katilimFonlar.length,
        kirpildi,
        fiyatsizGelen: fiyatsizlar.length,
        fiyatiTamamlanan: tamamlanan,
        kotaMaliyeti: maliyet,
        kalanAylik,
        kalanGunluk,
        kategoriDagilim,
        agHatasi: false,
        hata: kirpildi ? "KOTA KIRPILMASI — _meta.capped=true" : null,
      },
    },
  };
}

export { fonVerisiCek, ŞÜPHELİ_EŞİK, PARCALAR, siraliBekle, mapFon, sonTakasGunuAralik, VAKIF_KODLARI };
