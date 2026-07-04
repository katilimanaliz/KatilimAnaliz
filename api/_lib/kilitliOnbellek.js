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
//   3. Kilidi ALAMAYAN diğer tüm istekler kısa aralıklarla (400ms) önbelleği tekrar
//      kontrol eder — kilit sahibi bitirince onlar da taze veriyi Redis'ten okur,
//      kendileri dış API'ye HİÇ gitmez.
//   4. Güvenlik payı: kilit sahibi çökerse/çok yavaş kalırsa (2 saniyeden fazla),
//      bekleyenler sonsuza kadar beklemez — kendileri de veri çekmeye geçer.
export async function kilitliGetir(redis, anahtar, ttlSaniye, veriCekFn, { debug = false } = {}) {
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
  //    20sn'lik kendi kendine düşen bir süre var (kilit sahibi çökerse sonsuza dek asılı kalmasın).
  const kilitAnahtari = `lock:${anahtar}`;
  let kilitAlindi = false;
  try {
    const sonuc = await redis.set(kilitAnahtari, "1", { nx: true, ex: 20 });
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

  // 3) Kilit başkasında — kısa aralıklarla önbelleği tekrar dene (en fazla ~2 saniye).
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const onbellek = await redis.get(anahtar);
      if (onbellek) return { veri: onbellek, cached: true };
    } catch {}
  }

  // 4) Hâlâ yoksa (kilit sahibi çok yavaş/çökmüş olabilir) — kimseyi bekletmeden
  //    kendimiz de veri çekelim. Nadir bir durum, ama asla sonsuza kadar asılı kalınmaz.
  const veri = await veriCekFn();
  try { await redis.set(anahtar, veri, { ex: ttlSaniye }); } catch {}
  return { veri, cached: false };
}
