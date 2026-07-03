// api/_lib/fonFetch.js
// Fonoloji'den katılım fonlarını çekip normalize eden ORTAK mantık.
// Hem cron job'ı (api/cron-fon-guncelle.js) hem de public endpoint'in
// bootstrap/fallback yolu (api/fon-getiri.js) bunu kullanır — tek kaynak,
// iki yerde ayrı ayrı bakım gerektirmez.
// NOT: Dosya adı "_lib" ile başladığı için Vercel bunu bir API route olarak
// görmez, sadece import edilebilir bir modüldür.

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
  const gun = d.getDay();
  if (gun === 0 || gun === 6) return false;
  const str = d.toISOString().slice(0,10);
  return !TATILLER_2026.has(str) && !TATILLER_2025.has(str);
}

function sonTakasGunuAralik() {
  const bugun = new Date();
  bugun.setHours(12,0,0,0);
  let sonTakas = new Date(bugun);
  while (!isTakasGunu(sonTakas)) sonTakas.setDate(sonTakas.getDate() - 1);
  let oncekiTakas = new Date(sonTakas);
  oncekiTakas.setDate(oncekiTakas.getDate() - 1);
  while (!isTakasGunu(oncekiTakas)) oncekiTakas.setDate(oncekiTakas.getDate() - 1);
  const farkMs = sonTakas - oncekiTakas;
  return Math.round(farkMs / (1000*60*60*24));
}

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
    yillikHesap: f.return_1d ? parseFloat(((f.return_1d / takasAraligi) * 252 * 100).toFixed(2)) : null,
  };
}

const KATEGORILER = [
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
  {kat: "Hisse Senedi Şemsiye Fonu",      tumunu: false},
  {kat: "Para Piyasası Şemsiye Fonu",     tumunu: false},
  {kat: "Değişken Şemsiye Fonu",          tumunu: false},
  {kat: "Karma Şemsiye Fonu",             tumunu: false},
  {kat: "Fon Sepeti Şemsiye Fonu",        tumunu: false},
  {kat: "Altın Şemsiye Fonu",             tumunu: false},
  {kat: "Kıymetli Madenler Şemsiye Fonu", tumunu: false},
  {kat: "Endeks Şemsiye Fonu",            tumunu: false},
  {kat: "Serbest Şemsiye Fonu",           tumunu: false},
  {kat: "Altın Fonu",                     tumunu: false},
  {kat: "Kıymetli Madenler",              tumunu: false},
];

const VAKIF_KODLARI = ["VPA","VLT","VHS","VKK","VKV"];
const PAGE_SIZE = 100;
const ŞÜPHELİ_EŞİK = 100; // normal günde 150+ fon beklenir

// Fonoloji'den tüm katılım fonlarını çeker. Sonuç şüpheli derecede azsa
// (kategori sorgularının çoğu başarısız olmuş olabilir) `eksikGorunuyor:true`
// ile birlikte döner — çağıran taraf (cron ya da fallback) buna göre karar verir.
async function fonVerisiCek() {
  const API_KEY = process.env.FONOLOJI_KEY;
  if (!API_KEY) throw new Error("FONOLOJI_KEY tanımlı değil");
  const headers = { "X-API-Key": API_KEY, "Accept": "application/json" };
  const takasAraligi = sonTakasGunuAralik();

  const vakifRes = await Promise.all(
    VAKIF_KODLARI.map(kod =>
      fetchTekrarli(`https://fonoloji.com/v1/funds/${kod}`, { headers }, 2)
        .then(r => r ? r.json() : null).catch(() => null)
    )
  );

  const gorulmuKodlar = new Set();
  let katilimFonlar = [];
  for (const d of vakifRes) {
    if (!d) continue;
    const f = d.fund ?? d;
    const kod = f.code || "";
    if (!kod || gorulmuKodlar.has(kod)) continue;
    gorulmuKodlar.add(kod);
    katilimFonlar.push(mapFon(f, true, takasAraligi));
  }

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

  const kategoriSayac = {};
  for (const f of katilimFonlar) {
    const k = f.kategori || "Bilinmiyor";
    kategoriSayac[k] = (kategoriSayac[k] || 0) + 1;
  }

  return {
    success: true,
    count: katilimFonlar.length,
    eksikGorunuyor: katilimFonlar.length < ŞÜPHELİ_EŞİK,
    guncelleme: new Date().toISOString(),
    kategori_dagilim: kategoriSayac,
    data: katilimFonlar,
  };
}

export { fonVerisiCek, ŞÜPHELİ_EŞİK };

