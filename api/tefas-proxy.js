// api/tefas-proxy.js
// TEK fonksiyon, ÜÇ rol:
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
const FON_DETAY_CACHE_TTL_SANIYE = 900; // 15 dk

async function fonDetayGetir(req, res) {
  const kod = String(req.query?.kod || "").toUpperCase().trim();
  if (!kod) return res.status(400).json({ success: false, error: "kod parametresi gerekli" });

  const cacheAnahtar = `fon:detay:${kod}`;
  try {
    const onbellek = await kv.get(cacheAnahtar).catch(() => null);
    if (onbellek) {
      res.setHeader("Cache-Control", "max-age=0, s-maxage=300, stale-while-revalidate=300");
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
    const paket = { success: true, ...fon };
    try { await kv.set(cacheAnahtar, paket, { ex: FON_DETAY_CACHE_TTL_SANIYE }); } catch {}

    res.setHeader("Cache-Control", "max-age=0, s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json(paket);
  } catch (e) {
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
    if (onbellek) {
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
    const r = await fetch(
      `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}/history?period=${fonolojiPeriod}`,
      { headers: { "X-API-Key": API_KEY, "Accept": "application/json" } }
    );
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: `Fonoloji ${r.status}` });
    }
    const d = await r.json().catch(() => null);
    const noktalar = (d?.points || [])
      .filter((p) => typeof p.price === "number")
      .map((p) => ({ tarih: p.date, fiyat: p.price }));
    const guncelFiyat = noktalar.length ? noktalar[noktalar.length - 1].fiyat : null;
    const oncekiKapanis = noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null;

    const paket = { success: true, kod, donem: donemGiris, noktalar, guncelFiyat, oncekiKapanis };
    try { await kv.set(cacheAnahtar, paket, { ex: FON_GECMIS_CACHE_TTL_SANIYE }); } catch {}

    res.setHeader("Cache-Control", "max-age=0, s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json(paket);
  } catch (e) {
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

// kategoriTeshis birleştirme: parça sadece kendi kategorilerini işlediği için
// eski teşhisin üzerine yalnızca bu parçanın kategorileri yazılır.
function teshisBirlestir(eskiTeshis, yeniTeshis) {
  return { ...(eskiTeshis || {}), ...(yeniTeshis || {}) };
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

// ── GEÇİCİ TEŞHİS UCU (2026-08-03) ──────────────────────────────────────────
//   GET /api/tefas-proxy?tani=katilim
//
// NEDEN VAR: Fonoloji 3 Ağustos'ta ?katilim=1 sunucu-taraflı süzgecini
// duyurdu (434 fon). Mimariyi buna göre yeniden yazmadan önce üç şeyi
// ölçmemiz gerekiyor:
//   1) Kaç kayıt dönüyor, _meta.capped var mı
//   2) current_price her kayıtta dolu mu (doluysa tekil çekim fazı gereksiz)
//   3) Kategori dağılımı — bizim ekranda 279, onlarda 434; fark emeklilik
//      fonlarından mı geliyor yoksa listemiz eksik mi?
//
// NEDEN BU YOLLA: API anahtarı Vercel ortam değişkeninde ve panelde maskeli;
// dışarıdan elle sorgulanamıyor. Bu uç anahtarı SUNUCUDA kullanıp yalnız
// ÖZET döndürüyor — anahtar hiçbir yere sızmıyor, ham veri seti de
// dışarı verilmiyor (yeniden dağıtım kısıtı).
//
// KOTA KORUMASI: Sonuç 1 saat KV'de tutuluyor. Uç kimlik doğrulamasız olduğu
// için, olmasaydı tekrar tekrar çağrılıp kota yakılabilirdi.
//
// ⚠️ ÖLÇÜM BİTİNCE BU BLOK SİLİNECEK.
const TANI_KV_ANAHTAR = "tefas:tani:katilim:v1";
const TANI_TTL = 3600;

async function taniKatilim(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const onbellek = await kv.get(TANI_KV_ANAHTAR).catch(() => null);
    if (onbellek && req.query?.taze !== "1") {
      return res.status(200).json({ ...onbellek, onbellekten: true });
    }

    const API_KEY = process.env.FONOLOJI_KEY;
    if (!API_KEY) return res.status(500).json({ hata: "FONOLOJI_KEY tanımlı değil" });

    const url = "https://fonoloji.com/v1/funds?katilim=1&limit=500";
    const r = await fetch(url, { headers: { "X-API-Key": API_KEY, Accept: "application/json" } });
    const govde = await r.json().catch(() => null);

    const kayitlar = govde?.items ?? govde?.funds ?? govde?.data ?? (Array.isArray(govde) ? govde : []);
    const ilk = kayitlar[0] || null;

    const kategoriDagilim = {};
    let fiyatliAdet = 0, katilimAlaniOlan = 0;
    for (const f of kayitlar) {
      const k = f?.category || f?.fund_type || "(bos)";
      kategoriDagilim[k] = (kategoriDagilim[k] || 0) + 1;
      if (typeof f?.current_price === "number") fiyatliAdet++;
      if (f && ("katilim" in f)) katilimAlaniOlan++;
    }

    const ozet = {
      istekUrl: url,
      httpDurum: r.status,
      adet: kayitlar.length,
      // Kırpılma bayrağı ve gerçek maliyet — asıl aradığımız iki değer.
      meta: govde?._meta ?? null,
      ratelimit: {
        cost: r.headers.get("x-ratelimit-cost"),
        kalanAylik: r.headers.get("x-ratelimit-remaining-monthly"),
        limitAylik: r.headers.get("x-ratelimit-limit-monthly"),
        kalanGunluk: r.headers.get("x-ratelimit-remaining-daily"),
        limitGunluk: r.headers.get("x-ratelimit-limit-daily"),
      },
      fiyatliKayit: `${fiyatliAdet}/${kayitlar.length}`,
      katilimAlaniOlan: `${katilimAlaniOlan}/${kayitlar.length}`,
      ilkKaydinAlanlari: ilk ? Object.keys(ilk).sort() : null,
      // Ham veri DEĞİL, yalnız dağılım. Yeniden dağıtım kısıtı nedeniyle
      // fon listesinin kendisi bu uçtan hiç dönmüyor.
      kategoriDagilim,
      olcumZamani: new Date().toISOString(),
    };

    try { await kv.set(TANI_KV_ANAHTAR, ozet, { ex: TANI_TTL }); } catch {}
    return res.status(200).json(ozet);
  } catch (e) {
    return res.status(500).json({ hata: e.message });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.query?.tani === "katilim") return taniKatilim(req, res);
  if (req.query?.gecmis === "1") return fonGecmisGetir(req, res);
  if (req.query?.detay === "1") return fonDetayGetir(req, res);

  const cronIstegi = req.headers["x-vercel-cron"] === "1" || req.query?.cron === "1";
  if (cronIstegi) return cronYaz(req, res);
  return herkesOku(req, res);
}
