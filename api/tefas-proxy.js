
// Bugün ile son takas günü arasındaki iş günü sayısı
// BIST resmi tatil listesi (sabit yıllık güncelleme gerekir)
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
  const gun = d.getDay(); // 0=Pazar, 6=Cumartesi
  if (gun === 0 || gun === 6) return false;
  const str = d.toISOString().slice(0,10);
  return !TATILLER_2026.has(str) && !TATILLER_2025.has(str);
}

function sonTakasGunuAralik() {
  const bugun = new Date();
  bugun.setHours(12,0,0,0);
  // Geriye giderek son takas gününü bul
  let sonTakas = new Date(bugun);
  while (!isTakasGunu(sonTakas)) {
    sonTakas.setDate(sonTakas.getDate() - 1);
  }
  // Bir önceki takas gününü bul
  let oncekiTakas = new Date(sonTakas);
  oncekiTakas.setDate(oncekiTakas.getDate() - 1);
  while (!isTakasGunu(oncekiTakas)) {
    oncekiTakas.setDate(oncekiTakas.getDate() - 1);
  }
  // Takvim günü farkı (örn: Cuma→Pazartesi = 3)
  const farkMs = sonTakas - oncekiTakas;
  const takasAraligiGun = Math.round(farkMs / (1000*60*60*24));
  return takasAraligiGun; // 1=normal gün, 3=hafta sonu, daha fazla=tatil
}

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FONOLOJI_KEY;
    const takasAraligi = sonTakasGunuAralik(); // 1=normal, 3=hafta sonu vb.
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "FONOLOJI_KEY tanımlı değil" });
    }

    const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };

    // Vakıf Katılım fonlarını direkt koddan çek (yeni ihraç, kategori listesinde görünmüyor)
    const VAKIF_KODLARI = ["VPA","VLT","VHS","VKK","VKV"];

    // Vakıf Katılım fonlarını direkt çek
    const vakifRes = await Promise.all(
      VAKIF_KODLARI.map(kod =>
        fetch(`https://fonoloji.com/v1/funds/${kod}`, { headers })
          .then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );

    const gorulmuKodlar = new Set();
    let katilimFonlar = [];

    // Önce Vakıf Katılım fonlarını ekle (öncelikli)
    for (const d of vakifRes) {
      if (!d) continue;
      const f = d.fund ?? d;
      const kod = f.code || "";
      if (!kod || gorulmuKodlar.has(kod)) continue;
      gorulmuKodlar.add(kod);
      katilimFonlar.push(mapFon(f, true, takasAraligi));
    }

    // Kategori bazında paralel çek
    // 1. "Katılım" kategorisi — tüm fonları al (adında KATILIM geçmese de)
    // 2. Diğer kategoriler — sadece adında KATILIM geçenler
    const PAGE_SIZE = 100;

    // Kategori → filtre kuralı: true=tümünü al, false=sadece adında KATILIM geçenler
    // Fonoloji gerçek kategori adları — adında KATILIM geçen kategoriler tümünü al
    const KATEGORILER = [
      // Adı zaten KATILIM içeren kategoriler — tümünü al
      {kat: "Katılım",                        tumunu: true},
      {kat: "Altın Katılım Fonu",             tumunu: true},
      {kat: "OKS Katılım Standart Fon",       tumunu: true},
      {kat: "Katılım Değişken Fon",           tumunu: true},
      {kat: "Katılım Katkı Fonu",             tumunu: true},
      {kat: "Katılım Fonu",                   tumunu: true},
      {kat: "Katılım Standart Fon",           tumunu: true},
      {kat: "Başlangıç Katılım Fonu",         tumunu: true},
      {kat: "Katılım Hisse Senedi Fonu",      tumunu: true},
      {kat: "Kira Sertifikası Katılım Fonu",  tumunu: true},
      // Karma kategoriler — fon ADINDA KATILIM geçenler
      {kat: "Hisse Senedi Şemsiye Fonu",      tumunu: false},
      {kat: "Para Piyasası Şemsiye Fonu",     tumunu: false},
      {kat: "Değişken Şemsiye Fonu",          tumunu: false},
      {kat: "Karma Şemsiye Fonu",             tumunu: false},
      {kat: "Fon Sepeti Şemsiye Fonu",        tumunu: false},
      {kat: "Altın Şemsiye Fonu",             tumunu: false},
      {kat: "Kıymetli Madenler Şemsiye Fonu", tumunu: false},
      {kat: "Endeks Şemsiye Fonu",            tumunu: false},
      {kat: "Serbest Şemsiye Fonu",           tumunu: false},
      // Aşağıdakiler adında KATILIM geçmeyebilir — fon adı filtresi şart
      {kat: "Altın Fonu",                     tumunu: false},
      {kat: "Kıymetli Madenler",              tumunu: false},
    ];

    const kategoriPromises = KATEGORILER.map(async ({kat, tumunu}) => {
      const sonuclar = [];
      let offset = 0;
      const encKat = encodeURIComponent(kat);
      while (true) {
        const url = `https://fonoloji.com/v1/funds?category=${encKat}&limit=${PAGE_SIZE}&offset=${offset}`;
        const res = await fetch(url, { headers }).catch(() => null);
        if (!res || !res.ok) break;
        const d = await res.json().catch(() => null);
        if (!d) break;
        const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
        if (!items.length) break;
        for (const f of items) {
          if (!tumunu) {
            const isim = (f.name || "").toUpperCase();
            if (!isim.includes("KATILIM")) continue;
          }
          sonuclar.push(f);
        }
        if (items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return sonuclar;
    });

    const tumKategoriSonuclari = await Promise.all(kategoriPromises);

    for (const items of tumKategoriSonuclari) {
      for (const f of items) {
        const kod = f.code || "";
        if (!kod || gorulmuKodlar.has(kod)) continue;
        gorulmuKodlar.add(kod);
        katilimFonlar.push(mapFon(f, false, takasAraligi));
      }
    }

    // Kategori bazında istatistik
    const kategoriSayac = {};
    for (const f of katilimFonlar) {
      const k = f.kategori || "Bilinmiyor";
      kategoriSayac[k] = (kategoriSayac[k] || 0) + 1;
    }

    const noCache = req.query?.refresh === "1";
    res.setHeader("Cache-Control", noCache ? "no-store" : "s-maxage=82800, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: katilimFonlar.length,
      guncelleme: new Date().toISOString(),
      kategori_dagilim: kategoriSayac,
      data: katilimFonlar,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
    // Günlük normalize ile hesaplanan alternatif yıllık (tatil/hafta sonu düzeltmeli)
    yillikHesap: f.return_1d ? parseFloat(((f.return_1d / takasAraligi) * 252 * 100).toFixed(2)) : null,
  };
}
