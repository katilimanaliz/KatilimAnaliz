// api/piyasa-fiyatlar.js
// Birleştirilmiş fiyat proxy'si: altin + kripto + petrol + kur + altinapi
// Kullanım: /api/piyasa-fiyatlar?tip=altin | kripto | petrol | kur | altinapi
// + (2026-10-04) tip=banka-kurlari: katılım bankalarının döviz/gram altın/gram gümüş alış-satış makası (ayrı fonksiyon açılamaz: Vercel Hobby 12 sınırı)
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

  // ═════════════════════════════════════════════════════════════════════════
  // 4) ONS ALTIN / ONS GÜMÜŞ — YAHOO FUTURES'TAN KENDİ GRAM FİYATIMIZA
  //    (2026-08-10, Harem Altın ile karşılaştırma sonrası)
  // ═════════════════════════════════════════════════════════════════════════
  // ÖNCEKİ DAVRANIŞ: Truncgil'de "ONS" sembolü 0 döndüğü için ons altın Yahoo
  // GC=F'ten, ons gümüş SI=F'ten alınıyordu.
  //
  // SORUN: GC=F bir VADELİ (futures) kontrattır, Harem'in verdiği SPOT
  // kotasyon değildir. Vadeli fiyat spot'un üzerinde işlem görür. Ölçüldü
  // (10 Ağustos 12:53):
  //     Bizim (GC=F) 4.402,6   ·   Harem ONS 4.342,1   ·   fark %1,4
  // Bu, 23 Temmuz'daki Brent BZ=F hatasının birebir aynısı: doğru görünen bir
  // Yahoo sembolü, aslında farklı bir enstrüman.
  //
  // ÇÖZÜM: Ons'u kendi gram fiyatımızdan türetiyoruz. Elimizdeki veriden
  // çıkıyor, ek dış istek YOK, üstelik uygulama içi tutarlılığı garanti
  // ediyor (gram ile ons artık aynı sayıyı anlatıyor):
  //     ons = gram × 31,1034768 ÷ USDTRY
  // Doğrulama (aynı an): 6.664,70 × 31,1034768 ÷ 47,7189 = 4.344,0
  // Harem 4.342,1 → fark %0,04. Yahoo'nun %1,4'lük sapmasının otuzda biri.
  //
  // ALIŞ = SATIŞ, bilerek: Harem'de ONS 4.341,7 / 4.342,1 — yani %0,01.
  // Ons altında makasın olmaması VERİ EKSİKLİĞİ DEĞİL, piyasa gerçeğidir
  // (ons bir kotasyon birimidir, fiziki teslim ürünü değil). Bu yüzden
  // aşağıdaki makas tabanı filtresi ons sembollerini muaf tutuyor.
  const GRAM_ONS = 31.1034768;
  const onsTuret = (kaynakSembol, hedefler) => {
    const g = harita[kaynakSembol], d = harita.USDTRY;
    if (!g || !d) return;
    const gAsk = Number(g.ask), dAsk = Number(d.ask);
    if (!isFinite(gAsk) || gAsk <= 0 || !isFinite(dAsk) || dAsk <= 0) return;
    const ons = Math.round((gAsk * GRAM_ONS / dAsk) * 100) / 100;
    // Kapanış da aynı formülle türetilir ki yüzde değişim TL/ons karışımı
    // olmasın: ons cinsinden değişim, kur etkisinden arındırılmış olmalı.
    const gCl = Number(g.close), dCl = Number(d.close);
    const onsClose = (isFinite(gCl) && gCl > 0 && isFinite(dCl) && dCl > 0)
      ? Math.round((gCl * GRAM_ONS / dCl) * 100) / 100
      : null;
    for (const hedef of hedefler) {
      harita[hedef] = { symbol: hedef, bid: ons, ask: ons, close: onsClose, turetilmis: true };
    }
  };

  // ⚠️ XAUUSD TAKMA ADI — ZORUNLU, SİLİNMEMELİ
  // AltinAPI döneminde ons altın "XAUUSD" sembolüyle geliyordu ve kodun birkaç
  // yeri hâlâ o adı arıyor:
  //   • altinTaze() → satis(h,"XAUUSD"); bulamazsa THROW ediyor, yani
  //     /api/piyasa-fiyatlar?tip=altin ucu tamamen çalışmaz hâle geliyor
  //     (Göstergeler ekranındaki "Ons Altın/USD" satırı buradan besleniyor)
  //   • TAKIP_SEMBOLLER ve gecmis.js'teki KIYMETLI_SEMBOLLER
  // Frontend ise Fiziki Altın tablosunda "ONS" adını kullanıyor. İki ad da
  // aynı kayda işaret ediyor.
  //
  // ⚠️ SIRA ÖNEMLİ: onsTuret çağrıları AŞAĞIDA, gümüş açılımından SONRA.
  // Ons gümüş gram gümüşten türetiliyor; gram gümüş de "orta fiyat" olarak
  // gelip açılıyor. Çağrı yukarıda kalırsa ons gümüş açılmamış (orta) değerden
  // hesaplanır ve %4 düşük çıkar.

  // ═════════════════════════════════════════════════════════════════════════
  // 5) TÜM AYARLI ALTIN VE SARRAFİYE — GRAM ALTINDAN TÜRETİLİR
  // ═════════════════════════════════════════════════════════════════════════
  // Truncgil'in sarrafiye kotasyonları Harem'den kayıyor ve kayma YÖNÜ
  // TUTARSIZ (10 Ağustos 17:52 ölçümü, satış tarafı):
  //     çeyrek %-0,59   ·   tam %-0,58   ·   ata %+0,84
  // 22 ayarda ise sapma %2,75'e çıkıyordu ("YIA" muhtemelen farklı bir ürün,
  // bilezik vs külçe). Tek tek düzeltmek yerine kaynağın sarrafiye alanları
  // hiç kullanılmıyor: her ürün gram altından çarpanla türetiliyor.
  //
  // GEREKÇE — bu zaten piyasanın işleyişi. Sarrafiye has altından milyem
  // katsayısıyla fiyatlanır, bağımsız kotasyon almaz. Harem verisinde çarpanlar
  // ÜÇ ölçümde de neredeyse hiç oynamadı (12:53 / 17:15 / 17:52):
  //     çeyrek yeni  1,63156  1,63146  1,63150   → yayılım %0,006
  //     ata yeni     6,64998  6,64907  6,65000   → yayılım %0,014
  //     ata5 yeni   33,34183 33,33790 33,34268   → yayılım %0,014
  // Karşılaştırma: makas oranlarının kendisi aynı sürede %0,13 oynadı, yani
  // ürün/gram ilişkisi makastan on kat kararlı.
  //
  // ÖLÇÜLEN KAZANÇ (17:52, gram altından türetilse):
  //     çeyrek yeni %-0,59 → %0,00   ·   tam eski %-0,58 → %-0,04
  //     ata yeni    %+0,84 → %0,00   ·   22 ayar  %+0,003 (zaten türetiliyordu)
  //
  // ⚠️ Bu fiyatlar TÜRETİLMİŞ. Çarpanlar tek günün üç ölçümünden çıktı; piyasa
  // sertleştiğinde ürün primleri açılabilir ve karşılaştıracak gerçek veri
  // olmadığı için bunu fark edemeyiz. Aylık gözden geçirilmeli.
  const GRAM_ORAN = {
    // sembol         satış / gram altın satış      ölçüm  yayılım
    KULCEALTIN:    0.998008,   // 3   %0,003   HAS ALTIN
    AYAR22:        0.935125,   // 3   %0,004
    AYAR14:        0.723741,   // 2   %0,002
    CEYREK_YENI:   1.631507,   // 3   %0,006
    CEYREK_ESKI:   1.607537,   // 3   %0,003
    YARIM_YENI:    3.260113,   // 1
    YARIM_ESKI:    3.208213,   // 1
    TEK_YENI:      6.498176,   // 1
    TEK_ESKI:      6.409830,   // 3   %0,112
    ATA_YENI:      6.649685,   // 3   %0,014
    ATA_ESKI:      6.599842,   // 3   %0,014
    ATA5_YENI:    33.340803,   // 3   %0,014
    ATA5_ESKI:    33.091288,   // 3   %0,015
    GREMESE_YENI: 16.195067,   // 3   %0,014
    GREMESE_ESKI: 16.055137,   // 2   %0,015
  };
  for (const [sembol, oran] of Object.entries(GRAM_ORAN)) {
    const gram = harita.ALTIN;
    if (!gram || !(Number(gram.ask) > 0)) continue;
    const ask = Math.round(Number(gram.ask) * oran * 100) / 100;
    const close = Number(gram.close) > 0
      ? Math.round(Number(gram.close) * oran * 100) / 100 : null;
    // bid aşağıdaki HAREM_MAKAS döngüsünde hesaplanıyor
    harita[sembol] = { symbol: sembol, bid: null, ask, close, turetilmis: true };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 5b) GÜMÜŞ — TRUNCGIL DEĞERİ ORTA FİYATTIR, SATIŞ DEĞİL
  // ═════════════════════════════════════════════════════════════════════════
  // Truncgil'in gram gümüşü Harem'in ORTA fiyatına denk düşüyor:
  //     17:52  Truncgil 99,51  ·  Harem alış 96,04 / orta 99,97 / satış 103,91
  // Onu "satış" sayıp üstüne %7,6'lık fiziki makası aşağı doğru uygulamak,
  // alışı Harem'in alışının bile ALTINA düşürüyordu (ölçüldü: ons gümüşte
  // %-5,8 sapma). 22 ayardaki hatanın aynısı: doğru oran, yanlış taban.
  //
  // ÇÖZÜM: değer orta kabul edilip iki yöne açılıyor. r = alış/satış olmak
  // üzere  satış = orta × 2/(1+r).  Ölçülen sonuç: %-5,8 → %-0,44.
  const GUMUS_MAKAS_R = 0.923966;   // 2 ölçüm, yayılım %0,076
  {
    const g = harita.GUMUSTRY;
    const orta = g ? Number(g.ask) : NaN;
    if (isFinite(orta) && orta > 0) {
      const acilim = 2 / (1 + GUMUS_MAKAS_R);
      g.ask = Math.round(orta * acilim * 10000) / 10000;
      if (Number(g.close) > 0) g.close = Math.round(Number(g.close) * acilim * 10000) / 10000;
      g.bid = null;   // HAREM_MAKAS döngüsünde hesaplanacak
      g.turetilmis = true;
    }
  }

  // ── ONS TÜRETME (sıra: gümüş açılımından SONRA) ─────────────────────────
  // Ons altın gram altından, ons gümüş AÇILMIŞ gram gümüşten hesaplanıyor.
  onsTuret("ALTIN", ["ONS", "XAUUSD"]);
  onsTuret("GUMUSTRY", ["XAGUSD"]);

  // ═════════════════════════════════════════════════════════════════════════
  // 6) ALIŞ FİYATI — HAREM'DEN ÖLÇÜLEN MAKAS ORANLARI
  // ═════════════════════════════════════════════════════════════════════════
  // SORUN: Truncgil'in "Buying" alanı güvenilmez. İki ayrı biçimde bozuk:
  //   • gram altın / gram gümüş → alış fiilen satışın kopyası
  //       gram altın: bizde %0,013 makas   ·   Harem'de %1,00
  //     Fiziki altında %0,01 makas diye bir şey yoktur; sarraf o fiyattan geri
  //     almaz. Bu sayıyı "Alış" diye göstermek, kullanıcıya bozdurduğunda
  //     alacağından ~%1 fazlasını vaat etmek olur.
  //   • sarrafiyede ise TERS yönde — alış fazla düşük
  //       çeyrek: bizde 10.625 · Harem 10.747  (satış neredeyse birebir)
  //
  // ÇÖZÜM: Alış artık Truncgil'den okunmuyor; SATIŞ × Harem'in ölçülen makas
  // oranı. Yukarıdaki GRAM_ORAN türetmesiyle aynı mantık.
  //
  // ── ORANLARIN KARARLILIĞI ÖLÇÜLDÜ ────────────────────────────────────────
  // İki ayrı an karşılaştırıldı (10 Ağustos 12:53 ve 17:15; arada altın %0,54
  // düştü). 13 ortak sembolde EN BÜYÜK KAYMA 0,057 PUAN. Yani makaslar gün
  // içinde neredeyse hiç oynamıyor; sabit katsayı güvenli.
  // Aşağıdaki değerlerin sağındaki sayı, kaç ölçümün ortalaması olduğudur.
  //
  // ⚠️ Yine de piyasa rejimi değişince (sert oynaklık, tatil, kur şoku)
  // makaslar açılır. AYLIK gözden geçirilmeli; GRAM_ORAN için de aynı kural.
  const HAREM_MAKAS = {
    // sembol         alış / satış    ölçüm  yayılım
    ALTIN:         0.989504,   // 3   %0,128   GRAM ALTIN
    KULCEALTIN:    0.996465,   // 3   %0,128   HAS ALTIN
    AYAR22:        0.967439,   // 3   %0,128
    AYAR14:        0.750500,   // 2   %0,024   makas %25 — işçilik + alaşım
    ONS:           0.999908,   // 3   %0,000   üç ölçümde de BİREBİR aynı
    XAUUSD:        0.999908,   // 3            (ONS takma adı)
    XAGUSD:        0.923169,   // 3   %0,043   ons gümüş
    GUMUSTRY:      0.923966,   // 2   %0,076   gram gümüş
    CEYREK_YENI:   0.987455,   // 3   %0,130
    CEYREK_ESKI:   0.989821,   // 3   %0,122
    YARIM_YENI:    0.988957,   // 1
    YARIM_ESKI:    0.992566,   // 1
    TEK_YENI:      0.992336,   // 1
    TEK_ESKI:      0.993981,   // 3   %0,081
    ATA_YENI:      0.985551,   // 3   %0,128
    ATA_ESKI:      0.992994,   // 3   %0,130
    ATA5_YENI:     0.984309,   // 3   %0,128
    ATA5_ESKI:     0.991731,   // 3   %0,128
    GREMESE_YENI:  0.991707,   // 3   %0,128
    GREMESE_ESKI:  0.988878,   // 2   %0,072
  };

  for (const [sembol, oran] of Object.entries(HAREM_MAKAS)) {
    const k = harita[sembol];
    if (!k) continue;
    const a = Number(k.ask);
    if (!isFinite(a) || a <= 0) continue;
    k.bid = Math.round(a * oran * 100) / 100;
    k.makasKaynak = "harem-2026-08-10";
  }

  // ── ORAN TABLOSUNDA OLMAYANLAR İÇİN GÜVENLİK AĞI ────────────────────────
  // PLATIN ve PALADYUM Harem'in Altın sekmesinde yok, ölçüm yapılamadı. Sahte
  // bir makas (satışın kopyası) göstermektense hiç göstermemek yeğdir:
  // %0,15'in altında makas çıkarsa alış null döner, arayüz "—" gösterir
  // (v94'te hisse/fon için eklenen davranış). Döviz KAPSAM DIŞI: kur makasları
  // zaten bu eşiğin altında kalır ve Döviz sekmesi tamamen boşalırdı.
  const MAKAS_TABANI_YUZDE = 0.15;
  const TABAN_KAPSAMI = new Set(["PLATIN", "PALADYUM"]);
  for (const sembol of TABAN_KAPSAMI) {
    const k = harita[sembol];
    if (!k) continue;
    const b = Number(k.bid), a = Number(k.ask);
    if (!isFinite(b) || !isFinite(a) || a <= 0) continue;
    if (((a - b) / a) * 100 < MAKAS_TABANI_YUZDE) {
      k.bid = null;
      k.alisGuvenilmez = true;   // teşhis için; arayüz okumak zorunda değil
    }
  }

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

// ═══════════════════════════════════════════════════════════════════════════
// GÜN SONU GEÇMİŞİ (2026-10-03) — HAFTALIK ÖZET İÇİN TEK KAYNAK
// ═══════════════════════════════════════════════════════════════════════════
// SORUN: Haftalık Piyasa Özeti (api/getiri.js) döviz/altın/gümüşü Yahoo'dan
// (USDTRY=X, GC=F, SI=F; gram = futures ons × kur) alıyordu; ana menü ise
// bu dosyadaki Truncgil/Kapalı Çarşı değerlerini gösteriyor. İki ekran aynı
// varlık için FARKLI sayı veriyordu (GC=F vadeli kontrat spot'tan ~%1,4 sapar;
// gram altın/gümüş Kapalı Çarşı satışı ile sentetik hesap aynı değildir).
// Truncgil'in geçmiş verisi yok; bu yüzden ana menünün KENDİ değerlerini her
// gün kaydediyoruz (günlük kapanış mantığıyla aynı fikir).
//
// KAYIT: piyasa:gunsonu:v1 = { gunler:{ "YYYY-MM-DD": {USDTRY,EURTRY,ALTIN,GUMUSTRY,
// ONS,XAGUSD, ts} } } — TR tarihi anahtar; o günün SON görülen değeri (her istekte
// bugünün kaydı ezilir), son 28 gün tutulur. Cumartesi/Pazar kayıtları da yazılır:
// haftalık özet "Cuma kapanışı"nı Cuma 18:00'den sonra görülmüş kayıttan, yoksa
// hafta sonu kaydından alır (api/getiri.js gunSonuSec).
// Yazım hatası fiyat akışını ASLA etkilemez (try/catch).
const KV_GUNSONU = "piyasa:gunsonu:v1";
const GUNSONU_SEMBOLLER = ["USDTRY", "EURTRY", "ALTIN", "GUMUSTRY", "ONS", "XAGUSD"];
const GUNSONU_SAKLA = 28;

function bugunTRISO() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

async function gunSonuYaz(h) {
  try {
    const deg = {};
    for (const s of GUNSONU_SEMBOLLER) {
      const v = satis(h, s);
      if (v != null) deg[s] = v;
    }
    if (Object.keys(deg).length === 0) return;
    let kayit = null;
    try { kayit = await redis.get(KV_GUNSONU); } catch {}
    const gunler = kayit && kayit.gunler && typeof kayit.gunler === "object" ? { ...kayit.gunler } : {};
    gunler[bugunTRISO()] = { ...deg, ts: Date.now() };
    const anahtarlar = Object.keys(gunler).sort();
    while (anahtarlar.length > GUNSONU_SAKLA) delete gunler[anahtarlar.shift()];
    await redis.set(KV_GUNSONU, { gunler });
  } catch {}
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

// ─── ALTIN (Kaynak: tamamen Truncgil; ons gram fiyatından türetilir) ──────
// Alan adları BİREBİR korundu (XAU_USD, XAG_USD, USD_TRY, XAU_TRY_gram,
// XAG_TRY_gram). İki fark var:
//   • Gram fiyatları ons × kur ile HESAPLANMIYOR, doğrudan Kapalı Çarşı
//     verisinden (ALTIN / GUMUSTRY) geliyor.
//   • Ons fiyatları ise TERSİ yönde, gram fiyatından türetiliyor — Yahoo'nun
//     vadeli kontratı spot'tan %1,4 sapıyordu (bkz. onsTuret notu).
//
// ── ZORUNLULUK HİYERARŞİSİ (2026-08-10) ──────────────────────────────────
// Eskiden ons altın (XAU_USD) da ZORUNLU alandı; yoksa fonksiyon THROW edip
// bütün ucu düşürüyordu. Bu iki ayrı soruna yol açtı:
//   1) XAUUSD sembolü Truncgil geçişinde hiç üretilmez oldu → uç tamamen kırık
//      (yukarıdaki takma adla çözüldü)
//   2) Kırık olmasa bile: dış bir kaynağa erişilemediği anda ELDE OLAN gram
//      altın/gümüş/kur verileri de kullanıcıya hiç ulaşmıyordu
// Bu yüzden zorunluluk daraltıldı: uygulamanın gerçekten muhtaç olduğu alanlar
// gram altın ve USD/TRY. Ons altın gelmezse null döner, arayüz o satırı
// göstermez — geri kalan fiyatlar akmaya devam eder.
async function altinTaze() {
  const h = await altinApiPaylasimli();
  const ref = await gunlukReferansAlVeYaz(h);
  await gunSonuYaz(h);   // haftalık özet için gün sonu geçmişi (hata fırlatmaz)

  const XAU_USD = satis(h, "XAUUSD");
  const XAG_USD = satis(h, "XAGUSD");
  const USD_TRY = satis(h, "USDTRY");
  const XAU_TRY_gram = satis(h, "ALTIN");
  const XAG_TRY_gram = satis(h, "GUMUSTRY");

  if (XAU_TRY_gram == null) throw new Error("ALTIN (gram altın) alınamadı");
  if (USD_TRY == null) throw new Error("USDTRY alınamadı");
  // Akıl kontrolü yalnızca İKİSİ DE varken anlamlı; ons altın yoksa atlanır.
  if (XAU_USD != null && XAG_USD != null && XAG_USD >= XAU_USD) {
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
// 2026-10-03: sonuca `kaynak` ("alphavantage" | "yahoo") eklendi. Ana menüdeki Brent ile
// Haftalık Özet'teki Brent'in farklı çıkma sebebini kanıtlamak için: iki kaynak FARKLI
// enstrümandır (AlphaVantage = EIA spot günlük serisi; Yahoo BZ=F = vadeli kontrat) ve
// AlphaVantage ücretsiz planı GÜNDE 25 istek sınırlıdır; önbellek 30 dk iken sınır
// aşılıp Yahoo'ya düşülebiliyordu. Önbellek süresi 3 saate çıkarıldı (seri günlüktür).
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
            kaynak: "alphavantage",
            veriTarihi: veri[0].date || null,
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
    kaynak: "yahoo",
    ts: new Date().toISOString(),
  };
}

// ─── ALTINAPI (ham, tüm semboller) ─────────────────────────────────────────
const ALTINAPI_GARANTI = [
  "ALTIN","ONS","AYAR22","AYAR14","CEYREK_YENI","CEYREK_ESKI","YARIM_YENI",
  "YARIM_ESKI","TEK_YENI","TEK_ESKI","ATA_YENI","ATA_ESKI","XAGUSD",
  "GUMUSTRY","XPTUSD","PLATIN","XPDUSD","PALADYUM","USDTRY","EURTRY",
];

// ═══════════════════════════════════════════════════════════════════════════
// FİZİKİ ALTIN GEÇMİŞİ (2026-10-07) — "Fiziki Altın" sekmesindeki tarih seçici
// ═══════════════════════════════════════════════════════════════════════════
// AltinAPI/Truncgil geçmiş veri vermiyor (history uçları 404, doğrulandı); bu yüzden
// her TAZE altinapi çekiminde bugünün alış/satışı Redis HASH'ine yazılır:
//   piyasa:altingecmis:v1  →  alan "YYYY-MM-DD" (TR tarihi)  =  { SEMBOL:{b:alış,a:satış}, ts }
// Aynı gün içindeki her yazım günü EZER → kayıt o günün SON görülen değeridir (gün sonu).
// Kayıt YALNIZ bu tarihten itibaren birikir; öncesi için veri YOKTUR (uydurulmaz).
// HASH seçildi: tek alan yazılır/okunur (28 günlük tek-anahtar JSON gibi her dakika
// tüm geçmişi okuyup yazmaz). Yazım hatası fiyat akışını ASLA etkilemez.
const KV_ALTIN_GECMIS = "piyasa:altingecmis:v1";
const ALTIN_GECMIS_SEMBOLLER = [
  "ALTIN","ONS","XAGUSD","GUMUSTRY","AYAR22","AYAR14",
  "CEYREK_YENI","CEYREK_ESKI","YARIM_YENI","YARIM_ESKI",
  "TEK_YENI","TEK_ESKI","ATA_YENI","ATA_ESKI",
  // 2026-10-07: Döviz sekmesi tarih seçicisinde gerçek ALIŞ/SATIŞ için (Yahoo geçmişinde alış yok). Kayıt başladığı günden itibaren dolar.
  "USDTRY","EURTRY","GBPTRY","CHFTRY","CADTRY","AUDTRY","JPYTRY","CNYTRY","SARTRY","AEDTRY","RUBTRY",
];
const ALTIN_GECMIS_DOVIZ = new Set(["USDTRY","EURTRY","GBPTRY","CHFTRY","CADTRY","AUDTRY","JPYTRY","CNYTRY","SARTRY","AEDTRY","RUBTRY"]);
async function altinGecmisYaz(h) {
  try {
    const kayit = {};
    for (const s of ALTIN_GECMIS_SEMBOLLER) {
      let b = alis(h, s);
      const a = satis(h, s);
      // Döviz makas akıl kontrolü (gecmis.js ile aynı: normal makas %0,2–3; %5 üstü bozuk alış) → alış null, satış kalır
      if (a != null && b != null && ALTIN_GECMIS_DOVIZ.has(s)) {
        const makas = ((a - b) / b) * 100;
        if (!isFinite(makas) || makas < 0 || makas > 5) b = null;
      }
      if (a != null) kayit[s] = { b, a };
    }
    if (Object.keys(kayit).length === 0) return;
    await redis.hset(KV_ALTIN_GECMIS, { [bugunTRISO()]: { ...kayit, ts: Date.now() } });
  } catch {}
}

// GET /api/piyasa-fiyatlar?tip=altin-gecmis&tarih=YYYY-MM-DD
// → { tarih, bulunan, onceki, kayit, oncekiKayit } ; o günde kayıt yoksa ÖNCEKİ en yakın kayıt
// (5 güne kadar, hafta sonu/tatil için); hiç yoksa kayit:null. Ayrıca ilkKayit: birikimin başladığı gün.
async function altinGecmisHandler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300");
  if (req.method === "OPTIONS") return res.status(200).end();
  const tarih = String(req.query.tarih || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return res.status(400).json({ error: "tarih=YYYY-MM-DD gerekli" });
  try {
    const tum = (await redis.hgetall(KV_ALTIN_GECMIS)) || {};
    const gunler = Object.keys(tum).filter((g) => /^\d{4}-\d{2}-\d{2}$/.test(g)).sort();
    const ilkKayit = gunler.length ? gunler[0] : null;
    let idx = -1;
    for (let i = gunler.length - 1; i >= 0; i--) { if (gunler[i] <= tarih) { idx = i; break; } }
    const gunFark = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
    if (idx < 0 || gunFark(tarih, gunler[idx]) > 5) return res.status(200).json({ tarih, kayit: null, ilkKayit });
    const bulunan = gunler[idx];
    const onceki = idx > 0 ? gunler[idx - 1] : null;
    return res.status(200).json({ tarih, bulunan, onceki, kayit: tum[bulunan], oncekiKayit: onceki ? tum[onceki] : null, ilkKayit });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

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
  await altinGecmisYaz(harita);   // 2026-10-07: gün sonu alış/satış geçmişi (hata fırlatmaz)
  return sonuc;
}

// ─── KUR (Kaynak: AltinAPI; Bitcoin için CoinGecko) ────────────────────────
// Ana alanlar (USD_TRY, EUR_TRY …) SATIŞ fiyatını taşıyor — ana ekranda
// gösterilen budur. Alış/satış ayrımı ve günlük değişim "detay" altında.
//
// RUB/CNY/AED: AltinAPI'de ana sembol boş dönüyor (USDRUB bid=ask=0), bu
// yüzden DS_ önekli karşılıkları yedek olarak kullanılıyor.
// ─── KUR (Kaynak: Truncgil — merkezi önbellekten; yalnız Bitcoin CoinGecko) ─
// Truncgil döviz de veriyor ve SERBEST PİYASA kuru (USD 47,71 — AltinAPI'nin
// verdiğiyle neredeyse birebir; Frankfurter'ın ECB referans kuru ise gün içinde
// hiç güncellenmiyordu). Üstelik altınla AYNI yanıtta geldiği için merkezi
// önbellekten okunuyor: kur için ek bir dış istek yapılmıyor.
//
// Truncgil'de OLMAYAN tek kalem Bitcoin → CoinGecko.
// ONS ALTIN ARTIK YAHOO'DAN GELMİYOR (2026-08-10): GC=F vadeli kontrat olduğu
// için spot'tan %1,4 sapıyordu; ons artık gram fiyatından türetiliyor
// (bkz. altinApiCek içindeki onsTuret notu). Bu iki Yahoo isteği tamamen
// kaldırıldı — hem daha doğru hem iki dış çağrı daha az.
async function kurTaze() {
  const [haritaRes, btcRes] = await Promise.allSettled([
    altinApiPaylasimli(),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
  ]);

  if (haritaRes.status !== "fulfilled") {
    throw new Error("Truncgil alınamadı: " + (haritaRes.reason?.message || "bilinmeyen hata"));
  }
  const h = haritaRes.value;

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
    XAU_USD: satis(h, "ONS"),
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
  // petrol: anahtar v2 (yeni `kaynak` alanı hemen görünsün) ve TTL 30 dk → 3 saat
  // (AlphaVantage günlük seri + ücretsiz plan günde 25 istek; bkz. petrolTaze notu).
  petrol:   { anahtar: "petrol:v2",   ttl: 10800, fn: petrolTaze,  cacheControl: "s-maxage=1800" },
  // kur ARTIK merkezi önbelleği kullanıyor (Truncgil döviz de veriyor), yani
  // buradaki TTL dış servise giden istek sayısını belirlemiyor — o iş
  // altinApiTtl() içinde yapılıyor. 300sn yalnızca bu uca özel tazelik.
  // (Eski yorum "kur AltinAPI kullanmıyor" diyordu; Truncgil geçişinden sonra
  //  yanlış kaldı, düzeltildi.)
  kur:      { anahtar: "kur:v4",      ttl: 300,  fn: kurTaze,      cacheControl: "s-maxage=300" },
  altinapi: { anahtar: "altinapi:v7", ttl: 60,   fn: altinApiTaze, cacheControl: "s-maxage=60" },
};

// ═══════════════════════════════════════════════════════════════════════
// KATILIM BANKALARI KUR MAKASI — OTOMATİK TOPLAYICI (2026-10-04)
// Hesapla > Hazine > "Kur Makası ve Marj" ekranının veri kaynağı. BU DOSYANIN İÇİNDE (piyasa-fiyatlar.js) çünkü Vercel Hobby planı en fazla
// 12 sunucu fonksiyonuna izin veriyor; ayrı api/banka-kurlari.js 13. fonksiyon olup TÜM dağıtımı düşürdü. Mevcut tip yönlendirmesiyle AYNI: ?tip=banka-kurlari.
//
//   GET /api/piyasa-fiyatlar?tip=banka-kurlari                         → son işlem gününün MEDYAN ölçümü (uygulama bunu okur)
//   GET /api/piyasa-fiyatlar?tip=banka-kurlari&islem=topla&anahtar=... → bir ölçüm alır (cron-job.org çağırır; anahtar zorunlu)
//
// KAYNAK: kur.doviz.com (döviz) ve altin.doviz.com (altın/gümüş) banka sayfaları.
// ⚠️ Üçüncü taraf ticari siteden otomatik okuma: kullanım koşulu / engellenme riski kullanıcıya bildirildi. Önlemler: yalnız mesai saatinde,
//    yalnız 30 dk'da bir, dürüst User-Agent, BANKA_KURLARI=kapali acil anahtarı; engellenirse (403/429) durur ve uygulama elle JSON'a düşer.
// ZAMAN: Hobby fonksiyon süresi kısa → tüm istekler PARALEL, her istek 6 sn'de zaman aşımına uğrar.
// DOĞRULAMA: döviz/altın satırı kendi içinde tutarlı olmalı (satış>alış, makas=satış−alış, makas%=makas÷alış); gümüşte satış>alış ve satış≤alış×1,5.
//    (gram gümüş: bankanın kendi /gumus sayfası, 6 banka denenir; sayfası olmayan atlanır). Tutmayan satır ATILIR, uydurma/varsayılan değer YOK.
// ═══════════════════════════════════════════════════════════════════════
const BANKA_KURLARI = (() => {
  const HEDEF_BANKALAR = [
    { ad: "Albaraka Türk",  desen: "Albaraka Türk" },
    { ad: "Dünya Katılım",  desen: "Dünya Katılım" },
    { ad: "Emlak Katılım",  desen: "Emlak Katılım" },
    { ad: "Hayat Finans",   desen: "Hayat Finans" },
    { ad: "Kuveyt Türk",    desen: "Kuveyt Türk" },
    { ad: "T.O.M. Katılım", desen: "(?:TOM Bank(?: Hadi)?|T\\.?O\\.?M\\.? Katılım|TOM Katılım)" },
    { ad: "Türkiye Finans", desen: "Türkiye Finans" },
    { ad: "Vakıf Katılım",  desen: "Vakıf Katılım" },
    { ad: "Ziraat Katılım", desen: "Ziraat Katılım" },
    { ad: "Adil Katılım",   desen: "Adil Katılım" },
  ];
  const PARALAR = {
    USD: ["amerikan-dolari"],
    EUR: ["euro"],
    XAU: [],   // gram altın: altin.doviz.com tablosundan (madenTopla)
    XAG: [],   // gram gümüş: her bankanın KENDİ sayfasındaki tek satırdan (madenTopla)
  };
  const DOVIZ_PARALARI = ["USD", "EUR"];
  // Tablo her banka sayfasında aynı; ilk sayfada eksik banka kalırsa sıradaki sayfalar denenir (en çok 4 istek/para).
  const SAYFA_BANKALARI = ["kuveyt-turk", "albaraka-turk", "vakif-katilim", "ziraat-katilim"];
  const KAYNAK_ADRES = (banka, para) => `https://kur.doviz.com/${banka}/${para}`;
  // Kıymetli madenler: her bankanın sayfasında hem "Gram Altın Banka Kurları" tablosu hem de o bankanın kendi "Gram Gümüş" satırı var.
  const ALTIN_SAYFALARI = ["kuveyt-turk", "albaraka-turk", "vakif-katilim", "dunya-katilim", "emlak-katilim", "ziraat-katilim"];
  const ALTIN_ADRES = (banka) => `https://altin.doviz.com/${banka}/gram-altin`;
  // Gram gümüş AYRI sayfada (altın sayfasında DEĞİL — canlıda gümüş 0 çıkınca anlaşıldı): "<Banka> Gram Gümüş ... Alış / Satış 93,44 / 102,57"
  const GUMUS_ADRES = (banka) => `https://altin.doviz.com/${banka}/gumus`;
  const SAYFA_BANKA_AD = { "kuveyt-turk": "Kuveyt Türk", "albaraka-turk": "Albaraka Türk", "vakif-katilim": "Vakıf Katılım", "dunya-katilim": "Dünya Katılım", "emlak-katilim": "Emlak Katılım", "ziraat-katilim": "Ziraat Katılım" };
  const USER_AGENT = "KatilimPlus-KurMakasi/1.0 (+https://www.katilimplus.com)";
  const ZAMAN_ASIMI_MS = 6000;

  const MESAI_BASLANGIC_DK = 10 * 60;        // 10:00 TR
  const MESAI_BITIS_DK = 17 * 60 + 30;       // 17:30 TR
  const SAKLAMA_GUN = 12;
  const ANAHTAR_ORNEK = (gun) => `bankakur:ornek:${gun}`;
  const ANAHTAR_SON_GUN = "bankakur:songun";
  const ANAHTAR_DURUM = "bankakur:durum";

  function trZaman(d = new Date()) {
    const t = new Date(d.getTime() + 3 * 3600 * 1000); // Europe/Istanbul (UTC+3, DST yok)
    return { gun: t.toISOString().slice(0, 10), dk: t.getUTCHours() * 60 + t.getUTCMinutes(), haftaGunu: t.getUTCDay(), saat: t.toISOString().slice(11, 16) };
  }
  function mesaiMi(z) { return z.haftaGunu >= 1 && z.haftaGunu <= 5 && z.dk >= MESAI_BASLANGIC_DK && z.dk <= MESAI_BITIS_DK; }
  function trSayi(s) { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; }
  function medyan(dizi) {
    const a = dizi.filter((x) => typeof x === "number" && x > 0).sort((x, y) => x - y);
    if (!a.length) return null;
    const o = Math.floor(a.length / 2);
    return a.length % 2 ? a[o] : (a[o - 1] + a[o]) / 2;
  }
  const yuvarla4 = (x) => (x === null ? null : Math.round(x * 10000) / 10000);
  function duzMetin(html) {
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#x?[0-9a-f]+;/gi, " ")
      .replace(/\s+/g, " ");
  }

  // Tablo satırı: "<banka adı> alış satış makas %makas%" — banka adı satırda iki kez geçebilir, sayılara bitişik olan eşleşir.
  const SAYI = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2,4})";
  function bankaSatirlariniCikar(html) {
    const metin = duzMetin(html);
    const sonuc = {};
    for (const b of HEDEF_BANKALAR) {
      const re = new RegExp(`${b.desen}\\s+${SAYI}\\s+${SAYI}\\s+${SAYI}\\s+%\\s*(\\d+,\\d+)`, "g");
      let m;
      while ((m = re.exec(metin)) !== null) {
        const alis = trSayi(m[1]), satis = trSayi(m[2]), makas = trSayi(m[3]), makasYuzde = trSayi(m[4]);
        if (alis === null || satis === null || makas === null || makasYuzde === null) continue;
        if (!(satis > alis)) continue;
        if (Math.abs((satis - alis) - makas) > 0.0025 + satis * 0.00002) continue;
        if (Math.abs(makas / alis * 100 - makasYuzde) > 0.03) continue;
        sonuc[b.ad] = { alis, satis };
        break;
      }
    }
    return sonuc;
  }
  // Gümüş sayfası: "<Banka> Gram Gümüş ... Alış / Satış 93,44 / 102,57" — sayfa o bankanın gümüşüdür; 'Gram Gümüş' ifadesi ve mantık kontrolü şart.
  function gumusSayfasiniCikar(html) {
    const metin = duzMetin(html);
    if (!/Gram Gümüş/.test(metin)) return null;
    const m = new RegExp(`Alış\\s*/\\s*Satış[\\s·:]*${SAYI}\\s*/\\s*${SAYI}`).exec(metin);
    if (!m) return null;
    const alis = trSayi(m[1]), satis = trSayi(m[2]);
    if (alis === null || satis === null || !(satis > alis) || satis > alis * 1.5) return null; // mantıksız satır atılır
    return { alis, satis };
  }

  async function sayfaGetir(adres) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ZAMAN_ASIMI_MS);
    try {
      const r = await fetch(adres, { headers: { "User-Agent": USER_AGENT, "Accept": "text/html", "Accept-Language": "tr-TR,tr;q=0.9" }, signal: ctl.signal, redirect: "follow" });
      if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.durum = r.status; throw e; }
      return await r.text();
    } finally { clearTimeout(t); }
  }

  // Bir döviz için tüm hedef bankaların satırları. İlk sayfa çoğu bankayı verir; eksik kalırsa sıradaki sayfalar (sırayla) denenir.
  async function paraTopla(para, getir = sayfaGetir) {
    if (!DOVIZ_PARALARI.includes(para)) return { toplam: {}, hatalar: [], istek: 0, engellendi: false };
    const toplam = {}, hatalar = [];
    let istek = 0;
    for (const banka of SAYFA_BANKALARI) {
      for (const slug of PARALAR[para]) {
        istek++;
        try {
          const satirlar = bankaSatirlariniCikar(await getir(KAYNAK_ADRES(banka, slug)));
          for (const [ad, v] of Object.entries(satirlar)) if (!toplam[ad]) toplam[ad] = v;
        } catch (e) {
          hatalar.push(`${banka}/${slug}: ${e.message}`);
          if (e.durum === 403 || e.durum === 429) return { toplam, hatalar, istek, engellendi: true };
        }
      }
      if (Object.keys(toplam).length >= HEDEF_BANKALAR.length - 2) break; // çoğu bulundu; ısrar etme
    }
    return { toplam, hatalar, istek, engellendi: false };
  }

  // Gram altın (karşılaştırma tablosu, her sayfa tüm bankaları verir) + gram gümüş (bankanın KENDİ gümüş sayfası). Hepsi PARALEL; gümüş sayfası olmayan banka (404) sessizce atlanır.
  async function madenTopla(getir = sayfaGetir) {
    const altin = {}, gumus = {}, hatalar = [];
    let engellendi = false;
    const hata = (etiket, e) => { if (e.durum === 404) return; hatalar.push(`${etiket}: ${e.message}`); if (e.durum === 403 || e.durum === 429) engellendi = true; };
    await Promise.all(ALTIN_SAYFALARI.flatMap((slug) => [
      (async () => {
        try { for (const [ad, v] of Object.entries(bankaSatirlariniCikar(await getir(ALTIN_ADRES(slug))))) if (!altin[ad]) altin[ad] = v; }
        catch (e) { hata(`${slug}/gram-altin`, e); }
      })(),
      (async () => {
        try { const g = gumusSayfasiniCikar(await getir(GUMUS_ADRES(slug))); if (g) gumus[SAYFA_BANKA_AD[slug]] = g; }
        catch (e) { hata(`${slug}/gumus`, e); }
      })(),
    ]));
    return { altin, gumus, hatalar, istek: ALTIN_SAYFALARI.length * 2, engellendi };
  }

  // Gün içindeki örneklerden banka başına MEDYAN alış/satış
  function gunMedyani(ornekler) {
    const sonuc = [];
    for (const b of HEDEF_BANKALAR) {
      const satir = { ad: b.ad };
      for (const para of Object.keys(PARALAR)) {
        const alislar = [], satislar = [];
        for (const o of ornekler) {
          const v = o.v && o.v[b.ad] && o.v[b.ad][para];
          if (v && v.alis > 0 && v.satis > v.alis) { alislar.push(v.alis); satislar.push(v.satis); }
        }
        const a = medyan(alislar), s = medyan(satislar);
        satir[para] = a !== null && s !== null && s > a ? { alis: yuvarla4(a), satis: yuvarla4(s), n: alislar.length } : { alis: null, satis: null, n: 0 };
      }
      sonuc.push(satir);
    }
    return sonuc;
  }

  async function bkHandler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    try {
      if (process.env.BANKA_KURLARI === "kapali") return res.status(200).json({ kapali: true, bankalar: [] });
      const islem = String((req.query && req.query.islem) || "");

      // ── ÖLÇÜM AL (cron) ────────────────────────────────────────────────
      if (islem === "topla") {
        const beklenen = process.env.BANKA_KURLARI_ANAHTAR;
        if (!beklenen || String(req.query.anahtar || "") !== beklenen) return res.status(401).json({ hata: "yetkisiz" });
        const z = trZaman();
        const zorla = req.query.zorla === "1"; // test: mesai dışında da ölç
        if (!mesaiMi(z) && !zorla) return res.status(200).json({ atlandi: "mesai disi", zaman: `${z.gun} ${z.saat}` });
        const v = {};
        const durum = { zaman: `${z.gun} ${z.saat}`, hatalar: [], istek: 0, engellendi: false };
        // Döviz (USD, EUR) her ölçümde; altın/gümüş saatte bir (saat başı çağrısı, dakika 0-29) — hepsi PARALEL
        const maden = z.dk % 60 < 30 || zorla;
        const [dovizSonuc, mt] = await Promise.all([
          Promise.all(DOVIZ_PARALARI.map(async (p) => [p, await paraTopla(p)])),
          maden ? madenTopla() : Promise.resolve(null),
        ]);
        for (const [para, s] of dovizSonuc) {
          durum.istek += s.istek; durum.hatalar.push(...s.hatalar); if (s.engellendi) durum.engellendi = true;
          for (const [ad, d] of Object.entries(s.toplam)) { (v[ad] = v[ad] || {})[para] = d; }
        }
        if (mt) {
          durum.istek += mt.istek; durum.hatalar.push(...mt.hatalar); if (mt.engellendi) durum.engellendi = true;
          for (const [ad, d] of Object.entries(mt.altin)) { (v[ad] = v[ad] || {}).XAU = d; }
          for (const [ad, d] of Object.entries(mt.gumus)) { (v[ad] = v[ad] || {}).XAG = d; }
          durum.maden = { altin: Object.keys(mt.altin).length, gumus: Object.keys(mt.gumus).length };
        }
        const bulunan = Object.keys(v).length;
        durum.bulunanBanka = bulunan;
        if (bulunan > 0) {
          const anahtar = ANAHTAR_ORNEK(z.gun);
          await redis.rpush(anahtar, JSON.stringify({ t: `${z.gun}T${z.saat}`, v }));
          await redis.expire(anahtar, SAKLAMA_GUN * 86400);
          await redis.set(ANAHTAR_SON_GUN, z.gun, { ex: SAKLAMA_GUN * 86400 });
        }
        await redis.set(ANAHTAR_DURUM, JSON.stringify({ ...durum, ts: new Date().toISOString() }), { ex: SAKLAMA_GUN * 86400 });
        return res.status(200).json({ ...durum, kaydedildi: bulunan > 0 });
      }

      // ── OKU (uygulama) ─────────────────────────────────────────────────
      const gun = await redis.get(ANAHTAR_SON_GUN);
      const durumRaw = await redis.get(ANAHTAR_DURUM);
      const durum = typeof durumRaw === "string" ? JSON.parse(durumRaw) : durumRaw;
      if (!gun) return res.status(200).json({ guncelleme: null, bankalar: [], tani: durum || null });
      const ham = await redis.lrange(ANAHTAR_ORNEK(String(gun)), 0, -1);
      const ornekler = (ham || []).map((x) => (typeof x === "string" ? JSON.parse(x) : x));
      const bankalar = gunMedyani(ornekler);
      const saatler = ornekler.map((o) => String(o.t).slice(11, 16)).sort();
      return res.status(200).json({
        guncelleme: String(gun),
        olcumNotu: ornekler.length ? `mesai içi ${ornekler.length} ölçümün medyanı (${saatler[0]}–${saatler[saatler.length - 1]})` : null,
        ornekSayisi: ornekler.length,
        kaynak: "doviz.com",
        kaynakNotu: "Bankaların ilan ettiği gösterge kurlar (kaynak: doviz.com banka kurları sayfaları); mesai içi ölçümlerin medyanı.",
        bankalar,
        tani: durum || null,
      });
    } catch (e) {
      console.error("banka-kurlari hata:", e);
      return res.status(200).json({ guncelleme: null, bankalar: [], hata: String(e && e.message ? e.message : e) });
    }
  }

  return { handler: bkHandler, bankaSatirlariniCikar, gumusSayfasiniCikar, paraTopla, madenTopla, gunMedyani };
})();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const tip = req.query.tip;
  if (tip === "banka-kurlari") return BANKA_KURLARI.handler(req, res);   // 2026-10-04: kur makası toplayıcısı
  if (tip === "altin-gecmis") return altinGecmisHandler(req, res);   // 2026-10-07: fiziki altın geçmiş tarih seçici
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

handler.__bk = BANKA_KURLARI; // yalnız test erişimi
