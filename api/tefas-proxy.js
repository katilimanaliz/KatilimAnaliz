
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

// ── Ağ güvenilirliği ─────────────────────────────────────────────────────────
// Fonoloji'ye giden istekler bazen (geçici ağ sıçraması / oran sınırı) tek seferde
// başarısız oluyor. Bu, "sadece Vakıf Katılım fonları geldi" hatasının asıl nedeniydi:
// kategori sorgularının çoğu sessizce boş döndü, sadece VAKIF_KODLARI'nın bir kısmı
// (doğrudan URL'den çekildiği için) ayakta kaldı. Zaman aşımlı + 2 tekrar denemeli
// fetch ile bu geçici hataların büyük kısmı örtülüyor.
function fetchZamanAsimli(url, opts, msTimeout) {
  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), msTimeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(zamanlayici));
}
async function fetchTekrarli(url, opts, deneme = 3, msTimeout = 6000) {
  for (let i = 0; i < deneme; i++) {
    try {
      const r = await fetchZamanAsimli(url, opts, msTimeout);
      if (r.ok) return r;
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i === deneme - 1) return null;
      await new Promise(res => setTimeout(res, 400 * (i + 1)));
    }
  }
  return null;
}

// Bu instance'ın en son BAŞARILI (yeterli sayıda fon içeren) sonucu — yeni sorgu
// şüpheli derecede az fon döndürürse buna düşülür, kullanıcı boş ekran görmesin.
let sonBasariliSonuc = { data: null, ts: 0 };


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
        fetchTekrarli(`https://fonoloji.com/v1/funds/${kod}`, { headers }, 2)
          .then(r => r ? r.json() : null).catch(() => null)
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
        const res = await fetchTekrarli(url, { headers }, 2);
        if (!res) break;
        const d = await res.json().catch(() => null);
        if (!d) break;
        const items = d.items ?? d.funds ?? d.data ?? (Array.isArray(d) ? d : []);
        if (!items.length) break;
        for (const f of items) {
          // Sadece aktif (TEFAS'ta açık) fonlar
          if (f.trading_status && f.trading_status !== "AKTİF") continue;
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
        const mapped = mapFon(f, false, takasAraligi);
        if (!mapped.katilimUygun) continue;
        gorulmuKodlar.add(kod);
        katilimFonlar.push(mapped);
      }
    }

    // ── Cache güvenliği + eski-veriye-düşme ──────────────────────────────────
    // ÖNCEKİ HATA 1: s-maxage=82800 (23 saat) — sabah erken bir istek eksik yanıt
    //   alırsa CDN'de neredeyse tüm gün kilitleniyordu.
    // ÖNCEKİ HATA 2: Kategori sorgularının çoğu sessizce başarısız olunca sadece
    //   Vakıf Katılım'ın birkaç kodu dönüyordu ("1/2 fon" görünen bozulma budur).
    //   Artık her istek zaman aşımlı + 2 tekrar denemeli (yukarıda fetchTekrarli).
    // Üç önlem:
    //  1) Şüpheli derecede az fon dönerse (normal günde 150+ beklenir) VE bu
    //     instance'ın önceki başarılı bir sonucu varsa, ona düşülür — kullanıcı
    //     boş/eksik ekran yerine bayat ama doğru veri görür.
    //  2) Düşülecek eski veri de yoksa kısa (60sn) cache ile hemen yeniden dener.
    //  3) Fon NAV'ları günde bir kez (~08:30) güncellendiği için normal cache
    //     süresi 6 saate çıkarıldı — "günde birkaç kez sorgula" isteğine CDN
    //     önbelleği üzerinden yaklaşır (garantili sabit saatler için Vercel Cron
    //     + kalıcı depolama gerekir, bkz. sohbetteki not).
    const ŞÜPHELİ_EŞİK = 100;
    let sonucData = katilimFonlar;
    let eksikGorunuyor = katilimFonlar.length < ŞÜPHELİ_EŞİK;

    if (eksikGorunuyor && sonBasariliSonuc.data && sonBasariliSonuc.data.length >= ŞÜPHELİ_EŞİK) {
      sonucData = sonBasariliSonuc.data; // bugünkü sorgu bozuk — önceki iyi sonuca düş
    } else if (!eksikGorunuyor) {
      sonBasariliSonuc = { data: katilimFonlar, ts: Date.now() };
    }

    const kategoriSayacNihai = {};
    for (const f of sonucData) {
      const k = f.kategori || "Bilinmiyor";
      kategoriSayacNihai[k] = (kategoriSayacNihai[k] || 0) + 1;
    }

    const noCache = req.query?.refresh === "1";
    let cacheHeader;
    if (noCache) {
      cacheHeader = "no-store";
    } else if (eksikGorunuyor && sonucData === katilimFonlar) {
      cacheHeader = "s-maxage=60, stale-while-revalidate=30"; // düşülecek eski veri de yok — hemen tekrar dene
    } else {
      cacheHeader = "s-maxage=21600, stale-while-revalidate=3600"; // 6 saat
    }
    res.setHeader("Cache-Control", cacheHeader);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      success: true,
      count: sonucData.length,
      eksikVeriyleCalisiyor: eksikGorunuyor && sonucData !== katilimFonlar, // eski (bayat) veri kullanılıyor
      guncelleme: new Date().toISOString(),
      kategori_dagilim: kategoriSayacNihai,
      data: sonucData,
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
    katilimUygun: !!(f.is_participation || f.participation ||
      (f.name||"").toUpperCase().includes("KATILIM") ||
      (f.category||"").toUpperCase().includes("KATILIM")),
    kaynakKategori: f.category || "",
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
