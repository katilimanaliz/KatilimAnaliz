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
  };
}

const VAKIF_KODLARI = ["VPA","VLT","VHS","VKK","VKV"];
// Aranan fonların ham verisi filtre kararından ÖNCE rapora düşürülür — API'nin
// gerçek name/category/is_participation alanları /api/tefas-proxy yanıtındaki
// aranilanKayipFonlar altında görülür (14 Tem 13:51'de DNP/EP1/FTL YAKALANDI:
// is_participation:null ama isimde "KATILIM" var → filtre onları geçiriyor).
const ARANAN_TESHIS_KODLARI = ["NSA", "FTL", "MPE", "DNP", "EP1", "KLU", "PPG"];
const PAGE_SIZE = 100;
const BUYUK_SAYFA_LIMITI = 2000; // FAZ 1'in ilk denemesi — API izin verirse evren 2 istekte biter
const ŞÜPHELİ_EŞİK = 100; // normal günde 150+ katılım fonu beklenir
const MAKS_SAYFA = 60;    // emniyet: 6.000 fon üstü beklenmiyor (bugün ~3.450)
const EK_CEKIM_LIMITI = 150; // gerçek sınır süre bütçesi — bu sadece tavan
const BILINEN_KODLAR_KV = "katilim:bilinen-kodlar";     // JSON dizi: bilinen katılım fon kodları
const TAZELEME_IMLECI_KV = "katilim:tazeleme-imleci";   // FAZ 3'ün dönen imleci

// ESKİ MİMARİDEN KALAN: PARCALAR artık kullanılmıyor. Başka bir modül import
// ediyorsa kırılmasın diye boş dizi olarak export ediliyor.
const PARCALAR = [];

// Fonoloji'den fon verisini çeker, katılım filtresini yerelde uygular.
// `parcaNo` yok sayılır (geriye dönük uyum — cron URL'leri ?parca=N gönderiyor).
async function fonVerisiCek(parcaNo = null) {
  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) throw new Error("FONOLOJI_KEY tanımlı değil");
  const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };
  const takasAraligi = sonTakasGunuAralik();

  const gorulmuKodlar = new Set();
  const katilimFonlar = [];
  const hamKodSeti = new Set(); // görülen TÜM ham kodlar (filtre öncesi)
  const kayipFonlarHamVeri = {}; // ARANAN_TESHIS_KODLARI'ndan görülenlerin ham içeriği
  const kayipSayfalar = [];
  let hamToplam = 0;
  let hedefToplam = null;
  let sonHata = null;

  // SÜRE BÜTÇESİ: maxDuration 280 sn; 190. saniyede eldeki sonuçla durup HER
  // KOŞULDA KV'ye yazılır (12:17 taraması kanıtı: bütçesiz akış fonksiyonu
  // KV'ye yazamadan öldürüyordu). Artanlar sonraki taramada tamamlanır.
  const taramaBaslangicMs = Date.now();
  const SURE_BUTCESI_MS = 190000;
  const butceDoldu = () => Date.now() - taramaBaslangicMs > SURE_BUTCESI_MS;

  // Tek bir ham fon kaydını işler — tüm fazlar AYNI mantığı kullanır.
  const itemIsle = (f) => {
    const kodHam = f.code || "";
    if (kodHam) hamKodSeti.add(kodHam);
    if (ARANAN_TESHIS_KODLARI.includes(kodHam) && !kayipFonlarHamVeri[kodHam]) {
      kayipFonlarHamVeri[kodHam] = {
        name: f.name ?? null,
        category: f.category ?? f.fund_type ?? null,
        is_participation: f.is_participation ?? null,
        participation: f.participation ?? null,
        trading_status: f.trading_status ?? null,
      };
    }
    if (f.trading_status && f.trading_status !== "AKTİF") return;
    if (!kodHam || gorulmuKodlar.has(kodHam)) return;
    const mapped = mapFon(f, VAKIF_KODLARI.includes(kodHam), takasAraligi);
    if (!mapped.katilimUygun) return;
    gorulmuKodlar.add(kodHam);
    katilimFonlar.push(mapped);
  };

  // Bilinen katılım kodlarını KV'den yükle (yoksa boş — birkaç taramada dolar).
  let bilinenKodlar = [];
  try {
    const v = await hizRedis.get(BILINEN_KODLAR_KV);
    if (Array.isArray(v)) {
      bilinenKodlar = v.filter((x) => typeof x === "string");
    } else if (typeof v === "string") {
      const p = JSON.parse(v);
      if (Array.isArray(p)) bilinenKodlar = p.filter((x) => typeof x === "string");
    }
  } catch {}

  // ── FAZ 1: UYARLANIR LİSTE TARAMASI ────────────────────────────────────
  // Önce limit=2000 denenir; API kırparsa gelen gerçek sayfa boyu esas alınır.
  // Sayfalama ilerlemiyorsa: offset → page parametresine BİR kez geçilir,
  // o da ilerlemezse "kırık" ilan edilip döngü 3-4 istekte terk edilir.
  let sayfalamaModu = "offset"; // "offset" | "page" | "kirik" | "tek-sayfa"
  let pageParamDenendi = false;
  let etkinSayfaBoyu = null;    // API'nin GERÇEKTE döndürdüğü sayfa boyu
  let istekLimiti = BUYUK_SAYFA_LIMITI;
  let buyukSayfadanGeriDusuldu = false;
  let offset = 0;
  let sayfaNo = 1;
  let sayfaSayisi = 0;
  let sayfaTekrarKaldi = 3; // tarama genelinde toplam 3 ek deneme hakkı

  while (sayfaSayisi < MAKS_SAYFA) {
    if (butceDoldu()) { sonHata = "süre bütçesi doldu (liste taraması)"; break; }
    const url = sayfalamaModu === "page"
      ? `https://fonoloji.com/v1/funds?limit=${istekLimiti}&page=${sayfaNo}`
      : `https://fonoloji.com/v1/funds?limit=${istekLimiti}&offset=${offset}`;
    const buyukIstek = istekLimiti > PAGE_SIZE;
    // Büyük sayfa yanıtı MB mertebesinde olabilir → daha geniş zaman aşımı.
    const { res, hata } = await fetchTeshisli(url, { headers }, 2, buyukIstek ? 20000 : 8000);
    if (!res) {
      if (buyukIstek && !buyukSayfadanGeriDusuldu && sayfaSayisi === 0) {
        // limit=2000 reddedildi (400) ya da zaman aşımı → klasik 100'e düş.
        buyukSayfadanGeriDusuldu = true;
        istekLimiti = PAGE_SIZE;
        continue;
      }
      if (sayfaTekrarKaldi > 0) {
        sayfaTekrarKaldi--;
        await new Promise(r => setTimeout(r, 5000));
        continue; // aynı sayfayı tekrar dene
      }
      kayipSayfalar.push(sayfalamaModu === "page" ? `page:${sayfaNo}` : offset);
      sonHata = hata;
      break; // liste güvenilmez → tekil fazlar devralsın
    }
    const d = await res.json().catch(() => null);
    if (!d) {
      kayipSayfalar.push(sayfalamaModu === "page" ? `page:${sayfaNo}` : offset);
      sonHata = "JSON parse hatası";
      break;
    }
    if (hedefToplam === null) {
      const t = d.total ?? d.count ?? d.meta?.total;
      if (typeof t === "number" && t > 0) hedefToplam = t;
    }
    const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
    if (!items.length) break;
    if (etkinSayfaBoyu === null) etkinSayfaBoyu = items.length;
    hamToplam += items.length;
    const oncekiBenzersiz = hamKodSeti.size;
    for (const f of items) itemIsle(f);
    const yeniBenzersiz = hamKodSeti.size - oncekiBenzersiz;
    sayfaSayisi++;

    // Evren kapandıysa bitir.
    if (hedefToplam !== null && hamKodSeti.size >= hedefToplam) {
      if (sayfaSayisi === 1) sayfalamaModu = "tek-sayfa";
      break;
    }
    if (items.length < etkinSayfaBoyu) break; // gerçek son sayfa

    // KIRIK SAYFALAMA DEDEKTÖRÜ: 2. istekten itibaren benzersiz kod sayısı
    // büyümüyorsa (14 Tem kanıtı: 39 sayfada 134 benzersiz) ısrar etme.
    const buyumeEsigi = Math.max(10, Math.floor(etkinSayfaBoyu * 0.1));
    if (sayfaSayisi >= 2 && yeniBenzersiz < buyumeEsigi) {
      if (sayfalamaModu === "offset" && !pageParamDenendi) {
        // offset yok sayılıyor — bir kez de `page` parametresini dene.
        pageParamDenendi = true;
        sayfalamaModu = "page";
        sayfaNo = Math.max(2, Math.floor(hamKodSeti.size / etkinSayfaBoyu) + 1);
        continue;
      }
      sayfalamaModu = "kirik";
      sonHata = "sayfalama ilerlemiyor (offset ve page denendi) — tekil çekim devrede";
      break;
    }

    if (sayfalamaModu === "page") sayfaNo++;
    else offset += Math.max(1, etkinSayfaBoyu - 10); // %10 bindirme — kayma emici
  }

  // Liste taraması evreni kapsadı mı? (hedefToplam bilinmiyorsa kaba eşik)
  const taramaKapsayici = hedefToplam !== null
    ? hamKodSeti.size >= Math.floor(hedefToplam * 0.95)
    : hamKodSeti.size > 1000;

  // ── FAZ 2: TAM KOD LİSTESİ (/funds/codes — saatte 5 sınırlı, seferde 1) ──
  let kodListesiToplam = null;
  let tumKodlar = [];
  try {
    const { res: kodRes } = await fetchTeshisli("https://fonoloji.com/v1/funds/codes", { headers }, 1);
    if (kodRes) {
      const kd = await kodRes.json().catch(() => null);
      const hamListe = kd?.codes ?? kd?.items ?? kd?.data ?? (Array.isArray(kd) ? kd : []);
      tumKodlar = hamListe.map((x) => (typeof x === "string" ? x : x?.code)).filter(Boolean);
      if (tumKodlar.length > 0) kodListesiToplam = tumKodlar.length;
    }
  } catch {} // codes ucu sınıra takılırsa sessizce geç — tarama yine geçerli

  // ── FAZ 2.5: 5 VAKIF FONU GARANTİLİ ÇEKİM (2026-07-14, üçüncü tur) ──────
  // KÖK NEDEN (canlıda yakalandı): VLT arama ekranından tamamen kayboldu.
  // Eski mimaride (13 Temmuz öncesi) bu 5 fon HER taramada doğrudan ayrı
  // istekle çekiliyordu ("5 Vakıf + 21 kategori"); tam-tarama mimarisine
  // geçilirken bu garanti sessizce düştü — artık varlıkları tamamen liste
  // taramasının şansına (hangi sayfaya denk geldiklerine) kalmıştı. Kırık
  // sayfalamada bu şans sık sık ters gidiyor. Marka görünürlüğü en yüksek
  // 5 fon oldukları için (pazarlama materyallerinde birebir öne çıkıyorlar)
  // maliyeti göz ardı edilebilir 5 istek karşılığında SIFIR kayıp riski
  // sağlanıyor — bu sefer taramada zaten görülmüşlerse tekrar çekilmez.
  //
  // DÜZELTME (2026-07-14 akşam, fiyat eklenince ortaya çıktı): "zaten
  // görüldüyse atla" kontrolü hamKodSeti'ye bakıyordu — ama FAZ 1'in toplu
  // liste taraması bir fonu YAKALAYIP `fiyat:null` ile kaydedebiliyor (bulk
  // /funds yanıtında current_price her satırda garanti değil). Bu durumda
  // "zaten görüldü" sayılıp tekil (fiyatlı) çekim hiç tetiklenmiyordu — VPA
  // kalıcı olarak fiyatsız kalıyordu. Artık sadece "görüldü" değil, "fiyatlı
  // görüldü" olması aranıyor; fiyatsızsa tekil çekimle ÜZERİNE YAZILIYOR.
  for (const kod of VAKIF_KODLARI) {
    const mevcutIndex = katilimFonlar.findIndex((f) => f.kod === kod);
    if (mevcutIndex >= 0 && katilimFonlar[mevcutIndex].fiyat != null) continue; // zaten fiyatlı, taze
    if (butceDoldu()) break;
    const { res: vRes } = await fetchTeshisli(
      `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}`, { headers }, 2);
    if (!vRes) continue;
    const vd = await vRes.json().catch(() => null);
    const vFon = vd?.fund ?? vd;
    if (!vFon || !vFon.code) continue;
    if (mevcutIndex >= 0) {
      // Fiyatsız kaydın üzerine, bu sefer fiyatlı geleni yaz.
      const guncellenmis = mapFon(vFon, true, takasAraligi);
      if (guncellenmis.katilimUygun) katilimFonlar[mevcutIndex] = guncellenmis;
    } else {
      itemIsle(vFon);
    }
  }

  // ── FAZ 3: BİLİNEN KATILIM FONLARINI TAZELE (liste kapsayıcı DEĞİLSE) ───
  // Ekranın gösterdiği fonların tazeliği keşiften ÖNCE gelir: bütçenin %70'i
  // buraya. Dönen imleç sayesinde her tarama kaldığı yerden sürer.
  let imlecOnce = 0;
  let imlecSonra = 0;
  let tazelenenAdet = 0;
  if (!taramaKapsayici && bilinenKodlar.length > 0) {
    try {
      const v = await hizRedis.get(TAZELEME_IMLECI_KV);
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) imlecOnce = Math.floor(n) % bilinenKodlar.length;
    } catch {}
    imlecSonra = imlecOnce;
    const bilinenButceSonuMs = taramaBaslangicMs + Math.floor(SURE_BUTCESI_MS * 0.7);
    let ilerleme = 0;
    for (let i = 0; i < bilinenKodlar.length; i++) {
      const kod = bilinenKodlar[(imlecOnce + i) % bilinenKodlar.length];
      const mevcutIndex = katilimFonlar.findIndex((f) => f.kod === kod);
      // DÜZELTME: "hamKodSeti.has(kod)" tek başına yeterli değildi — FAZ 1
      // fiyatsız yakalamış olabilir. Fiyatlıysa gerçekten atla, değilse
      // tekil çekimle tazele (bkz. FAZ 2.5'teki aynı düzeltme notu).
      if (mevcutIndex >= 0 && katilimFonlar[mevcutIndex].fiyat != null) { ilerleme = i + 1; continue; }
      if (Date.now() > bilinenButceSonuMs || butceDoldu()) break;
      const { res: tekRes } = await fetchTeshisli(
        `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}`, { headers }, 1);
      ilerleme = i + 1;
      if (!tekRes) continue;
      const td = await tekRes.json().catch(() => null);
      const fon = td?.fund ?? td; // tekil yanıt {fund:{...}} sarmalında geliyor
      if (fon && fon.code) {
        if (mevcutIndex >= 0) {
          const guncellenmis = mapFon(fon, VAKIF_KODLARI.includes(kod), takasAraligi);
          if (guncellenmis.katilimUygun) katilimFonlar[mevcutIndex] = guncellenmis;
        } else {
          itemIsle(fon);
        }
        tazelenenAdet++;
      }
    }
    imlecSonra = bilinenKodlar.length > 0 ? (imlecOnce + ilerleme) % bilinenKodlar.length : 0;
    try { await hizRedis.set(TAZELEME_IMLECI_KV, String(imlecSonra), { ex: 60 * 60 * 24 * 7 }); } catch {}
  }

  // ── FAZ 4: KEŞİF — taramada görülmeyen kodlardan tekil tamamlama ─────────
  // Aranan teşhis kodları EN BAŞA, kalanı rastgele karışık — her tarama farklı
  // bir dilimi tamamlar, birkaç taramada tüm evren en az bir kez görülür ve
  // katılım olanlar bilinen listesine katılır.
  let kacakKodlar = [];
  let ekCekilenAdet = 0;
  if (tumKodlar.length > 0) {
    kacakKodlar = tumKodlar.filter((k) => !hamKodSeti.has(k));
    const oncelikli = kacakKodlar.filter((k) => ARANAN_TESHIS_KODLARI.includes(k));
    const kalan = kacakKodlar.filter((k) => !ARANAN_TESHIS_KODLARI.includes(k));
    for (let i = kalan.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kalan[i], kalan[j]] = [kalan[j], kalan[i]];
    }
    const cekimSirasi = oncelikli.concat(kalan);
    for (const kod of cekimSirasi.slice(0, EK_CEKIM_LIMITI)) {
      if (butceDoldu()) break; // kalanlar sonraki taramada
      const { res: tekRes } = await fetchTeshisli(
        `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}`, { headers }, 1);
      if (!tekRes) continue;
      const td = await tekRes.json().catch(() => null);
      const fon = td?.fund ?? td;
      if (fon && fon.code) { itemIsle(fon); ekCekilenAdet++; }
    }
  }

  // ── Bilinen katılım kodlarını KV'de güncelle ─────────────────────────────
  // Bu taramada katılım filtresini geçen HER kod bilinen listesine eklenir;
  // kod listesi elde varsa borsadan kalkmış (evrende olmayan) kodlar ayıklanır.
  try {
    const birlesik = new Set(bilinenKodlar);
    for (const f of katilimFonlar) if (f.kod) birlesik.add(f.kod);
    let kayit = Array.from(birlesik);
    if (tumKodlar.length > 500) {
      const evren = new Set(tumKodlar);
      kayit = kayit.filter((k) => evren.has(k));
    }
    await hizRedis.set(BILINEN_KODLAR_KV, JSON.stringify(kayit), { ex: 60 * 60 * 24 * 30 });
  } catch {}

  const kategoriSayac = {};
  for (const f of katilimFonlar) {
    const k = f.kategori || "Bilinmiyor";
    kategoriSayac[k] = (kategoriSayac[k] || 0) + 1;
  }

  // Teşhis: eski kategori-bazlı yapıyla alan uyumu korunuyor (hamAdet/agHatasi/hata)
  // ki tefas-proxy'deki teshisBirlestir değişmeden çalışsın.
  const kategoriTeshis = {
    "Tam Tarama": {
      hamAdet: hamToplam,
      agHatasi: kayipSayfalar.length > 0,
      hata: sonHata,
      sayfaSayisi,
      hedefToplam,
      kayipSayfalar,
      hamBenzersiz: hamKodSeti.size,
      mukerrer: hamToplam - hamKodSeti.size,
      sayfalamaModu,           // "offset" | "page" | "kirik" | "tek-sayfa"
      etkinSayfaBoyu,          // API'nin gerçekte döndürdüğü sayfa boyu (limit kırpması burada görülür)
      istenenLimit: istekLimiti,
      taramaKapsayici,         // liste taraması evrenin %95'ini gördü mü
      kodListesiToplam,
      kacakAdet: kacakKodlar.length,
      kacakIlkOrnekler: kacakKodlar.slice(0, 15),
      ekCekilenAdet,
      bilinenAdet: bilinenKodlar.length, // FAZ 3'ün çalıştığı bilinen kod sayısı (tarama başındaki)
      tazelenenAdet,
      tazelemeImleci: { once: imlecOnce, sonra: imlecSonra },
      // Aranan fonlar hiçbir fazda görülmediyse burada eksik kalır — bu da
      // kendi başına bir bulgu (Fonoloji'nin tam listesinde yoklar demektir).
      aranilanKayipFonlar: kayipFonlarHamVeri,
    },
  };

  // eksikGorunuyor: tefas-proxy bu bayrağı "eski veriyle BİRLEŞTİR (true) /
  // TAMAMEN DEĞİŞTİR (false)" kararı için kullanıyor (bkz. cronYaz).
  // DÜZELTME (2026-07-14, ikinci tur — canlıda VLT'nin kaybolmasıyla
  // yakalandı): önceki sürümde taramaKapsayici=false iken bile sadece
  // "hiç fon bulunamadıysa" true oluyordu — yani sayfalama kırıkken bile
  // (ki bugün HEP kırık) her kısmi tarama önceki KV verisinin TAMAMINI
  // silip yerine o seferin bulduğu az sayıda fonu yazıyordu. Keşif fazı
  // sadece ARANAN_TESHIS_KODLARI'nı öncelikli aradığı için VLT gibi
  // Vakıf fonları ilk büyük sayfaya denk gelmeyince tamamen kaybolabildi
  // (142→193 büyüme aslında bir "değiştirme" idi, "birleştirme" değil —
  // şans eseri net büyüme oldu ama VLT gibi tekil fonlar düşebildi).
  // ARTIK: liste taraması evreni kapsamadığı sürece (taramaKapsayici=false,
  // ki kırık sayfalamada HER ZAMAN böyledir) eksikGorunuyor HER DURUMDA
  // true — tefas-proxy bu yüzden HER kısmi taramada birleştirir, önceden
  // bilinen hiçbir fon bir daha sessizce kaybolamaz. Sadece liste taraması
  // gerçekten tüm evreni kapsadığında (taramaKapsayici=true, sayfalama
  // düzelirse) eski eşik bazlı mantığa dönülüp doğrudan değiştirme
  // güvenle yapılabilir.
  const eksikGorunuyor = taramaKapsayici
    ? (katilimFonlar.length < ŞÜPHELİ_EŞİK || kayipSayfalar.length > 3)
    : true;

  return {
    success: true,
    parca: parcaNo,
    count: katilimFonlar.length,
    eksikGorunuyor,
    guncelleme: new Date().toISOString(),
    kategori_dagilim: kategoriSayac,
    kategoriTeshis,
    data: katilimFonlar,
  };
}

export { fonVerisiCek, ŞÜPHELİ_EŞİK, PARCALAR, siraliBekle, mapFon, sonTakasGunuAralik, VAKIF_KODLARI };
