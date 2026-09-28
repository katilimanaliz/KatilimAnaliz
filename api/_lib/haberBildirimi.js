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

// ── HABER SINIFLANDIRMA (2026-09-28) ─────────────────────────────────────────
// SORUN: Otomatik giden haberlerin kategorisi yoktu (RSS <category> alanı
// güvenilir değil) → "kategorisiz = herkese" kuralı yüzünden Pro üyenin
// kategori seçimi otomatik bildirimlerde HİÇBİR ŞEY filtrelemiyordu.
// ÇÖZÜM: haber, başlığındaki anahtar kelimelerle 0..n kategoriye eşleniyor
// (haberKategorileriBul). Gönderimde kategoriler:[...] verilirse:
//   • hiç filtre seçmemiş ("genel") aboneler HER haberi alır,
//   • filtre seçmiş aboneler yalnızca kesişen kategorideki haberi alır,
//   • hiçbir kategoriye uymayan haber (kategoriler:[]) SADECE genel abonelere gider.
// Eşleme YAKLAŞIKTIR (anahtar kelime); kuralları KATEGORI_KURALLARI'nda
// genişletmek/düzeltmek tek yerden yapılır.
const HABER_KATEGORI_ANAHTARLARI = ["katilim","bist","doviz-altin","kfk","merkez-bankasi","enflasyon","global"];

// Locale'e bağımlı OLMAYAN normalizasyon: İ/I→i, küçük harf, Türkçe karakterleri
// ASCII'ye indirge, harf/rakam dışındakileri tek boşluğa çevir.
function haberMetniNormalle(s) {
  return String(s || "")
    .replace(/İ/g, "i").replace(/I/g, "i")
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, (c) => ({ "ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","â":"a","î":"i","û":"u" }[c]))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const B = "(?<![a-z0-9])";   // kelime başı
const S = "(?![a-z0-9])";    // kelime sonu
const GLOBAL_BORSA = new RegExp(`${B}(?:abd${S}|wall street|nasdaq|avrupa|asya|nikkei|dax${S}|ftse|dow${S}|s p ?500)`);
const KATEGORI_KURALLARI = {
  "katilim": [
    new RegExp(`${B}katilim`), new RegExp(`${B}islami`), /faizsiz/, new RegExp(`${B}sukuk`),
    /kira sertifika/, /murabaha/, new RegExp(`${B}zekat`), /kuveyt turk/, /albaraka/, /turkiye finans/,
  ],
  "bist": [
    new RegExp(`${B}bist`), /borsa istanbul/, new RegExp(`${B}hisse`), new RegExp(`${B}temettu`),
    new RegExp(`${B}bedelsiz`), /halka arz/, new RegExp(`${B}xu ?[0-9]{3}`), new RegExp(`${B}kap${S}`),
    /sermaye artir/, /pay geri alim/,
    (t) => new RegExp(`${B}borsa`).test(t) && !GLOBAL_BORSA.test(t),   // "borsa": yurt dışı borsa haberi değilse
  ],
  "doviz-altin": [
    new RegExp(`${B}doviz`), new RegExp(`${B}dolar`), new RegExp(`${B}euro(?!zone|pa|nex| bolge| alani)`),
    new RegExp(`${B}avro(?! bolge| alani)`), new RegExp(`${B}altin(?!ci)`), new RegExp(`${B}gumus`), /sterlin/,
    new RegExp(`${B}usd`), new RegExp(`${B}eur${S}`), new RegExp(`${B}gbp`), new RegExp(`${B}ons${S}`),
    new RegExp(`${B}kur(?:u|lar|lari|un)?${S}`), /parite/,
  ],
  "kfk": [
    new RegExp(`${B}kfk`), /kefalet/, /kamu finansman/, new RegExp(`${B}kgf${S}`), /kredi garanti/,
    /hazine destekli/, /hazine garantili/,
  ],
  "merkez-bankasi": [
    /merkez bankasi/, new RegExp(`${B}tcmb${S}`), new RegExp(`${B}ppk${S}`), new RegExp(`${B}faiz(?!siz)`),
    new RegExp(`${B}repo(?:su|nun|ya|da|lar)?${S}`), /reeskont/, /para politikasi/,
    /(?:brut|net|doviz|altin) rezerv/, /zorunlu karsilik/,
  ],
  "enflasyon": [
    /enflasyon/, new RegExp(`${B}tufe`), new RegExp(`${B}ufe${S}`), /yi ufe/, /cari acik/, /cari denge/,
    new RegExp(`${B}issizlik`), /gsyi?h/, /ekonomik buyume/, /sanayi uretim/, new RegExp(`${B}pmi${S}`),
    /ekonomik guven/, /tuketici guven/, /kapasite kullanim/, /perakende satis/, /dis ticaret/,
    /butce (?:acik|fazla|dengesi)/, /odemeler dengesi/, new RegExp(`${B}tuik`), new RegExp(`${B}istihdam`),
  ],
  "global": [
    new RegExp(`${B}abd${S}`), new RegExp(`${B}fed${S}`), /federal reserve/, new RegExp(`${B}ecb${S}`),
    /avrupa/, /euro bolge/, /avro bolge/, /euro alani/, /trump/, /wall street/, /nasdaq/, /s p ?500/,
    /dow jones/, new RegExp(`${B}dow${S}`), /nikkei/, new RegExp(`${B}dax${S}`), /ftse/,
    new RegExp(`${B}cin${S}`), /japonya/, new RegExp(`${B}boj${S}`), /bank of england/, /ingiltere/, /almanya/,
    new RegExp(`${B}brent`), new RegExp(`${B}petrol`), new RegExp(`${B}opec`), new RegExp(`${B}asya`), /kuresel/,
  ],
};

function kategorilerEsle(normalMetin) {
  const bulunan = [];
  for (const kat of HABER_KATEGORI_ANAHTARLARI) {
    const kurallar = KATEGORI_KURALLARI[kat] || [];
    if (kurallar.some((k) => (typeof k === "function" ? k(normalMetin) : k.test(normalMetin)))) bulunan.push(kat);
  }
  return bulunan;
}

// Başlık önce; başlıktan hiçbir kategori çıkmazsa özetin İLK 200 karakteri
// denenir (özetteki alakasız cümlelerin yanlış eşleşme yaratmaması için).
function haberKategorileriBul(baslik, ozet) {
  const b = kategorilerEsle(haberMetniNormalle(baslik));
  if (b.length > 0) return b;
  return kategorilerEsle(haberMetniNormalle(String(ozet || "").slice(0, 200)));
}

// { redis, admin, baslik, govde, kategori?, kategoriler?, veri? } → gönderim özeti.
//  • kategori (string) VEYA kategoriler (dizi) hiç verilmemişse TÜM abonelere gider —
//    kategori seçmiş kullanıcı da dahil (elle/admin GENEL DUYURULARI kategori
//    filtresinden muaf, bkz. api/bildirim.js "HABER BİLDİRİMLERİ").
//  • kategori (string): genel aboneler + o kategoriyi seçmiş olanlar (admin, tek kategori).
//  • kategoriler (dizi, OTOMATİK akış): genel aboneler + kesişenler; dizi BOŞSA
//    (haber hiçbir kategoriye uymadı) SADECE genel aboneler.
async function haberleriGonder({ redis, admin, baslik, govde, kategori, kategoriler, veri }) {
  if (!baslik || !govde) {
    return { basarili: false, hata: "'baslik' ve 'govde' zorunlu" };
  }

  const tokenlar = await redis.smembers(HABER_BILDIRIM_TOKENS_KEY);
  if (!tokenlar || tokenlar.length === 0) {
    return { basarili: true, gonderilen: 0, mesaj: "Kayıtlı haber bildirimi abonesi yok" };
  }

  let hedefTokenlar = tokenlar;
  if (Array.isArray(kategoriler)) {
    const anahtarlar = tokenlar.map((t) => HABER_BILDIRIM_KATEGORI_PREFIX + t);
    const kayitlar = anahtarlar.length ? await redis.mget(...anahtarlar) : [];
    hedefTokenlar = tokenlar.filter((t, i) => {
      const k = kayitlar[i];
      if (!Array.isArray(k) || k.length === 0) return true; // genel abone: her haberi alır
      return kategoriler.some((x) => k.includes(x));
    });
  } else if (kategori) {
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

export { haberleriGonder, haberKategorileriBul, HABER_KATEGORI_ANAHTARLARI, HABER_BILDIRIM_TOKENS_KEY, HABER_BILDIRIM_KATEGORI_PREFIX };
