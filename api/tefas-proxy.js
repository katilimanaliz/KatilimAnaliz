// api/tefas-proxy.js
// TEK fonksiyon, DÖRT rol:
//  1) Normal kullanıcı isteği (GET, header/param yok) → KV'den okur, hızlı yanıt verir
//  2) Vercel Cron tetiklemesi (?cron=1&parca=1|2|3) → Fonoloji'den O PARÇANIN
//     kategorilerini çekip KV'deki mevcut veriyle BİRLEŞTİRİR (üzerine tamamen
//     yazmaz — fon kodu bazında upsert yapar)
//  3) Tek fon geçmiş fiyat isteği (?gecmis=1&kod=XXX&donem=1a|3a|1y) → fon
//     detay grafiği (Yatırım Fonları Getiri İzleme + Portföyüm'den açılan
//     grafik ekranı) için Fonoloji'nin /funds/:code/history ucundan geçmiş
//     fiyat serisi çeker. AYRI BİR api/ DOSYASI AÇILMADI — Vercel Hobby plan
//     12 Serverless Function sınırına zaten yakınız (bkz. aşağıdaki not),
//     bu yüzden üçüncü rol de bu dosyaya eklendi.
//  4) Tek fon hisse ağırlık dağılımı isteği (?holdings=1&kod=XXX) → Fon
//     Tahminleri özelliği için Fonoloji'nin /funds/:code/portfolio?include=
//     holdings ucundan KAP portföy dağılım raporundan çıkarılmış hisse kodu +
//     ağırlık listesini çeker. Canlı hisse FİYATI burada YOK — o, uygulamanın
//     zaten sahip olduğu BİST veri izleme kaynağından (hisse-proxy.js) alınıp
//     frontend'de bu ağırlıklarla eşleştirilerek tahmin hesaplanıyor.
//     AYRI BİR DOSYA AÇILMADI (aynı 12 fonksiyon sınırı gerekçesiyle).
//
// NEDEN PARÇALARA BÖLÜNDÜ: Fonoloji "dakikada en fazla 30 istek" sınırı
// uyguluyor (kendi hata mesajından doğrulandı: "Dakikada 30 istek sınırı
// aşıldı"). Toplam ~34 isteği (5 Vakıf + 21 kategori + pagination) tek çağrıda
// bu kurala uyacak şekilde yavaşlatınca süre ~75-90sn'ye çıkıyor — bu, Vercel
// fonksiyon zaman aşımı sınırına (plana göre değişir) takılma riski taşıyor.
// Çözüm: kategoriler 8 dengeli PARÇAya bölündü (_lib/fonFetch.js'deki
// PARCALAR'a bkz), her parçaya vercel.json'da bir cron saati tanımlandı.
// Her çağrı ~20-45sn sürer, güvenli. Son parça bittiğinde tam liste oluşur.
//
// ⚠️ NOT (2026-08-18): Yukarıdaki "8 parçaya bölündü" açıklaması ARTIK GÜNCEL
// DEĞİL — bkz. _lib/fonFetch.js başındaki not. 3 Ağustos'ta fonVerisiCek()
// Fonoloji'nin ?katilim=1 sunucu-taraflı süzgeciyle TEK istekte tüm katılım
// fonlarını (434 kayıt) çeken mimariye geçti. `parcaNo` parametresi (cron
// URL'leri hâlâ ?parca=N gönderdiği için) geriye dönük uyumluluk için duruyor
// ama fonVerisiCek() içinde YOK SAYILIYOR. Bu dosyadaki eski açıklama silinmedi
// (tarihsel bağlam için), ama GÜNCEL DAVRANIŞ budur.
//
// NEDEN TEK DOSYA (ayrı bir cron-*.js/fon-gecmis.js değil): Vercel Hobby plan
// deployment başına en fazla 12 Serverless Function'a izin veriyor (bu repo
// zaten sınırda). Cron mantığını VE tek-fon geçmiş ucunu buraya taşıyarak
// fonksiyon sayısı artmıyor.
//
// KİLİT KORUMASI (2026-07 eklendi, sonra ortak modüle taşındı): İki ayrı
// yarış durumu tespit edildi:
//   (a) cronYaz oku-değiştir-yaz yapıyor (KV'den `eski`yi okuyup birleştirip
//       geri yazıyor). Aynı anda iki çağrı (örn. manuel tetikleme + zamanlanmış
//       tetikleme çakışırsa) aynı `eski` değeri okuyup birbirinin yazdığını
//       ezebilir (lost update). `kilitliCalistir` ile korunuyor.
//   (b) herkesOku'daki bootstrap kısmı: KV tamamen boşken aynı anda gelen
//       birden fazla ilk istek, hepsi paralel fonVerisiCek() tetikleyip
//       Fonoloji'ye gereksiz yük bindirebilir (kalabalık hücumu). AYNI kilit
//       anahtarıyla `kilitliCalistir` kullanılıyor — böylece cron yazması ile
//       bootstrap okuması da birbirini dışlar.
// Kilit mantığı artık _lib/kilitliOnbellek.js'deki ORTAK modülde — evds-proxy.js
// (ve ileride eklenecek başka proxy'ler) ile aynı, tek yerden bakımı yapılan
// kilit deseni kullanılıyor.
//
// BOOTSTRAP DÜZELTMESİ (2026-07, v2): Fonoloji API kullanım panelinde Vakıf
// fonu endpoint'lerinin (VPA/VLT/VHS/VKK) ay içinde ~170'er kez çağrıldığı
// görüldü — bu, günde 1 kez çalışması gereken cron'un ÇOK üzerinde. KÖK NEDEN:
// eski bootstrap mantığı, tam çekim SONUCU 100 fondan azsa (280sn zaman aşımı
// veya 429'lar yüzünden yarım kalırsa) KV'ye HİÇ YAZMIYORDU. Bu durumda
// `kayit` sonsuza dek null kalıyor, bu da HER TEK kullanıcı isteğinin (sayfa
// her yenilendiğinde, her yeni ziyaretçide) aynı ağır tam-çekimi baştan
// tekrar tetiklemesine yol açıyordu — kendi kendini besleyen bir döngü.
// İKİ DÜZELTME yapıldı:
//   1) Kısmi/düşük sonuç gelse bile artık KV'ye YAZILIYOR (eksik:true
//      işaretiyle) — böylece bir sonraki istek sıfırdan başlamak yerine
//      mevcut (eksik de olsa) veriyi kullanır; cron parçaları zamanla
//      birlestir() ile eksikleri tamamlar.
//   2) Bootstrap denemesi başına kısa bir SOĞUMA SÜRESİ (10 dakika) eklendi:
//      bir deneme (başarılı/başarısız fark etmez) yapıldıktan sonra, aynı 10
//      dakika içinde gelen diğer istekler YENİ bir tam-çekim tetiklemez,
//      sadece "veri henüz yok" der. Böylece art arda gelen çok sayıda soğuk
//      istek, art arda çok sayıda ağır Fonoloji çekimine dönüşemez.
//
// TEŞHİS KALICILIĞI (2026-07-13): fonVerisiCek'in ürettiği kategoriTeshis
// (kategori başına hamAdet/agHatasi/hata) artık KV'ye YAZILIYOR ve public
// yanıtta dönülüyor — parça bazında birleştirilerek (her cron kendi
// kategorilerinin teşhisini günceller, diğerlerini korur). Böylece "bizde
// olmayan fonlar var" tarzı raporlarda tarayıcıdan /api/tefas-proxy açıp
// hangi kategorinin boş/hatalı olduğu anında görülebiliyor.
//
// ⚠️ DÜZELTME (2026-08-18): "parça bazında birleştirilerek" yukarıdaki notta
// tarif edilen davranış, teshisBirlestir()'in ESKİ mimari (parçalı cron)
// için doğruydu — her parça sadece KENDİ kategorilerini güncelleyip
// diğerlerini KV'de korurdu. Ama 3 Ağustos'ta fonVerisiCek() tek-istek
// mimarisine geçtikten SONRA bu birleştirme mantığı DEĞİŞTİRİLMEDİ — spread
// ile birleştirme, artık üretilmeyen Temmuz ayı anahtarlarını ("Tam Tarama",
// "Fon Sepeti Şemsiye Fonu" vb.) KV'de SİLİNMEDEN taşımaya devam etti.
// Kullanıcı /api/tefas-proxy yanıtına baktığında, aylar önce yazılmış
// "sayfalama kırık" teşhisini GÜNCEL sanabiliyordu. teshisBirlestir() artık
// eskiyi hiç karıştırmadan sadece yeni teşhisi döndürüyor (bkz. fonksiyon
// tanımı aşağıda).
export const config = { maxDuration: 280 };

import { Redis } from "@upstash/redis";
import { fonVerisiCek, ŞÜPHELİ_EŞİK, siraliBekle, mapFon, sonTakasGunuAralik, VAKIF_KODLARI } from "./_lib/fonFetch.js";
import { kilitliCalistir } from "./_lib/kilitliOnbellek.js";

// Vercel'in enjekte ettiği env var adı entegrasyon şekline göre değişebiliyor,
// ikisini de kontrol ediyoruz.
const kv = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const KV_ANAHTAR = "tefas:katilim-fonlari";
const BAYATLIK_SINIRI_SAAT = 20;

// Hem cron yazması hem bootstrap okuması AYNI anahtarı kullanır; böylece
// ikisi de birbirini dışlar, ayrı ayrı kilit anahtarları tutmaya gerek kalmaz.
const KILIT_ANAHTARI = `lock:${KV_ANAHTAR}`;

// Bootstrap soğuma anahtarı — bkz. dosya başındaki "BOOTSTRAP DÜZELTMESİ" notu.
const BOOTSTRAP_SOGUMA_ANAHTAR = "tefas:bootstrap-son-deneme";
const BOOTSTRAP_SOGUMA_SANIYE = 600; // 10 dakika

// ── Tek fon geçmiş fiyat serisi (2026-07-14 akşam eklendi) ─────────────────
// Fon detay grafiği için: /api/tefas-proxy?gecmis=1&kod=VPA&donem=1a
// donem: "1a"|"3a"|"1y" (uygulamanın hisse tarafındaki dönem sözleşmesiyle
// AYNI — HisseDetay'daki 1 Ay/3 Ay/1 Yıl sekmeleriyle tutarlı).
const FON_GECMIS_DONEM_MAP = { "1a": "1m", "3a": "3m", "1y": "1y" };
const FON_GECMIS_CACHE_TTL_SANIYE = 600; // 10 dk — aynı fon+dönem sık sorulursa Fonoloji'ye tekrar gitmesin

// ── Tek fon TAM DETAY (kategori/yönetici/yatırımcı/büyüklük dahil) ─────────
// Fon detay grafiği Portföyüm'den açıldığında (sadece fiyat/getiri saklayan
// PortfoyKalemi ile), eksik metadata'yı tamamlamak için:
// /api/tefas-proxy?detay=1&kod=VPA
// mapFon() ile aynı normalize edilmiş şekli döndürür (kod/ad/yonetici/
// kategori/yatirimci/portfoy/fiyat/gunluk/gunlukNorm/haftalik/aylik/yillik/
// takasAraligi) — böylece FonDetay/GetiriHesaplayici hangi ekrandan açıldığına
// bakmaksızın hep aynı alan adlarını bulur.
const FON_DETAY_CACHE_TTL_SANIYE = 86400; // 24 saat — fon NAV'ı/yatırımcı sayısı günde bir kez değişiyor (2026-09-05'te 15 dk'dan yükseltildi, gereksiz Fonoloji sorgusu)

// ── Tek fon HİSSE AĞIRLIK DAĞILIMI (2026-09 eklendi — Fon Tahminleri) ──────
// /api/tefas-proxy?holdings=1&kod=THF
// Fonoloji'nin /funds/:code/portfolio?include=holdings ucundan KAP portföy
// dağılım raporundan çıkarılmış hisse kodu + ağırlık listesini çeker.
//
// ⚠️ Holdings verisi PERİYODİK (KAP dağılım raporu tarihine bağlı, günlük
// DEĞİL) — cache TTL bilerek uzun (24 saat). Canlı hisse FİYATI bu uçtan
// GELMEZ — frontend, uygulamanın zaten sahip olduğu BİST veri izleme
// kaynağıyla (hisse-proxy.js / TradingView) bu ağırlıkları eşleştirip
// tahmini getiriyi kendisi hesaplar. Bu uç sadece ağırlık listesi + dağılım
// tarihini döner.
//
// ✅ YANIT ŞEKLİ DOĞRULANDI (2026-09-03, THF ile gerçek çağrı): d.holdings BİR
// NESNE, asıl liste d.holdings.items içinde. Kalem alanları: asset_code,
// asset_name, asset_type ("stock" | diğer), weight. Tarih iki ayrı alanda:
// latestPeriod ("2026-08") ve latestPublishDate (epoch ms). Aşağıdaki
// ayrıştırma bu gerçek şekle göre yazıldı (tahmini alan adı denemesi değil).
const FON_HOLDINGS_CACHE_TTL_SANIYE = 86400; // 24 saat — periyodik veri, günlük değişmez

// Hem HTTP ucu (fonHoldingsGetir) hem de günlük tahmin snapshot cron'u
// (fonTahminSnapshotCalistir) AYNI çekim+cache mantığını kullanır — kod
// tekrarını önlemek için ortak dahili fonksiyona çıkarıldı (2026-09-04).
// req/res'e bağımlı değildir, sadece veri döner (ya da null).
// ── ALT FON GÜNLÜK GETİRİSİ (2026-09-04 eklendi) ────────────────────────────
// Bazı fonlar (ör. DFI) portföylerinin büyük bir kısmını BAŞKA FONLARA
// yatırıyor (tur: "fund" — ör. DFI'nin %31'i ABG/PSE/BAC/GCD/KVR/PFS'de).
// Bu alt fonlar için canlı hisse fiyatı gibi bir şey YOK — TEFAS/Fonoloji
// NAV'ı günde BİR kez (önceki günün kapanışıyla) yayımlıyor. Kullanıcı kararı:
// bu kalemler için "—" göstermek yerine, alt fonun KENDİ SON AÇIKLANAN GÜNLÜK
// GETİRİSİNİ (return_1d) kullanarak tahmine dahil edelim — TLREF/repo oranı
// gibi bir vekil DEĞİL, fonun gerçek dünkü getirisi.
// TTL 24 saat: zaten günde bir güncellenen bir veri, daha sık sorgulamaya
// gerek yok. Aynı alt fon birden çok üst fonda geçebilir (ör. PSE) — anahtar
// alt fon koduna göre olduğu için tekrar sorgu atılmaz, cache paylaşılır.
const ALT_FON_GETIRI_CACHE_TTL_SANIYE = 86400; // 24 saat

async function altFonGunlukGetiriGetir(kod) {
  const cacheAnahtar = `fon:gunluk-getiri:${kod}`;
  try {
    const onbellek = await kv.get(cacheAnahtar).catch(() => null);
    if (onbellek && typeof onbellek.getiri === "number") return onbellek.getiri;
  } catch {}

  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) return null;

  try {
    await siraliBekle();
    const r = await fetch(
      `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}`,
      { headers: { "X-API-Key": API_KEY, "Accept": "application/json" } }
    );
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    const ham = d?.fund ?? d;
    const getiriHam = ham?.return_1d;
    if (typeof getiriHam !== "number") return null;
    const getiri = parseFloat((getiriHam * 100).toFixed(4));
    try { await kv.set(cacheAnahtar, { getiri, ts: Date.now() }, { ex: ALT_FON_GETIRI_CACHE_TTL_SANIYE }); } catch {}
    return getiri;
  } catch {
    return null;
  }
}

async function holdingsGetirDahili(kod) {
  const cacheAnahtar = `fon:holdings:${kod}`;
  try {
    const onbellek = await kv.get(cacheAnahtar).catch(() => null);
    if (onbellek && Array.isArray(onbellek.kalemler) && onbellek.kalemler.length) {
      return onbellek;
    }
  } catch {}

  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) return null;

  try {
    await siraliBekle();
    const r = await fetch(
      `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}/portfolio?include=holdings`,
      { headers: { "X-API-Key": API_KEY, "Accept": "application/json" } }
    );
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);

    // ── GERÇEK YANIT ŞEKLİ (2026-09-03, THF ile doğrulandı) ────────────────
    const holdingsBlok = d?.holdings ?? {};
    const hamKalemler = Array.isArray(holdingsBlok.items) ? holdingsBlok.items : [];
    const donemEtiketi = holdingsBlok.latestPeriod ?? null;
    const yayinTarihiMs = typeof holdingsBlok.latestPublishDate === "number"
      ? holdingsBlok.latestPublishDate : null;

    const kalemler = hamKalemler
      .map((k) => ({
        kod: String(k.asset_code ?? "").toUpperCase().trim(),
        ad: k.asset_name ?? null,
        agirlik: typeof k.weight === "number" ? k.weight : null,
        tur: k.asset_type ?? null,
      }))
      .filter((k) => k.kod && typeof k.agirlik === "number");

    if (!kalemler.length) return null;

    // Alt fon kalemleri (tur:"fund") için önceki günün getirisini ekle —
    // bkz. yukarıdaki altFonGunlukGetiriGetir notu. Paralel çekiliyor ama
    // siraliBekle() zaten aralarında paylaşılan hız sırasına sokuyor.
    const altFonKalemleri = kalemler.filter((k) => k.tur === "fund");
    if (altFonKalemleri.length) {
      const sonuclar = await Promise.all(
        altFonKalemleri.map((k) => altFonGunlukGetiriGetir(k.kod))
      );
      altFonKalemleri.forEach((k, i) => { k.oncekiGunGetiri = sonuclar[i]; });
    }

    const paket = {
      success: true,
      kod,
      dagilimDonemi: donemEtiketi,
      dagilimYayinTarihiMs: yayinTarihiMs,
      kalemler,
      kaynak: "fonoloji",
    };
    try { await kv.set(cacheAnahtar, paket, { ex: FON_HOLDINGS_CACHE_TTL_SANIYE }); } catch {}
    return paket;
  } catch {
    return null;
  }
}

async function fonHoldingsGetir(req, res) {
  const kod = String(req.query?.kod || "").toUpperCase().trim();
  if (!kod) return res.status(400).json({ success: false, error: "kod parametresi gerekli" });

  // Ham yanıtı incelemek için geçici debug kapısı: ?holdings=1&kod=THF&ham=1
  // (dahili fonksiyonu atlar, doğrudan Fonoloji'yi çağırır — cache'e yazmaz)
  if (req.query?.ham === "1") {
    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    try {
      await siraliBekle();
      const r = await fetch(
        `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}/portfolio?include=holdings`,
        { headers: { "X-API-Key": API_KEY, "Accept": "application/json" } }
      );
      const d = await r.json().catch(() => null);
      return res.status(200).json({ success: true, ham: d });
    } catch (e) {
      return res.status(500).json({ success: false, error: String(e.message || e) });
    }
  }

  const paket = await holdingsGetirDahili(kod);
  if (!paket) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ success: false, error: "Holdings verisi alınamadı" });
  }
  res.setHeader("Cache-Control", "max-age=0, s-maxage=3600, stale-while-revalidate=3600");
  return res.status(200).json(paket);
}

// ── FON TAHMİN GEÇMİŞİ (2026-09-04 eklendi) ─────────────────────────────────
// "Tahmin Geçmişi" sekmesi için: günlük olarak bir önceki günün tahminini o
// günün gerçek TEFAS getirisiyle kapatıp isabet hesaplayan, aynı zamanda
// bugünün YENİ tahminini kaydeden bir snapshot mekanizması.
//
// ⚠️ İSABET FORMÜLÜ BİZİM TANIMIMIZ — Fintables'ın kullandığı formülü
// örnekten tersine mühendislikle çıkarmaya ÇALIŞMADIK (birkaç örnek veriden
// güvenilir şekilde çıkarılamayacağı görüldü — aynı yönlü tahminlerde bile
// tutarsız isabet değerleri vardı). Basit, şeffaf, uygulama içinde de bu
// şekilde açıklanan kendi formülümüz: tahmin ile gerçek getiri arasındaki
// MUTLAK PUAN farkı 1,5 puanı bulunca isabet %0'a iner, fark sıfırsa %100.
const ISABET_ESIK_PUAN = 1.5;
function isabetHesapla(tahmin, gercek) {
  if (typeof tahmin !== "number" || typeof gercek !== "number") return null;
  const fark = Math.abs(tahmin - gercek);
  return Math.max(0, Math.min(100, 100 - (fark / ISABET_ESIK_PUAN) * 100));
}

// Türkiye saatiyle (TSİ, UTC+3) bugünün tarihini "YYYY-MM-DD" döner —
// Vercel fonksiyonları UTC'de çalışır, yerel tarihe göre snapshot almak için
// sabit +3 ofset uygulanıyor (DST yok, TSİ sabit UTC+3).
function bugunTarihiTR() {
  const simdi = new Date(Date.now() + 3 * 3600 * 1000);
  return simdi.toISOString().slice(0, 10);
}

const FON_TAHMIN_PILOT = ["THF", "DFI", "DOH", "PBR", "PHE", "PUK", "TLY", "TMV", "KHA"];

// ── DİNAMİK TAKİP LİSTESİ (2026-09-04 eklendi) ──────────────────────────────
// Sabit 9 pilot fonun ÜZERİNE, kullanıcıların Ana Sayfa'dan ekleyebildiği
// fonlar. TEK bir global liste — bu widget kimlik doğrulaması olmayan (auth
// sistemi yok) bir Ana Sayfa öğesi, dolayısıyla "kullanıcı bazlı" değil,
// TÜM uygulama kullanıcılarının paylaştığı TEK backend listesi.
//
// ⚠️ ÜST SINIR BİLEREK DÜŞÜK (toplam 10 = 9 pilot + 1 ekstra): auth olmadan
// herkesin ekleyebildiği bir liste, sınırsız büyürse her yeni fon kalıcı
// olarak günlük 1 Fonoloji isteği demek — kota zamanla tükenir. Sınır
// dolunca yeni ekleme istekleri reddedilir, mevcut fon silinmez.
const FON_TAHMIN_TOPLAM_LIMIT = 10;
const FON_TAHMIN_EKSTRA_KV = "fonTahmin:ekstraListe";

async function fonTahminListesiOku() {
  let ekstra = [];
  try {
    const kayit = await kv.get(FON_TAHMIN_EKSTRA_KV).catch(() => null);
    if (Array.isArray(kayit)) ekstra = kayit;
  } catch {}
  // Dedupe + pilot listesindekileri ekstradan ayıkla (çakışma olmasın)
  const ekstraTemiz = [...new Set(ekstra)].filter((k) => !FON_TAHMIN_PILOT.includes(k));
  return { pilot: FON_TAHMIN_PILOT, ekstra: ekstraTemiz, liste: [...FON_TAHMIN_PILOT, ...ekstraTemiz] };
}

async function fonTahminListesiGetir(req, res) {
  const { pilot, ekstra, liste } = await fonTahminListesiOku();
  res.setHeader("Cache-Control", "max-age=0, s-maxage=120, stale-while-revalidate=120");
  return res.status(200).json({ success: true, pilot, ekstra, liste, limit: FON_TAHMIN_TOPLAM_LIMIT });
}

async function fonTahminEkle(req, res) {
  const kod = String(req.query?.kod || "").toUpperCase().trim();
  if (!kod) return res.status(400).json({ success: false, error: "kod parametresi gerekli" });

  const { ekstra, liste } = await fonTahminListesiOku();

  if (liste.includes(kod)) {
    return res.status(200).json({ success: true, zatenListede: true, liste });
  }
  if (liste.length >= FON_TAHMIN_TOPLAM_LIMIT) {
    return res.status(409).json({
      success: false,
      error: `Liste dolu (üst sınır ${FON_TAHMIN_TOPLAM_LIMIT} fon). Yeni fon eklenemedi.`,
      liste,
    });
  }

  // Fon gerçekten var mı ve hisse dağılımı çekilebiliyor mu doğrula —
  // geçersiz/rastgele kodların listeye girip her gün boşu boşuna
  // denenmesini (ve isabet %0 kaydı biriktirmesini) önler.
  const holdings = await holdingsGetirDahili(kod);
  if (!holdings) {
    return res.status(404).json({ success: false, error: "Fon bulunamadı ya da hisse dağılımı alınamadı" });
  }

  const yeniEkstra = [...ekstra, kod];
  try { await kv.set(FON_TAHMIN_EKSTRA_KV, yeniEkstra); } catch (e) {
    return res.status(500).json({ success: false, error: String(e.message || e) });
  }

  return res.status(200).json({ success: true, liste: [...FON_TAHMIN_PILOT, ...yeniEkstra] });
}
const FON_TAHMIN_GECMIS_MAX_KAYIT = 30;

async function tahminGecmisGetir(req, res) {
  const kod = String(req.query?.kod || "").toUpperCase().trim();
  if (!kod) return res.status(400).json({ success: false, error: "kod parametresi gerekli" });
  try {
    const kayitlar = (await kv.get(`fonTahmin:gecmis:${kod}`).catch(() => null)) || [];
    res.setHeader("Cache-Control", "max-age=0, s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json({ success: true, kod, kayitlar });
  } catch (e) {
    return res.status(500).json({ success: false, error: String(e.message || e) });
  }
}

// Canlı hisse fiyat değişimlerini kendi /api/hisse-proxy ucumuzdan HTTP ile
// çekiyoruz — frontend'in kullandığı AYNI veri, ayrı bir kaynak/kota YOK.
async function hisseDegisimMapGetirDahili() {
  try {
    const r = await fetch("https://www.katilimplus.com/api/hisse-proxy");
    if (!r.ok) return {};
    const d = await r.json().catch(() => null);
    const m = {};
    for (const h of (d?.data || [])) {
      if (typeof h.degisim1g === "number" && h.ticker) m[h.ticker] = h.degisim1g;
    }
    return m;
  } catch {
    return {};
  }
}

async function fonTahminSnapshotCalistir(req, res) {
  // ⚠️ Paylaşılan CRON_SECRET yerine AYRI bir gizli anahtar kullanılıyor
  // (2026-09-04): CRON_SECRET Vercel'de "Secret" tipinde — bir kez
  // kaydedildikten sonra değeri bir daha GÖSTERİLEMİYOR. Onu rotate etmek
  // aynı anahtarı kullanan diğer TÜM cron-job.org görevlerini (bildirim,
  // fiyat alarmı vb.) kırardı. Bu yeni cron için bağımsız bir anahtar
  // (FON_TAHMIN_CRON_SECRET) tanımlanınca, değeri Uğur'un kendisi belirlediği
  // için elinde kalır — mevcut sisteme dokunulmamış olur.
  const cronSecret = process.env.FON_TAHMIN_CRON_SECRET;
  const gelenAuth = req.headers.authorization;
  const vercelCronMu = req.headers["x-vercel-cron"] === "1";
  if (cronSecret && !vercelCronMu && gelenAuth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Yetkisiz" });
  }

  // ── İKİ AŞAMALI ÇALIŞMA MODU (2026-09-04 eklendi) ─────────────────────────
  // Önceden bu fonksiyon TEK bir günlük çağrıda (akşam 18:25) hem dünkü
  // tahminin gerçek getirisini kapatıyor hem bugünün yeni tahminini
  // kaydediyordu. Sorun: TEFAS gerçek getiriyi ERTESİ GÜN sabah ~09:00-10:00
  // yayınlıyor — ama kullanıcı bunu akşama kadar (18:25'e kadar) ekranda
  // GÖREMİYORDU, gereksiz bir gecikme. Artık iki ayrı moda bölündü:
  //   ?mod=kaydet       → SADECE bugünün tahminini ekler (gerçek getiriye
  //                        dokunmaz). Piyasa kapanışından sonra (~18:20)
  //                        çağrılmalı.
  //   ?mod=gerceklestir → SADECE açık (gercek:null) bekleyen bir önceki kaydı,
  //                        artık TEFAS'ta yayınlanmış olan gerçek getiriyle
  //                        kapatır (yeni tahmin EKLEMEZ). Sabah ~09:30-10:00
  //                        çağrılmalı — TEFAS'ın yayın saatinden hemen sonra.
  //   (mod verilmezse)  → ESKİ DAVRANIŞ (ikisi birden) — geriye dönük uyumluluk
  //                        ve elle/manuel test için korunuyor.
  const mod = req.query?.mod === "kaydet" || req.query?.mod === "gerceklestir" ? req.query.mod : null;
  const kaydetMi = mod == null || mod === "kaydet";
  const gerceklestirMi = mod == null || mod === "gerceklestir";

  const bugun = bugunTarihiTR();
  const hisseDegisimMap = kaydetMi ? await hisseDegisimMapGetirDahili() : {};
  // Gerçek getiri kapatma adımı için mevcut TEFAS fon listesini bir kez oku.
  const tefasKayit = gerceklestirMi ? await kv.get(KV_ANAHTAR).catch(() => null) : null;
  const fonGercekMap = {};
  for (const f of (tefasKayit?.data || [])) {
    if (f?.kod && typeof f.gunluk === "number") fonGercekMap[f.kod] = f.gunluk;
  }

  const sonuclar = [];
  const { liste: takipListesi } = await fonTahminListesiOku();
  for (const kod of takipListesi) {
    try {
      let tahmin = null, kapsam = 0;
      if (kaydetMi) {
        const holdings = await holdingsGetirDahili(kod);
        if (holdings) {
          let t = 0, k = 0;
          for (const kalem of holdings.kalemler) {
            if (kalem.tur === "stock") {
              const deg = hisseDegisimMap[kalem.kod];
              if (typeof deg !== "number" || typeof kalem.agirlik !== "number") continue;
              t += (kalem.agirlik / 100) * deg;
              k += kalem.agirlik;
            } else if (kalem.tur === "fund" && typeof kalem.oncekiGunGetiri === "number") {
              // Alt fon — canlı fiyat yok, önceki gün açıklanan getiriyle dahil
              // ediliyor (bkz. altFonGunlukGetiriGetir notu).
              if (typeof kalem.agirlik !== "number") continue;
              t += (kalem.agirlik / 100) * kalem.oncekiGunGetiri;
              k += kalem.agirlik;
            }
          }
          if (k > 0) { tahmin = t; kapsam = k; }
        }
      }

      const gecmisAnahtar = `fonTahmin:gecmis:${kod}`;
      let kayitlar = (await kv.get(gecmisAnahtar).catch(() => null)) || [];
      if (!Array.isArray(kayitlar)) kayitlar = [];

      // 1) Bir önceki kaydın gerçek getirisi HENÜZ kapatılmadıysa, bugünkü
      // TEFAS verisiyle kapat (bir önceki kayıt DÜNKÜ tahmindi, bugün onun
      // gerçek getirisi TEFAS'ta yayınlanmış olur). SADECE gerceklestirMi.
      if (gerceklestirMi) {
        const son = kayitlar[kayitlar.length - 1];
        if (son && son.gercek == null && son.tarih !== bugun) {
          const gercek = fonGercekMap[kod];
          if (typeof gercek === "number") {
            son.gercek = gercek;
            son.isabet = isabetHesapla(son.tahmin, gercek);
          }
        }
      }

      // 2) Bugün için zaten bir kayıt yoksa, yeni tahmini ekle. SADECE kaydetMi.
      if (kaydetMi) {
        const son2 = kayitlar[kayitlar.length - 1];
        if (!son2 || son2.tarih !== bugun) {
          if (tahmin != null) {
            kayitlar.push({ tarih: bugun, tahmin, gercek: null, isabet: null, kapsam });
          }
        } else if (tahmin != null) {
          // Aynı gün içinde cron birden fazla kez çalışırsa (manuel test vb.)
          // en güncel tahminle üzerine yaz — kapsam artmış olabilir.
          son2.tahmin = tahmin;
          son2.kapsam = kapsam;
        }
      }

      if (kayitlar.length > FON_TAHMIN_GECMIS_MAX_KAYIT) {
        kayitlar = kayitlar.slice(kayitlar.length - FON_TAHMIN_GECMIS_MAX_KAYIT);
      }

      await kv.set(gecmisAnahtar, kayitlar).catch(() => {});
      sonuclar.push({ kod, tahmin, kapsam, kayitSayisi: kayitlar.length });
    } catch (e) {
      sonuclar.push({ kod, hata: String(e.message || e) });
    }
  }

  return res.status(200).json({ success: true, tarih: bugun, sonuclar });
}

// ── FON AD/KATEGORİ — HAFİF, UZUN ÖMÜRLÜ UÇ (2026-09-04 eklendi) ────────────
// Fon Tahminleri widget'ının kod altında fon adını göstermek için sürekli
// (arka planda, kullanıcı hiçbir şeye tıklamadan) `?detay=1`'i çağırması,
// o ucun paylaşılan 15 dakikalık KV önbelleğini (Portföyüm'ün CANLI fiyat
// ihtiyacı için ayarlanmış) 9 fon için sürekli tetikleyip günde ~864 istek/
// aylık ~26.000'e kadar çıkabiliyordu (aylık kota 15.000).
//
// Fon adı/kategorisi PRATİKTE HİÇ DEĞİŞMEZ — bu yüzden AYRI, çok daha uzun
// ömürlü (24 saat) bir KV anahtarında tutuluyor. `?detay=1`'in paylaşılan
// önbelleğine DOKUNULMUYOR (Portföyüm'ün tazelik ihtiyacı bozulmasın).
// Fon adı/kategorisi pratikte hiç değişmiyor — 180 gün (yaklaşık 6 ay) gibi
// çok uzun bir süre tutuluyor. Tamamen süresiz (ex olmadan) de olabilirdi,
// ama ileride veri şekli değişirse kendiliğinden bir gün tazelensin diye
// yine de bir üst sınır bırakıldı.
const FON_ADKATEGORI_CACHE_TTL_SANIYE = 180 * 24 * 60 * 60; // 180 gün

async function fonAdKategoriGetir(req, res) {
  const kod = String(req.query?.kod || "").toUpperCase().trim();
  if (!kod) return res.status(400).json({ success: false, error: "kod parametresi gerekli" });

  const cacheAnahtar = `fon:adkategori:${kod}`;
  try {
    const onbellek = await kv.get(cacheAnahtar).catch(() => null);
    if (onbellek) {
      res.setHeader("Cache-Control", "max-age=0, s-maxage=3600, stale-while-revalidate=3600");
      return res.status(200).json(onbellek);
    }
  } catch {}

  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });

  try {
    await siraliBekle();
    const r = await fetch(`https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}`, {
      headers: { "X-API-Key": API_KEY, "Accept": "application/json" },
    });
    if (!r.ok) return res.status(r.status).json({ success: false, error: `Fonoloji ${r.status}` });
    const d = await r.json().catch(() => null);
    const ham = d?.fund ?? d;
    if (!ham || !ham.code) return res.status(404).json({ success: false, error: "Fon bulunamadı" });

    const paket = { success: true, kod: ham.code, ad: ham.name || "", kategori: ham.category || ham.fund_type || "" };
    try { await kv.set(cacheAnahtar, paket, { ex: FON_ADKATEGORI_CACHE_TTL_SANIYE }); } catch {}

    res.setHeader("Cache-Control", "max-age=0, s-maxage=3600, stale-while-revalidate=3600");
    return res.status(200).json(paket);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ success: false, error: String(e.message || e) });
  }
}

async function fonDetayGetir(req, res) {
  const kod = String(req.query?.kod || "").toUpperCase().trim();
  if (!kod) return res.status(400).json({ success: false, error: "kod parametresi gerekli" });

  const cacheAnahtar = `fon:detay:${kod}`;
  try {
    const onbellek = await kv.get(cacheAnahtar).catch(() => null);
    if (onbellek) {
      res.setHeader("Cache-Control", "max-age=0, s-maxage=3600, stale-while-revalidate=3600");
      return res.status(200).json(onbellek);
    }
  } catch {}

  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });

  try {
    await siraliBekle();
    const r = await fetch(`https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}`, {
      headers: { "X-API-Key": API_KEY, "Accept": "application/json" },
    });
    if (!r.ok) return res.status(r.status).json({ success: false, error: `Fonoloji ${r.status}` });
    const d = await r.json().catch(() => null);
    const ham = d?.fund ?? d;
    if (!ham || !ham.code) return res.status(404).json({ success: false, error: "Fon bulunamadı" });

    const takasAraligi = sonTakasGunuAralik();
    const fon = mapFon(ham, VAKIF_KODLARI.includes(ham.code), takasAraligi);

    // ── GÜNLÜK FON/YATIRIMCI GİRİŞ-ÇIKIŞI (2026-09-05 eklendi) ─────────────
    // Fonoloji'nin fund detayında (return_1d gibi) günlük giriş/çıkış rakamı
    // YOK — ama /timeseries?include=nav ucu her gün için total_value (fon
    // büyüklüğü) ve investor_count (yatırımcı sayısı) veriyor (bu deseni
    // fonGecmisGetir zaten canlı doğrulamış: d.nav.points, alanlar date/
    // price/investor_count/total_value). Son iki günün farkını alarak kendi
    // snapshot mekanizmamızı kurmaya GEREK KALMADAN günlük değişimi elde
    // ediyoruz. ⚠️ Son nokta genelde total_value/investor_count null gelir
    // (bugün henüz TEFAS'a işlenmemiş) — bu yüzden SADECE ikisi de dolu olan
    // ardışık son iki noktaya bakılıyor.
    let gunlukFonAkisiTL = null, gunlukYatirimciDegisimi = null, gunlukAkisTarihi = null;
    try {
      await siraliBekle();
      const rNav = await fetch(
        `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}/timeseries?include=nav&period=1m`,
        { headers: { "X-API-Key": API_KEY, "Accept": "application/json" } }
      );
      if (rNav.ok) {
        const dNav = await rNav.json().catch(() => null);
        const hamNoktalar = dNav?.nav?.points ?? dNav?.timeseries?.nav?.points
                         ?? (Array.isArray(dNav?.nav) ? dNav.nav : null) ?? dNav?.points ?? [];
        const doluNoktalar = (Array.isArray(hamNoktalar) ? hamNoktalar : [])
          .filter((p) => typeof p?.total_value === "number" && typeof p?.investor_count === "number");
        if (doluNoktalar.length >= 2) {
          const son = doluNoktalar[doluNoktalar.length - 1];
          const onceki = doluNoktalar[doluNoktalar.length - 2];
          gunlukFonAkisiTL = son.total_value - onceki.total_value;
          gunlukYatirimciDegisimi = son.investor_count - onceki.investor_count;
          gunlukAkisTarihi = son.date ?? null;
        }
      }
    } catch {}

    const paket = { success: true, ...fon, gunlukFonAkisiTL, gunlukYatirimciDegisimi, gunlukAkisTarihi };
    try { await kv.set(cacheAnahtar, paket, { ex: FON_DETAY_CACHE_TTL_SANIYE }); } catch {}

    // ⚠️ 2026-08-06 DÜZELTİLDİ: Burada "noktalar.length" kontrolü vardı ama bu
    // fonksiyonda öyle bir değişken YOK — koruma yanlışlıkla fonGecmisGetir
    // yerine buraya yazılmıştı. Sonuç: /api/tefas-proxy?detay=1 çağrısı
    // 3 Ağustos'tan beri her seferinde 500 dönüyordu
    // ("noktalar is not defined"). Derleme hatası vermiyor; yalnız çalışma
    // anında patlıyor ve sadece bu dal tetiklendiğinde görünüyor.
    // Bu uçta karşılığı: fon nesnesi gerçekten doldu mu?
    res.setHeader("Cache-Control", fon?.kod
      ? "max-age=0, s-maxage=3600, stale-while-revalidate=3600"
      : "no-store");
    return res.status(200).json(paket);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");   // hata da takılmasın
    return res.status(500).json({ success: false, error: String(e.message || e) });
  }
}

async function fonGecmisGetir(req, res) {
  const kod = String(req.query?.kod || "").toUpperCase().trim();
  const donemGiris = String(req.query?.donem || "1a");
  const fonolojiPeriod = FON_GECMIS_DONEM_MAP[donemGiris] || "1m";

  if (!kod) return res.status(400).json({ success: false, error: "kod parametresi gerekli" });

  const cacheAnahtar = `fon:gecmis:${kod}:${fonolojiPeriod}`;
  try {
    const onbellek = await kv.get(cacheAnahtar).catch(() => null);
    // ⚠️ BOŞ SONUÇ ÖNBELLEKLENMEZ (2026-08-03): /timeseries geçişinde alan
    // adı tutmayınca boş "noktalar" 10 dakika saklanıyor ve düzeltmenin
    // etkisi görünmüyordu. Boş kayıt varsa yok sayılıp yeniden çekiliyor.
    const bosKayit = !onbellek?.noktalar?.length;
    if (onbellek && !bosKayit) {
      res.setHeader("Cache-Control", "max-age=0, s-maxage=300, stale-while-revalidate=300");
      return res.status(200).json(onbellek);
    }
  } catch {}

  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });

  try {
    // fonFetch.js'deki cron taramasıyla AYNI paylaşılan sıraya girer — toplam
    // istek hızı Fonoloji'nin dakikalık sınırının altında kalır.
    await siraliBekle();
    // ── /history → /timeseries GEÇİŞİ (2026-08-03) ───────────────────────
    // Fonoloji eski tekil fon uçlarını 15 Ağustos 2026, 05:00 (TSİ) itibarıyla
    // kaldırıyor; /history de listede. Sonrasında 410 dönecek ve fon detay
    // grafiği (Getiri İzleme + Portföyüm) çalışmayı bırakırdı.
    //
    // Yeni uç ?include= ile blok seçtiriyor; NAV serisi için include=nav
    // yeterli. Kota açısından fark yok: her ikisi de TEK FON kaydı = 1 kota,
    // kaç NAV noktası döndüğü maliyeti değiştirmiyor.
    //
    // Yanıt biçimi değişebileceği için hem yeni (timeseries.nav) hem eski
    // (points) şekli okunuyor — geçiş sırasında ikisi de gelirse kırılmasın.
    const r = await fetch(
      `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}/timeseries?include=nav&period=${fonolojiPeriod}`,
      { headers: { "X-API-Key": API_KEY, "Accept": "application/json" } }
    );
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: `Fonoloji ${r.status}` });
    }
    const d = await r.json().catch(() => null);

    // ── NAV SERİSİNİN YERİ (2026-08-03'te ölçüldü) ───────────────────────
    // /timeseries yanıtı BİR KATMAN DAHA DERİN — ilk geçiş denemesinde bunu
    // ıskaladık ve grafik sessizce boş çizildi:
    //   { code, blocks:["nav"], nav:{ code, period, points:[…] }, realReturnPct }
    // Yani seri d.nav DEĞİL, d.nav.points. Nokta alanları eskisiyle aynı
    // (date / price / investor_count / total_value), dolayısıyla eşleme
    // değişmiyor; yalnızca bir seviye iniliyor.
    // Yedek yollar: API biçimi ileride düzleşirse veya /history'ye dönülürse
    // kırılmasın diye eski şekiller de deneniyor.
    const hamNoktalar = d?.nav?.points ?? d?.timeseries?.nav?.points
                     ?? (Array.isArray(d?.nav) ? d.nav : null) ?? d?.points ?? [];
    const noktalar = (Array.isArray(hamNoktalar) ? hamNoktalar : [])
      .filter((p) => typeof (p?.price ?? p?.value) === "number")
      .map((p) => ({ tarih: p.date ?? p.tarih, fiyat: p.price ?? p.value }));
    const guncelFiyat = noktalar.length ? noktalar[noktalar.length - 1].fiyat : null;
    const oncekiKapanis = noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null;

    const paket = { success: true, kod, donem: donemGiris, noktalar, guncelFiyat, oncekiKapanis };
    // Boş sonuç YAZILMAZ — geçici bir arıza 10 dakika kalıcı hale gelmesin.
    if (noktalar.length) {
      try { await kv.set(cacheAnahtar, paket, { ex: FON_GECMIS_CACHE_TTL_SANIYE }); } catch {}
    }

    // ⚠️ BOŞ SERİ CDN'DE ÖNBELLEKLENMEZ. /timeseries eşlemesi yanlışken boş
    // "noktalar" hem Redis'te hem Vercel kenar önbelleğinde takılı kalmış,
    // düzeltmenin etkisi görünmediği için hata kodda sanılmıştı.
    res.setHeader("Cache-Control", noktalar.length
      ? "max-age=0, s-maxage=300, stale-while-revalidate=300"
      : "no-store");
    return res.status(200).json(paket);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ success: false, error: String(e.message || e) });
  }
}

// Yeni parçanın fonlarını mevcut kayıtla birleştirir: aynı `kod`a sahip fon
// varsa taze veriyle DEĞİŞTİRİLİR, yoksa eklenir. Diğer parçalardan gelen
// (bu çağrıda dokunulmayan) fonlar olduğu gibi korunur.
function birlestir(eskiData, yeniData) {
  const map = new Map();
  for (const f of (eskiData || [])) map.set(f.kod, f);
  for (const f of yeniData) map.set(f.kod, f);
  return [...map.values()];
}

// ⚠️ DÜZELTİLDİ (2026-08-18) — bkz. dosya başındaki "DÜZELTME" notu.
// ESKİ (parçalı cron mimarisi, Temmuz 2026): her parça sadece KENDİ
// kategorilerini taradığı için, eski teşhisin üzerine sadece o parçanın
// kategorileri YAZILIYORDU — spread ile birleştirme doğruydu:
//   return { ...(eskiTeshis || {}), ...(yeniTeshis || {}) };
// YENİ (tek istek mimarisi, 3 Ağustos 2026'dan beri): fonVerisiCek() ARTIK
// PARÇALI ÇALIŞMIYOR — her çağrıda TÜM katılım fonlarını (434 kayıt) TEK
// seferde çekip TEK bir "Katılım Taraması" anahtarı üretiyor. Parça kavramı
// yok, dolayısıyla "diğer parçaların teşhisini koru" mantığına da gerek yok.
// Spread ile birleştirmeye DEVAM ETMEK, artık üretilmeyen eski anahtarları
// ("Tam Tarama", "Fon Sepeti Şemsiye Fonu" vb.) KV'de SİLİNMEDEN sonsuza dek
// taşımak anlamına geliyordu — /api/tefas-proxy yanıtına bakan biri, aylar
// önce yazılmış "sayfalama kırık" teşhisini GÜNCEL sanabiliyordu.
// Artık her taramada YENİ teşhis ESKİSİNİN YERİNİ TAMAMEN ALIYOR.
function teshisBirlestir(eskiTeshis, yeniTeshis) {
  return yeniTeshis || {};
}

function kategoriDagilimHesapla(data) {
  const d = {};
  for (const f of data) {
    const k = f.kategori || "Bilinmiyor";
    d[k] = (d[k] || 0) + 1;
  }
  return d;
}

async function cronYaz(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const gelenAuth = req.headers.authorization;
  const vercelCronMu = req.headers["x-vercel-cron"] === "1";
  if (cronSecret && !vercelCronMu && gelenAuth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Yetkisiz" });
  }

  const parcaNo = req.query?.parca ? parseInt(req.query.parca, 10) : null;

  let basarili, sonuc;
  try {
    ({ basarili, sonuc } = await kilitliCalistir(
    kv,
    KILIT_ANAHTARI,
    /* ttlSaniye */ 290,
    async () => {
      const yeni = await fonVerisiCek(parcaNo);
      const eski = await kv.get(KV_ANAHTAR).catch(() => null);

      let sonucData, sonucSayim;
      if (yeni.eksikGorunuyor && eski?.data?.length) {
        // DÜZELTME (2026-07-14): eskiden yeni veri TAMAMEN atılıp eski
        // korunuyordu — sayfalama kırılınca her tarama "şüpheli" sayıldı ve
        // tekil çekimle kurtarılan fonlar (NSA vb.) dahil hiçbir yenilik
        // KV'ye giremedi (count aylarca 142'de kaldı). Birleştirme zaten
        // küçülmeye izin vermez: eski taban korunur, yeni görülenler eklenir
        // ve değerleri tazelenir. "Koruma" amacı bozulmadan kayıp bitiyor.
        sonucData = birlestir(eski.data, yeni.data);
        sonucSayim = sonucData.length;
      } else if (parcaNo) {
        sonucData = birlestir(eski?.data, yeni.data);
        sonucSayim = sonucData.length;
      } else {
        sonucData = yeni.data;
        sonucSayim = yeni.data.length;
      }

      const kaydedilecek = {
        success: true,
        count: sonucSayim,
        guncelleme: new Date().toISOString(),
        kategori_dagilim: kategoriDagilimHesapla(sonucData),
        // TEŞHİS KALICILIĞI (2026-07-13): parça teşhisi eski teşhisle
        // birleştirilerek saklanır — /api/tefas-proxy yanıtında görünür.
        // ⚠️ 2026-08-18: teshisBirlestir artık ESKİYİ KORUMUYOR, bkz. tanım.
        kategoriTeshis: teshisBirlestir(eski?.kategoriTeshis, yeni.kategoriTeshis),
        // Cron zaten gerçek veri yazdığı için "eksik" bayrağını temizliyoruz —
        // bootstrap'tan kalma eksik işareti kalıcı olmasın.
        eksik: false,
        data: sonucData,
      };
      await kv.set(KV_ANAHTAR, kaydedilecek);

      return {
        parca: parcaNo,
        buParcaninGetirdigi: yeni.count,
        toplamSayim: sonucSayim,
        eskiToplamSayim: eski?.data?.length ?? null,
        eksikGorunuyor: yeni.eksikGorunuyor,
        kategoriTeshis: yeni.kategoriTeshis,
      };
    },
    { denemeSayisi: 20, bekleMs: 1000 }
    ));
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }

  if (!basarili) {
    return res.status(409).json({
      success: false,
      error: "Başka bir yazma işlemi sürüyor (kilit alınamadı). Bu çağrı atlandı, bir sonraki cron tetiklemesinde tekrar denenecek.",
    });
  }

  return res.status(200).json({ success: true, mod: "cron-yazma", ...sonuc });
}

async function herkesOku(req, res) {
  try {
    let kayit = await kv.get(KV_ANAHTAR).catch(() => null);
    const bayatMi = !kayit || (Date.now() - new Date(kayit.guncelleme).getTime()) > BAYATLIK_SINIRI_SAAT*3600*1000;

    if (bayatMi && !kayit) {
      // SOĞUMA KONTROLÜ (bkz. dosya başındaki "BOOTSTRAP DÜZELTMESİ" notu):
      // Son 10 dakika içinde bir bootstrap denemesi zaten yapıldıysa (başarılı
      // olsun olmasın), YENİ bir tam-çekim tetiklemiyoruz. `nx:true` sayesinde
      // bu SET işlemi atomik: aynı anda gelen birden fazla istekten sadece
      // biri "true" (yani "ben denerim") sonucu alır.
      let denemeBendeMi = false;
      try {
        const sonuc = await kv.set(BOOTSTRAP_SOGUMA_ANAHTAR, "1", { nx: true, ex: BOOTSTRAP_SOGUMA_SANIYE });
        denemeBendeMi = sonuc === "OK" || sonuc === true;
      } catch {
        denemeBendeMi = false;
      }

      if (denemeBendeMi) {
        const { basarili, sonuc } = await kilitliCalistir(
          kv,
          KILIT_ANAHTARI,
          /* ttlSaniye */ 90,
          async () => {
            const taze = await fonVerisiCek();
            if (taze.count > 0) {
              const paket = {
                success: true,
                count: taze.count,
                guncelleme: taze.guncelleme,
                kategori_dagilim: taze.kategori_dagilim,
                kategoriTeshis: taze.kategoriTeshis,
                // DÜZELTME: kısmi sonuç bile olsa artık KV'ye YAZILIYOR (eski
                // davranış: sadece count>=ŞÜPHELİ_EŞİK ise yazılıyordu — düşük
                // sonuçlar hiç yazılmadığı için `kayit` sonsuza dek null kalıp
                // her istekte yeniden tam-çekim tetikleniyordu).
                eksik: taze.count < ŞÜPHELİ_EŞİK,
                data: taze.data,
              };
              await kv.set(KV_ANAHTAR, paket).catch(() => {});
              return paket;
            }
            return null;
          },
          { denemeSayisi: 1 }
        ).catch(() => ({ basarili: false, sonuc: null }));

        if (basarili) {
          if (sonuc) kayit = sonuc;
        } else {
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 400));
            try {
              const tazeKayit = await kv.get(KV_ANAHTAR).catch(() => null);
              if (tazeKayit) { kayit = tazeKayit; break; }
            } catch {}
          }
        }
      }
      // denemeBendeMi false ise (soğuma süresi içindeyiz) — hiçbir ek Fonoloji
      // isteği ATMADAN aşağıdaki "veri yok" yanıtına düşüyoruz. Cron parçaları
      // zaten günde 8 kez çalışıp KV'yi dolduracak.
    }

    if (!kayit) {
      res.setHeader("Cache-Control", "max-age=0, s-maxage=30, stale-while-revalidate=30");
      return res.status(200).json({
        success: false,
        error: "Veri henüz mevcut değil. Cron parçalarının (?cron=1&parca=1..8) en az bir kez çalıştığını kontrol edin.",
        count: 0,
        data: [],
      });
    }

    // DÜZELTME (2026-07-14): s-maxage=1800 (30 dk) KALDIRILDI. Kök sorun:
    // taze tarama KV'ye yazsa bile CDN 30-45 dk boyunca ESKİ yanıtı sunuyordu;
    // uygulama/masaüstü/iOS web farklı CDN kopyalarına düşüp birbirinden farklı
    // ve Fonoloji'den geride veriler gösteriyordu. Yanıt zaten KV'den okunuyor
    // (Fonoloji'ye istek YOK), uzun CDN önbelleğinin koruduğu bir maliyet yok.
    // 60 sn: ani trafik patlamasına karşı yeterli, tazelik kaybı ihmal edilir.
    res.setHeader("Cache-Control", "max-age=0, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      success: true,
      count: kayit.count,
      guncelleme: kayit.guncelleme,
      kaynakBayat: bayatMi,
      kaynakEksik: !!kayit.eksik,
      kategori_dagilim: kayit.kategori_dagilim,
      kategoriTeshis: kayit.kategoriTeshis || null,
      data: kayit.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, count: 0, data: [] });
  }
}

// ── TEFAS RESMİ API — KATILIM DIŞI "TÜM FONLAR" (2026-09-06 eklendi) ────────
// 6 Eylül'de tarayıcı DevTools ile TEFAS'ın kendi (2026'da yenilenmiş) resmi
// API'si canlı doğrulandı: POST tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir,
// fonTipi:"YAT" ile TÜM standart yatırım fonlarını (katılım dahil TÜM evren)
// 25'erli sayfalarla (basSira/bitSira) döndürüyor. Vercel'in sunucu IP'si
// ENGELLENMİYOR (canlı teşhis: httpDurum 200, sonucAdedi 25).
//
// KAPSAM AYRIMI (kullanıcı kararı, 2026-09-06): Katılım fonları Fonoloji'den
// gelmeye DEVAM EDİYOR (zengin ek veri: getiri dönemleri, risk skoru, holdings
// vb. — TEFAS'ın bu ucu bunları vermiyor, sadece fiyat/kişi sayısı/portföy
// büyüklüğü var). Bu yeni kaynak SADECE katılım dışı/geri kalan fonlar için
// kullanılıyor — iki kaynak ayrı KV anahtarlarında tutuluyor, birbirine
// KARIŞTIRILMIYOR. Sınıflandırma (hangi fon katılım uygun) yine SADECE
// Fonoloji'nin ?katilim=1 süzgecinden geçenlerle sınırlı; bu yeni kaynaktaki
// fonlara isim bazlı tahminle rozet TAKILMIYOR (yanlış sınıflandırma riski).
//
// TARİH ARALIĞI NEDEN GENİŞ: canlı teşhiste tek günlük aralık (bugün=bugün)
// "Index 0 out of bounds" hatası verdi — muhtemelen o gün (hafta sonu/tatil)
// için veri yoktu. Son 5 gün → bugün aralığı tarayıcıda doğrulandı, aynısı
// kullanılıyor.
const TEFAS_RESMI_URL = "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir";
const TEFAS_TUM_KV_ANAHTAR = "tefas:tum-fonlar-diger";
const TEFAS_TUM_KILIT_ANAHTARI = `lock:${TEFAS_TUM_KV_ANAHTAR}`;
const TEFAS_SAYFA_BOYUTU = 25;
// Güvenlik tavanı: gerçek evren muhtemelen ~3000-3500 fon (~120-140 sayfa).
// 200 sayfa (5000 fon) tavanı, beklenmedik bir büyüme olursa sonsuz döngüye
// girilmesin diye.
const TEFAS_MAX_SAYFA = 200;
// İstekler arası bilinçli gecikme — 6 Eylül'deki canlı testte TEFAS 6.
// sayfadan sonra 429 (çok istek) döndürdü; demek ki resmi bir hız sınırı VAR.
// 400ms yetersiz çıktı, 1500ms'e çıkarıldı.
const TEFAS_ISTEK_ARASI_MS = 1500;
// 429 geldiğinde art arda deneme sayısı ve aralarındaki artan bekleme —
// TEFAS'ın sınırı muhtemelen kısa bir pencerede sıfırlanıyor, birkaç saniye
// beklemek genelde yeterli oluyor.
const TEFAS_429_DENEME = 4;
const TEFAS_429_BASLANGIC_BEKLEME_MS = 4000;
const TEFAS_TUM_BAYATLIK_SINIRI_SAAT = 20;
// Devam imleci — bir çalıştırma 429/süre bütçesi yüzünden yarım kalırsa, bir
// SONRAKİ cron çağrısı 1. sayfadan değil KALDIĞI SAYFADAN devam eder. Aksi
// halde her çalıştırma aynı erken sayfada 429 yiyip asla ilerleyemez.
// Tam tur tamamlanınca (tamamlandiMi=true) imleç sıfırlanır — ertesi günkü
// taze tur yine baştan başlar.
const TEFAS_TUM_IMLEC_KV = "tefas:tum-fonlar-diger:imlec";

function tefasGovdeOlustur(fonTipi, basSira, bitSira, basTarih, bitTarih) {
  return {
    fonTipi, fonKodu: null, aramaMetni: null,
    basSira, bitSira, basTarih, bitTarih,
    dil: "TR", fonGrubu: null, fonTurAciklama: null,
    fonTurKod: null, kurucuKod: null, sfonTurKod: null,
  };
}

function tefasFonNormallestir(f) {
  return {
    kod: f.fonKodu || "",
    ad: f.fonUnvan || "",
    tarih: f.tarih || null,
    fiyat: (typeof f.fiyat === "number") ? f.fiyat : null,
    borsaBultenFiyat: (typeof f.borsaBultenFiyat === "number") ? f.borsaBultenFiyat : null,
    tedavuldekiPaySayisi: (typeof f.tedPaySayisi === "number") ? f.tedPaySayisi : null,
    kisiSayisi: (typeof f.kisiSayisi === "number") ? f.kisiSayisi : null,
    portfoyBuyuklukTL: (typeof f.portfoyBuyukluk === "number") ? f.portfoyBuyukluk : null,
    kaynak: "tefas-resmi",
  };
}

// TEFAS'ın resmi API'sinden fonTipi="YAT" ile TÜM sayfaları sırayla çeker.
// Fonoloji'nin katılım listesiyle KARŞILAŞTIRMA/BİRLEŞTİRME yapmaz — sadece
// ham TEFAS listesini döner, çağıran taraf (cron) KV'ye yazar.
// `baslangicSayfa`: 0-indexli, devam imlecinden okunur — 0 ise baştan başlar.
async function tefasTumFonlariCek(baslangicSayfa = 0) {
  const bugun = new Date();
  const besGunOnce = new Date(bugun); besGunOnce.setDate(bugun.getDate() - 5);
  const yyyymmdd = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const basTarih = yyyymmdd(besGunOnce);
  const bitTarih = yyyymmdd(bugun);

  const taramaBaslangicMs = Date.now();
  const SURE_BUTCESI_MS = 230000; // maxDuration 280sn; güvenli pay bırakılıyor

  const tumFonlar = [];
  const gorulenKodlar = new Set();
  let sayfa = baslangicSayfa;
  let hata = null;
  let tamamlandiMi = false;

  for (sayfa = baslangicSayfa; sayfa < TEFAS_MAX_SAYFA; sayfa++) {
    if (Date.now() - taramaBaslangicMs > SURE_BUTCESI_MS) {
      hata = "Süre bütçesi doldu — kısmi sonuçla durduruldu";
      break;
    }
    const basSira = sayfa * TEFAS_SAYFA_BOYUTU + 1;
    const bitSira = basSira + TEFAS_SAYFA_BOYUTU - 1;
    const govde = tefasGovdeOlustur("YAT", basSira, bitSira, basTarih, bitTarih);

    // ── 429 İÇİN GERİ-BASMALI YENİDEN DENEME ────────────────────────────────
    // 6 Eylül canlı testinde 6. sayfadan sonra TEFAS 429 döndürdü. Tek seferde
    // vazgeçmek yerine artan bekleme ile birkaç kez deneniyor; hepsi başarısız
    // olursa bu sayfada durup imleç BU SAYFADA bırakılıyor (bir sonraki cron
    // çağrısı buradan devam eder).
    let govdeYaniti = null;
    let sayfaHatasi = null;
    for (let deneme = 0; deneme < TEFAS_429_DENEME; deneme++) {
      if (deneme > 0) {
        const bekleme = TEFAS_429_BASLANGIC_BEKLEME_MS * Math.pow(2, deneme - 1);
        await new Promise((r) => setTimeout(r, bekleme));
      }
      try {
        const controller = new AbortController();
        const zamanlayici = setTimeout(() => controller.abort(), 15000);
        const r = await fetch(TEFAS_RESMI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Referer": "https://www.tefas.gov.tr/",
            "Origin": "https://www.tefas.gov.tr",
          },
          body: JSON.stringify(govde),
          signal: controller.signal,
        }).finally(() => clearTimeout(zamanlayici));
        if (r.status === 429) {
          sayfaHatasi = `HTTP 429 (sayfa ${sayfa + 1}, deneme ${deneme + 1}/${TEFAS_429_DENEME})`;
          continue; // bir sonraki denemeye geç
        }
        if (!r.ok) { sayfaHatasi = `HTTP ${r.status} (sayfa ${sayfa + 1})`; govdeYaniti = null; break; }
        govdeYaniti = await r.json().catch(() => null);
        sayfaHatasi = null;
        break; // başarılı
      } catch (e) {
        sayfaHatasi = `${e.name === "AbortError" ? "Zaman aşımı" : String(e.message || e)} (sayfa ${sayfa + 1})`;
      }
    }

    if (!govdeYaniti) { hata = sayfaHatasi || `Bilinmeyen hata (sayfa ${sayfa + 1})`; break; }
    if (govdeYaniti?.errorMessage) { hata = `TEFAS: ${govdeYaniti.errorMessage} (sayfa ${sayfa + 1})`; break; }

    const liste = Array.isArray(govdeYaniti?.resultList) ? govdeYaniti.resultList : [];
    for (const f of liste) {
      const kod = f?.fonKodu;
      if (!kod || gorulenKodlar.has(kod)) continue;
      gorulenKodlar.add(kod);
      tumFonlar.push(tefasFonNormallestir(f));
    }

    if (liste.length < TEFAS_SAYFA_BOYUTU) { tamamlandiMi = true; sayfa++; break; } // son sayfa
    await new Promise((r) => setTimeout(r, TEFAS_ISTEK_ARASI_MS));
  }

  // Devam imleci: tam tur bittiyse sıfırla, yarım kaldıysa kaldığı sayfayı kaydet.
  const sonrakiSayfa = tamamlandiMi ? 0 : sayfa;

  return {
    data: tumFonlar,
    sayfaSayisi: sayfa - baslangicSayfa,
    baslangicSayfa,
    sonrakiSayfa,
    tamamlandiMi,
    hata,
  };
}

async function tefasTumCronYaz(req, res) {
  // Ayrı, özel bir gizli anahtar — mevcut CRON_SECRET/FON_TAHMIN_CRON_SECRET'e
  // dokunulmuyor (aynı desende: bkz. fonTahminSnapshotCalistir'deki gerekçe).
  const cronSecret = process.env.TEFAS_TUM_CRON_SECRET;
  const gelenAuth = req.headers.authorization;
  const vercelCronMu = req.headers["x-vercel-cron"] === "1";
  if (cronSecret && !vercelCronMu && gelenAuth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Yetkisiz" });
  }

  let basarili, sonuc;
  try {
    ({ basarili, sonuc } = await kilitliCalistir(
      kv,
      TEFAS_TUM_KILIT_ANAHTARI,
      /* ttlSaniye */ 270,
      async () => {
        const baslangicSayfa = (await kv.get(TEFAS_TUM_IMLEC_KV).catch(() => null)) || 0;
        const taze = await tefasTumFonlariCek(baslangicSayfa);
        const eski = await kv.get(TEFAS_TUM_KV_ANAHTAR).catch(() => null);

        // Kısmi/başarısız tarama eski veriyi SİLMEZ — fonFetch.js'deki aynı
        // "eksik veri koruması" prensibi burada da uygulanıyor. İmleçten
        // devam eden bir tarama zaten SADECE yeni sayfaları getirir, bu
        // yüzden her zaman eskiyle BİRLEŞTİRİLİR (tam bir baştan-sona tur
        // tamamlanana kadar sonucun tamamı asla tek seferde gelmez).
        let sonucData;
        if (taze.data.length === 0 && eski?.data?.length) {
          sonucData = eski.data;
        } else if (baslangicSayfa > 0 && eski?.data?.length) {
          sonucData = birlestir(eski.data, taze.data);
        } else if (!taze.tamamlandiMi && eski?.data?.length) {
          sonucData = birlestir(eski.data, taze.data);
        } else {
          sonucData = taze.data;
        }

        const kaydedilecek = {
          success: true,
          count: sonucData.length,
          guncelleme: new Date().toISOString(),
          tamamlandiMi: taze.tamamlandiMi,
          sonHata: taze.hata,
          data: sonucData,
        };
        await kv.set(TEFAS_TUM_KV_ANAHTAR, kaydedilecek);
        // İmleci güncelle: tam tur bittiyse 0'a sıfırla, yarım kaldıysa
        // kaldığı sayfayı kaydet (bir sonraki cron çağrısı oradan devam eder).
        await kv.set(TEFAS_TUM_IMLEC_KV, taze.sonrakiSayfa).catch(() => {});
        return {
          baslangicSayfa,
          buCekimSayfaSayisi: taze.sayfaSayisi,
          buCekimFonSayisi: taze.data.length,
          sonrakiCagriBaslangicSayfa: taze.sonrakiSayfa,
          toplamSayim: sonucData.length,
          tamamlandiMi: taze.tamamlandiMi,
          hata: taze.hata,
        };
      },
      { denemeSayisi: 1 }
    ));
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }

  if (!basarili) {
    return res.status(409).json({ success: false, error: "Başka bir tarama sürüyor, bu çağrı atlandı." });
  }
  return res.status(200).json({ success: true, mod: "tefas-tum-cron", ...sonuc });
}

async function tefasTumOku(req, res) {
  try {
    const kayit = await kv.get(TEFAS_TUM_KV_ANAHTAR).catch(() => null);
    if (!kayit) {
      res.setHeader("Cache-Control", "max-age=0, s-maxage=30, stale-while-revalidate=30");
      return res.status(200).json({
        success: false,
        error: "Veri henüz mevcut değil. ?tefasTumCron=1 en az bir kez çalıştırılmalı.",
        count: 0, data: [],
      });
    }
    const bayatMi = (Date.now() - new Date(kayit.guncelleme).getTime()) > TEFAS_TUM_BAYATLIK_SINIRI_SAAT * 3600 * 1000;
    res.setHeader("Cache-Control", "max-age=0, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      success: true,
      count: kayit.count,
      guncelleme: kayit.guncelleme,
      kaynakBayat: bayatMi,
      tamamlandiMi: kayit.tamamlandiMi,
      sonHata: kayit.sonHata || null,
      data: kayit.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, count: 0, data: [] });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ── TEFAS TEŞHİS (2026-09-06, GÜNCELLENDİ) ───────────────────────────────
  // 5 Eylül'deki ilk deneme YANLIŞ parametre adları kullanıyordu (fontip,
  // bastarih küçük harf, tarih formatı DD.MM.YYYY) — hiçbiri site tarafından
  // tanınmadığı için hepsi başarısız olmuştu. 6 Eylül'de tarayıcı DevTools
  // Network sekmesinden GERÇEK istek yakalandı:
  //   POST https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir
  //   Body: { fonTipi, fonKodu, aramaMetni, basSira, bitSira, basTarih,
  //           bitTarih (YYYYMMDD!), dil, fonGrubu, fonTurAciklama,
  //           fonTurKod, kurucuKod, sfonTurKod }
  // Tarayıcıdan 200 OK + gerçek fon listesi döndü (fonKodu/fonUnvan/tarih/
  // fiyat/tedPaySayisi/kisiSayisi/portfoyBuyukluk/borsaBultenFiyat/rn).
  // BİLİNMEYEN: Bu, tarayıcı isteğiydi — Vercel'in sunucu IP'sinden AYNI
  // isteğin geçip geçmeyeceği (WAF/bot koruması) HENÜZ DOĞRULANMADI. Bu blok
  // tam olarak yakalanan isteği taklit edip sonucu görmek için var.
  // fonTipi "BYF" (Borsa Yatırım Fonu) tarayıcıda denenmişti — "YAT" (adi
  // yatırım fonu, asıl büyük evren) ile de deneniyor; ikisi de dönerse hangi
  // fonTipi değerlerinin var olduğu daha net anlaşılır.
  if (req.query?.teshis === "tefas") {
    const denemeler = [];
    const bugun = new Date();
    const bes_gun_once = new Date(bugun); bes_gun_once.setDate(bugun.getDate() - 5);
    const yyyymmdd = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    // DÜZELTME (ilk deneme sonucu): tek günlük aralık (bugün=bugün) TEFAS
    // tarafında "Index 0 out of bounds" hatası verdi — muhtemelen o tek gün
    // (Pazar, borsa kapalı) için veri yok. Tarayıcıda doğrulanan istek geniş
    // bir aralık kullanıyordu (basTarih 1 Eylül → bitTarih 6 Eylül), aynısı
    // burada da uygulanıyor.
    const govdeOlustur = (fonTipi) => ({
      fonTipi,
      fonKodu: null,
      aramaMetni: null,
      basSira: 1,
      bitSira: 25,
      basTarih: yyyymmdd(bes_gun_once),
      bitTarih: yyyymmdd(bugun),
      dil: "TR",
      fonGrubu: null,
      fonTurAciklama: null,
      fonTurKod: null,
      kurucuKod: null,
      sfonTurKod: null,
    });
    const denenecekler = [
      { ad: "fonTipi=YAT (adi yatırım fonu — asıl hedef)", govde: govdeOlustur("YAT") },
      { ad: "fonTipi=BYF (tarayıcıda doğrulanan)", govde: govdeOlustur("BYF") },
    ];
    for (const d of denenecekler) {
      try {
        const controller = new AbortController();
        const zamanlayici = setTimeout(() => controller.abort(), 15000);
        const r = await fetch("https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Referer": "https://www.tefas.gov.tr/",
            "Origin": "https://www.tefas.gov.tr",
          },
          body: JSON.stringify(d.govde),
          signal: controller.signal,
        }).finally(() => clearTimeout(zamanlayici));
        const metin = await r.text();
        let sonucAdedi = null;
        try { sonucAdedi = JSON.parse(metin)?.resultList?.length ?? null; } catch {}
        denemeler.push({
          ad: d.ad, gonderilenGovde: d.govde, httpDurum: r.status, contentType: r.headers.get("content-type"),
          sonucAdedi, ilk1000Karakter: metin.slice(0, 1000), uzunluk: metin.length,
        });
      } catch (e) {
        denemeler.push({ ad: d.ad, hata: String(e?.message || e) });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ teshis: "tefas", denemeler });
  }

  if (req.query?.gecmis === "1") return fonGecmisGetir(req, res);
  if (req.query?.detay === "1") return fonDetayGetir(req, res);
  if (req.query?.adKategori === "1") return fonAdKategoriGetir(req, res);
  if (req.query?.holdings === "1") return fonHoldingsGetir(req, res);
  if (req.query?.tahminGecmis === "1") return tahminGecmisGetir(req, res);
  if (req.query?.fonTahminListesi === "1") return fonTahminListesiGetir(req, res);
  if (req.query?.fonTahminEkle === "1") return fonTahminEkle(req, res);
  // Ayrı sorgu parametresiyle tetiklenir (cron-job.org'dan Bearer token ile) —
  // genel ?cron=1 dalıyla ÇAKIŞMAZ, kendi auth kontrolünü kendi yapar.
  if (req.query?.fonTahminSnapshot === "1") return fonTahminSnapshotCalistir(req, res);
  // TEFAS resmi API'sinden katılım dışı "tüm fonlar" — ayrı kaynak, ayrı KV
  // anahtarı, ayrı cron secret. Katılım fonlarının cron akışıyla (aşağıdaki
  // genel ?cron=1 dalı) hiç kesişmiyor.
  if (req.query?.tefasTumCron === "1") return tefasTumCronYaz(req, res);
  if (req.query?.tumFonlar === "1") return tefasTumOku(req, res);

  const cronIstegi = req.headers["x-vercel-cron"] === "1" || req.query?.cron === "1";
  if (cronIstegi) return cronYaz(req, res);
  return herkesOku(req, res);
}
