// _lib/haberBildirimi.js (2026-09-27)
//
// Haber bildirimi GÖNDERME mantığının TEK kopyası. İki yerden çağrılıyor:
//   1) api/bildirim.js → ?islem=haber-bildirim-gonder (ADMIN, elle tetikleme)
//   2) api/finans-haberleri.js → taze() içinde, gerçekten yeni bir başlık
//      tespit edildiğinde OTOMATİK tetikleme
// Önceden bu mantık SADECE api/bildirim.js'in içindeydi; iki yerden aynı
// işi yapması gerekince (admin/elle VE otomatik) tek dosyaya çıkarıldı —
// aksi halde iki kopya birbirinden sessizce sapardı (bkz. dosyanın diğer
// yerlerindeki "AYNI mantık, tek dosyada" gerekçeleriyle aynı prensip).
//
// admin.messaging() Firebase Admin SDK örneğini DIŞARIDAN alıyor (parametre
// olarak) — bu dosya kendi firebaseAdmin importunu YAPMIYOR, çünkü hem
// api/bildirim.js hem api/finans-haberleri.js kendi admin örneklerini zaten
// import ediyor olacak; tek bir admin örneği paylaşmak yerine çağıranın
// kendi örneğini geçmesi, dairesel import riskini de ortadan kaldırıyor.
const HABER_BILDIRIM_TOKENS_KEY = "haberBildirimTokens";
const HABER_BILDIRIM_KATEGORI_PREFIX = "haberBildirimKategori:";

// { redis, admin, baslik, govde, kategori?, veri? } → gönderim özeti.
// kategori verilmemişse (ya da null/undefined) TÜM abonelere gider —
// kategori seçmiş bir kullanıcı da dahil (bkz. api/bildirim.js'deki
// "HABER BİLDİRİMLERİ" bölümündeki gerekçe: bu davranış BİLİNÇLİ, genel/
// önemli duyurular kategori filtresinden muaf).
async function haberleriGonder({ redis, admin, baslik, govde, kategori, veri }) {
  if (!baslik || !govde) {
    return { basarili: false, hata: "'baslik' ve 'govde' zorunlu" };
  }

  const tokenlar = await redis.smembers(HABER_BILDIRIM_TOKENS_KEY);
  if (!tokenlar || tokenlar.length === 0) {
    return { basarili: true, gonderilen: 0, mesaj: "Kayıtlı haber bildirimi abonesi yok" };
  }

  let hedefTokenlar = tokenlar;
  if (kategori) {
    const anahtarlar = tokenlar.map((t) => HABER_BILDIRIM_KATEGORI_PREFIX + t);
    const kayitlar = anahtarlar.length ? await redis.mget(...anahtarlar) : [];
    hedefTokenlar = tokenlar.filter((t, i) => {
      const k = kayitlar[i];
      if (!Array.isArray(k) || k.length === 0) return true; // genel abone
      return k.includes(kategori);
    });
  }

  if (hedefTokenlar.length === 0) {
    return { basarili: true, gonderilen: 0, mesaj: "Bu kategoriye abone kimse yok" };
  }

  const GRUP_BOYU = 500;
  let gonderilenToplam = 0;
  let gecersizTokenlar = [];

  for (let i = 0; i < hedefTokenlar.length; i += GRUP_BOYU) {
    const grup = hedefTokenlar.slice(i, i + GRUP_BOYU);
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
        if (kod.includes("registration-token-not-registered") || kod.includes("invalid-argument")) {
          gecersizTokenlar.push(grup[idx]);
        }
      }
    });
  }

  if (gecersizTokenlar.length > 0) {
    await redis.srem(HABER_BILDIRIM_TOKENS_KEY, ...gecersizTokenlar);
    for (const t of gecersizTokenlar) await redis.del(HABER_BILDIRIM_KATEGORI_PREFIX + t);
  }

  return {
    basarili: true,
    hedefTokenSayisi: hedefTokenlar.length,
    basariylaGonderilen: gonderilenToplam,
    temizlenenGecersizToken: gecersizTokenlar.length,
  };
}

export { haberleriGonder, HABER_BILDIRIM_TOKENS_KEY, HABER_BILDIRIM_KATEGORI_PREFIX };
