// api/_lib/kilitliOnbellek.js
// ─── KALABALIK HÜCUMU (THUNDERING HERD) ÖNLEYİCİ ───────────────────────────
// Sorun: Önbellek süresi tam dolduğu anda, YÜZLERCE/BİNLERCE eşzamanlı kullanıcı
// isteği "önbellek boş" görüp AYNI ANDA dış API'ye (Yahoo Finance, CoinGecko, EVDS
// vb.) gidebilir. Redis'in kendisi bunu engellemez — sadece "veri var mı" sorusuna
// cevap verir, "birden fazla kişi aynı anda tazeleme yapmasın" garantisi vermez.
//
// Çözüm: Dağıtık kilit (distributed lock). Önbellek boşsa:
//   1. Sadece BİR istek "kilidi" alabilir (Redis'in atomik SET NX özelliğiyle).
//   2. Kilidi alan istek dış API'ye gidip veriyi tazeler, önbelleğe yazar, kilidi bırakır.
//   3. Kilidi ALAMAYAN diğer tüm istekler kısa aralıklarla önbelleği tekrar
//      kontrol eder — kilit sahibi bitirince onlar da taze veriyi Redis'ten okur,
//      kendileri dış API'ye HİÇ gitmez.
//   4. Güvenlik payı: kilit sahibi çökerse/çok yavaş kalırsa, bekleyenler sonsuza
//      kadar beklemez — davranış `pesEtmeDavranisi` ile seçilir (aşağıya bkz).
//
// SÜRELER ARTIK PARAMETRİK (2026-07 güncellendi): İlk sürümde kilit TTL'i
// (20sn) ve bekleme süresi (~2sn) sabitti. Bu, saniyeler içinde biten dış API
// çağrıları (Yahoo Finance, CoinGecko) için doğruydu, ama örneğin Fonoloji'den
// tam liste çekmek gibi 75-90sn süren işler için YANLIŞ: kilit süresi dolarsa
// ikinci bir eşzamanlı çekim başlayabilir, ya da bekleyenler ~2sn sonra pes edip
// kendileri de aynı ağır işlemi tetikleyebilir — tam önlemeye çalıştığımız şeyin
// kendisi. Bu yüzden `kilitTtlSaniye`, `denemeSayisi`, `bekleMs` artık her
// çağıran kendi işleminin gerçek süresine göre ayarlayabildiği parametreler.
export async function kilitliGetir(redis, anahtar, ttlSaniye, veriCekFn, opts = {}) {
  const {
    debug = false,
    kilitTtlSaniye = 20,       // Kilidin kendiliğinden düşme süresi — veriCekFn'in
                                 // olağan sürenizden UZUN olmalı (çökme durumunda sonsuza
                                 // kadar kilitli kalmasın diye), ama gereksiz kısa da olmamalı.
    denemeSayisi = 5,           // Kilit başkasındaysa önbelleği kaç kez tekrar deneyelim
    bekleMs = 400,              // Denemeler arası bekleme (ms)
    pesEtmeDavranisi = "kendinCek", // Tüm denemeler bitip önbellek hâlâ boşsa ne yapılsın:
                                      //  "kendinCek": kendin de veriCekFn'i çalıştır (varsayılan,
                                      //     saniyeler içinde biten hafif işler için uygun)
                                      //  "vazgec": null dön, ağır/tekrar tetiklenmemesi gereken
                                      //     işler için (çağıran kendi "veri yok" cevabını verir)
  } = opts;

  // debug=1 ile test edilirken önbelleği/kilidi tamamen atla — taze veri garantili gelsin.
  if (debug) {
    const veri = await veriCekFn();
    try { await redis.set(anahtar, veri, { ex: ttlSaniye }); } catch {}
    return { veri, cached: false };
  }

  // 1) Önbellekte var mı? (en yaygın durum, hızlı çıkış)
  try {
    const onbellek = await redis.get(anahtar);
    if (onbellek) return { veri: onbellek, cached: true };
  } catch {} // Redis'e ulaşılamazsa aşağıda doğrudan veri çekmeye düşer

  // 2) Kilit almayı dene — sadece kilit YOKSA başarılı olur (atomik NX).
  const kilitAnahtari = `lock:${anahtar}`;
  let kilitAlindi = false;
  try {
    const sonuc = await redis.set(kilitAnahtari, "1", { nx: true, ex: kilitTtlSaniye });
    kilitAlindi = sonuc === "OK" || sonuc === true;
  } catch {}

  if (kilitAlindi) {
    // Biz sorumluyuz — taze veriyi çek, önbelleğe yaz, kilidi bırak.
    try {
      const veri = await veriCekFn();
      try { await redis.set(anahtar, veri, { ex: ttlSaniye }); } catch {}
      try { await redis.del(kilitAnahtari); } catch {}
      return { veri, cached: false };
    } catch (e) {
      try { await redis.del(kilitAnahtari); } catch {}
      throw e;
    }
  }

  // 3) Kilit başkasında — kısa aralıklarla önbelleği tekrar dene.
  for (let i = 0; i < denemeSayisi; i++) {
    await new Promise(r => setTimeout(r, bekleMs));
    try {
      const onbellek = await redis.get(anahtar);
      if (onbellek) return { veri: onbellek, cached: true };
    } catch {}
  }

  // 4) Hâlâ yoksa (kilit sahibi çok yavaş/çökmüş olabilir).
  if (pesEtmeDavranisi === "vazgec") {
    return { veri: null, cached: false, kilitBasarisiz: true };
  }
  const veri = await veriCekFn();
  try { await redis.set(anahtar, veri, { ex: ttlSaniye }); } catch {}
  return { veri, cached: false };
}

// ─── KARŞILIKLI DIŞLAMA (MUTUAL EXCLUSION) ─────────────────────────────────
// kilitliGetir "önbellek boşsa doldur" modelini varsayar — önbellek doluysa iş
// hiç çalıştırılmaz. Bazı işler bunu istemez: örneğin bir KV kaydını
// oku-değiştir-yaz şeklinde güncellemek (cron ile veri yazmak gibi) HER
// çağrıda çalışmalı, ama aynı anda yalnızca BİR tanesi çalışmalı — ikinci bir
// eşzamanlı çağrı aynı `eski` değeri okuyup birbirinin yazdığını ezmemeli
// (lost update). kilitliCalistir tam bunun için: kilidi almayı dener (isteğe
// bağlı birkaç kez, aralıklarla), alırsa işlevi çalıştırıp kilidi bırakır,
// alamazsa {basarili:false} döner — çağıran bu durumda ne yapacağına kendi
// karar verir (örn. 409 dönüp bir sonraki tetiklemeye bırakmak gibi).
export async function kilitliCalistir(redis, kilitAnahtari, ttlSaniye, islevFn, opts = {}) {
  const { denemeSayisi = 1, bekleMs = 500 } = opts;

  let kilitAlindi = false;
  for (let i = 0; i < denemeSayisi; i++) {
    try {
      const sonuc = await redis.set(kilitAnahtari, "1", { nx: true, ex: ttlSaniye });
      kilitAlindi = sonuc === "OK" || sonuc === true;
    } catch {}
    if (kilitAlindi) break;
    if (i < denemeSayisi - 1) await new Promise(r => setTimeout(r, bekleMs));
  }

  if (!kilitAlindi) return { basarili: false };

  try {
    const sonuc = await islevFn();
    return { basarili: true, sonuc };
  } finally {
    try { await redis.del(kilitAnahtari); } catch {}
  }
}
