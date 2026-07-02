// api/gecmis.js
// Yahoo Finance üzerinden 30 günlük geçmiş fiyat verisi (Kur Grafik Modalı için)
// Standart semboller: USDTRY=X, EURTRY=X, BTC-USD vb.
// Özel mod: sembol=GRAM_ALTIN veya GRAM_GUMUS -> ons/USD × USD/TRY çarpılarak TL/gram hesaplanır
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const { sembol } = req.query;
  if (!sembol) {
    return res.status(400).json({ error: "sembol parametresi gerekli" });
  }

  const GRAM_ONS = 31.1034768; // 1 ons = 31.1034768 gram

  try {
    if (sembol === "GRAM_ALTIN" || sembol === "GRAM_GUMUS") {
      // NOT: XAUUSD=X / XAGUSD=X Yahoo'nun v8/finance/chart API'sinde 404 veriyor
      // (sadece Yahoo'nun kendi web sitesinde özet sayfası var, chart endpoint'i desteklemiyor).
      // GC=F / SI=F (vadeli kontrat) kullanmak zorundayız — rollover kaynaklı sıçramaları
      // aşağıdaki "önceki kapanışı kendi serisinden hesapla" mantığıyla azaltıyoruz.
      const onsSembol = sembol === "GRAM_ALTIN" ? "GC=F" : "SI=F";
      const [onsRes, usdRes] = await Promise.all([
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${onsSembol}?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?interval=1d&range=1mo`, { headers: { "User-Agent": "Mozilla/5.0" } }),
      ]);
      const onsJson = await onsRes.json();
      const usdJson = await usdRes.json();

      const onsResult = onsJson?.chart?.result?.[0];
      const usdResult = usdJson?.chart?.result?.[0];
      if (!onsResult || !usdResult) {
        return res.status(200).json({ noktalar: [], guncelFiyat: null, oncekiKapanis: null });
      }

      // USD/TRY tarihe göre eşlemek için map oluştur
      const usdMap = {};
      (usdResult.timestamp || []).forEach((t, i) => {
        const tarih = new Date(t * 1000).toISOString().slice(0, 10);
        const c = usdResult.indicators?.quote?.[0]?.close?.[i];
        if (c != null) usdMap[tarih] = c;
      });

      const onsTimestamps = onsResult.timestamp || [];
      const onsCloses = onsResult.indicators?.quote?.[0]?.close || [];

      let sonUsdTry = null;
      const noktalar = onsTimestamps
        .map((t, i) => {
          const tarih = new Date(t * 1000).toISOString().slice(0, 10);
          const onsFiyat = onsCloses[i];
          const usdTry = usdMap[tarih] ?? sonUsdTry;
          if (usdTry != null) sonUsdTry = usdTry;
          if (onsFiyat == null || usdTry == null) return null;
          const gramTL = (onsFiyat * usdTry) / GRAM_ONS;
          return { tarih, fiyat: Math.round(gramTL * 100) / 100 };
        })
        .filter(p => p !== null && p.fiyat > 0);

      const onsMeta = onsResult.meta || {};
      const usdMeta = usdResult.meta || {};
      const guncelOns = onsMeta.regularMarketPrice ?? (noktalar.length ? null : null);
      const guncelUsd = usdMeta.regularMarketPrice;
      // Önceki kapanış için de aynı tutarlılık kuralı: önce kendi serimizin (noktalar)
      // son-1 noktasını kullan, yalnızca yetersizse Yahoo'nun ayrı meta alanlarına düş.
      const oncekiOnsMeta = onsMeta.previousClose ?? onsMeta.chartPreviousClose;
      const oncekiUsdMeta = usdMeta.previousClose ?? usdMeta.chartPreviousClose;

      const guncelFiyat = (guncelOns != null && guncelUsd != null)
        ? Math.round((guncelOns * guncelUsd / GRAM_ONS) * 100) / 100
        : (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
      const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
        ?? ((oncekiOnsMeta != null && oncekiUsdMeta != null)
          ? Math.round((oncekiOnsMeta * oncekiUsdMeta / GRAM_ONS) * 100) / 100
          : null);

      return res.status(200).json({ noktalar, guncelFiyat, oncekiKapanis });
    }

    // Standart sembol modu (USD/TRY, EUR/TRY, BTC-USD vb.)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?interval=1d&range=1mo`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();

    const result = json?.chart?.result?.[0];
    if (!result) {
      return res.status(200).json({ noktalar: [], guncelFiyat: null, oncekiKapanis: null });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const meta = result.meta || {};

    const noktalar = timestamps
      .map((t, i) => ({
        tarih: new Date(t * 1000).toISOString().slice(0, 10),
        fiyat: closes[i],
      }))
      .filter(p => p.fiyat != null && p.fiyat > 0);

    const guncelFiyat = meta.regularMarketPrice ?? (noktalar.length ? noktalar[noktalar.length - 1].fiyat : null);
    // Önceki kapanışı ÖNCELİKLE kendi serisinden (noktalar) hesapla — Yahoo'nun ayrı
    // meta.previousClose alanı, vadeli kontrat rollover'larında (petrol/doğalgaz/bakır gibi
    // sürekli kontrat sembollerinde) farklı bir kontrata ait, seriyle tutarsız bir değer
    // döndürebiliyor ve yapay %20-30 sıçramalara yol açıyor. Kendi serimizin son iki noktası
    // her zaman aynı sorgudan geldiği için içsel olarak tutarlıdır.
    const oncekiKapanis = (noktalar.length > 1 ? noktalar[noktalar.length - 2].fiyat : null)
      ?? meta.previousClose ?? meta.chartPreviousClose ?? null;

    res.status(200).json({ noktalar, guncelFiyat, oncekiKapanis });
  } catch (e) {
    res.status(500).json({ error: e.message, noktalar: [], guncelFiyat: null, oncekiKapanis: null });
  }
}
