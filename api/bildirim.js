// api/bildirim.js
//
// TEK dosyada DÖRT işlem — Vercel'in /api altında en fazla 12 fonksiyon
// sınırına takılmamak için hepsi buraya birleştirildi. Hangi işlemin
// yapılacağı query parametresiyle belirleniyor: ?islem=...
//
// ── 1) Token kaydetme (uygulamadan çağrılır, herkes çağırabilir) ──
//
//   fetch(`${API_BASE}/api/bildirim?islem=kaydet`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ token: token.value, platform: ... }),
//   });
//
// ── 2) Bildirim gönderme (sadece admin, x-admin-key veya ?anahtar= gerekli) ──
//
//   curl -X POST "https://www.katilimplus.com/api/bildirim?islem=gonder" \
//     -H "Content-Type: application/json" \
//     -H "x-admin-key: GIZLI_ANAHTARINIZ" \
//     -d '{"baslik":"Yeni Kur!", "govde":"USD/TRY güncellendi."}'
//
//   NOT (2026-07): Bazı tarayıcı ortamlarında (özellikle Safari Gizli
//   Sekme + Gelişmiş İzleme Koruması) özel HTTP header'lar ("x-admin-key"
//   gibi) fetch() içinde "SyntaxError: The string did not match the
//   expected pattern" hatasına yol açabiliyor. Bu yüzden admin anahtarı
//   HEM header HEM query param (?anahtar=) ile kabul ediliyor — tıpkı
//   alarm-kontrol uç noktasındaki gibi.
//
//   YİNELENEN GÖNDERİM KORUMASI (2026-07-24 eklendi): Admin panelindeki
//   "Gönder" butonu klasik form gönderimi kullanıyor (bkz. panel notları) —
//   yavaş bağlantı/çift dokunma/form resubmit gibi durumlarda aynı içerik
//   yanlışlıkla iki kez TÜM kullanıcılara gidebiliyordu (yaşanmış vaka).
//   Şimdi aynı başlık+gövde BILDIRIM_TEKRAR_ONLE_SANIYE içinde tekrar
//   gönderilmeye çalışılırsa 409 ile reddediliyor. Gerçekten aynı içeriği
//   bilerek tekrar göndermek gerekiyorsa ?zorla=1 (query) veya
//   {"zorla":true} (body) ile bypass edilebilir.
//
// ── 3) FİYAT ALARMLARI (2026-07 eklendi) ──
//
// Kullanıcı bir enstrüman için "şu fiyata gelirse" veya "%X yükselir/düşerse"
// alarmı kurabiliyor. Alarmlar Redis'te TEK bir anahtar altında (JSON dizi
// olarak — tefas-proxy/evds-proxy'deki aynı desen) tutulur, push token'a
// (cihaza) bağlıdır — uygulamanın kullanıcı hesabı olmadığı için token,
// alarmın "kime ait olduğunu" belirleyen tek kimliktir.
//
//   POST ?islem=alarm-ekle    { token, sembol, ad, tip:"hedef"|"yuzde", yon, hedefFiyat?, yuzde? }
//   POST ?islem=alarm-listele { token }                    → {alarmlar:[...]}
//   POST ?islem=alarm-sil     { token, id }
//   POST ?islem=alarm-durum   { token, id, aktif } → KAP aboneliğini duraklat/başlat
//   GET  ?islem=duyurular[&sonrasi=<ts>] → son toplu duyurular (geçmiş için)
//
//   BİST HİSSE ALARMLARI (2026-07-29 eklendi): Sembol "BIST:" önekiyle
//   gelirse (örn. "BIST:ASELS") fiyat /api/hisse-proxy'den okunur. Detaylı
//   gerekçe ve güvenlik önlemleri için aşağıdaki BİST bölümüne bakın.
//
// ── 4) ALARM KONTROLÜ (dış tetikleyici çağırır — Vercel Cron DEĞİL) ──
//
// Vercel Hobby planında cron günde 1 kezle sınırlı (fiyat alarmı için işe
// yaramaz) — bu yüzden bu uç nokta, ücretsiz bir dış zamanlayıcı servisinin
// (örn. cron-job.org) her 5-15 dakikada bir HTTP isteğiyle tetiklemesi için
// tasarlandı. Kimlik doğrulama HEM header HEM query param ile desteklenir
// çünkü bazı ücretsiz zamanlayıcılar özel header ayarlamaya izin vermiyor:
//
//   GET/POST ?islem=alarm-kontrol&anahtar=GIZLI_ANAHTAR
//   (veya header: x-admin-key: GIZLI_ANAHTAR)
//
// Tetiklenen her alarm İÇİN SADECE O CİHAZA (kendi token'ına) push bildirimi
// gönderilir — bildirimGonder'daki gibi TÜM kullanıcılara değil. Tetiklenen
// alarm "aktif:false" yapılır (tek seferlik) — kullanıcı isterse aynı
// koşulla yeni bir alarm kurabilir.
//
// ── 5) HESABA BAĞLAMA + MİSAFİR/ÜCRETSİZ/PRO SINIRI (2026-09-27 eklendi) ──
//
// alarm-ekle artık isteğe bağlı bir 'uid' alanı kabul ediyor (Firebase
// Authentication uid'i). uid gönderilirse alarm o hesaba bağlanır VE aktif
// fiyat/yüzde alarmı sayısı hesabın Pro durumuna göre sınırlanır (misafir: 2,
// ücretsiz üye: 5, Pro: sınırsız). uid gönderilmezse (misafir) eskisi gibi çalışır.
//
//   POST ?islem=alarm-hesaba-bagla { token, uid }
//   → kullanıcı giriş yaptığında BİR KEZ çağrılır; bu cihazın token'ına
//     kayıtlı, henüz uid'i olmayan alarmları o hesaba bağlar.
//
// ── 6) HABER BİLDİRİMLERİ (2026-09-27 eklendi) ──
//
//   POST ?islem=haber-bildirim-ayarla { token, acik, kategoriler?, uid? }
//   POST ?islem=haber-bildirim-gonder { baslik, govde, kategori? } (ADMIN)
//
// Detaylar için aşağıdaki "HABER BİLDİRİMLERİ" bölümüne bakın. Gönderim
// mantığının kendisi ./_lib/haberBildirimi.js'e taşındı — api/finans-
// haberleri.js de AYNI fonksiyonu, yeni bir başlık geldiğinde OTOMATİK
// çağırıyor (bkz. o dosyadaki "OTOMATİK BİLDİRİM" bölümü).
//
// ── 8) REVENUECAT WEBHOOK (2026-09-27 eklendi) ──
//
//   POST ?islem=revenuecat-webhook   (RevenueCat panelinden çağrılır)
//   Authorization: <REVENUECAT_WEBHOOK_SECRET ortam değişkeniyle AYNI değer>
//
// Gerçek satın alma/yenileme/iptal/süre dolumu olaylarını Firestore'daki
// pro/{uid} kaydına yazar — böylece mobilde alınan Pro web'de/masaüstünde de
// tanınır ve sunucu tarafı kontroller (alarm sınırı, banka oranı alarmı,
// haber kategorileri) gerçek aboneleri Pro sayar. Yeni bir /api dosyası
// açılmadı (12 fonksiyon sınırı) — bu dosyanın bir işlemi olarak eklendi.
// Ayrıntı için aşağıdaki "REVENUECAT WEBHOOK" bölümüne bakın.
// ── 7) BANKA ORANI ALARMI (2026-09-27 eklendi) — SADECE PRO ──
//
//   POST ?islem=alarm-ekle { token, uid, tip:"banka_oran", banka, urun,
//                            yon:"ustunde"|"altinda", hedefFiyat, ad? }
//
// urun ∈ {tl,usd,eur,altin} (kâr payı) veya {konut60,konut120,tasit12,
// tasit24,ihtiyac12,ihtiyac24} (finansman). Veri kar-payi.json'dan (repodaki
// public/kar-payi.json) okunuyor. uid Pro değilse 403. Detaylar için
// aşağıdaki "BANKA ORANI ALARMLARI" bölümüne bakın.

import { Redis } from "@upstash/redis";
import { randomUUID, timingSafeEqual } from "crypto";
import { admin } from "./_lib/firebaseAdmin.js";
import { kilitliCalistir } from "./_lib/kilitliOnbellek.js";
import { haberleriGonder, HABER_BILDIRIM_TOKENS_KEY, HABER_BILDIRIM_KATEGORI_PREFIX } from "./_lib/haberBildirimi.js";

// NOT: Vercel KV entegrasyonu, Upstash'in standart isimlendirmesi olan
// UPSTASH_REDIS_REST_URL/TOKEN yerine KV_REST_API_URL/KV_REST_API_TOKEN
// isimlerini kullanıyor — bu yüzden Redis.fromEnv() yerine bunları
// açıkça veriyoruz.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ═══════════════════════════════════════════════════════════════════════════
// HIZ SINIRI (2026-08-02 güvenlik taraması)
// ═══════════════════════════════════════════════════════════════════════════
// Bu dosyadaki "gonder" ve "alarm-kontrol" uçları admin anahtarıyla korunuyor
// (doğru yapılmış). Ancak "kaydet", "alarm-ekle" ve kardeşleri KİMLİK
// DOĞRULAMASIZ olmak ZORUNDA — uygulamanın kullanıcı hesabı yok, push token
// tek kimlik. Bu da onları kötüye kullanıma açık bırakıyor:
//
//   • kaydet      → pushTokens kümesine sınırsız çöp kayıt
//   • alarm-ekle  → fiyatAlarmlari dizisini sınırsız şişirme
//
// İkincisi daha ciddi: alarmlar TEK bir Redis anahtarında JSON dizi olarak
// duruyor. Token başına 20 sınırı var ama saldırgan sınırsız sahte token
// üretebilir; her ekleme dev diziyi baştan yazar ve alarm-kontrol turu her
// alarm için fiyat çekmeye çalışır. Fatura ve cron süresi birlikte patlar.
//
// Fail-open: Redis'e ulaşılamazsa istek GEÇER. Upstash kesintisinde tüm
// kullanıcıları kilitlemek, çareyi hastalıktan kötü yapardı.
const HIZ_SINIRI_ADET = 30;      // IP başına dakikada izin verilen yazma isteği
const HIZ_SINIRI_PENCERE = 60;   // saniye

function istemciIp(req) {
  const x = req.headers["x-forwarded-for"];
  if (typeof x === "string" && x) return x.split(",")[0].trim();
  return req.headers["x-real-ip"] || "bilinmeyen";
}

async function hizSiniriAsildiMi(req) {
  try {
    const ip = istemciIp(req);
    if (ip === "bilinmeyen") return false;
    const pencere = Math.floor(Date.now() / (HIZ_SINIRI_PENCERE * 1000));
    const sayac = await redis.incr(`rl:bildirim:${ip}:${pencere}`);
    if (sayac === 1) await redis.expire(`rl:bildirim:${ip}:${pencere}`, HIZ_SINIRI_PENCERE * 2);
    return sayac > HIZ_SINIRI_ADET;
  } catch {
    return false; // fail-open
  }
}

// FCM kayıt token'ı biçimi. Gerçek token'lar uzun, noktalı ve
// harf/rakam/-/_/: karakterlerinden oluşur. Bu kontrol "aaa" gibi çöp
// kayıtları eler; meşru token'ları elemez.
//
// NOT: Ham APNs hex token'ları (64-200 hex) bu testten ÖNCE
// hamTokeniDonustur ile FCM biçimine çevriliyor, dolayısıyla buraya
// çevrilmiş hâlleriyle geliyorlar.
const FCM_TOKEN_REGEX = /^[A-Za-z0-9_:.\-]{100,4096}$/;

// Tüm alarmlar TEK anahtarda tutulduğu için toplam boy da sınırlanmalı;
// token başına 20 sınırı sahte token üretimine karşı tek başına yetmiyor.
// Mevcut ölçek (474 indirme) düşünüldüğünde bu sınır çok uzak, ama
// kötüye kullanımda tavan görevi görüyor.
// ── KATILIM ENDEKSİ ÜYELİĞİ (2026-08-06) ────────────────────────────────────
// Kullanıcı portföyündeki bir hisse Katılım Endeksi'nden çıktığında haber
// alsın diye. Endeks periyodik revize ediliyor; kimse kullanıcıya bunu
// söylemiyor, kendi fark etmesi gerekiyordu.
//
// NEDEN AYRI ÖNBELLEK: Yukarıdaki bistVerisiGetir() Redis anlık görüntüsünü
// okuyor ama o anahtar YALNIZCA FİYAT tutuyor — katilimEndeksi bayrağı orada
// yok. Bayrak için hisse-proxy'nin TAM çıktısı gerekiyor ve o HTTP çağrısı
// pahalı (bkz. yukarıdaki CPU notu). Endeks üç ayda bir revize edildiğine
// göre 12 saatlik önbellek fazlasıyla yeterli: abone sayısı ne olursa olsun
// günde en fazla 2 HTTP çağrısı.
const KV_ENDEKS_UYELER_KEY = "endeks:uyeler:v1";
const ENDEKS_ONBELLEK_SN = 12 * 3600;
// Endekste her zaman en az bu kadar hisse vardır. Daha azı gelirse veri
// BOZUKTUR (ör. hisse-proxy alan adını değiştirdi, bayrak hiç gelmedi) —
// o durumda güncelleme YAPILMAZ. Aksi halde tek bir yukarı akış değişikliği
// bütün abonelere "hisseniz endeksten çıktı" diye YANLIŞ bildirim gönderirdi.
const ENDEKS_ASGARI_UYE = 20;

async function endeksUyeleriOku() {
  try {
    const c = await redis.get(KV_ENDEKS_UYELER_KEY);
    if (c && Array.isArray(c.uyeler) && c.uyeler.length >= ENDEKS_ASGARI_UYE) {
      return new Set(c.uyeler);
    }
  } catch (e) {
    console.error("Endeks onbellegi okunamadi:", e.message);
  }
  try {
    const r = await fetchZamanli(
      `${API_TABAN}/api/hisse-proxy`,
      { headers: { Accept: "application/json", "User-Agent": "KatilimPlus-Alarm/1.0" } },
      12000
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.success || !Array.isArray(j.data) || j.data.length < 100) return null;
    const uyeler = j.data
      .filter((h) => h?.katilimEndeksi && h?.ticker)
      .map((h) => String(h.ticker).toUpperCase());
    if (uyeler.length < ENDEKS_ASGARI_UYE) {
      console.error("Endeks uye sayisi supheli, guncelleme yapilmadi:", uyeler.length);
      return null;
    }
    await redis.set(KV_ENDEKS_UYELER_KEY, { uyeler, ts: Date.now() }, { ex: ENDEKS_ONBELLEK_SN });
    return new Set(uyeler);
  } catch (e) {
    console.error("Endeks uyeleri alinamadi:", e.message);
    return null;
  }
}

const MAKS_TOPLAM_ALARM = 5000;

// ── ZEKÂT HATIRLATMASI (2026-08-06) ─────────────────────────────────────────
// Fiyat alarmlarından ve KAP aboneliklerinden farklı olarak TARİH tabanlı:
// kullanıcı zekât gününü seçer, o gün geldiğinde tek bir push gider ve tarih
// otomatik olarak bir KAMERİ YIL (354 gün) ileri alınır — abonelik sürer.
//
// NEDEN AYRI BİR SİSTEM DEĞİL: Yerel bildirim (@capacitor/local-notifications)
// yeni bir native paket ve yeni mağaza sürümü gerektirirdi. Mevcut alarm
// dizisine yeni bir "tip" olarak eklenince token yönetimi, cron turu, FCM
// gönderimi ve ölü token temizliği HAZIR altyapıdan geliyor; özellik Live
// Update ile çıkabiliyor.
//
// Token başına TEK kayıt tutulur — ikinci kez kurulursa mevcut kayıt
// güncellenir (kullanıcı zekât gününü değiştirmiş demektir).
const ZEKAT_KAMERI_GUN = 354;
const ZEKAT_SEMBOL = "ZEKAT";

// "YYYY-MM-DD" → gün başlangıcı (UTC) zaman damgası. Saat dilimi kaymasının
// bildirimi bir gün erken/geç göndermemesi için gün bazında karşılaştırıyoruz.
function zekatTarihMs(gg) {
  if (typeof gg !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(gg)) return null;
  const t = Date.parse(gg + "T00:00:00Z");
  return isNaN(t) ? null : t;
}

// Bir kameri yıl ileri al ve yine "YYYY-MM-DD" döndür.
function zekatTarihIlerlet(gg, gun = ZEKAT_KAMERI_GUN) {
  const t = zekatTarihMs(gg);
  if (t == null) return null;
  return new Date(t + gun * 86400000).toISOString().slice(0, 10);
}

async function tokenKaydet(req, res) {
  let { token, platform, eskiToken } = req.body || {};

  if (token && APNS_HEX_REGEX.test(token)) {
    const cevrilen = await hamTokeniDonustur(token);
    if (!cevrilen) {
      res.status(400).json({ hata: "Token donusturulemedi" });
      return;
    }
    token = cevrilen;
  }

  if (!token || typeof token !== "string") {
    res.status(400).json({ hata: "Geçerli bir 'token' alanı gerekli" });
    return;
  }

  // BİÇİM DOĞRULAMASI (2026-08-02): Önceden herhangi bir metin kabul
  // ediliyordu; {"token":"a"} ile Redis kümesi çöple doldurulabilirdi.
  // Şişen küme her "gonder" çağrısında 500'lük gruplar hâlinde FCM'e
  // gönderilmeye çalışılır — hem maliyet hem gecikme.
  if (!FCM_TOKEN_REGEX.test(token)) {
    res.status(400).json({ hata: "Token biçimi geçersiz" });
    return;
  }

  await redis.sadd("pushTokens", token);
  if (platform) {
    await redis.hset("pushTokenPlatform", { [token]: platform });
  }

  // TOKEN TASIMA (2026-07-18): Cihazin token'i degistiyse eski token'a
  // bagli ALARMLAR yeni token'a tasinir — aksi halde tetiklenen alarm olu
  // token'a gonderilir ve bildirim sessizce kaybolur (yasanmis vaka).
  let tasinanAlarm = 0;
  if (eskiToken && typeof eskiToken === "string" && eskiToken !== token) {
    try {
      await redis.srem("pushTokens", eskiToken);
      await redis.hdel("pushTokenPlatform", eskiToken);
      const { basarili, sonuc } = await kilitliCalistir(
        redis,
        ALARM_KILIT_ANAHTAR,
        15,
        async () => {
          const alarmlar = await alarmlariOku();
          let sayi = 0;
          const yeniListe = alarmlar.map((a) => {
            if (a.token === eskiToken) { sayi++; return { ...a, token }; }
            return a;
          });
          if (sayi > 0) await redis.set(ALARM_KV_ANAHTAR, yeniListe);
          return { sayi };
        },
        { denemeSayisi: 5, bekleMs: 300 }
      );
      if (basarili) tasinanAlarm = sonuc?.sayi || 0;
    } catch (e) {
      console.error("Token tasima hatasi (kayit yine de basarili):", e.message);
    }
  }

  res.status(200).json({ basarili: true, tasinanAlarm });
}

// Tek bir token'a push bildirimi gönderir (alarm bildirimleri için — tüm
// kullanıcılara değil, sadece alarmı kuran cihaza gider).
async function tekTokeneGonder(token, baslik, govde, veri) {
  try {
    await admin.messaging().send({
      notification: { title: baslik, body: govde },
      data: veri || {},
      token,
      android: { notification: { sound: "default", channelId: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
    });
    return true;
  } catch (e) {
    console.error("Alarm bildirimi gönderilemedi:", token, e.message);
    return { hata: e.code || e.message || "bilinmeyen" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// YİNELENEN GÖNDERİM KORUMASI (2026-07-24)
// ═══════════════════════════════════════════════════════════════════════════
// Aynı başlık+gövde çok kısa süre içinde ikinci kez ?islem=gonder ile
// gelirse (çift tıklama, form resubmit, yavaş bağlantıda tekrar deneme vb.)
// sessizce engellenir. Redis'te TEK bir anahtar altında son gönderimin
// içerik özeti + zaman damgası tutulur — TTL süresi dolunca otomatik silinir,
// ayrıca temizlik kodu gerekmez.
const SON_BILDIRIM_ANAHTAR = "sonGonderilenBildirim";
const BILDIRIM_TEKRAR_ONLE_SANIYE = 30 * 60; // 30 dakika

// ── TOPLU DUYURU ARŞİVİ (2026-08-01) ───────────────────────────────────────
// SORUN: Uygulama KAPALIYKEN gelen bildirimler geçmişe hiç kaydedilmiyordu.
// Frontend yalnızca iki olayla kayıt tutuyor:
//   notificationReceived        → sadece uygulama AÇIKKEN çalışır
//   notificationActionPerformed → sadece bildirime DOKUNULURSA çalışır
// Kullanıcı bildirimi kaçırır ya da kaydırıp atarsa uygulamada hiç izi
// kalmıyordu — 1 Ağustos'ta 236 kişiye giden haftalık özet duyurusu
// kimsenin geçmişinde görünmedi.
//
// ÇÖZÜM: Toplu duyurular herkese aynı gittiği için kullanıcı başına
// saklamaya gerek yok — TEK bir Redis anahtarında son N duyuru tutuluyor.
// Uygulama açılışta bu listeyi çekip kendi yerel geçmişiyle birleştiriyor.
// Maliyet: duyuru başına tek yazma, kullanıcı sayısından bağımsız.
//
// Fiyat alarmları bu listeye GİRMEZ: onlar kişiye özel ve alarm kaydında
// zaten tetiklenme bilgisi duruyor (ileride oradan da beslenebilir).
const DUYURU_ARSIV_ANAHTAR = "duyuruArsiv";
const DUYURU_ARSIV_BOYU = 20;      // saklanacak duyuru sayısı
const DUYURU_ARSIV_GUN = 30;       // bundan eski duyurular istemciye verilmez

async function bildirimGonder(req, res) {
  const gelenAnahtarHeader = req.headers["x-admin-key"];
  const gelenAnahtarQuery = req.query?.anahtar;
  const gelenAnahtarBody = req.body?.anahtar;
  if (
    !process.env.ADMIN_GIZLI_ANAHTAR ||
    (gelenAnahtarHeader !== process.env.ADMIN_GIZLI_ANAHTAR &&
      gelenAnahtarQuery !== process.env.ADMIN_GIZLI_ANAHTAR &&
      gelenAnahtarBody !== process.env.ADMIN_GIZLI_ANAHTAR)
  ) {
    res.status(401).json({ hata: "Yetkisiz istek" });
    return;
  }

  const { baslik, govde, veri } = req.body || {};
  if (!baslik || !govde) {
    res.status(400).json({ hata: "'baslik' ve 'govde' alanları zorunlu" });
    return;
  }

  // Yinelenen gönderim kontrolü — ?zorla=1 veya {"zorla":true} ile atlanabilir.
  const zorla = req.query?.zorla === "1" || req.body?.zorla === true;
  const icerikAnahtari = `${baslik}\u0000${govde}`;
  if (!zorla) {
    try {
      const son = await redis.get(SON_BILDIRIM_ANAHTAR);
      if (son && son.icerik === icerikAnahtari && Date.now() - son.ts < BILDIRIM_TEKRAR_ONLE_SANIYE * 1000) {
        res.status(409).json({
          hata: "Bu içerik az önce gönderildi, yinelenen gönderim engellendi.",
          oncekiGonderim: new Date(son.ts).toISOString(),
          bypassIcin: "İstenerek tekrar göndermek için ?zorla=1 ekleyin.",
        });
        return;
      }
    } catch (e) {
      // Redis kontrolü başarısız olursa gönderimi engellemeyelim — sessizce devam.
      console.error("Yinelenen gönderim kontrolü hatası (gönderime devam ediliyor):", e.message);
    }
  }

  const tokenlar = await redis.smembers("pushTokens");
  if (!tokenlar || tokenlar.length === 0) {
    res.status(200).json({ basarili: true, gonderilen: 0, mesaj: "Kayıtlı token yok" });
    return;
  }

  const GRUP_BOYU = 500;
  let gonderilenToplam = 0;
  let gecersizTokenlar = [];
  let ornekHatalar = [];

  for (let i = 0; i < tokenlar.length; i += GRUP_BOYU) {
    const grup = tokenlar.slice(i, i + GRUP_BOYU);

    const mesaj = {
      notification: { title: baslik, body: govde },
      data: veri || {},
      tokens: grup,
      android: { notification: { sound: "default", channelId: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
    };

    const sonuc = await admin.messaging().sendEachForMulticast(mesaj);
    gonderilenToplam += sonuc.successCount;

    sonuc.responses.forEach((r, idx) => {
      if (!r.success) {
        const kod = r.error?.code || "";
        console.error("FCM gonderim hatasi:", kod, "-", r.error?.message, "- token(ilk10):", grup[idx]?.slice(0, 10));
        if (ornekHatalar.length < 5) {
          ornekHatalar.push({ kod, mesaj: r.error?.message || null });
        }
        if (
          kod.includes("registration-token-not-registered") ||
          kod.includes("invalid-argument")
        ) {
          gecersizTokenlar.push(grup[idx]);
        }
      }
    });
  }

  if (gecersizTokenlar.length > 0) {
    await redis.srem("pushTokens", ...gecersizTokenlar);
    await redis.hdel("pushTokenPlatform", ...gecersizTokenlar);
  }

  // Başarılı gönderim sonrası iz kaydı (yinelenen gönderim koruması için).
  // Bu adım hata verse bile yanıt zaten hazır — sessizce yutulur.
  try {
    await redis.set(SON_BILDIRIM_ANAHTAR, { icerik: icerikAnahtari, ts: Date.now() }, { ex: BILDIRIM_TEKRAR_ONLE_SANIYE });
  } catch (e) {
    console.error("Son gönderim izi kaydedilemedi (bildirim yine de gitti):", e.message);
  }

  // Duyuru arşivine ekle — uygulama kapalıyken gelen bildirimlerin
  // geçmişte görünmesini sağlayan kayıt. Hata olursa bildirim yine gider.
  try {
    let arsiv = [];
    const ham = await redis.get(DUYURU_ARSIV_ANAHTAR);
    if (Array.isArray(ham)) arsiv = ham;
    else if (typeof ham === "string") { try { arsiv = JSON.parse(ham) || []; } catch {} }
    const kayit = {
      id: `duyuru_${Date.now()}`,
      baslik,
      govde,
      ts: Date.now(),
      alici: gonderilenToplam,
    };
    const yeni = [kayit, ...arsiv.filter((k) => k && k.id !== kayit.id)].slice(0, DUYURU_ARSIV_BOYU);
    await redis.set(DUYURU_ARSIV_ANAHTAR, yeni);
  } catch (e) {
    console.error("Duyuru arşive yazılamadı (bildirim yine de gitti):", e.message);
  }

  res.status(200).json({
    basarili: true,
    hedefTokenSayisi: tokenlar.length,
    basariylaGonderilen: gonderilenToplam,
    temizlenenGecersizToken: gecersizTokenlar.length,
    ornekHatalar,
  });
}

// Uygulamanın açılışta çağırdığı uç: son toplu duyurular.
//
//   GET/POST ?islem=duyurular[&sonrasi=<ts>]
//   → { basarili, duyurular: [{id, baslik, govde, ts}] }
//
// Kimlik doğrulaması YOK: içerik zaten tüm kullanıcılara push olarak gitmiş
// genel duyurulardan ibaret, kişisel veri içermiyor. `alici` alanı (kaç
// cihaza ulaştığı) istemciye VERİLMEZ — bu işletme bilgisi.
//
// ?sonrasi= verilirse yalnızca o zaman damgasından yeni olanlar döner;
// istemci son gördüğü damgayı saklayıp gereksiz veri çekmez.
async function duyurulariListele(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  try {
    let arsiv = [];
    const ham = await redis.get(DUYURU_ARSIV_ANAHTAR);
    if (Array.isArray(ham)) arsiv = ham;
    else if (typeof ham === "string") { try { arsiv = JSON.parse(ham) || []; } catch {} }

    const sonrasi = Number(req.query?.sonrasi || req.body?.sonrasi || 0) || 0;
    const enEski = Date.now() - DUYURU_ARSIV_GUN * 86400 * 1000;

    const liste = arsiv
      .filter((k) => k && k.ts && k.ts > enEski && k.ts > sonrasi)
      .sort((a, b) => b.ts - a.ts)
      .map((k) => ({ id: k.id, baslik: k.baslik, govde: k.govde, ts: k.ts }));

    res.status(200).json({ basarili: true, duyurular: liste });
  } catch (e) {
    // Hata durumunda boş liste — uygulama açılışı bundan etkilenmemeli.
    res.status(200).json({ basarili: false, duyurular: [], hata: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HABER BİLDİRİMLERİ (2026-09-27; hesap zorunluluğu SONRADAN aynı gün eklendi)
// ═══════════════════════════════════════════════════════════════════════════
// Fiyat alarmlarından FARKLI: kullanıcı bir EŞİK kurmuyor, sadece "yeni önemli
// haber/bildirimlerimi haber ver" diye ABONE oluyor — HESAP GEREKTİRİR
// (misafir açamaz), kategori seçimi ise ayrıca Pro gerektirir.
//
//   POST ?islem=haber-bildirim-ayarla
//        { token, acik:true|false, uid (acik:true iken ZORUNLU), kategoriler? }
//   POST ?islem=haber-bildirim-gonder   (ADMIN — x-admin-key/?anahtar=)
//        { baslik, govde, kategori?, veri?, anahtar? }
//
// acik:true iken uid YOKSA 403 döner — misafir bildirim AÇAMAZ (ama
// acik:false her zaman serbest, eski misafir abonelerin çıkabilmesi için).
// uid VARSA (hesaplı kullanıcı) ama Pro DEĞİLSE: genel abonelik kurulur,
// kategoriler VERİLMİŞSE bile sessizce yok sayılır (bkz. aşağıdaki Pro
// kontrolü). kategoriler VERİLMEMİŞSE (veya boş dizi) o token "genel abone"
// sayılır — her haber-bildirim-gonder çağrısında (kategori filtresi ne
// olursa olsun) bildirim alır. kategoriler VERİLMİŞ VE Pro'ysa, yalnızca o
// kategorilerden biriyle gönderilen haberlerde bildirim alır — genel
// (kategorisiz) bir gönderimde DAHİL EDİLMEZ, çünkü kullanıcı bilinçli
// olarak daraltmış demektir.
//
// ✅ OTOMATİK TETİKLEME (2026-09-27, aynı gün eklendi): api/finans-
// haberleri.js, taze() içinde gerçekten YENİ bir başlık tespit ettiğinde
// haberleriGonder()'i (bkz. ./_lib/haberBildirimi.js) doğrudan çağırıyor —
// kategori VERİLMEDEN (genel duyuru gibi, tüm abonelere ulaşır; RSS
// kaynaklarının kategori alanı güvenilir/temiz olmadığı için kategoriye
// eşlenmiyor). Bu tetikleme, o dosyanın 15 dk'lık kilitli önbelleğine bağlı
// çalışıyor — ayrı bir cron GEREKMİYOR, ama kimse 15 dk içinde /api/finans-
// haberleri'ni ziyaret etmezse o turda tetiklenmez (organik trafiğe bağlı).
// HABER_BILDIRIM_TOKENS_KEY / HABER_BILDIRIM_KATEGORI_PREFIX artık
// ./_lib/haberBildirimi.js'den import ediliyor (2026-09-27) — o modül,
// api/finans-haberleri.js'in de kullandığı TEK gerçek kaynak; burada
// tekrar tanımlanırsa iki dosya sessizce birbirinden sapabilirdi.

async function haberBildirimAyarla(req, res) {
  const { token, acik, kategoriler, uid } = req.body || {};
  if (!token || typeof acik !== "boolean") {
    res.status(400).json({ hata: "'token' ve boolean 'acik' alanları zorunlu" });
    return;
  }
  try {
    if (!acik) {
      await redis.srem(HABER_BILDIRIM_TOKENS_KEY, token);
      await redis.del(HABER_BILDIRIM_KATEGORI_PREFIX + token);
      res.status(200).json({ basarili: true, abone: false });
      return;
    }
    // ── BİLDİRİM AÇMA HESAP GEREKTİRİR (2026-09-27) ──────────────────────
    // Misafir (uid yok) artık haber bildirimini AÇAMIYOR — kapatma
    // (acik:false, yukarıda) hâlâ herkese açık (zaten hiçbir zarar yok,
    // ayrıca eski misafir abonelerinin çıkabilmesi lazım). Frontend zaten
    // bu durumda toggle'ı hiç çağırmıyor (nav("hesapGiris")'e yönlendiriyor)
    // — burası ikinci savunma hattı, istemciye güvenmiyoruz.
    if (!uid || typeof uid !== "string") {
      res.status(403).json({ hata: "Haber bildirimi almak için hesap açman/giriş yapman gerekiyor." });
      return;
    }
    await redis.sadd(HABER_BILDIRIM_TOKENS_KEY, token);
    // ── KATEGORİ SEÇİMİ SADECE PRO (2026-09-27) ─────────────────────────
    // Genel bildirim (acik:true) misafir dahil herkese açık kalıyor;
    // yalnızca hangi KATEGORİLERİ göreceğini DARALTMAK Pro'ya özel.
    // Frontend zaten bu seçeneği Pro olmayana göstermiyor, ama backend'de
    // de gerçek denetim yapılıyor (banka_oran'daki AYNI ilke: istemciye
    // güvenme). Pro değilse kategoriler SESSİZCE yok sayılır (hata
    // döndürmüyoruz) — genel abonelik yine de kurulmuş olur, sadece
    // daraltma uygulanmaz.
    const pro = Array.isArray(kategoriler) && kategoriler.length > 0 ? await kullaniciProMu(uid) : false;
    if (pro) {
      const temiz = kategoriler.filter((k) => typeof k === "string" && k.length > 0 && k.length < 50).slice(0, 20);
      await redis.set(HABER_BILDIRIM_KATEGORI_PREFIX + token, temiz);
    } else {
      // Kategori verilmemiş/boşaltılmış/Pro değil → "tüm kategoriler" (genel abone).
      await redis.del(HABER_BILDIRIM_KATEGORI_PREFIX + token);
    }
    res.status(200).json({ basarili: true, abone: true });
  } catch (e) {
    res.status(500).json({ hata: "Bildirim tercihi kaydedilemedi", detay: e.message });
  }
}

async function haberBildirimGonder(req, res) {
  const gelenAnahtarHeader = req.headers["x-admin-key"];
  const gelenAnahtarQuery = req.query?.anahtar;
  const gelenAnahtarBody = req.body?.anahtar;
  if (
    !process.env.ADMIN_GIZLI_ANAHTAR ||
    (gelenAnahtarHeader !== process.env.ADMIN_GIZLI_ANAHTAR &&
      gelenAnahtarQuery !== process.env.ADMIN_GIZLI_ANAHTAR &&
      gelenAnahtarBody !== process.env.ADMIN_GIZLI_ANAHTAR)
  ) {
    res.status(401).json({ hata: "Yetkisiz istek" });
    return;
  }

  const { baslik, govde, kategori, veri } = req.body || {};
  // Asıl gönderim mantığı ./_lib/haberBildirimi.js'de — api/finans-haberleri.js
  // ile PAYLAŞILAN tek kopya (bkz. o dosyanın başındaki gerekçe).
  const sonuc = await haberleriGonder({ redis, admin, baslik, govde, kategori, veri });
  res.status(sonuc.basarili ? 200 : 400).json(sonuc);
}

// ═══════════════════════════════════════════════════════════════════════════
// FİYAT ALARMLARI
// ═══════════════════════════════════════════════════════════════════════════

const ALARM_KV_ANAHTAR = "fiyatAlarmlari";
// HAM APNs TOKEN DONUSUMU (2026-07-18): iOS tokenReceived bazen ham
// APNs hex token verir; FCM reddeder (invalid-argument). Sunucu ham token
// gorunce Firebase batchImport ile FCM tokenina cevirir.
const APNS_HEX_REGEX = /^[0-9a-fA-F]{64,200}$/;

async function hamTokeniDonustur(token) {
  if (!token || !APNS_HEX_REGEX.test(token)) return token;
  try {
    const cred = admin.app().options.credential;
    const erisim = await cred.getAccessToken();
    const cevap = await fetch("https://iid.googleapis.com/iid/v1:batchImport", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + erisim.access_token,
        access_token_auth: "true",
      },
      body: JSON.stringify({
        application: "com.katilimplus.app",
        sandbox: false,
        apns_tokens: [token],
      }),
    });
    const d = await cevap.json();
    const kayit = d && d.results && d.results[0];
    if (kayit && kayit.status === "OK" && kayit.registration_token) {
      return kayit.registration_token;
    }
    console.error("APNs donusum red:", JSON.stringify(kayit || d).slice(0, 200));
    return null;
  } catch (e) {
    console.error("APNs donusum hata:", e.message);
    return null;
  }
}

const ALARM_KILIT_ANAHTAR = `lock:${ALARM_KV_ANAHTAR}`;
const OZ = 31.1034768; // ons → gram dönüşüm sabiti

// ═══════════════════════════════════════════════════════════════════════════
// MİSAFİR / ÜCRETSİZ / PRO ALARM SINIRI (2026-09-27)
// ═══════════════════════════════════════════════════════════════════════════
// SADECE fiyat/yüzde alarmlarına uygulanır (tip:"hedef"|"yuzde") — KAP/endeks
// abonelikleri ve zekât hatırlatması kendi ayrı tavanlarını (MAKS_KAP_...,
// MAKS_ENDEKS_...) zaten koruyor, bunlara dokunulmadı.
//
// uid gönderilmemişse (misafir — hesap açmamış kullanıcı) en düşük sınır
// uygulanır. uid gönderilmişse Firestore'daki pro/{uid} dokümanına bakılır:
// aktif Pro ise HİÇBİR SINIR YOK (kullanıcı isteği, 2026-09-27) — sadece
// alarmEkle'nin başındaki MAKS_TOPLAM_ALARM küresel tavanı (sistem geneli,
// 5000) geçerli kalır; değilse ücretsiz üye sınırı uygulanır.
//
// NOT: kpProDurumGetir (frontend) Pro'yu İKİ kaynaktan (Firestore VEYA
// RevenueCat entitlement) belirliyor — burada SADECE Firestore okunuyor.
// RevenueCat'ten satın alan bir kullanıcının bu limitte tanınması için
// frontend'in başarılı satın alma sonrası pro/{uid}'yi de yazması gerekiyor
// (bkz. FiyatlamaPro.tsx ProSatinAl bileşenindeki satinAl/geriYukle).
const ALARM_LIMIT_MISAFIR = 2;
const ALARM_LIMIT_UCRETSIZ = 5;

async function kullaniciProMu(uid) {
  if (!uid) return false;
  try {
    const snap = await admin.firestore().collection("pro").doc(uid).get();
    if (!snap.exists) return false;
    const d = snap.data() || {};
    if (!d.aktif) return false;
    if (d.bitisTarihi && new Date(d.bitisTarihi).getTime() < Date.now()) return false;
    return true;
  } catch (e) {
    // Fail-CLOSED (rate-limit'teki fail-open'ın tersi): bu bir ücretli
    // özellik kapısı, güvenlik açığı değil abuse-önleme. Firestore'a
    // ulaşılamazsa en kötü ihtimalle gerçek bir Pro kullanıcı geçici olarak
    // ücretsiz sınıra düşer — bu, sınırsız alarm oluşturma riskinden iyidir.
    console.error("Pro durumu (alarm limiti) okunamadi:", e.message);
    return false;
  }
}

async function alarmLimitiVeTierAl(uid) {
  if (!uid) return { limit: ALARM_LIMIT_MISAFIR, tier: "misafir" };
  const pro = await kullaniciProMu(uid);
  if (pro) return { limit: Infinity, tier: "pro" };
  return { limit: ALARM_LIMIT_UCRETSIZ, tier: "ucretsiz" };
}

function fetchZamanli(url, opts, msTimeout) {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), msTimeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(zamanlayici));
}

// Yahoo Finance'ten tek bir sembolün GÜNCEL fiyatını çeker. meta.regularMarketPrice
// varsa onu kullanır (en güncel, gün içi) — yoksa son kapanışa düşer.
async function yahooGuncelFiyat(sembol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?range=1d&interval=5m`;
  try {
    const r = await fetchZamanli(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)" } }, 8000);
    if (!r.ok) return null;
    const j = await r.json();
    const sonuc = j?.chart?.result?.[0];
    const meta = sonuc?.meta;
    if (meta?.regularMarketPrice != null) return meta.regularMarketPrice;
    const kapanislar = (sonuc?.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === "number");
    return kapanislar.length ? kapanislar[kapanislar.length - 1] : null;
  } catch {
    return null;
  }
}

// AltinAPI sembolleri (2026-07-23 eklendi) — Altın sekmesindeki yeni ürünler
// (Ons/22-14 Ayar/Ceyrek-Yarim-Tam-Ata Yeni-Eski/Gumus/Platin/Paladyum) icin
// alarm destegi. Bu semboller Yahoo Finance'te YOK; ayrica AltinAPI'nin
// ucretsiz plani ayda 1000 istekle sinirli oldugu icin BURADA YENI BIR
// ALTINAPI ISTEGI YAPILMIYOR — piyasa-fiyatlar.js'in zaten 1 saatte bir
// doldurdugu Redis onbellegi (altinapi:v3) DOGRUDAN OKUNUYOR.
const ALTINAPI_SEMBOLLERI = new Set([
  "ALTIN","ONS","AYAR22","AYAR14","CEYREK_YENI","CEYREK_ESKI",
  "YARIM_YENI","YARIM_ESKI","TEK_YENI","TEK_ESKI","ATA_YENI","ATA_ESKI",
  "XAGUSD","GUMUSTRY","XPTUSD","PLATIN","XPDUSD","PALADYUM",
]);

async function altinApiOnbellektenOku(sembol) {
  try {
    const veri = await redis.get("altinapi:v3");
    if (!veri || !veri[sembol]) return null;
    const { bid, ask } = veri[sembol];
    if (bid == null || ask == null) return null;
    return (bid + ask) / 2; // orta fiyat, alarm karsilastirmasi icin
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BİST HİSSE ALARMLARI (2026-07-29)
// ═══════════════════════════════════════════════════════════════════════════
// SEMBOL BİÇİMİ: "BIST:ASELS" — önek ŞART. Mevcut alarm sembolleri Yahoo
// biçiminde ("USDTRY=X", "GC=F") veya AltinAPI sembolü ("ALTIN", "AYAR22")
// olduğu için, çıplak "ALTIN"/"ONS" gibi kodlarla çakışma riski var. Önek
// bunu tamamen ortadan kaldırıyor ve TradingView'ın kendi gösterimiyle de
// aynı ("BIST:ASELS").
//
// NEDEN /api/hisse-proxy: O uç TEK istekte 615 hissenin TAMAMINI döndürüyor.
// Kaç farklı hisseye alarm kurulmuş olursa olsun kontrol turu başına BİR
// istek yetiyor. hisse-proxy verisini Redis'e YAZMIYOR (yalnızca CDN
// önbelleği kullanıyor), bu yüzden altinapi'deki gibi hazır bir anahtardan
// okuyamıyoruz — HTTP üzerinden çağırıyoruz. Uç zaten seans içinde 600 sn,
// seans dışında 3600 sn CDN önbellekli olduğu için bu çağrı çoğu zaman
// fonksiyonu hiç çalıştırmadan karşılanıyor (Vercel CPU kotası korunuyor).
//
// ⚠️ BAYAT VERİ KORUMASI — bu bölümün en kritik parçası:
// 24-28 Temmuz'da Midas dört gün boyunca donuk veri döndürdü ve fiyatlar
// ekranda hiç değişmedi. Alarm sistemi böyle bir durumda ya hiç ateşlemez ya
// da YANLIŞ ateşler, üstelik kimse fark etmez. Bu yüzden seans içinde veri
// BIST_BAYAT_ESIK_DK'dan eskiyse BİST alarmları o tur TAMAMEN ATLANIR —
// bayat fiyatla karar vermektense hiç karar vermemek doğrudur. Atlanan tur
// yanıtta "bistNot" alanıyla bildirilir, sessizce yutulmaz.
const BIST_ONEK = "BIST:";
const BIST_BAYAT_ESIK_DK = 45;
// hisse-proxy.js'in yazdığı fiyat anlık görüntüsü. ⚠️ O dosyadaki
// KV_HISSE_FIYAT_KEY ile AYNI olmak zorunda; içerik şekli:
//   { veriZamani, kaynak, yazilmaTs, adet, fiyatlar: { ASELS: 361.75, ... } }
const KV_HISSE_FIYAT_KEY = "hisse:fiyat:v1";
// Kendi uç noktamıza çağrı — YALNIZCA Redis anlık görüntüsü yokken yedek olarak.
// VERCEL_URL dağıtım başına değiştiği ve apex alan adı 308 yönlendirme yaptığı
// için (devir belgesi notu) kanonik www adresi sabit tutuluyor.
const API_TABAN = process.env.API_TABAN || "https://www.katilimplus.com";

// Tek kontrol turu içinde birden fazla kez istenirse tekrar okumamak için
// kısa ömürlü bellek içi önbellek (fonksiyon örneği yaşadığı sürece).
let bistBellek = { paket: null, ts: 0 };
const BIST_BELLEK_MS = 60 * 1000;

// ASIL YOL: hisse-proxy.js'in Redis'e yazdığı anlık görüntüyü okur.
//
// NEDEN HTTP DEĞİL: Alarm cron'u 10 dakikada bir çalışıyor. HTTP ile
// /api/hisse-proxy çağırmak, CDN önbelleğiyle çakışmadığı her turda o
// fonksiyonun TAM çalışmasını tetikliyordu (TradingView isteği + 615 kaydın
// normalize edilmesi) — ayda ~30-50 dakika CPU, 4 saatlik kotanın beşte biri.
// Redis okuması ise hiçbir fonksiyon çalıştırmıyor.
//
// YEDEK: Anahtar boşsa (ör. yeni dağıtım sonrası hisse-proxy hiç
// çalışmamışsa) eski HTTP yolu deneniyor — o çağrı zaten anahtarı da
// doldurduğu için sonraki turlar yeniden Redis'ten okur.
async function bistVerisiGetir() {
  if (bistBellek.paket && Date.now() - bistBellek.ts < BIST_BELLEK_MS) return bistBellek.paket;

  // 1) Redis anlık görüntüsü
  try {
    const anlik = await redis.get(KV_HISSE_FIYAT_KEY);
    const fiyatlar = anlik?.fiyatlar;
    if (fiyatlar && typeof fiyatlar === "object") {
      const kodlar = Object.keys(fiyatlar);
      if (kodlar.length >= 100) {
        const harita = new Map();
        for (const kod of kodlar) harita.set(kod.toUpperCase(), { fiyat: fiyatlar[kod] });
        const paket = { harita, veriZamani: anlik.veriZamani || null, kaynak: anlik.kaynak || null, okuma: "redis" };
        bistBellek = { paket, ts: Date.now() };
        return paket;
      }
    }
  } catch (e) {
    console.error("BIST anlik goruntusu okunamadi:", e.message);
  }

  // 2) Yedek: HTTP (aynı zamanda Redis anahtarını da doldurur)
  try {
    const r = await fetchZamanli(
      `${API_TABAN}/api/hisse-proxy`,
      { headers: { Accept: "application/json", "User-Agent": "KatilimPlus-Alarm/1.0" } },
      12000
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.success || !Array.isArray(j.data) || j.data.length < 100) return null;
    const harita = new Map();
    for (const h of j.data) if (h?.ticker) harita.set(String(h.ticker).toUpperCase(), h);
    const paket = { harita, veriZamani: j.veriZamani || null, kaynak: j.kaynak || null, okuma: "http-yedek" };
    bistBellek = { paket, ts: Date.now() };
    return paket;
  } catch (e) {
    console.error("BIST verisi alinamadi (HTTP yedek):", e.message);
    return null;
  }
}

// hisse-proxy.js'deki piyasaAcikMi() ile BİREBİR aynı mantık (TR saati,
// hafta içi 10:00–18:00). Ortak dosyaya çıkarılmadı çünkü iki uç birbirinden
// bağımsız kalsın istiyoruz; değişirse İKİSİ birlikte güncellenmeli.
function bistSeansAcikMi() {
  const tr = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const gun = tr.getDay();                       // 0=Pazar, 6=Cumartesi
  const dk = tr.getHours() * 60 + tr.getMinutes();
  return gun >= 1 && gun <= 5 && dk >= 10 * 60 && dk < 18 * 60;
}

function bistVerisiBayatMi(veriZamani) {
  if (!bistSeansAcikMi()) return false;   // seans dışında eskilik NORMAL
  if (!veriZamani) return true;           // damga yoksa güvenme
  return (Date.now() - new Date(veriZamani).getTime()) / 60000 > BIST_BAYAT_ESIK_DK;
}

async function bistTekFiyat(sembol) {
  const paket = await bistVerisiGetir();
  if (!paket) return null;
  const h = paket.harita.get(sembol.slice(BIST_ONEK.length).toUpperCase());
  return (h && typeof h.fiyat === "number" && h.fiyat > 0) ? h.fiyat : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BANKA ORANI ALARMLARI (2026-09-27) — SADECE PRO
// ═══════════════════════════════════════════════════════════════════════════
// "X bankasının Y oranı Z'yi geçince/altına inince haber ver". Fiyat
// alarmlarıyla AYNI yapıda tek-seferlik bir eşik alarmı (tetiklenince
// aktif:false) — farkı, fiyatı Yahoo/AltinAPI/BIST yerine repodaki statik
// kar-payi.json'dan (public/kar-payi.json, KatilimAnaliz reposunda elle
// güncelleniyor) okuması.
//
// VERİ KAYNAĞI: ${API_TABAN}/kar-payi.json — Next/Vercel'de public/ altındaki
// dosyalar doğrudan kök URL'den servis edilir, /api/ öneki YOK. Dosyanın iki
// bölümü var: "bankalar" (kâr payı oranları: tl/usd/eur/altin) ve
// "finansman.bankalar" (konut60/120, tasit12/24, ihtiyac12/24). "urun" alanı
// hangi bölümden okunacağını belirliyor (bkz. KAR_PAYI_ALANLARI/
// FINANSMAN_ALANLARI). Şimdilik canlı bir API değil, elle güncellenen bir
// dosya — bu yüzden Redis'e YAZILMIYOR, her kontrol turunda doğrudan (kısa
// bellek-içi önbellekle) çekiliyor; BIST'teki gibi bayat-veri riski yok
// çünkü dosya zaten günde birkaç kez elle güncelleniyor, "an be an" değil.
const KAR_PAYI_ALANLARI = new Set(["tl", "usd", "eur", "altin"]);
const FINANSMAN_ALANLARI = new Set(["konut60", "konut120", "tasit12", "tasit24", "ihtiyac12", "ihtiyac24"]);
const BANKA_ONEK = "BANKA:";
const MAKS_BANKA_ORANI_ALARM_TOKEN_BASINA = 30; // Pro zaten sınırsız fiyat alarmı kurabiliyor, bu SADECE kötüye kullanım tavanı

let karPayiBellek = { veri: null, ts: 0 };
const KAR_PAYI_BELLEK_MS = 10 * 60 * 1000; // 10 dk — elle güncellenen bir dosya, sık çekmeye gerek yok

async function karPayiVerisiGetir() {
  if (karPayiBellek.veri && Date.now() - karPayiBellek.ts < KAR_PAYI_BELLEK_MS) return karPayiBellek.veri;
  try {
    const r = await fetchZamanli(`${API_TABAN}/kar-payi.json`, { headers: { Accept: "application/json" } }, 10000);
    if (!r.ok) return karPayiBellek.veri; // eski (varsa) önbelleği koru
    const j = await r.json();
    if (!j || !Array.isArray(j.bankalar)) return karPayiBellek.veri;
    karPayiBellek = { veri: j, ts: Date.now() };
    return j;
  } catch (e) {
    console.error("kar-payi.json alinamadi:", e.message);
    return karPayiBellek.veri; // ağ hatasında eski (varsa) veriyle devam
  }
}

// banka adını normalize ederek karşılaştırır — "kuveyt türk" == "Kuveyt Türk".
function bankaAdiEslesir(a, b) {
  return String(a || "").trim().toLocaleUpperCase("tr-TR") === String(b || "").trim().toLocaleUpperCase("tr-TR");
}

// { banka, urun } için güncel oranı döner; bulunamazsa/veri null'sa null.
function bankaOraniOku(veri, banka, urun) {
  if (!veri) return null;
  const finansman = KAR_PAYI_ALANLARI.has(urun) ? false : FINANSMAN_ALANLARI.has(urun) ? true : null;
  if (finansman === null) return null;
  const liste = finansman ? (veri.finansman?.bankalar || []) : (veri.bankalar || []);
  const kayit = liste.find((b) => bankaAdiEslesir(b?.ad, banka));
  if (!kayit) return null;
  const v = kayit[urun];
  return typeof v === "number" && isFinite(v) ? v : null;
}

// ── PRO ADI GÖSTERİMİ İÇİN ürün etiketleri (hata mesajlarında kullanılıyor) ──
const BANKA_URUN_ETIKET = {
  tl: "TL Kâr Payı Oranı", usd: "USD Kâr Payı Oranı", eur: "EUR Kâr Payı Oranı", altin: "Altın Kâr Payı Oranı",
  konut60: "Konut Finansmanı (60 Ay)", konut120: "Konut Finansmanı (120 Ay)",
  tasit12: "Taşıt Finansmanı (12 Ay)", tasit24: "Taşıt Finansmanı (24 Ay)",
  ihtiyac12: "İhtiyaç Finansmanı (12 Ay)", ihtiyac24: "İhtiyaç Finansmanı (24 Ay)",
};

// ═══════════════════════════════════════════════════════════════════════════
// KAP BİLDİRİM ALARMLARI (2026-07-29)
// ═══════════════════════════════════════════════════════════════════════════
// Fiyat alarmından YAPISAL OLARAK FARKLI — bu bir ABONELİK:
//   • Tetiklenince aktif:false YAPILMAZ, izlemeye devam eder
//   • Eşik yok; "son gördüğümden yenisi geldi mi" durumu tutulur
//   • Kurulurken o anki EN YENİ bildirim başlangıç kabul edilir — yoksa
//     alarm kurar kurmaz son 15 günün tamamı push olarak yağar
//
// VERİ KAYNAĞI: evds-proxy.js'in doldurduğu "kap:tum:v3" Redis anahtarı
// DOĞRUDAN okunuyor. İki dosya aynı Upstash örneğine bağlı (ikisi de
// KV_REST_API_URL kullanıyor) — altinapi:v3 deseninin aynısı, ekstra HTTP
// isteği yok. Önbellek boş/süresi dolmuşsa evds-proxy tek bir çağrıyla
// ısıtılıp tekrar okunuyor (saatte en fazla bir kez).
//
// ⚠️ evds-proxy.js'deki KV_KAP_TUM_KEY ve kapSadeKayit alan adları
// değişirse BURASI DA güncellenmeli. Alan adları: id, kod, ilgili, sirket,
// baslik, ozet, tarih, ek, link.
const KV_KAP_TUM_KEY = "kap:tum:v3";
const MAKS_KAP_ALARM_TOKEN_BASINA = 15;
const KAP_TUR_BASINA_MAKS_BILDIRIM = 3;   // tek turda bir hisse için en fazla kaç yeni bildirim duyurulsun
const MAKS_ENDEKS_ALARM_TOKEN_BASINA = 20;   // endeks aboneliği kalıcı, fiyat alarmlarından ayrı sayılıyor

async function kapTumOku(isitmaYapilsinMi = true) {
  try {
    const liste = await redis.get(KV_KAP_TUM_KEY);
    if (Array.isArray(liste) && liste.length) return liste;
  } catch {}
  if (!isitmaYapilsinMi) return null;
  // Önbellek boş → evds-proxy'yi bir kez çağırıp doldurt, sonra tekrar oku.
  // Yanıtı kullanmıyoruz (yalnızca 8 kayıt döner); amaç önbelleği ısıtmak.
  try {
    await fetchZamanli(
      `${API_TABAN}/api/evds-proxy?kap=hisse&kod=ASELS`,
      { headers: { Accept: "application/json", "User-Agent": "KatilimPlus-Alarm/1.0" } },
      20000
    );
    const liste = await redis.get(KV_KAP_TUM_KEY);
    if (Array.isArray(liste) && liste.length) return liste;
  } catch (e) {
    console.error("KAP onbellegi isitilamadi:", e.message);
  }
  return null;
}

// evds-proxy.js'deki kapHisseEslesir ile AYNI mantık: bildirimi yapan
// şirketin kodu ya da ilgili şirketler listesinde TAM kelime eşleşmesi.
// indexOf kullanılmıyor — "AKBNK" ararken "AKBNKX"i yakalamasın diye.
function kapHisseyeAitMi(kayit, kod) {
  const K = String(kod || "").toUpperCase().trim();
  if (!K) return false;
  if (String(kayit?.kod || "").toUpperCase().trim() === K) return true;
  const ilgili = String(kayit?.ilgili || "").toUpperCase();
  if (!ilgili) return false;
  return ilgili.split(/[,;\s]+/).filter(Boolean).includes(K);
}

// KAP publishDate biçimi: "GG.AA.YYYY SS:DD:ss". String sıralaması yanlış
// sonuç verir, epoch'a çeviriyoruz (evds-proxy'deki zaman() ile aynı).
function kapZaman(t) {
  if (!t) return 0;
  const m = String(t).match(/^(\d{2})\.(\d{2})\.(\d{4})[ T]?(\d{2})?:?(\d{2})?/);
  if (!m) return 0;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
}

// Bir hissenin bildirimlerini en YENİDEN eskiye sıralı döndürür.
function kapHisseBildirimleri(liste, kod) {
  return (liste || [])
    .filter((k) => k && k.id && kapHisseyeAitMi(k, kod))
    .sort((a, b) => kapZaman(b.tarih) - kapZaman(a.tarih));
}

// "Yeni" tanımı: disclosureIndex KAP tarafından artan sırayla veriliyor, bu
// yüzden sayısal karşılaştırma birincil ölçüt. İki taraf da sayı değilse
// yayın zamanına düşülüyor — id biçimi değişirse alarm sessizce ölmesin.
function kapDahaYeniMi(kayit, sonGorulenId, sonGorulenTs) {
  // DİKKAT: Number(null) === 0 ve isFinite(0) === true. Bu yüzden null/undefined
  // açıkça elenmeli — aksi halde "a > 0" karşılaştırmasına düşer ve TÜM
  // bildirimler yeni sayılır (abonelik duraklatıp devam ettirildiğinde
  // geçmişin tamamının push olarak yağmasına yol açardı).
  const a = Number(kayit?.id);
  const b = (sonGorulenId == null || sonGorulenId === "") ? NaN : Number(sonGorulenId);
  if (isFinite(a) && isFinite(b)) return a > b;
  return kapZaman(kayit?.tarih) > (sonGorulenTs || 0);
}

// GRAM_ALTIN/GRAM_GUMUS gibi sentetik semboller dahil, herhangi bir alarm
// sembolünün güncel fiyatını döner.
//
// NOT: alarm-kontrol turunda BİST sembolleri için bu fonksiyon KULLANILMAZ —
// orada tek istekle toplu okuma yapılıyor (bkz. alarmKontrol). Buradaki BİST
// dalı yalnızca alarm-ekle sırasındaki tekil doğrulama için.
async function alarmFiyatGetir(sembol) {
  if (sembol === "GRAM_ALTIN" || sembol === "GRAM_GUMUS") {
    const onsSembol = sembol === "GRAM_ALTIN" ? "GC=F" : "SI=F";
    const [ons, usdTry] = await Promise.all([yahooGuncelFiyat(onsSembol), yahooGuncelFiyat("USDTRY=X")]);
    if (ons == null || usdTry == null) return null;
    return (ons * usdTry) / OZ;
  }
  if (typeof sembol === "string" && sembol.startsWith(BIST_ONEK)) {
    return bistTekFiyat(sembol);
  }
  if (ALTINAPI_SEMBOLLERI.has(sembol)) {
    return altinApiOnbellektenOku(sembol);
  }
  return yahooGuncelFiyat(sembol);
}

async function alarmlariOku() {
  try {
    const kayit = await redis.get(ALARM_KV_ANAHTAR);
    if (Array.isArray(kayit)) return kayit;
    if (typeof kayit === "string") return JSON.parse(kayit) || [];
    return [];
  } catch {
    return [];
  }
}

async function alarmEkle(req, res) {
  let { token, sembol, ad, tip, yon, hedefFiyat, yuzde, uid } = req.body || {};
  // uid isteğe bağlı — göndermeyen (misafir) istemciler eskisi gibi çalışır.
  if (uid != null && typeof uid !== "string") uid = null;
  if (token && APNS_HEX_REGEX.test(token)) {
    const cevrilen = await hamTokeniDonustur(token);
    if (cevrilen) token = cevrilen;
  }
  // KAP alarmında "yon" anlamsız — istemci göndermese de kabul ediyoruz.
  if (tip === "kap" && !yon) yon = "yeni";
  // Zekât hatırlatmasında sembol/ad/yon sabit — istemcinin göndermesi gerekmez.
  // Endeks aboneliğinde "yon" anlamsız — istemci göndermese de kabul ediyoruz.
  if (tip === "endeks" && !yon) yon = "degisim";
  if (tip === "zekat") {
    sembol = ZEKAT_SEMBOL;
    ad = ad || "Zekât Günü";
    yon = "tarih";
  }
  if (!token || !sembol || !ad || !tip || !yon) {
    res.status(400).json({ hata: "token, sembol, ad, tip, yon alanları zorunlu" });
    return;
  }

  // ── ZEKÂT HATIRLATMASI ──────────────────────────────────────────────────
  // Fiyat çekilmez, tarih tutulur. Token başına TEK kayıt: aynı token tekrar
  // kurarsa mevcut kayıt güncellenir (kullanıcı gününü değiştirmiş olur).
  if (tip === "zekat") {
    const gg = req.body?.zekatTarihi;
    const ms = zekatTarihMs(gg);
    if (ms == null) {
      res.status(400).json({ hata: "Geçerli bir zekât tarihi gerekli (YYYY-AA-GG)." });
      return;
    }
    // Bugünden en fazla bir kameri yıl ileri olabilir; daha uzağı kullanıcı
    // hatasıdır (yanlış yıl seçimi) ve yıllarca sessiz kalan kayıt üretirdi.
    const bugun = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    if (ms < bugun) {
      res.status(400).json({ hata: "Zekât tarihi geçmiş bir gün olamaz." });
      return;
    }
    if (ms > bugun + (ZEKAT_KAMERI_GUN + 30) * 86400000) {
      res.status(400).json({ hata: "Zekât tarihi en fazla bir yıl sonrası için kurulabilir." });
      return;
    }

    try {
      const { basarili, sonuc } = await kilitliCalistir(
        redis, ALARM_KILIT_ANAHTAR, 15,
        async () => {
          const alarmlar = await alarmlariOku();
          if (alarmlar.length >= MAKS_TOPLAM_ALARM) {
            console.error("KURESEL ALARM TAVANI ASILDI (zekat):", alarmlar.length);
            return { hataKodu: 503, hata: "Sistem şu anda yeni kayıt kabul edemiyor. Lütfen daha sonra tekrar deneyin." };
          }
          const mevcut = alarmlar.find((a) => a.token === token && a.tip === "zekat");
          if (mevcut) {
            const guncel = { ...mevcut, ad, zekatTarihi: gg, aktif: true, kapaliSebep: null, uid: uid || mevcut.uid || null };
            await redis.set(ALARM_KV_ANAHTAR, alarmlar.map((a) => (a.id === mevcut.id ? guncel : a)));
            return { alarm: guncel, guncellendi: true };
          }
          const yeniAlarm = {
            id: randomUUID(),
            token, uid: uid || null, sembol: ZEKAT_SEMBOL, ad,
            tip: "zekat",
            yon: "tarih",
            zekatTarihi: gg,
            hedefFiyat: null,
            yuzde: null,
            baslangicFiyat: null,
            bildirimSayisi: 0,
            olusturulmaTs: Date.now(),
            aktif: true,
            tetiklenmeTs: null,
            tetiklenmeFiyat: null,
          };
          await redis.set(ALARM_KV_ANAHTAR, [...alarmlar, yeniAlarm]);
          return { alarm: yeniAlarm, guncellendi: false };
        },
        { denemeSayisi: 10, bekleMs: 300 }
      );
      if (!basarili) { res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." }); return; }
      if (sonuc?.hataKodu) { res.status(sonuc.hataKodu).json({ hata: sonuc.hata }); return; }
      res.status(200).json({
        basarili: true,
        alarm: sonuc.alarm,
        guncellendi: sonuc.guncellendi,
        not: "Zekât gününde hatırlatma alacaksınız; tarih her yıl bir kameri yıl (354 gün) ileri alınır.",
      });
    } catch (e) {
      res.status(500).json({ hata: "Zekât hatırlatması kurulamadı", detay: e.message });
    }
    return;
  }

  // ── KAP BİLDİRİM ALARMI ─────────────────────────────────────────────────
  // Fiyat çekilmez; bunun yerine o anki EN YENİ bildirim başlangıç noktası
  // olarak kaydedilir. Böylece kullanıcı alarmı kurar kurmaz geçmiş 15 günün
  // bildirimleriyle boğulmaz — yalnızca BUNDAN SONRA gelenler duyurulur.
  if (tip === "kap") {
    if (!sembol.startsWith(BIST_ONEK)) {
      res.status(400).json({ hata: "KAP alarmı yalnızca BİST hisseleri için kurulabilir (sembol 'BIST:' önekli olmalı)" });
      return;
    }
    const kod = sembol.slice(BIST_ONEK.length).toUpperCase();
    const tumListe = await kapTumOku();
    if (!tumListe) {
      res.status(502).json({ hata: "KAP bildirim listesi şu an alınamadı, alarm oluşturulamadı. Lütfen biraz sonra tekrar deneyin." });
      return;
    }
    const bildirimler = kapHisseBildirimleri(tumListe, kod);
    const enYeni = bildirimler[0] || null;

    try {
      const { basarili, sonuc } = await kilitliCalistir(
        redis, ALARM_KILIT_ANAHTAR, 15,
        async () => {
          const alarmlar = await alarmlariOku();
          // KAP alarmları kalıcı olduğu için fiyat alarmlarından AYRI sayılıyor —
          // aksi halde 20 KAP aboneliği fiyat alarmı kurmayı tamamen engellerdi.
          const kapSayisi = alarmlar.filter((a) => a.token === token && a.tip === "kap" && a.aktif).length;
          if (kapSayisi >= MAKS_KAP_ALARM_TOKEN_BASINA) {
            return { hataKodu: 429, hata: `En fazla ${MAKS_KAP_ALARM_TOKEN_BASINA} KAP bildirim aboneliği kurabilirsiniz.` };
          }
          // Küresel tavan — fiyat alarmı yolundakiyle aynı gerekçe.
          if (alarmlar.length >= MAKS_TOPLAM_ALARM) {
            console.error("KURESEL ALARM TAVANI ASILDI (kap):", alarmlar.length);
            return { hataKodu: 503, hata: "Sistem şu anda yeni alarm kabul edemiyor. Lütfen daha sonra tekrar deneyin." };
          }
          const zatenVar = alarmlar.some((a) => a.token === token && a.tip === "kap" && a.sembol === sembol && a.aktif);
          if (zatenVar) return { hataKodu: 409, hata: "Bu hisse için zaten bir KAP bildirim aboneliğiniz var." };

          const yeniAlarm = {
            id: randomUUID(),
            token, uid: uid || null, sembol, ad,
            tip: "kap",
            yon: "yeni",
            hedefFiyat: null,
            yuzde: null,
            baslangicFiyat: null,
            // Başlangıç referansı: bu ikisinden HANGİSİ varsa o kullanılır.
            sonGorulenId: enYeni?.id ?? null,
            sonGorulenTs: enYeni ? kapZaman(enYeni.tarih) : Date.now(),
            bildirimSayisi: 0,
            olusturulmaTs: Date.now(),
            aktif: true,
            tetiklenmeTs: null,
            tetiklenmeFiyat: null,
          };
          await redis.set(ALARM_KV_ANAHTAR, [...alarmlar, yeniAlarm]);
          return { alarm: yeniAlarm };
        },
        { denemeSayisi: 10, bekleMs: 300 }
      );
      if (!basarili) { res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." }); return; }
      if (sonuc?.hataKodu) { res.status(sonuc.hataKodu).json({ hata: sonuc.hata }); return; }
      res.status(200).json({
        basarili: true,
        alarm: sonuc.alarm,
        mevcutBildirimSayisi: bildirimler.length,
        not: "Bundan sonra yayınlanacak yeni bildirimler için uyarılacaksınız.",
      });
    } catch (e) {
      res.status(500).json({ hata: "KAP alarmı oluşturulamadı", detay: e.message });
    }
    return;
  }

  // ── KATILIM ENDEKSİ ABONELİĞİ ───────────────────────────────────────────
  // Fiyat çekilmez; kuruluş anındaki üyelik durumu referans olarak kaydedilir.
  // Sonraki turlarda bu değerle karşılaştırılır, DEĞİŞTİĞİNDE bildirim gider.
  if (tip === "endeks") {
    if (!sembol.startsWith(BIST_ONEK)) {
      res.status(400).json({ hata: "Endeks aboneliği yalnızca BİST hisseleri için kurulabilir (sembol 'BIST:' önekli olmalı)" });
      return;
    }
    const kod = sembol.slice(BIST_ONEK.length).toUpperCase();
    const uyeler = await endeksUyeleriOku();
    if (!uyeler) {
      res.status(502).json({ hata: "Katılım Endeksi listesi şu an alınamadı, abonelik oluşturulamadı. Lütfen biraz sonra tekrar deneyin." });
      return;
    }
    const suAnUye = uyeler.has(kod);

    try {
      const { basarili, sonuc } = await kilitliCalistir(
        redis, ALARM_KILIT_ANAHTAR, 15,
        async () => {
          const alarmlar = await alarmlariOku();
          const endeksSayisi = alarmlar.filter((a) => a.token === token && a.tip === "endeks" && a.aktif).length;
          if (endeksSayisi >= MAKS_ENDEKS_ALARM_TOKEN_BASINA) {
            return { hataKodu: 429, hata: `En fazla ${MAKS_ENDEKS_ALARM_TOKEN_BASINA} endeks aboneliği kurabilirsiniz.` };
          }
          if (alarmlar.length >= MAKS_TOPLAM_ALARM) {
            console.error("KURESEL ALARM TAVANI ASILDI (endeks):", alarmlar.length);
            return { hataKodu: 503, hata: "Sistem şu anda yeni abonelik kabul edemiyor. Lütfen daha sonra tekrar deneyin." };
          }
          const zatenVar = alarmlar.some((a) => a.token === token && a.tip === "endeks" && a.sembol === sembol && a.aktif);
          if (zatenVar) return { hataKodu: 409, hata: "Bu hisse için zaten bir endeks aboneliğiniz var." };

          const yeniAlarm = {
            id: randomUUID(),
            token, uid: uid || null, sembol, ad,
            tip: "endeks",
            yon: "degisim",
            endeksDurum: suAnUye,
            hedefFiyat: null,
            yuzde: null,
            baslangicFiyat: null,
            bildirimSayisi: 0,
            olusturulmaTs: Date.now(),
            aktif: true,
            tetiklenmeTs: null,
            tetiklenmeFiyat: null,
          };
          await redis.set(ALARM_KV_ANAHTAR, [...alarmlar, yeniAlarm]);
          return { alarm: yeniAlarm };
        },
        { denemeSayisi: 10, bekleMs: 300 }
      );
      if (!basarili) { res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." }); return; }
      if (sonuc?.hataKodu) { res.status(sonuc.hataKodu).json({ hata: sonuc.hata }); return; }
      res.status(200).json({
        basarili: true,
        alarm: sonuc.alarm,
        suAnUye,
        not: suAnUye
          ? "Bu hisse şu an Katılım Endeksi'nde. Endeksten çıkarılırsa bildirim alacaksınız."
          : "Bu hisse şu an Katılım Endeksi'nde değil. Endekse eklenirse bildirim alacaksınız.",
      });
    } catch (e) {
      res.status(500).json({ hata: "Endeks aboneliği oluşturulamadı", detay: e.message });
    }
    return;
  }

  // ── BANKA ORANI ALARMI (2026-09-27) — SADECE PRO ─────────────────────────
  // "X bankasının Y oranı Z'yi geçince/altına inince haber ver". Fiyat
  // alarmlarıyla AYNI mantık (tek seferlik eşik, tetiklenince aktif:false)
  // ama veri kaynağı kar-payi.json. uid ZORUNLU ve Pro olmalı — misafir/
  // ücretsiz üye bu alarm tipini hiç kuramaz (403).
  if (tip === "banka_oran") {
    if (!uid) {
      res.status(403).json({ hata: "Banka oranı alarmı için giriş yapmış olman gerekiyor." });
      return;
    }
    const pro = await kullaniciProMu(uid);
    if (!pro) {
      res.status(403).json({ hata: "Banka oranı alarmı Pro üyelere özel. Pro'ya geçerek kullanabilirsin." });
      return;
    }
    const banka = req.body?.banka;
    const urun = req.body?.urun;
    if (!banka || typeof banka !== "string" || !urun || (!KAR_PAYI_ALANLARI.has(urun) && !FINANSMAN_ALANLARI.has(urun))) {
      res.status(400).json({ hata: "Geçerli bir 'banka' ve 'urun' (tl|usd|eur|altin|konut60|konut120|tasit12|tasit24|ihtiyac12|ihtiyac24) gerekli" });
      return;
    }
    if (hedefFiyat == null || isNaN(parseFloat(hedefFiyat))) {
      res.status(400).json({ hata: "Geçerli bir 'hedefFiyat' (hedef oran, %) gerekli" });
      return;
    }
    if (yon !== "ustunde" && yon !== "altinda") {
      res.status(400).json({ hata: "'yon' 'ustunde' ya da 'altinda' olmalı" });
      return;
    }

    const karPayiVeri = await karPayiVerisiGetir();
    const mevcutOran = bankaOraniOku(karPayiVeri, banka, urun);
    if (mevcutOran == null) {
      res.status(502).json({ hata: `${banka} için ${BANKA_URUN_ETIKET[urun] || urun} verisi şu an alınamadı, alarm oluşturulamadı.` });
      return;
    }

    const h = parseFloat(hedefFiyat);
    if (yon === "ustunde" && mevcutOran >= h) {
      res.status(400).json({ hata: `Oran şu an zaten hedefin üstünde (%${mevcutOran} ≥ %${h}). Güncel oranın üstünde bir hedef girin.`, mevcutFiyat: mevcutOran });
      return;
    }
    if (yon === "altinda" && mevcutOran <= h) {
      res.status(400).json({ hata: `Oran şu an zaten hedefin altında (%${mevcutOran} ≤ %${h}). Güncel oranın altında bir hedef girin.`, mevcutFiyat: mevcutOran });
      return;
    }

    const sembol = `${BANKA_ONEK}${banka}|${urun}`;
    const adEtiket = ad || `${banka} — ${BANKA_URUN_ETIKET[urun] || urun}`;

    try {
      const { basarili, sonuc } = await kilitliCalistir(
        redis, ALARM_KILIT_ANAHTAR, 15,
        async () => {
          const alarmlar = await alarmlariOku();
          const sayisi = alarmlar.filter((a) => a.tip === "banka_oran" && a.aktif && (a.uid === uid || a.token === token)).length;
          if (sayisi >= MAKS_BANKA_ORANI_ALARM_TOKEN_BASINA) {
            return { hataKodu: 429, hata: `En fazla ${MAKS_BANKA_ORANI_ALARM_TOKEN_BASINA} aktif banka oranı alarmı kurabilirsiniz.` };
          }
          if (alarmlar.length >= MAKS_TOPLAM_ALARM) {
            console.error("KURESEL ALARM TAVANI ASILDI (banka_oran):", alarmlar.length);
            return { hataKodu: 503, hata: "Sistem şu anda yeni alarm kabul edemiyor. Lütfen daha sonra tekrar deneyin." };
          }
          const yeniAlarm = {
            id: randomUUID(),
            token, uid, sembol, ad: adEtiket,
            tip: "banka_oran",
            yon,
            hedefFiyat: h,
            yuzde: null,
            baslangicFiyat: mevcutOran,
            banka, urun,
            olusturulmaTs: Date.now(),
            aktif: true,
            tetiklenmeTs: null,
            tetiklenmeFiyat: null,
          };
          await redis.set(ALARM_KV_ANAHTAR, [...alarmlar, yeniAlarm]);
          return { alarm: yeniAlarm };
        },
        { denemeSayisi: 10, bekleMs: 300 }
      );
      if (!basarili) { res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." }); return; }
      if (sonuc?.hataKodu) { res.status(sonuc.hataKodu).json({ hata: sonuc.hata }); return; }
      res.status(200).json({ basarili: true, alarm: sonuc.alarm });
    } catch (e) {
      res.status(500).json({ hata: "Banka oranı alarmı oluşturulamadı", detay: e.message });
    }
    return;
  }

  if (tip === "hedef" && (hedefFiyat == null || isNaN(parseFloat(hedefFiyat)))) {
    res.status(400).json({ hata: "tip=hedef için geçerli bir 'hedefFiyat' gerekli" });
    return;
  }
  if (tip === "yuzde" && (yuzde == null || isNaN(parseFloat(yuzde)) || parseFloat(yuzde) <= 0)) {
    res.status(400).json({ hata: "tip=yuzde için pozitif bir 'yuzde' gerekli" });
    return;
  }

  const mevcutFiyat = await alarmFiyatGetir(sembol);
  if (mevcutFiyat == null) {
    res.status(502).json({ hata: "Bu sembol için güncel fiyat alınamadı, alarm oluşturulamadı" });
    return;
  }

  // ── ANINDA TETİKLENECEK ALARMI REDDET (2026-07-30) ──────────────────────
  // Alarm mantığı SEVİYE kontrolü yapıyor ("fiyat ≥ hedef mi?"), oysa
  // kullanıcının beklediği GEÇİŞ ("hedefin altındayken üstüne çıktı mı?").
  // Koşul kuruluş anında zaten sağlanıyorsa alarm ilk kontrol turunda anlamsız
  // biçimde tetikleniyordu — yaşanmış vaka: fiyat 283 iken hem "≥283" hem
  // "≤283" alarmı kuruldu, ikisi de aynı anda ateşledi.
  //
  // Yüzde alarmlarında bu sorun yok: onlar zaten baslangicFiyat'a göre
  // HAREKET ölçüyor, sıfır hareket eşiği geçemez.
  if (tip === "hedef") {
    const h = parseFloat(hedefFiyat);
    const fmt = (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
    if (yon === "ustunde" && mevcutFiyat >= h) {
      res.status(400).json({
        hata: `Fiyat şu an zaten hedefin üstünde (${fmt(mevcutFiyat)} ≥ ${fmt(h)}). Bu alarm anında tetiklenirdi — güncel fiyatın üstünde bir hedef girin.`,
        mevcutFiyat,
      });
      return;
    }
    if (yon === "altinda" && mevcutFiyat <= h) {
      res.status(400).json({
        hata: `Fiyat şu an zaten hedefin altında (${fmt(mevcutFiyat)} ≤ ${fmt(h)}). Bu alarm anında tetiklenirdi — güncel fiyatın altında bir hedef girin.`,
        mevcutFiyat,
      });
      return;
    }
  }

  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis,
      ALARM_KILIT_ANAHTAR,
      15,
      async () => {
        const alarmlar = await alarmlariOku();

        // ── MİSAFİR/ÜCRETSİZ/PRO SINIRI (2026-09-27) ────────────────────────
        // uid varsa hesap SAHİBİNİN TÜM CİHAZLARINDAKİ aktif alarmları sayılır
        // (aksi halde kullanıcı ikinci bir cihazda aynı limiti "yeniden"
        // kullanabilirdi); uid yoksa (misafir) eskisi gibi sadece bu token.
        const { limit: alarmLimiti, tier: alarmTier } = await alarmLimitiVeTierAl(uid);
        const aktifSayisi = alarmlar.filter((a) =>
          a.aktif && (uid ? (a.uid === uid || a.token === token) : a.token === token)
        ).length;
        if (aktifSayisi >= alarmLimiti) {
          const mesaj = alarmTier === "misafir"
            ? `Misafir olarak en fazla ${alarmLimiti} aktif alarm kurabilirsiniz. Daha fazlası için hesap açın.`
            : alarmTier === "ucretsiz"
            ? `Ücretsiz üyelikte en fazla ${alarmLimiti} aktif alarm kurabilirsiniz. Sınırsız alarm için Pro'ya geçin.`
            : `En fazla ${alarmLimiti} aktif alarm kurabilirsiniz. Lütfen önce birkaçını silin.`;
          return { hataKodu: 429, hata: mesaj, tier: alarmTier };
        }

        // KÜRESEL TAVAN (2026-08-02): Token başına sınır, sahte token üreten
        // bir saldırgana karşı işe yaramaz. Alarmların tamamı TEK anahtarda
        // durduğu için dizinin toplam boyu da sınırlanmalı.
        if (alarmlar.length >= MAKS_TOPLAM_ALARM) {
          console.error("KURESEL ALARM TAVANI ASILDI:", alarmlar.length);
          return { hataKodu: 503, hata: "Sistem şu anda yeni alarm kabul edemiyor. Lütfen daha sonra tekrar deneyin." };
        }

        const yeniAlarm = {
          id: randomUUID(),
          token,
          uid: uid || null,
          sembol,
          ad,
          tip, // "hedef" | "yuzde"
          yon, // hedef: "ustunde"|"altinda"  |  yuzde: "artis"|"dusus"
          hedefFiyat: tip === "hedef" ? parseFloat(hedefFiyat) : null,
          yuzde: tip === "yuzde" ? parseFloat(yuzde) : null,
          baslangicFiyat: mevcutFiyat,
          olusturulmaTs: Date.now(),
          aktif: true,
          tetiklenmeTs: null,
          tetiklenmeFiyat: null,
        };

        const yeniListe = [...alarmlar, yeniAlarm];
        await redis.set(ALARM_KV_ANAHTAR, yeniListe);
        return { alarm: yeniAlarm };
      },
      { denemeSayisi: 10, bekleMs: 300 }
    );

    if (!basarili) {
      res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." });
      return;
    }
    if (sonuc?.hataKodu) {
      res.status(sonuc.hataKodu).json({ hata: sonuc.hata });
      return;
    }
    res.status(200).json({ basarili: true, alarm: sonuc.alarm });
  } catch (e) {
    res.status(500).json({ hata: "Alarm oluşturulamadı", detay: e.message });
  }
}

// Kullanıcı GİRİŞ YAPTIĞINDA çağrılır (bkz. FiyatlamaPro.tsx'teki hesap
// senkron effect'i) — bu cihazın token'ına kayıtlı, henüz uid'i olmayan
// TÜM alarmları o hesaba bağlar. TOKEN TASIMA'daki (tokenKaydet) AYNI
// desen: kilit altında oku-değiştir-yaz.
//
//   POST ?islem=alarm-hesaba-bagla { token, uid }
//
// Zaten uid'i OLAN (başka bir hesaba bağlı) alarmlara DOKUNULMAZ — aksi
// halde paylaşılan bir cihazda A hesabıyla kurulmuş bir alarm, B hesabıyla
// girişte sessizce B'ye geçerdi.
async function alarmHesabaBagla(req, res) {
  const { token, uid } = req.body || {};
  if (!token || !uid || typeof uid !== "string") {
    res.status(400).json({ hata: "'token' ve 'uid' alanları zorunlu" });
    return;
  }
  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis, ALARM_KILIT_ANAHTAR, 15,
      async () => {
        const alarmlar = await alarmlariOku();
        let sayi = 0;
        const yeniListe = alarmlar.map((a) => {
          if (a.token === token && !a.uid) { sayi++; return { ...a, uid }; }
          return a;
        });
        if (sayi > 0) await redis.set(ALARM_KV_ANAHTAR, yeniListe);
        return { baglanan: sayi };
      },
      { denemeSayisi: 10, bekleMs: 300 }
    );
    if (!basarili) {
      res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." });
      return;
    }
    res.status(200).json({ basarili: true, baglanan: sonuc.baglanan });
  } catch (e) {
    res.status(500).json({ hata: "Alarmlar hesaba bağlanamadı", detay: e.message });
  }
}

async function alarmListele(req, res) {
  const { token, uid } = req.body || {};
  if (!token) {
    res.status(400).json({ hata: "'token' alanı zorunlu" });
    return;
  }
  const alarmlar = await alarmlariOku();
  // uid verilmişse hesabın TÜM cihazlarındaki alarmlar da listeye girer
  // (bkz. portfoy senkronundaki AYNI "hem token hem uid eşleşsin" deseni).
  const kendiAlarmlarim = alarmlar
    .filter((a) => a.token === token || (uid && a.uid === uid))
    .sort((a, b) => b.olusturulmaTs - a.olusturulmaTs);
  res.status(200).json({ basarili: true, alarmlar: kendiAlarmlarim });
}

async function alarmSil(req, res) {
  const { token, id, uid } = req.body || {};
  if (!token || !id) {
    res.status(400).json({ hata: "'token' ve 'id' alanları zorunlu" });
    return;
  }

  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis,
      ALARM_KILIT_ANAHTAR,
      15,
      async () => {
        const alarmlar = await alarmlariOku();
        // uid eşleşmesi de kabul edilir — listelenen ama BAŞKA bir cihazın
        // token'ına ait bir alarmı (aynı hesap) buradan silebilmek için.
        const yeniListe = alarmlar.filter((a) => !(a.id === id && (a.token === token || (uid && a.uid === uid))));
        const silindi = yeniListe.length !== alarmlar.length;
        if (silindi) await redis.set(ALARM_KV_ANAHTAR, yeniListe);
        return { silindi };
      },
      { denemeSayisi: 10, bekleMs: 300 }
    );
    if (!basarili) {
      res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." });
      return;
    }
    res.status(200).json({ basarili: true, silindi: sonuc.silindi });
  } catch (e) {
    res.status(500).json({ hata: "Alarm silinemedi", detay: e.message });
  }
}

// Tetiklenmis (aktif olmayan) alarmlarin TUMUNU tek istekte siler.
// Yalnizca istegi yapan token'in kendi alarmlarina dokunur.
async function alarmTemizle(req, res) {
  const { token } = req.body || {};
  if (!token) {
    res.status(400).json({ hata: "'token' alanı zorunlu" });
    return;
  }
  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis,
      ALARM_KILIT_ANAHTAR,
      15,
      async () => {
        const alarmlar = await alarmlariOku();
        const yeniListe = alarmlar.filter((a) => !(a.token === token && !a.aktif));
        const silinen = alarmlar.length - yeniListe.length;
        if (silinen > 0) await redis.set(ALARM_KV_ANAHTAR, yeniListe);
        return { silinen };
      },
      { denemeSayisi: 10, bekleMs: 300 }
    );
    if (!basarili) {
      res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." });
      return;
    }
    res.status(200).json({ basarili: true, silinen: sonuc.silinen });
  } catch (e) {
    res.status(500).json({ hata: "Temizlik başarısız", detay: e.message });
  }
}

// Aktif alarmların benzersiz sembolleri için fiyat tablosu üretir.
// BİST sembolleri TEK istekte toplu okunur; diğerleri (Yahoo/AltinAPI)
// eskisi gibi paralel ve tekil çekilir.
async function alarmFiyatTablosu(benzersizSemboller) {
  const fiyatlar = {};
  let bistNot = null;
  let bistMeta = null;

  const bistSemboller = benzersizSemboller.filter((s) => typeof s === "string" && s.startsWith(BIST_ONEK));
  const digerSemboller = benzersizSemboller.filter((s) => !(typeof s === "string" && s.startsWith(BIST_ONEK)));

  const isler = [];

  if (bistSemboller.length > 0) {
    isler.push((async () => {
      const paket = await bistVerisiGetir();
      if (!paket) {
        bistNot = "BIST verisi alinamadi — BIST alarmlari bu turda atlandi";
        return;
      }
      bistMeta = { veriZamani: paket.veriZamani, kaynak: paket.kaynak, okuma: paket.okuma };
      if (bistVerisiBayatMi(paket.veriZamani)) {
        // Bilinçli davranış: bayat fiyatla karar verme. Alarmlar aktif kalır,
        // bir sonraki turda taze veriyle tekrar bakılır.
        bistNot = `BIST verisi bayat (${paket.veriZamani}) — BIST alarmlari bu turda atlandi`;
        return;
      }
      for (const s of bistSemboller) {
        const h = paket.harita.get(s.slice(BIST_ONEK.length).toUpperCase());
        fiyatlar[s] = (h && typeof h.fiyat === "number" && h.fiyat > 0) ? h.fiyat : null;
      }
    })());
  }

  for (const s of digerSemboller) {
    isler.push((async () => { fiyatlar[s] = await alarmFiyatGetir(s); })());
  }

  await Promise.all(isler);
  return { fiyatlar, bistNot, bistMeta };
}

// Bir KAP ABONELİĞİNİ duraklatır ya da yeniden başlatır (2026-07-30).
//
//   POST ?islem=alarm-durum { token, id, aktif: true|false }
//
// NEDEN AYRI BİR UÇ: Abonelik hiç auto-kapanmadığı için kullanıcının silmeden
// susturabileceği bir yol gerekiyordu. Silmek geçmişi de yok ediyor; duraklatmak
// kaydı koruyup bildirimi kesiyor.
//
// ⚠️ YENİDEN BAŞLATIRKEN İMLEÇ SIFIRLANIYOR: Duraklatılmış süre boyunca
// yayınlanan bildirimler "yeni" sayılmıyor — aksi halde 3 hafta duraklatıp
// açan kullanıcı 3 haftalık yığını tek seferde push olarak alırdı.
//
// SADECE tip:"kap" için geçerli. Fiyat alarmlarında tetiklenmiş bir alarmı
// yeniden açmak, eşik hâlâ sağlandığı için anında tekrar tetiklenmesine yol
// açardı — bilinçli olarak reddediliyor.
async function alarmDurum(req, res) {
  const { token, id, aktif, uid } = req.body || {};
  if (!token || !id || typeof aktif !== "boolean") {
    res.status(400).json({ hata: "'token', 'id' ve boolean 'aktif' alanları zorunlu" });
    return;
  }

  // Yeniden başlatma isteniyorsa güncel en yeni bildirimi ÖNCEDEN öğren
  // (kilit içinde ağ isteği yapmamak için).
  let yeniBaslangic = null;
  if (aktif) {
    try {
      const alarmlar = await alarmlariOku();
      const hedef = alarmlar.find((a) => a.id === id && (a.token === token || (uid && a.uid === uid)));
      if (hedef && hedef.tip === "kap") {
        const kod = String(hedef.sembol || "").slice(BIST_ONEK.length).toUpperCase();
        const tumListe = await kapTumOku();
        if (tumListe) {
          const enYeni = kapHisseBildirimleri(tumListe, kod)[0] || null;
          yeniBaslangic = {
            sonGorulenId: enYeni?.id ?? null,
            sonGorulenTs: enYeni ? kapZaman(enYeni.tarih) : Date.now(),
          };
        } else {
          // KAP listesi alınamadıysa en azından "şu andan itibaren" diyelim;
          // id'yi null bırakmak kapDahaYeniMi'yi zaman karşılaştırmasına düşürür.
          yeniBaslangic = { sonGorulenId: null, sonGorulenTs: Date.now() };
        }
      }
    } catch (e) {
      console.error("Abonelik yeniden baslatma hazirligi hatasi:", e.message);
    }
  }

  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis, ALARM_KILIT_ANAHTAR, 15,
      async () => {
        const alarmlar = await alarmlariOku();
        const idx = alarmlar.findIndex((a) => a.id === id && (a.token === token || (uid && a.uid === uid)));
        if (idx < 0) return { hataKodu: 404, hata: "Alarm bulunamadı." };
        const mevcut = alarmlar[idx];
        if (mevcut.tip !== "kap") {
          return { hataKodu: 400, hata: "Bu işlem yalnızca KAP bildirim abonelikleri için geçerli." };
        }
        const guncel = { ...mevcut, aktif };
        if (!aktif) {
          guncel.kapaliSebep = "kullanici";
        } else {
          delete guncel.kapaliSebep;
          if (yeniBaslangic) {
            guncel.sonGorulenId = yeniBaslangic.sonGorulenId;
            guncel.sonGorulenTs = yeniBaslangic.sonGorulenTs;
          }
        }
        const yeniListe = alarmlar.slice();
        yeniListe[idx] = guncel;
        await redis.set(ALARM_KV_ANAHTAR, yeniListe);
        return { alarm: guncel };
      },
      { denemeSayisi: 10, bekleMs: 300 }
    );
    if (!basarili) { res.status(409).json({ hata: "Şu anda başka bir alarm işlemi sürüyor, lütfen tekrar deneyin." }); return; }
    if (sonuc?.hataKodu) { res.status(sonuc.hataKodu).json({ hata: sonuc.hata }); return; }
    res.status(200).json({
      basarili: true,
      alarm: sonuc.alarm,
      not: aktif
        ? "Abonelik yeniden başlatıldı. Yalnızca bundan sonra yayınlanan bildirimler gönderilecek."
        : "Abonelik duraklatıldı. Yeniden başlatana kadar bildirim gönderilmeyecek.",
    });
  } catch (e) {
    res.status(500).json({ hata: "Abonelik durumu değiştirilemedi", detay: e.message });
  }
}

// Dış zamanlayıcının çağırdığı kontrol uç noktası. Tüm AKTİF alarmları
// gruplanmış sembollerle tek seferde fiyatlandırır, koşulu sağlayanlara
// SADECE KENDİ TOKEN'INA push gönderir ve alarmı "aktif:false" yapar.
async function alarmKontrol(req, res) {
  const gelenAnahtarHeader = req.headers["x-admin-key"];
  const gelenAnahtarQuery = req.query?.anahtar;
  const beklenenAnahtar = process.env.ALARM_KONTROL_ANAHTARI || process.env.ADMIN_GIZLI_ANAHTAR;
  if (!beklenenAnahtar || (gelenAnahtarHeader !== beklenenAnahtar && gelenAnahtarQuery !== beklenenAnahtar)) {
    res.status(401).json({ hata: "Yetkisiz istek" });
    return;
  }

  try {
    const { basarili, sonuc } = await kilitliCalistir(
      redis,
      ALARM_KILIT_ANAHTAR,
      60,
      async () => {
        const alarmlar = await alarmlariOku();
        const aktifAlarmlar = alarmlar.filter((a) => a.aktif);

        if (aktifAlarmlar.length === 0) {
          return { kontrolEdilenAlarm: 0, benzersizSembol: 0, tetiklenen: 0, gonderilenBildirim: 0 };
        }

        // Fiyat alarmları, KAP abonelikleri, zekât hatırlatmaları ve banka
        // oranı alarmları ayrı akışlar — sonuncusu HARİÇ hepsinde çekilecek
        // bir Yahoo/AltinAPI/BIST fiyatı yok. Bu tipler fiyatAlarmlar
        // filtresine EKLENMEZSE alarmFiyatTablosu onlar için boşuna fiyat
        // aramaya çalışır ve her turda hata üretir.
        const kapAlarmlar = aktifAlarmlar.filter((a) => a.tip === "kap");
        const fiyatAlarmlar = aktifAlarmlar.filter((a) => a.tip !== "kap" && a.tip !== "zekat" && a.tip !== "endeks" && a.tip !== "banka_oran");

        // Aynı sembolü birden fazla alarm izliyorsa fiyatı TEK kere çekelim.
        const benzersizSemboller = [...new Set(fiyatAlarmlar.map((a) => a.sembol))];
        const { fiyatlar, bistNot, bistMeta } = benzersizSemboller.length
          ? await alarmFiyatTablosu(benzersizSemboller)
          : { fiyatlar: {}, bistNot: null, bistMeta: null };

        // KAP listesi TEK kere okunuyor — kaç abonelik olursa olsun.
        let kapListe = null, kapNot = null;
        if (kapAlarmlar.length > 0) {
          kapListe = await kapTumOku();
          if (!kapListe) kapNot = "KAP listesi alinamadi — KAP alarmlari bu turda atlandi";
        }

        // Endeks üye listesi de TEK kere; 12 saatlik önbellekten geliyor.
        const endeksAlarmlar = aktifAlarmlar.filter((a) => a.tip === "endeks");
        let endeksUyeler = null, endeksNot = null;
        if (endeksAlarmlar.length > 0) {
          endeksUyeler = await endeksUyeleriOku();
          if (!endeksUyeler) endeksNot = "Endeks listesi alinamadi — endeks abonelikleri bu turda atlandi";
        }

        // Banka oranı verisi de TEK kere (10 dk'lık bellek-içi önbellekten).
        const bankaOranAlarmlar = aktifAlarmlar.filter((a) => a.tip === "banka_oran");
        let karPayiVeri = null, bankaOranNot = null;
        if (bankaOranAlarmlar.length > 0) {
          karPayiVeri = await karPayiVerisiGetir();
          if (!karPayiVeri) bankaOranNot = "kar-payi.json alinamadi — banka orani alarmlari bu turda atlandi";
        }

        let tetiklenen = 0;
        let gonderilenBildirim = 0;
        let kapTetiklenen = 0;
        let zekatTetiklenen = 0;
        let endeksTetiklenen = 0;
        let bankaOraniTetiklenen = 0;
        let olenAbonelik = 0;   // token gecersiz oldugu icin kapanan abonelik sayisi
        let gecersizKurulumKapatilan = 0;   // kurulusunda kosulu zaten saglanan (eski) hedef alarmlari
        const gonderimHatalari = [];
        const guncelListe = [];

        for (const alarm of alarmlar) {
          if (!alarm.aktif) {
            guncelListe.push(alarm);
            continue;
          }

          // ── KAP ABONELİĞİ ────────────────────────────────────────────────
          // Fiyat alarmlarından farklı olarak tetiklense de AKTİF KALIR;
          // yalnızca "son görülen" imleci ileri alınır.
          // ── ZEKÂT HATIRLATMASI ───────────────────────────────────────────
          // Tarih tabanlı. Gün geldiğinde (veya geçtiyse) tek bildirim gider,
          // tarih bir kameri yıl ileri alınır ve kayıt AKTİF KALIR.
          //
          // Gecikme toleransı: cron bir gün hiç çalışmazsa tarih geçmiş olur;
          // ">=" karşılaştırması sayesinde bildirim yine de gider (bir gün geç
          // ama gider). Kaçırılan yıl birikmesin diye tarih, bugünün İLERİSİNE
          // düşene kadar ilerletilir.
          if (alarm.tip === "zekat") {
            const hedefMs = zekatTarihMs(alarm.zekatTarihi);
            if (hedefMs == null) {
              // Bozuk kayıt — sessizce kapat, her turda tekrar denenmesin.
              guncelListe.push({ ...alarm, aktif: false, kapaliSebep: "gecersiz-tarih" });
              continue;
            }
            const bugunMs = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
            if (bugunMs < hedefMs) { guncelListe.push(alarm); continue; }

            zekatTetiklenen++;
            const gonderildi = await tekTokeneGonder(
              alarm.token,
              "🌙 Zekât günün geldi",
              "Zekât hesabını güncellemek için Katılım Plus'ı aç. Nisap, güncel altın fiyatına göre yeniden hesaplanacak.",
              { tip: "zekat-hatirlatma", alarmId: alarm.id, ekran: "zekatHesabi" }
            );
            if (gonderildi === true) gonderilenBildirim++;
            else if (gonderildi && gonderildi.hata) {
              gonderimHatalari.push({ alarm: alarm.ad, tokenIlk10: (alarm.token || "").slice(0, 10), hata: gonderildi.hata });
            }

            // Ölü token → aboneliği kapat (KAP aboneliğiyle aynı gerekçe).
            const olduMu = !!(gonderildi && gonderildi.hata &&
              String(gonderildi.hata).includes("registration-token-not-registered"));
            if (olduMu) {
              olenAbonelik++;
              guncelListe.push({ ...alarm, aktif: false, kapaliSebep: "token-gecersiz", tetiklenmeTs: Date.now() });
              continue;
            }

            let sonraki = zekatTarihIlerlet(alarm.zekatTarihi);
            let guvenlik = 0;
            while (sonraki && zekatTarihMs(sonraki) <= bugunMs && guvenlik < 10) {
              sonraki = zekatTarihIlerlet(sonraki);
              guvenlik++;
            }
            guncelListe.push({
              ...alarm,
              zekatTarihi: sonraki || alarm.zekatTarihi,
              bildirimSayisi: (alarm.bildirimSayisi || 0) + 1,
              tetiklenmeTs: Date.now(),
            });
            continue;
          }

          // ── KATILIM ENDEKSİ ABONELİĞİ ────────────────────────────────────
          // Üyelik durumu kayıttakinden FARKLIYSA bildirim gider. Tetiklense
          // de AKTİF KALIR — hisse çıkıp sonra tekrar girerse yine haber
          // verilsin. Liste alınamadıysa kayıt olduğu gibi bırakılır; asla
          // "çıktı" varsayılmaz (yanlış bildirim, hiç bildirimden kötüdür).
          if (alarm.tip === "endeks") {
            if (!endeksUyeler) { guncelListe.push(alarm); continue; }
            const kod = String(alarm.sembol || "").slice(BIST_ONEK.length).toUpperCase();
            const suAnUye = endeksUyeler.has(kod);
            const oncekiDurum = alarm.endeksDurum;
            if (typeof oncekiDurum !== "boolean" || suAnUye === oncekiDurum) {
              // İlk kez görülen bozuk kayıtta durumu sessizce sabitle.
              guncelListe.push(typeof oncekiDurum === "boolean" ? alarm : { ...alarm, endeksDurum: suAnUye });
              continue;
            }

            endeksTetiklenen++;
            const baslik = suAnUye ? `☪ ${alarm.ad} Katılım Endeksi'ne eklendi` : `⚠️ ${alarm.ad} Katılım Endeksi'nden çıkarıldı`;
            const govde = suAnUye
              ? `${alarm.ad} artık Katılım Endeksi kapsamında. Endeks periyodik olarak revize edilir.`
              : `${alarm.ad} artık Katılım Endeksi kapsamında değil. Portföyünüzü gözden geçirmek isteyebilirsiniz.`;
            const gonderildi = await tekTokeneGonder(
              alarm.token, baslik, govde,
              { tip: "endeks-degisimi", sembol: alarm.sembol, alarmId: alarm.id, uye: String(suAnUye) }
            );
            if (gonderildi === true) gonderilenBildirim++;
            else if (gonderildi && gonderildi.hata) {
              gonderimHatalari.push({ alarm: alarm.ad, tokenIlk10: (alarm.token || "").slice(0, 10), hata: gonderildi.hata });
            }

            const olduMu = !!(gonderildi && gonderildi.hata &&
              String(gonderildi.hata).includes("registration-token-not-registered"));
            if (olduMu) {
              olenAbonelik++;
              guncelListe.push({ ...alarm, aktif: false, kapaliSebep: "token-gecersiz", tetiklenmeTs: Date.now() });
              continue;
            }
            // Durum GÖNDERİM SONUCUNDAN BAĞIMSIZ güncelleniyor: gönderim
            // başarısızsa bile eski durumda bırakılırsa her turda tekrar
            // tekrar denenir ve kullanıcı sonunda üst üste bildirim alır.
            guncelListe.push({
              ...alarm,
              endeksDurum: suAnUye,
              bildirimSayisi: (alarm.bildirimSayisi || 0) + 1,
              tetiklenmeTs: Date.now(),
            });
            continue;
          }

          if (alarm.tip === "kap") {
            if (!kapListe) { guncelListe.push(alarm); continue; }
            const kod = String(alarm.sembol || "").slice(BIST_ONEK.length).toUpperCase();
            const hepsi = kapHisseBildirimleri(kapListe, kod);
            const yeniler = hepsi.filter((k) => kapDahaYeniMi(k, alarm.sonGorulenId, alarm.sonGorulenTs));
            if (yeniler.length === 0) { guncelListe.push(alarm); continue; }

            const enYeni = yeniler[0];
            const duyurulan = Math.min(yeniler.length, KAP_TUR_BASINA_MAKS_BILDIRIM);
            const baslikMetni = String(enYeni.baslik || enYeni.ozet || "Yeni bildirim").slice(0, 90);
            const govde = yeniler.length > 1
              ? `${yeniler.length} yeni bildirim. En yenisi: ${baslikMetni}`
              : baslikMetni;

            kapTetiklenen++;
            const gonderildi = await tekTokeneGonder(
              alarm.token, `📄 KAP: ${alarm.ad}`, govde,
              { tip: "kap-bildirimi", sembol: alarm.sembol, alarmId: alarm.id, kapId: String(enYeni.id || ""), link: enYeni.link || "" }
            );
            if (gonderildi === true) gonderilenBildirim++;
            else if (gonderildi && gonderildi.hata) {
              gonderimHatalari.push({ alarm: alarm.ad, tokenIlk10: (alarm.token||"").slice(0,10), hata: gonderildi.hata });
            }

            // ── ÖLÜ TOKEN → ABONELİĞİ KAPAT (2026-07-30) ───────────────────
            // Kullanıcı bildirimleri kapattıysa / uygulamayı sildiyse FCM
            // "registration-token-not-registered" döner. Fiyat alarmları
            // tetiklenince zaten kapandığı için kendini sınırlıyor, ama
            // ABONELİK süresiz — sonsuza kadar ölü token'a göndermeyi
            // denerdi. Artık kendini kapatıyor: kullanıcı bildirimi
            // kapattığında bu abonelik de sessizce sona eriyor.
            const olduMu = !!(gonderildi && gonderildi.hata &&
              String(gonderildi.hata).includes("registration-token-not-registered"));
            if (olduMu) {
              olenAbonelik++;
              guncelListe.push({ ...alarm, aktif: false, kapaliSebep: "token-gecersiz", tetiklenmeTs: Date.now() });
              continue;
            }
            // İmleç EN YENİYE alınıyor — duyurulmayanlar da "görülmüş" sayılır,
            // aksi halde aynı yığın her turda tekrar tekrar bildirilirdi.
            guncelListe.push({
              ...alarm,
              sonGorulenId: enYeni.id ?? alarm.sonGorulenId,
              sonGorulenTs: kapZaman(enYeni.tarih) || Date.now(),
              bildirimSayisi: (alarm.bildirimSayisi || 0) + duyurulan,
              tetiklenmeTs: Date.now(),
            });
            continue;
          }

          // ── BANKA ORANI ALARMI ───────────────────────────────────────────
          // Fiyat alarmlarıyla AYNI "geçiş" mantığı (tek seferlik, tetiklenince
          // aktif:false) ama veri kar-payi.json'dan geliyor. Veri o turda hiç
          // alınamadıysa alarm dokunulmadan bırakılır — bir sonraki turda
          // tekrar denenir.
          if (alarm.tip === "banka_oran") {
            if (!karPayiVeri) { guncelListe.push(alarm); continue; }
            const guncelOran = bankaOraniOku(karPayiVeri, alarm.banka, alarm.urun);
            if (guncelOran == null) { guncelListe.push(alarm); continue; }

            let tetiklendiMi = false, mesaj = "";
            if (alarm.yon === "ustunde" && guncelOran >= alarm.hedefFiyat) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} hedefinize ulaştı/geçti: %${guncelOran} (hedef: %${alarm.hedefFiyat})`;
            } else if (alarm.yon === "altinda" && guncelOran <= alarm.hedefFiyat) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} hedefinizin altına indi: %${guncelOran} (hedef: %${alarm.hedefFiyat})`;
            }

            if (!tetiklendiMi) { guncelListe.push(alarm); continue; }

            bankaOraniTetiklenen++;
            const gonderildi = await tekTokeneGonder(alarm.token, `🏦 Banka Oranı: ${alarm.ad}`, mesaj, {
              tip: "banka-orani-alarmi", banka: alarm.banka, urun: alarm.urun, alarmId: alarm.id,
            });
            if (gonderildi === true) gonderilenBildirim++;
            else if (gonderildi && gonderildi.hata) {
              gonderimHatalari.push({ alarm: alarm.ad, tokenIlk10: (alarm.token || "").slice(0, 10), hata: gonderildi.hata });
            }
            const olduMu = !!(gonderildi && gonderildi.hata &&
              String(gonderildi.hata).includes("registration-token-not-registered"));
            if (olduMu) {
              olenAbonelik++;
              guncelListe.push({ ...alarm, aktif: false, kapaliSebep: "token-gecersiz", tetiklenmeTs: Date.now() });
              continue;
            }
            guncelListe.push({ ...alarm, aktif: false, tetiklenmeTs: Date.now(), tetiklenmeFiyat: guncelOran });
            continue;
          }

          const guncelFiyat = fiyatlar[alarm.sembol];
          if (guncelFiyat == null) {
            guncelListe.push(alarm); // fiyat alınamadıysa bir sonraki kontrole bırak
            continue;
          }

          let tetiklendiMi = false;
          let mesaj = "";
          if (alarm.tip === "hedef") {
            // GEÇİŞ KORUMASI (2026-07-30): Kuruluş anında koşul ZATEN sağlanan
            // alarmlar artık alarmEkle'de reddediliyor. Burası ikinci savunma
            // hattı — düzeltmeden önce oluşturulmuş kayıtlar ve fiyatın bayat
            // geldiği kenar durumlar için. Böyle bir kayıt tetiklenmez,
            // sessizce kapatılır ki her turda tekrar tekrar denenmesin.
            const bas = alarm.baslangicFiyat;
            const gecersizKurulum = bas != null && (
              (alarm.yon === "ustunde" && bas >= alarm.hedefFiyat) ||
              (alarm.yon === "altinda" && bas <= alarm.hedefFiyat)
            );
            if (gecersizKurulum) {
              gecersizKurulumKapatilan++;
              guncelListe.push({ ...alarm, aktif: false, kapaliSebep: "gecersiz-kurulum", tetiklenmeTs: Date.now() });
              continue;
            }
            if (alarm.yon === "ustunde" && guncelFiyat >= alarm.hedefFiyat) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} fiyatı hedefinize ulaştı/geçti: ${guncelFiyat.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} (hedef: ${alarm.hedefFiyat})`;
            } else if (alarm.yon === "altinda" && guncelFiyat <= alarm.hedefFiyat) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} fiyatı hedefinizin altına indi: ${guncelFiyat.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} (hedef: ${alarm.hedefFiyat})`;
            }
          } else if (alarm.tip === "yuzde" && alarm.baslangicFiyat) {
            const degisimYuzde = ((guncelFiyat - alarm.baslangicFiyat) / alarm.baslangicFiyat) * 100;
            if (alarm.yon === "artis" && degisimYuzde >= alarm.yuzde) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} %${degisimYuzde.toFixed(2)} yükseldi (alarm eşiği: %${alarm.yuzde})`;
            } else if (alarm.yon === "dusus" && degisimYuzde <= -alarm.yuzde) {
              tetiklendiMi = true;
              mesaj = `${alarm.ad} %${Math.abs(degisimYuzde).toFixed(2)} düştü (alarm eşiği: %${alarm.yuzde})`;
            }
          }

          if (tetiklendiMi) {
            tetiklenen++;
            // BİST fiyatları ~15 dk gecikmeli — bildirimde açıkça belirtiliyor
            // ki kullanıcı "fiyat değdi ama bildirim geç geldi" diye düşünmesin.
            const govde = alarm.sembol.startsWith(BIST_ONEK)
              ? `${mesaj} · BİST verisi ~15 dk gecikmelidir`
              : mesaj;
            const gonderildi = await tekTokeneGonder(alarm.token, `🔔 Fiyat Alarmı: ${alarm.ad}`, govde, {
              tip: "fiyat-alarmi",
              sembol: alarm.sembol,
              alarmId: alarm.id,
            });
            if (gonderildi === true) gonderilenBildirim++;
            else if (gonderildi && gonderildi.hata) {
              gonderimHatalari.push({ alarm: alarm.ad, tokenIlk10: (alarm.token||"").slice(0,10), hata: gonderildi.hata });
            }
            guncelListe.push({ ...alarm, aktif: false, tetiklenmeTs: Date.now(), tetiklenmeFiyat: guncelFiyat });
          } else {
            guncelListe.push(alarm);
          }
        }

        await redis.set(ALARM_KV_ANAHTAR, guncelListe);
        return {
          kontrolEdilenAlarm: aktifAlarmlar.length,
          fiyatAlarmi: fiyatAlarmlar.length,
          kapAlarmi: kapAlarmlar.length,
          benzersizSembol: benzersizSemboller.length,
          tetiklenen,
          kapTetiklenen,
          zekatTetiklenen,
          endeksAlarmi: endeksAlarmlar.length,
          endeksTetiklenen,
          bankaOraniAlarmi: bankaOranAlarmlar.length,
          bankaOraniTetiklenen,
          olenAbonelik,
          gecersizKurulumKapatilan,
          gonderilenBildirim,
          gonderimHatalari,
          bistSeansAcik: bistSeansAcikMi(),
          ...(kapListe ? { kapKayitSayisi: kapListe.length } : {}),
          ...(bistMeta ? { bistMeta } : {}),
          ...(bistNot ? { bistNot } : {}),
          ...(kapNot ? { kapNot } : {}),
          ...(endeksNot ? { endeksNot } : {}),
          ...(bankaOranNot ? { bankaOranNot } : {}),
        };
      },
      { denemeSayisi: 3, bekleMs: 1000 }
    );

    if (!basarili) {
      res.status(409).json({ hata: "Önceki kontrol hâlâ sürüyor, bu çağrı atlandı." });
      return;
    }
    res.status(200).json({ basarili: true, ...sonuc });
  } catch (e) {
    console.error("alarm-kontrol hatası:", e);
    res.status(500).json({ hata: "Alarm kontrolü başarısız", detay: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REVENUECAT WEBHOOK (2026-09-27)
// ═══════════════════════════════════════════════════════════════════════════
// SORUN: Gerçek satın almalar yalnızca RevenueCat'te duruyordu; web/masaüstü
// ve bu dosyadaki sunucu kontrolleri yalnızca Firestore'daki pro/{uid}'ye
// bakıyor. Sonuç: iPhone'dan Pro alan biri masaüstünde "ücretsiz" görünüyor,
// alarm sınırı ve banka oranı alarmı da onu Pro saymıyordu.
//
// ÇÖZÜM: RevenueCat her abonelik olayında bu uca POST atar; biz de pro/{uid}
// kaydını güncelleriz. app_user_id = Firebase uid'i (istemci Purchases.logIn
// ile eşliyor). Kimlik doğrulama: RevenueCat panelindeki "Authorization
// header value" alanına yazılan değer = REVENUECAT_WEBHOOK_SECRET.
//
// KURALLAR
//  • Aktiflik = bitiş zamanı gelecekteyse (iptal edilse bile dönem sonuna
//    kadar Pro sürer); EXPIRATION olayı kesin olarak pasife çeker.
//  • Elle verilmiş Pro (kaynak:"manuel", beta testi) RevenueCat'in süre
//    dolumuyla SİLİNMEZ — aksi halde beta kullanıcıları sessizce düşerdi.
//  • Sıra dışı gelen ESKİ olaylar yok sayılır (sonOlayTs karşılaştırması).
//  • Hesapsız (anonim "$RCAnonymousID:") alıcılar için alias'lardaki gerçek
//    uid aranır; yoksa olay yok sayılır (200 döner, tekrar denenmesin).
//  • İşleme hatasında 500 döner — RevenueCat otomatik yeniden dener.
const REVENUECAT_ENTITLEMENT = "katılım_plus_pro";
const RC_ISLENEN_TIPLER = new Set([
  "INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION",
  "NON_RENEWING_PURCHASE", "CANCELLATION", "BILLING_ISSUE", "EXPIRATION",
  "SUBSCRIPTION_EXTENDED", "SUBSCRIPTION_PAUSED",
]);

function rcGuvenliEsitMi(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Firebase uid'i biçimi (doküman yoluna sızmasın: "/" vb. kabul edilmez).
function rcGecerliUid(id) {
  return typeof id === "string" && !id.startsWith("$RCAnonymousID") && /^[A-Za-z0-9_-]{6,128}$/.test(id);
}

async function revenueCatProKaydiGuncelle(uid, { aktif, bitisMs, urun, tip, olayTs, kesinPasif }) {
  const ref = admin.firestore().collection("pro").doc(uid);
  const snap = await ref.get();
  const mevcut = snap.exists ? (snap.data() || {}) : null;

  if (mevcut && Number(mevcut.sonOlayTs) > olayTs) return { uid, atlandi: "eski-olay" };
  if (!aktif && mevcut && mevcut.kaynak === "manuel" && mevcut.aktif === true) {
    return { uid, atlandi: "manuel-pro-korundu" };
  }
  await ref.set({
    aktif,
    bitisTarihi: bitisMs ? new Date(bitisMs).toISOString() : null,
    kaynak: "revenuecat",
    urun: urun || null,
    sonOlay: tip,
    sonOlayTs: olayTs,
    guncelleme: new Date().toISOString(),
  }, { merge: true });
  return { uid, aktif };
}

async function revenueCatWebhook(req, res) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const gelen = req.headers["authorization"] || "";
  if (!secret || !(rcGuvenliEsitMi(gelen, secret) || rcGuvenliEsitMi(gelen, `Bearer ${secret}`))) {
    res.status(401).json({ hata: "Yetkisiz istek" });
    return;
  }

  const olay = req.body?.event;
  if (!olay || typeof olay.type !== "string") {
    res.status(400).json({ hata: "Geçersiz webhook gövdesi" });
    return;
  }
  if (olay.type === "TEST") {
    res.status(200).json({ basarili: true, not: "test olayi alindi" });
    return;
  }

  // Bizim entitlement'ımız dışındaki olaylar (varsa) yok sayılır.
  const ent = Array.isArray(olay.entitlement_ids) ? olay.entitlement_ids
    : (olay.entitlement_id ? [olay.entitlement_id] : []);
  if (ent.length > 0 && !ent.includes(REVENUECAT_ENTITLEMENT)) {
    res.status(200).json({ basarili: true, atlandi: "baska-entitlement" });
    return;
  }

  const olayTs = Number(olay.event_timestamp_ms) || Date.now();

  try {
    // ── TRANSFER: abonelik bir kullanıcıdan diğerine geçti ────────────────
    if (olay.type === "TRANSFER") {
      const sonuclar = [];
      for (const uid of (olay.transferred_from || []).filter(rcGecerliUid)) {
        sonuclar.push(await revenueCatProKaydiGuncelle(uid, { aktif: false, bitisMs: null, urun: null, tip: "TRANSFER_FROM", olayTs }));
      }
      for (const uid of (olay.transferred_to || []).filter(rcGecerliUid)) {
        // Bitiş bilinmiyor — sonraki EXPIRATION/RENEWAL olayı bunu düzeltir.
        sonuclar.push(await revenueCatProKaydiGuncelle(uid, { aktif: true, bitisMs: null, urun: null, tip: "TRANSFER_TO", olayTs }));
      }
      res.status(200).json({ basarili: true, sonuclar });
      return;
    }

    if (!RC_ISLENEN_TIPLER.has(olay.type)) {
      res.status(200).json({ basarili: true, atlandi: "ilgisiz-tip", tip: olay.type });
      return;
    }

    // Alıcının gerçek (Firebase) uid'i: önce app_user_id, anonimse alias'lar.
    const adaylar = [olay.app_user_id, ...(Array.isArray(olay.aliases) ? olay.aliases : []), olay.original_app_user_id];
    const uid = adaylar.find(rcGecerliUid);
    if (!uid) {
      res.status(200).json({ basarili: true, atlandi: "hesapsiz-alici" });
      return;
    }

    const bitisMs = olay.expiration_at_ms ? Number(olay.expiration_at_ms) : null;
    const kesinPasif = olay.type === "EXPIRATION";
    const aktif = kesinPasif ? false : (bitisMs ? bitisMs > Date.now() : true);
    const sonuc = await revenueCatProKaydiGuncelle(uid, { aktif, bitisMs, urun: olay.product_id, tip: olay.type, olayTs, kesinPasif });
    res.status(200).json({ basarili: true, ...sonuc });
  } catch (e) {
    console.error("revenuecat-webhook hatasi:", e);
    res.status(500).json({ hata: "Webhook islenemedi", detay: e.message });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const islem = req.query?.islem;

  // ── HIZ SINIRI ─────────────────────────────────────────────────────────
  // "gonder", "alarm-kontrol" ve "revenuecat-webhook" MUAF: üçü de gizli anahtarla korunuyor
  // (webhook: RevenueCat sunucularından gelir, olay yoğunluğu IP başına sınırlanmamalı) —
  // eski not: "gonder" ve "alarm-kontrol" MUAF: ikisi de admin anahtarıyla korunuyor
  // ve alarm-kontrol dış zamanlayıcıdan hep AYNI IP ile geliyor. Sınıra
  // dahil edilirlerse meşru cron turu engellenebilirdi.
  //
  // Geri kalan uçlar (kaydet, alarm-ekle/sil/listele/durum/temizle,
  // duyurular) kimlik doğrulamasız olduğu için sınıra tabi.
  if (islem !== "gonder" && islem !== "alarm-kontrol" && islem !== "revenuecat-webhook") {
    if (await hizSiniriAsildiMi(req)) {
      res.setHeader("Retry-After", String(HIZ_SINIRI_PENCERE));
      res.setHeader("Cache-Control", "no-store");
      res.status(429).json({
        hata: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.",
        limit: `${HIZ_SINIRI_ADET}/${HIZ_SINIRI_PENCERE}sn`,
      });
      return;
    }
  }

  // alarm-kontrol dış zamanlayıcılardan GET olarak da çağrılabilmeli (bazı
  // ücretsiz servisler yalnızca GET destekler) — diğer tüm işlemler POST ister.
  if (islem === "alarm-kontrol") {
    try {
      await alarmKontrol(req, res);
    } catch (e) {
      console.error("bildirim.js hatası:", e);
      res.status(500).json({ hata: "Sunucu hatası oluştu", detay: String(e) });
    }
    return;
  }

  // Duyuru listesi GET ile de çağrılabilmeli — uygulama açılışta basit bir
  // fetch atıyor ve okuma işlemi için POST zorunluluğu gereksiz. (İlk sürümde
  // bu blok POST kontrolünün ARKASINDA kalmıştı ve açılış isteği 405 alıyordu;
  // testte yakalandı.)
  if (islem === "duyurular") {
    try {
      await duyurulariListele(req, res);
    } catch (e) {
      console.error("bildirim.js duyuru hatası:", e);
      res.status(200).json({ basarili: false, duyurular: [] });
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ hata: "Sadece POST kabul edilir" });
    return;
  }

  try {
    if (islem === "kaydet") {
      await tokenKaydet(req, res);
    } else if (islem === "gonder") {
      await bildirimGonder(req, res);
    } else if (islem === "alarm-ekle") {
      await alarmEkle(req, res);
    } else if (islem === "alarm-listele") {
      await alarmListele(req, res);
    } else if (islem === "alarm-sil") {
      await alarmSil(req, res);
    } else if (islem === "alarm-temizle") {
      await alarmTemizle(req, res);
    } else if (islem === "alarm-durum") {
      await alarmDurum(req, res);
    } else if (islem === "alarm-hesaba-bagla") {
      await alarmHesabaBagla(req, res);
    } else if (islem === "haber-bildirim-ayarla") {
      await haberBildirimAyarla(req, res);
    } else if (islem === "haber-bildirim-gonder") {
      await haberBildirimGonder(req, res);
    } else if (islem === "revenuecat-webhook") {
      await revenueCatWebhook(req, res);
    } else {
      res.status(400).json({ hata: "Geçersiz 'islem'." });
    }
  } catch (e) {
    console.error("bildirim.js hatası:", e);
    res.status(500).json({ hata: "Sunucu hatası oluştu", detay: String(e) });
  }
}
