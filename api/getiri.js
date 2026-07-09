// api/getiri.js
//
// Getiri Karşılaştırma ekranı için: seçilen tarih aralığında (1ay, 3ay, 6ay,
// 1yil, ybb) piyasa enstrümanlarının yüzde getirisini hesaplar.
//
// Kullanım:  GET /api/getiri?aralik=1ay
// Yanıt:     { basarili:true, aralik:"1ay", getiriler:[{kod, ad, getiri}] }
//
// Veri kaynağı: Yahoo Finance v8 chart API (USDTRY=X, EURTRY=X, GC=F, SI=F,
// XU100.IS, XK100.IS). Gram Altın/Gümüş getirisi sentetik olarak
// (1+ons)*(1+usdtry)-1 formülüyle hesaplanır (ons USD cinsinden olduğu için).
//
// NOT: Vercel /api fonksiyon sınırına (12) dikkat — bu dosya yeni bir fonksiyon
// ekler. Sınır aşılırsa deploy hata verir; o durumda bu handler mevcut bir
// dosyaya (örn. gecmis.js içine ?islem= parametresiyle) birleştirilebilir.

const ARALIK_MAP = {
  "1ay":  "1mo",
  "3ay":  "3mo",
  "6ay":  "6mo",
  "1yil": "1y",
  "ybb":  "ytd",
};

async function yahooGetiri(sembol, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?range=${range}&interval=1d`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const sonuc = j?.chart?.result?.[0];
  const kapanis = sonuc?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(kapanis)) return null;
  const seri = kapanis.filter((v) => typeof v === "number" && isFinite(v));
  if (seri.length < 2) return null;
  const ilk = seri[0];
  const son = seri[seri.length - 1];
  if (!ilk) return null;
  return {
    getiri: (son - ilk) / ilk, // ondalık getiri (0.12 = %12)
    ad: sonuc?.meta?.shortName || sonuc?.meta?.symbol || sembol,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // 30 dk CDN cache — Yahoo'ya gereksiz yük binmesin, ekran hızlı açılsın
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  const aralik = String(req.query?.aralik || "1ay");
  const range = ARALIK_MAP[aralik];
  if (!range) {
    res.status(400).json({ basarili: false, hata: "Geçersiz aralık. 1ay|3ay|6ay|1yil|ybb" });
    return;
  }

  try {
    // Kullanıcının eklediği ekstra semboller (?ekstra=THYAO.IS,BTC-USD)
    // Güvenlik: en fazla 8 sembol, her biri en fazla 15 karakter, sadece
    // Yahoo sembollerinde geçerli karakterler (harf/rakam/nokta/tire/=/^).
    const ekstraHam = String(req.query?.ekstra || "");
    const ekstraSemboller = ekstraHam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s.length <= 15 && /^[A-Z0-9.\-=^]+$/.test(s))
      .slice(0, 8);

    const [usd, eur, onsAltin, onsGumus, xu100, xk100, ...ekstraSonuclar] = await Promise.all([
      yahooGetiri("USDTRY=X", range),
      yahooGetiri("EURTRY=X", range),
      yahooGetiri("GC=F", range),
      yahooGetiri("SI=F", range),
      yahooGetiri("XU100.IS", range),
      yahooGetiri("XK100.IS", range),
      ...ekstraSemboller.map((s) => yahooGetiri(s, range)),
    ]);

    // Gram (TL) getirisi = ons (USD) getirisi ile USD/TRY getirisinin bileşimi
    const gramAltin =
      onsAltin?.getiri != null && usd?.getiri != null
        ? (1 + onsAltin.getiri) * (1 + usd.getiri) - 1
        : null;
    const gramGumus =
      onsGumus?.getiri != null && usd?.getiri != null
        ? (1 + onsGumus.getiri) * (1 + usd.getiri) - 1
        : null;

    const yzd = (v) => (v == null ? null : Math.round(v * 10000) / 100); // %, 2 hane

    const getiriler = [
      { kod: "USDTRY",     ad: "USD/TRY",          getiri: yzd(usd?.getiri) },
      { kod: "EURTRY",     ad: "EUR/TRY",          getiri: yzd(eur?.getiri) },
      { kod: "ONS_ALTIN",  ad: "Ons Altın ($)",    getiri: yzd(onsAltin?.getiri) },
      { kod: "GRAM_ALTIN", ad: "Gram Altın (₺)",   getiri: yzd(gramAltin) },
      { kod: "ONS_GUMUS",  ad: "Ons Gümüş ($)",    getiri: yzd(onsGumus?.getiri) },
      { kod: "GRAM_GUMUS", ad: "Gram Gümüş (₺)",   getiri: yzd(gramGumus) },
      { kod: "XU100",      ad: "BIST 100",         getiri: yzd(xu100?.getiri) },
      { kod: "XK100",      ad: "Katılım Endeksi",  getiri: yzd(xk100?.getiri) },
    ];

    const ekstraGetiriler = ekstraSemboller.map((sembol, i) => ({
      sembol,
      ad: ekstraSonuclar[i]?.ad || sembol,
      getiri: yzd(ekstraSonuclar[i]?.getiri),
    }));

    res.status(200).json({ basarili: true, aralik, getiriler, ekstraGetiriler });
  } catch (e) {
    console.error("getiri.js hatası:", e);
    res.status(500).json({ basarili: false, hata: "Sunucu hatası", detay: String(e) });
  }
}
