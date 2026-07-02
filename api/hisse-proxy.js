const XK100_KODLARI = new Set([
  "ASELS","TUPRS","BIMAS","EREGL","KTLEV","GUBRF","MAGEN","ISDMR","ENJSA",
  "SASA","KCHOL","TOASO","FROTO","TTRAK","TSKB","YKBNK","SAHOL","SISE",
  "AKBNK","GARAN","ISCTR","VAKBN","HALKB","ALARK","AEFES","ARCLK","THYAO",
  "PGSUS","TCELL","TAVHL","PETKM","BRISA","CCOLA","DOHOL","EKGYO","ENKAI",
  "GESAN","SARKY","SELEC","MGROS","OTKAR","RYSAS","TTRAK","TKFEN","TKNSA",
  "TURSG","ULKER","YEOTK","ZOREN","AGHOL","AKSA","ATATP","BSOKE","CEMTS",
  "DAPGM","DARDL","DCTTR","FORMT","GENIL","GENTS","GRSEL","IDGYO","KBORU",
  "OBAMS","PAGYO","PNLSN","POLHO","RGYAS","RNPOL","SANEL","SURGY","TARKM",
  "TUREX","TUKAS","ULAS","VRGYO","BIENY","CIMSA","DENGE","HEKTS","IHLGM",
  "KRDMD","ASUZU","ARCLK","GRSEL","ALBRK","ANSGR","CLEBI","DOHOL",
]);

const CACHE_TTL = 30 * 24 * 3600 * 1000; // şirket adları neredeyse hiç değişmiyor — 30 gün "taze" say
let isimCache = { data: null, ts: 0, rawSample: null, rawCount: 0 };

// BigPara'nın döndürdüğü alan adı (kod/ad) zaman içinde değişmiş/farklı casing kullanıyor olabilir.
// Bilinen tüm olası varyantları dener — hangisi API'de gerçekten varsa onu kullanır.
function ilkGecerliAlan(obj, adaylar) {
  for (const k of adaylar) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

const KOD_ALANLARI = ["kod","Kod","KOD","sembol","Sembol","SEMBOL","symbol","Symbol","HisseKodu","hisseKodu"];
const AD_ALANLARI  = ["ad","Ad","AD","hisseAdi","HisseAdi","HISSE_ADI","isim","Isim","IsimTam","name","Name","Aciklama","aciklama","Unvan","unvan","SirketAdi","sirketAdi"];

// Zaman aşımlı fetch — BigPara yavaş kaldığında istek sonsuza kadar beklemesin
function fetchZamanAsimli(url, opts, msTimeout) {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), msTimeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(zamanlayici));
}

// BigPara isteği bazı soğuk başlangıçlarda (cold start) tek seferde başarısız/timeout olabiliyor
// — bu, "şirket isimleri arada gelip gidiyor" şikayetinin asıl sebebiydi. 2 tekrar denemeyle
// (kısa aralarla) bu geçici hataların büyük kısmı örtülüyor.
async function bigparaCekTekrarli(deneme = 3) {
  for (let i = 0; i < deneme; i++) {
    try {
      const r = await fetchZamanAsimli(
        "https://bigpara.hurriyet.com.tr/api/v1/hisse/list",
        { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } },
        6000
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const liste = json?.data || [];
      if (Array.isArray(liste) && liste.length > 0) return liste;
      throw new Error("Boş liste döndü");
    } catch (e) {
      if (i === deneme - 1) throw e;
      await new Promise(res => setTimeout(res, 500 * (i + 1))); // 500ms, 1000ms artan bekleme
    }
  }
  return [];
}

async function sirketIsimleriniGetir() {
  const now = Date.now();
  if (isimCache.data && now - isimCache.ts < CACHE_TTL) return isimCache.data;

  try {
    const liste = await bigparaCekTekrarli(3);

    const isimMap = {};
    for (const h of liste) {
      const kod = ilkGecerliAlan(h, KOD_ALANLARI);
      const ad  = ilkGecerliAlan(h, AD_ALANLARI);
      if (kod && ad) isimMap[kod] = ad;
    }
    isimCache = {
      data: isimMap,
      ts: now,
      rawSample: liste.slice(0, 2),   // BigPara'dan gelen ham ilk 2 kayıt — gerçek alan adlarını görmek için
      rawCount: liste.length,
    };
    return isimMap;
  } catch (e) {
    // 3 deneme de başarısız oldu. Elimizde önceki (eski de olsa) bir isim haritası varsa
    // onu kullanmaya devam et — boş {} dönüp tüm isimleri ticker'a düşürmek yerine bayat
    // ama doğru isimler göstermek çok daha iyi bir kullanıcı deneyimi.
    isimCache.rawSample = isimCache.rawSample || [{ hata: String(e && e.message || e) }];
    return isimCache.data || {};
  }
}

export default async function handler(req, res) {
  try {
    const debug = req.query.debug === "1";

    const [midasRes, isimMap] = await Promise.all([
      fetch("https://www.getmidas.com/wp-json/midas-api/v1/midas_table_data?sortId=&return=table", {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      }),
      sirketIsimleriniGetir(),
    ]);

    let midasListe = [];
    if (midasRes.ok) {
      const text = await midasRes.text();
      try {
        const parsed = JSON.parse(text);
        midasListe = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
        if (!Array.isArray(midasListe)) midasListe = [];
      } catch(e) {}
    }

    if (debug) {
      const tumKodlar = midasListe.filter(h => h.Code && !h.Code.startsWith("X")).map(h => h.Code);
      const eslesenler = tumKodlar.filter(k => isimMap[k]);
      const eslesmeyenler = tumKodlar.filter(k => !isimMap[k]);
      const tamListe = req.query.tam === "1";
      return res.status(200).json({
        midas_kayit_sayisi: midasListe.length,
        isim_kaynagi_kayit_sayisi: Object.keys(isimMap).length,
        isim_kaynagi_ham_toplam: isimCache.rawCount,
        isim_kaynagi_ham_ornek: tamListe ? isimCache.rawSample : isimCache.rawSample?.slice(0, 2),
        isim_kaynagi_cache_yasi_dk: isimCache.ts ? Math.round((Date.now() - isimCache.ts) / 60000) : null,
        // GERÇEK EŞLEŞME ORANI — tüm hisselerin kaçında isim bulunuyor
        eslesme_orani: `${eslesenler.length} / ${tumKodlar.length}`,
        eslesmeyen_kod_sayisi: eslesmeyenler.length,
        eslesmeyen_ornekler: eslesmeyenler.slice(0, 15),
        eslesen_ornek: midasListe.slice(0, 5).map(h => ({
          kod: h.Code,
          bulunan_isim: isimMap[h.Code] || "BULUNAMADI"
        })),
        // ?tam=1 ile eklenir: statik listeye gömmek için kod->isim eşlemesinin TAMAMI
        tam_isim_haritasi: tamListe ? isimMap : undefined,
      });
    }

    const hisseler = midasListe
      .filter(h => h.Code && !h.Code.startsWith("X"))
      .map(h => {
        const kod = h.Code;
        return {
          ticker:       kod,
          sirket:       isimMap[kod] || kod,
          sektor:       "",
          fiyat:        h.Last || h.Close || 0,
          degisim1g:    parseFloat((h.DailyChangePercent || 0).toFixed(2)),
          degisim1h:    h.WeeklyChangePercent != null ? parseFloat(h.WeeklyChangePercent.toFixed(2)) : null,
          degisim1a:    (h.MOMChangePercent ?? h.MonthlyChangePercent) != null
                          ? parseFloat((h.MOMChangePercent ?? h.MonthlyChangePercent).toFixed(2)) : null,
          degisim1y:    (h.YearlyChangePercent ?? h.YearlyChange) != null
                          ? parseFloat((h.YearlyChangePercent ?? h.YearlyChange).toFixed(2)) : null,
          yuksek:       h.High || 0,
          dusuk:        h.Low || 0,
          hacim:        h.TotalVolume || 0,
          piyasaDegeri: h.MarketValue || 0,
          fk:           h.PriceEarning || null,
          pddd:         h.PriceBookValue || null,
          roe:          h.ReturnOnEquity != null ? h.ReturnOnEquity * 100 : null,
          temetu:       null,
          katilimEndeksi: XK100_KODLARI.has(kod),
        };
      })
      .sort((a,b) => (b.piyasaDegeri||0) - (a.piyasaDegeri||0));

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: hisseler.length,
      katilimCount: hisseler.filter(h=>h.katilimEndeksi).length,
      guncelleme: new Date().toISOString(),
      data: hisseler,
    });

  } catch(e) {
    res.status(500).json({ success:false, error: e.message });
  }
}
