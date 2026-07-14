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
//   0) TAM TARAMA MİMARİSİ (2026-07-13 akşam, kullanıcı önerisi): kategori
//      bazlı çekim TAMAMEN KALDIRILDI. Kök sorun: kategori adları Fonoloji
//      ile birebir tutmak zorundaydı (yanlış ad = sessizce 0 fon, ör. "Endeks
//      Şemsiye Fonu"), kalabalık kategorilerde sayfa kayıpları oluyordu ve
//      NSA/DNP gibi fonlar günlerce listeye giremedi. Artık /v1/funds TÜM
//      liste olarak taranıyor (~3.450 fon, ~35 sayfa, sefer başı ~35 istek,
//      8 sefer/gün ≈ ayda ~6.300 istek — 15.000 kotanın içinde) ve katılım
//      filtresi (isim/kategori "KATILIM" + is_participation bayrağı) BİZDE
//      uygulanıyor. Kategori ne olursa olsun hiçbir katılım fonu kaçamaz.
//      `parcaNo` parametresi geriye dönük uyum için duruyor (cron URL'leri
//      ?parca=N gönderiyor) ama artık yok sayılıyor — her çağrı tam tarama.
//      tefas-proxy'nin parça birleştirmesi (kod bazlı merge) bilerek korundu:
//      taramada sayfa kaybı olursa eski fonlar silinmez, sadece güncellenen
//      güncellenir.
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

const VAKIF_KODLARI = ["VPA","VLT","VHS","VKK","VKV"];
// TEŞHİS (2026-07-13 akşam): tam tarama artık sayfa kaybetmiyor (kanıtlandı:
// hamAdet~3500, kayipSayfalar:[]) ama count hâlâ 142'de sabit kaldı — yani
// NSA/DNP/FTL/MPE/EP1 ham taramanın İÇİNDE görülüyor ama katılım filtresi
// (mapFon.katilimUygun) onları eliyor. Bu kodları görürse HAM halini (filtre
// sonucundan bağımsız) rapora düşür — API'nin gerçek name/category/
// is_participation alanlarını görüp filtreyi buna göre düzeltebilelim.
const ARANAN_TESHIS_KODLARI = ["NSA","FTL","MPE","DNP","EP1"];
const PAGE_SIZE = 100;
const ŞÜPHELİ_EŞİK = 100; // normal günde 150+ katılım fonu beklenir
const MAKS_SAYFA = 60;    // emniyet: 6.000 fon üstü beklenmiyor (bugün ~3.450)

// ESKİ MİMARİDEN KALAN: PARCALAR artık kullanılmıyor (tam tarama). Başka bir
// modül import ediyorsa kırılmasın diye boş dizi olarak export ediliyor.
const PARCALAR = [];

// Fonoloji'den TÜM fon listesini tarar, katılım filtresini yerelde uygular.
// `parcaNo` yok sayılır (geriye dönük uyum — cron URL'leri ?parca=N gönderiyor).
async function fonVerisiCek(parcaNo = null) {
  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) throw new Error("FONOLOJI_KEY tanımlı değil");
  const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };
  const takasAraligi = sonTakasGunuAralik();

  const gorulmuKodlar = new Set();
  const katilimFonlar = [];
  let hamToplam = 0;        // taranan (aktif+pasif dahil sayfadan gelen) ham kayıt
  let hedefToplam = null;   // API total bildiriyorsa: kayıp sayfa atlarken pusula
  const kayipSayfalar = []; // tekrarlara rağmen alınamayan offset'ler
  let sonHata = null;
  let sayfaTekrarKaldi = 3; // tarama genelinde toplam 3 ek deneme hakkı
  let offset = 0;
  let sayfaSayisi = 0;
  const kayipFonlarHamVeri = {}; // ARANAN_TESHIS_KODLARI'ndan görülenlerin ham içeriği

  // MÜKERRERLİK/KAÇAK DÜZELTMESİ (2026-07-14): Kanıt — tarama hamAdet:3500
  // okurken hedefToplam:3422 idi (78+ kayıt MÜKERRER okundu, buna karşılık
  // NSA/FTL/MPE/DNP/EP1 gibi fonlar HİÇ görünmedi; aranilanKayipFonlar boş
  // döndü ama aynı fonlar Fonoloji sitesinde 3.422'lik evrenin içinde).
  // KÖK NEDEN: varsayılan liste sıralaması tarama sürerken (≈80 sn) değişiyor;
  // sayfalar kayınca bazı fonlar iki sayfada birden gelir, bazıları hiçbir
  // sayfaya denk gelmez. ÜÇ KATMANLI çözüm:
  //   1) &sort=code — sabit alfabetik sıralama, kayma ihtimalini kökten keser
  //      (ilk sayfada başarısız olursa otomatik sort'suz düşer, tarama sürer);
  //   2) tarama sonrası /funds/codes'tan tam kod listesi alınıp taramada hiç
  //      görülmeyenler tespit edilir ve /funds/:kod ile TEK TEK tamamlanır
  //      (kampanya: fon başına sınır kalktı; codes ucu saatte 5 — saatlik
  //      cron'la uyumlu);
  //   3) hamBenzersiz/mukerrer/kacak sayıları teşhise yazılır — sorun bir
  //      daha nüksederse tek bakışta görünür.
  const hamKodSeti = new Set(); // taramada görülen TÜM ham kodlar (filtre öncesi)
  let sortParam = "&sort=code";

  // Tek bir ham fon kaydını işler — hem sayfa döngüsü hem eksik-tamamlama
  // geçidi AYNI mantığı kullansın diye fonksiyona çıkarıldı.
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

  while (sayfaSayisi < MAKS_SAYFA) {
    const url = `https://fonoloji.com/v1/funds?limit=${PAGE_SIZE}&offset=${offset}${sortParam}`;
    const { res, hata } = await fetchTeshisli(url, { headers }, 2);
    if (!res) {
      // sort=code parametresini API tanımıyorsa İLK sayfada anlaşılır —
      // parametreyi bırak, tekrar hakkı HARCAMADAN aynı offset'i sort'suz dene.
      if (sayfaSayisi === 0 && offset === 0 && sortParam) {
        sortParam = "";
        continue;
      }
      // Geçici hata: önce tarama genel tekrar hakkını kullan (5sn nefes)
      if (sayfaTekrarKaldi > 0) {
        sayfaTekrarKaldi--;
        await new Promise(r => setTimeout(r, 5000));
        continue; // aynı offset'i tekrar dene
      }
      // Haklar bitti: bu sayfayı kayıp say, mümkünse taramaya devam et.
      kayipSayfalar.push(offset);
      sonHata = hata;
      if (hedefToplam === null) break; // toplamı bilmeden körlemesine ilerlenmez
      offset += PAGE_SIZE; sayfaSayisi++;
      if (offset >= hedefToplam) break;
      continue;
    }
    const d = await res.json().catch(() => null);
    if (!d) {
      kayipSayfalar.push(offset); sonHata = "JSON parse hatası";
      offset += PAGE_SIZE; sayfaSayisi++;
      if (hedefToplam !== null && offset >= hedefToplam) break;
      continue;
    }
    if (hedefToplam === null) {
      const t = d.total ?? d.count ?? d.meta?.total;
      if (typeof t === "number" && t > 0) hedefToplam = t;
    }
    const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
    if (!items.length) break;
    hamToplam += items.length;
    for (const f of items) itemIsle(f);
    sayfaSayisi++;
    offset += PAGE_SIZE;
    if (items.length < PAGE_SIZE) break;
    if (hedefToplam !== null && offset >= hedefToplam) break;
  }

  // KAÇAK TAMAMLAMA GEÇİDİ: /funds/codes'tan tam evren alınır, taramada hiç
  // görülmeyen kodlar tek tek /funds/:kod ile çekilir. sort=code işliyorsa bu
  // liste normalde BOŞ kalır — bu geçit, sıralama yine kayarsa devreye giren
  // emniyet ağıdır. Tek seferde en fazla EK_CEKIM_LIMITI fon tamamlanır
  // (maxDuration'ı zorlamamak için); artan olursa bir sonraki saatlik tarama
  // kaldığı yerden tamamlar.
  const EK_CEKIM_LIMITI = 40;
  let kodListesiToplam = null;
  let kacakKodlar = [];
  let ekCekilenAdet = 0;
  try {
    const { res: kodRes } = await fetchTeshisli("https://fonoloji.com/v1/funds/codes", { headers }, 1);
    if (kodRes) {
      const kd = await kodRes.json().catch(() => null);
      const hamListe = kd?.codes ?? kd?.items ?? kd?.data ?? (Array.isArray(kd) ? kd : []);
      const tumKodlar = hamListe.map((x) => (typeof x === "string" ? x : x?.code)).filter(Boolean);
      if (tumKodlar.length > 0) {
        kodListesiToplam = tumKodlar.length;
        kacakKodlar = tumKodlar.filter((k) => !hamKodSeti.has(k));
        for (const kod of kacakKodlar.slice(0, EK_CEKIM_LIMITI)) {
          const { res: tekRes } = await fetchTeshisli(
            `https://fonoloji.com/v1/funds/${encodeURIComponent(kod)}`, { headers }, 1);
          if (!tekRes) continue;
          const td = await tekRes.json().catch(() => null);
          const fon = td?.fund ?? td; // tekil yanıt {fund:{...}} sarmalında geliyor
          if (fon && fon.code) { itemIsle(fon); ekCekilenAdet++; }
        }
      }
    }
  } catch {} // codes ucu saatlik sınırına takılırsa sessizce geç — tarama yine geçerli

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
      sortKullanildi: sortParam !== "",
      kodListesiToplam,
      kacakAdet: kacakKodlar.length,
      kacakIlkOrnekler: kacakKodlar.slice(0, 15),
      ekCekilenAdet,
      // Aranan 5 fon taramada hiç görülmediyse burada eksik kalır — bu da
      // kendi başına bir bulgu (Fonoloji'nin tam listesinde yoklar demektir).
      aranilanKayipFonlar: kayipFonlarHamVeri,
    },
  };

  // Katılım fonu sayısı eşiğin altındaysa VEYA 3'ten fazla sayfa kaybolduysa
  // "eksik görünüyor" — tefas-proxy bu durumda eski veriyi korur.
  const eksikGorunuyor = katilimFonlar.length < ŞÜPHELİ_EŞİK || kayipSayfalar.length > 3;

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

export { fonVerisiCek, ŞÜPHELİ_EŞİK, PARCALAR };
