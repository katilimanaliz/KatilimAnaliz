// api/kamu-haznedarligi.js — Kamu Haznedarlığı Getiri İzleme (2026-10-13)
//
// NE YAPAR
//   Kamu kurumlarının mevduatları için TCMB'nin haftalık Mevduat Ağırlıklı Ortalama Faiz (AOMF) oranlarının
//   belirli bir yüzdesi olarak hesaplanan "tahmini getiri oranlarını" tutar ve ekrana sunar.
//   tahmini getiri = AOMF(ilgili vade grubu) × katsayı%     (örn. 43,11 × %55 = %23,7105)
//
// GEÇMİŞ KAYDI
//   Her oran değişikliği Redis'te KALICI (TTL'siz) bir kayıt olarak tutulur: { gecerli, ref:{1,3,6,12}, katsayi:[...] }.
//   "gecerli" = oranın yürürlüğe girdiği gün. Bir tarih sorulduğunda o tarihte (veya öncesindeki en son) kayıt geçerlidir;
//   yani oranlar değişene kadar her gün aynı oranlar geçerli sayılır.
//
// KAYNAK (EVDS3)
//   TCMB, bir haftanın mevduat AOMF verisini izleyen haftanın 4. iş gününde (Perşembe) yayımlar; TCMB ekranına Cuma girer.
//   Bu yüzden bir gözlemin yürürlük tarihi = gözlem haftasının Cuması + 7 gün (örn. gözlem 2 Eki → yürürlük 9 Eki).
//   EVDS seri kodları KESİN BİLİNMİYOR: ilk çalışmada "kalibrasyon" yapılır — EVDS'deki mevduat serileri taranır ve değerleri
//   TCMB ekranındaki bilinen değerlerle (TOHUM kaydı) eşleşen 4 seri bulunup Redis'e yazılır (khz:seri:v1).
//   Eşleşme bulunamazsa ekran TOHUM kaydıyla çalışır; ?teshis=1 adayları listeler.
//
// GÜNCELLEME
//   Cron yok: ekran açıldığında (en çok 3 saatte bir, kilitli) EVDS'ye bakılır. Yürürlük tarihi gözlem tarihinden
//   türetildiği için geç fark edilse bile geçmiş doğru yazılır.

import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const config = { maxDuration: 60 };

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";
const KV_VERI = "khz:veri:v1";
const KV_SERI = "khz:seri:v1";
const KV_KONTROL_KILIT = "khz:kilit:kontrol";
const KV_KALIBRE_KILIT = "khz:kilit:kalibre";
const KV_ABONE = "khz:abone:v1";           // hash: push token → {ts}
const KV_BILDIRILDI = "khz:bildirildi:v1"; // son bildirilen kaydin yururluk tarihi (cift gonderimi onler)
const CRON_ARALIK_MS = 15 * 60 * 1000;
const KONTROL_ARALIK_MS = 3 * 3600 * 1000;
const KALIBRE_DENEME_ARALIK_SN = 1800;    // başarısız kalibrasyon 30 dk'da bir denenir
const VADE_GRUPLARI = ["1", "3", "6", "12"];   // 1 ay, 3 ay, 6 ay, 1 yıl (AOMF vade dilimi)

// Kamu Haznedarlığı Genel Tebliği katsayıları (TCMB ekranı, 9 Eki 2026 görüntüsünden). Her kayıtla birlikte saklanır;
// ileride katsayılar değişirse eski tarihler eski katsayılarla gösterilir.
const KATSAYI_VARSAYILAN = [
  { vade: "Gecelik",           ref: "1",  oran: 55 },
  { vade: "7 Güne Kadar",      ref: "1",  oran: 60 },
  { vade: "8 gün - 29 gün",    ref: "1",  oran: 65 },
  { vade: "30 gün - 59 gün",   ref: "3",  oran: 65 },
  { vade: "60 gün - 89 gün",   ref: "3",  oran: 70 },
  { vade: "90 gün - 134 gün",  ref: "6",  oran: 80 },
  { vade: "135 gün - 179 gün", ref: "6",  oran: 85 },
  { vade: "180 gün - 269 gün", ref: "12", oran: 90 },
  { vade: "270 gün üzeri",     ref: "12", oran: 95 },
];

// TOHUM: kullanıcının paylaştığı TCMB ekranı (kayıt tarihi 09.10.2026). Aynı zamanda kalibrasyonun doğruluk referansı.
const TOHUM = {
  gecerli: "2026-10-09",
  ref: { "1": 43.11, "3": 43.79, "6": 43.14, "12": 40.28 },
  katsayi: KATSAYI_VARSAYILAN,
  kaynak: "tcmb-ekrani",
};

// ── Yardımcılar ────────────────────────────────────────────────────────────
async function fetchZamanli(url, opsiyonlar = {}, msTimeout = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), msTimeout);
  try { return await fetch(url, { ...opsiyonlar, signal: c.signal }); } finally { clearTimeout(t); }
}
const N = (s) => String(s == null ? "" : s).toLocaleUpperCase("tr-TR")
  .split("İ").join("I").split("Ş").join("S").split("Ç").join("C")
  .split("Ö").join("O").split("Ü").join("U").split("Ğ").join("G");

function istanbulBugunIso() {
  // Europe/Istanbul tarihi (UTC+3 sabit)
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function isoToUtc(iso) { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); }
function utcToIso(ms) { return new Date(ms).toISOString().slice(0, 10); }
function gunEkle(iso, n) { return utcToIso(isoToUtc(iso) + n * 86400000); }
function tarihCoz(t) {
  const s = String(t || "").trim();
  let m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}
function tarihEvds(iso) { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; }
// Gözlem tarihinin ait olduğu haftanın (Pzt-Paz) Cuması
function haftaninCumasi(iso) {
  const ms = isoToUtc(iso);
  const gun = new Date(ms).getUTCDay();        // 0 Paz … 6 Cmt
  const pztGeri = gun === 0 ? 6 : gun - 1;     // Pazartesiye geri
  return utcToIso(ms - pztGeri * 86400000 + 4 * 86400000);
}
function yururlukTarihi(gozlemIso, bugunIso) {
  const aday = gunEkle(haftaninCumasi(gozlemIso), 7);
  const fark = (isoToUtc(aday) - isoToUtc(bugunIso)) / 86400000;
  return (fark > 10 || fark < -400) ? bugunIso : aday;   // makul değilse tespit günü
}
function seriAnahtarlari(kod) { return [kod, kod.replace(/\./g, "_"), kod.replace(/_/g, ".")]; }
function degerOku(satir, kod) {
  for (const k of seriAnahtarlari(kod)) {
    const v = satir[k];
    if (v !== null && v !== undefined && v !== "") {
      const n = parseFloat(String(v).replace(",", "."));
      if (isFinite(n)) return n;
    }
  }
  return null;
}
async function evdsJson(url, apiKey, ms = 10000) {
  const r = await fetchZamanli(url, { headers: { key: apiKey, Accept: "application/json" } }, ms);
  const t = await r.text();
  if (t.trim().startsWith("<")) throw new Error(`HTML döndü (HTTP ${r.status})`);
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`);
  return JSON.parse(t);
}
function degerGecerli(v) { return typeof v === "number" && isFinite(v) && v > 1 && v < 300; }
function ayniMi(a, b) { return VADE_GRUPLARI.every((g) => Math.abs((a[g] ?? -1) - (b[g] ?? -2)) < 0.005); }

// ── Redis ──────────────────────────────────────────────────────────────────
async function veriOku() {
  let v = null;
  try { v = await redis.get(KV_VERI); } catch {}
  if (v && Array.isArray(v.kayitlar) && v.kayitlar.length) return v;
  const ilk = { kayitlar: [TOHUM], sonKontrol: null, olusturma: Date.now() };
  try { await redis.set(KV_VERI, ilk, { nx: true }); } catch {}
  return ilk;
}
async function veriYaz(v) { await redis.set(KV_VERI, v); }

// ── EVDS: seri kalibrasyonu ────────────────────────────────────────────────
async function katalogGruplari(apiKey) {
  for (const kb of ["https://evds2.tcmb.gov.tr/service/evds", BASE]) {
    try {
      const r = await fetchZamanli(kb + "/datagroups/mode=0&code=0&type=json", { headers: { key: apiKey, Accept: "application/json" } }, 10000);
      const t = await r.text();
      if (t.trim().startsWith("[")) return { kb, gruplar: JSON.parse(t) };
    } catch {}
  }
  return null;
}

async function kalibreEt(apiKey, teshis) {
  const kat = await katalogGruplari(apiKey);
  if (!kat) { teshis.hata = "datagroups alinamadi"; return null; }
  const ilgili = kat.gruplar.filter((g) => {
    const ad = N(g.DATAGROUP_ADI || g.DATAGROUP_NAME);
    return ad.includes("MEVDUAT") || ad.includes("AOMF") || ad.includes("HAZNEDAR");
  }).slice(0, 25);
  teshis.gruplar = ilgili.map((g) => g.DATAGROUP_ADI || g.DATAGROUP_NAME);

  // seri listeleri (paralel)
  const seriler = [];
  await Promise.all(ilgili.map(async (g) => {
    const kod = g.DATAGROUP_KODU || g.DATAGROUP_CODE;
    try {
      const r = await fetchZamanli(`${kat.kb}/serieList/type=json&code=${kod}`, { headers: { key: apiKey, Accept: "application/json" } }, 10000);
      const t = await r.text();
      if (t.trim().startsWith("[")) {
        for (const s of JSON.parse(t)) seriler.push({ kod: s.SERIE_CODE, ad: s.SERIE_NAME, grup: g.DATAGROUP_ADI || g.DATAGROUP_NAME });
      }
    } catch {}
  }));
  teshis.seriSayisi = seriler.length;
  if (!seriler.length) return null;

  // değerler: parçalar halinde
  const bas = gunEkle(istanbulBugunIso(), -90), bit = istanbulBugunIso();
  const veri = {};   // kod → { iso: değer }
  const parcalar = [];
  for (let i = 0; i < seriler.length; i += 12) parcalar.push(seriler.slice(i, i + 12));
  const calistir = async (p) => {
    try {
      const j = await evdsJson(`${BASE}/series=${p.map((s) => s.kod).join("-")}&startDate=${tarihEvds(bas)}&endDate=${tarihEvds(bit)}&type=json`, apiKey, 12000);
      for (const row of (j.items || [])) {
        const iso = tarihCoz(row.Tarih); if (!iso) continue;
        for (const s of p) {
          const v = degerOku(row, s.kod);
          if (v !== null) (veri[s.kod] = veri[s.kod] || {})[iso] = v;
        }
      }
    } catch (e) { teshis.parcaHata = (teshis.parcaHata || 0) + 1; }
  };
  for (let i = 0; i < parcalar.length; i += 5) await Promise.all(parcalar.slice(i, i + 5).map(calistir));

  // eşleştirme: hedef değerler = TOHUM
  const TOL = 0.011;
  const aday = { "1": [], "3": [], "6": [], "12": [] };
  const bilgi = Object.fromEntries(seriler.map((s) => [s.kod, s]));
  for (const kod of Object.keys(veri)) {
    for (const g of VADE_GRUPLARI) {
      for (const [iso, v] of Object.entries(veri[kod])) {
        if (Math.abs(v - TOHUM.ref[g]) <= TOL) aday[g].push({ kod, iso });
      }
    }
  }
  teshis.adaylar = Object.fromEntries(VADE_GRUPLARI.map((g) => [g, aday[g].slice(0, 12).map((a) => ({ ...a, ad: bilgi[a.kod]?.ad, grup: bilgi[a.kod]?.grup }))]));
  // ortak tarih: her grup için aynı gözlem tarihinde aday olsun
  const tarihler = [...new Set(aday["1"].map((a) => a.iso))].sort().reverse();
  const puan = (kod, g) => {
    const ad = N(bilgi[kod]?.ad), grup = N(bilgi[kod]?.grup);
    let p = 0;
    if (/\bTL\b|TRY|TURK LIRASI/.test(ad)) p += 2;
    if (grup.includes("HAFTALIK") || ad.includes("HAFTALIK")) p += 2;
    if (ad.includes("AGIRLIKLI") || grup.includes("AGIRLIKLI")) p += 2;
    const k = { "1": ["1 AYA KADAR", "1 AY"], "3": ["3 AYA KADAR", "3 AY"], "6": ["6 AYA KADAR", "6 AY"], "12": ["1 YILA KADAR", "1 YIL"] }[g];
    if (k.some((x) => ad.includes(x))) p += 3;
    if (ad.includes("AKIM") || grup.includes("AKIM")) p += 2;
    if (ad.includes("MEVDUAT") || grup.includes("MEVDUAT")) p += 1;
    if (ad.includes("UZUN VADELI")) p -= 6; // "1 Yil ve Daha Uzun" serisi 12 ay grubu degildir
    return p;
  };
  for (const iso of tarihler) {
    const secim = {};
    let tamam = true;
    for (const g of VADE_GRUPLARI) {
      const ad = aday[g].filter((a) => a.iso === iso).sort((x, y) => puan(y.kod, g) - puan(x.kod, g))[0];
      if (!ad) { tamam = false; break; }
      secim[g] = ad.kod;
    }
    if (tamam && new Set(Object.values(secim)).size === 4) {
      teshis.eslesenTarih = iso;
      return { ...secim, eslesenTarih: iso, kalibreTs: Date.now() };
    }
  }
  return null;
}

async function seriHaritasi(apiKey, teshis, zorla) {
  let m = null;
  try { m = await redis.get(KV_SERI); } catch {}
  if (m && VADE_GRUPLARI.every((g) => typeof m[g] === "string")) return m;
  // başarısız denemeyi sık tekrarlama
  let kilit = true;
  try { const s = await redis.set(KV_KALIBRE_KILIT, "1", { nx: true, ex: zorla ? 60 : KALIBRE_DENEME_ARALIK_SN }); kilit = (s === "OK" || s === true); } catch {}
  if (!kilit) { teshis.not = "kalibrasyon yakinda denendi"; return null; }
  const sonuc = await kalibreEt(apiKey, teshis);
  if (sonuc) { try { await redis.set(KV_SERI, sonuc); } catch {} }
  return sonuc;
}

// ── EVDS: güncelleme ───────────────────────────────────────────────────────
async function evdsGozlemleri(apiKey, harita) {
  const bit = istanbulBugunIso(), bas = gunEkle(bit, -70);
  const kodlar = VADE_GRUPLARI.map((g) => harita[g]);
  const j = await evdsJson(`${BASE}/series=${kodlar.join("-")}&startDate=${tarihEvds(bas)}&endDate=${tarihEvds(bit)}&type=json`, apiKey, 12000);
  const gozlem = [];
  for (const row of (j.items || [])) {
    const iso = tarihCoz(row.Tarih); if (!iso) continue;
    const ref = {};
    let tam = true;
    for (const g of VADE_GRUPLARI) {
      const v = degerOku(row, harita[g]);
      if (!degerGecerli(v)) { tam = false; break; }
      ref[g] = Math.round(v * 10000) / 10000;
    }
    if (tam) gozlem.push({ iso, ref });
  }
  gozlem.sort((a, b) => a.iso.localeCompare(b.iso));
  return gozlem;
}

async function guncelle(apiKey, zorla, teshis, aralikMs = KONTROL_ARALIK_MS) {
  const v = await veriOku();
  const simdi = Date.now();
  if (!zorla && v.sonKontrol && simdi - v.sonKontrol < aralikMs) return v;

  let kilit = false;
  try { const s = await redis.set(KV_KONTROL_KILIT, "1", { nx: true, ex: zorla ? 20 : 120 }); kilit = (s === "OK" || s === true); } catch {}
  if (!kilit) return v;
  try {
    const harita = await seriHaritasi(apiKey, teshis, zorla);
    if (!harita) { teshis.seri = "eslesmedi"; return v; }
    teshis.seri = "hazir";
    const gozlem = await evdsGozlemleri(apiKey, harita);
    teshis.gozlemSayisi = gozlem.length;
    const bugun = istanbulBugunIso();
    let degisti = false;
    const oncekiSon = v.kayitlar[v.kayitlar.length - 1];
    for (const g of gozlem) {
      const son = v.kayitlar[v.kayitlar.length - 1];
      const gecerli = yururlukTarihi(g.iso, bugun);
      if (gecerli <= son.gecerli) continue;          // yalnızca daha yeni yürürlük
      if (ayniMi(son.ref, g.ref)) continue;           // oran değişmediyse yeni kayıt açma
      v.kayitlar.push({ gecerli, ref: g.ref, katsayi: son.katsayi || KATSAYI_VARSAYILAN, kaynak: "evds", evdsTarih: g.iso, kayitTs: simdi });
      degisti = true;
    }
    v.sonKontrol = simdi;
    v.seriDurumu = "hazir";
    await veriYaz(v);
    teshis.degisti = degisti;
    if (degisti) {
      try { teshis.bildirim = await degisimBildir(oncekiSon, v.kayitlar[v.kayitlar.length - 1]); } catch (e) { teshis.bildirimHata = e.message; }
    }
  } catch (e) {
    teshis.hata = e.message;
  } finally {
    try { await redis.del(KV_KONTROL_KILIT); } catch {}
  }
  return v;
}


// ── Alarm: oran değişince push bildirimi ───────────────────────────────────
const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function tarihYazi(iso) { const [y, m, d] = String(iso).split("-").map(Number); return `${d} ${AYLAR[m - 1]} ${y}`; }
async function degisimBildir(onceki, yeni) {
  if (!onceki || !yeni || onceki.gecerli === yeni.gecerli) return { gonderilen: 0, not: "kayit yok" };
  try { if ((await redis.get(KV_BILDIRILDI)) === yeni.gecerli) return { gonderilen: 0, not: "zaten bildirildi" }; } catch {}
  try { await redis.set(KV_BILDIRILDI, yeni.gecerli); } catch {}
  const aboneler = await redis.hgetall(KV_ABONE);
  const tokenlar = Object.keys(aboneler || {});
  if (!tokenlar.length) return { gonderilen: 0, not: "abone yok" };
  const govde = `Yeni oranlar yayımlandı. Güncel getiri oranları için ekrana bakın. Yürürlük: ${tarihYazi(yeni.gecerli)}.`;
  const { admin } = await import("./firebaseAdmin.js");
  let gonderilen = 0; const gecersiz = [];
  for (let i = 0; i < tokenlar.length; i += 500) {
    const grup = tokenlar.slice(i, i + 500);
    const sonuc = await admin.messaging().sendEachForMulticast({
      notification: { title: "Kamu Haznedarlığı oranları değişti", body: govde },
      data: { tip: "kamu-haznedarligi", gecerli: yeni.gecerli },
      tokens: grup,
      android: { notification: { sound: "default", channelId: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
    });
    gonderilen += sonuc.successCount;
    sonuc.responses.forEach((r, idx) => {
      const kod = r.error?.code || "";
      if (!r.success && (kod.includes("registration-token-not-registered") || kod.includes("invalid-argument"))) gecersiz.push(grup[idx]);
    });
  }
  if (gecersiz.length) { try { await redis.hdel(KV_ABONE, ...gecersiz); } catch {} }
  return { gonderilen, abone: tokenlar.length, temizlenen: gecersiz.length };
}

// Dış zamanlayıcı (alarm-kontrol) çağırır: ekran açılmasa da yeni oran yakalanır ve bildirim gider.
export async function khzCronKontrol() {
  const apiKey = process.env.EVDS_KEY; if (!apiKey) return { not: "EVDS_KEY yok" };
  const teshis = {};
  await guncelle(apiKey, false, teshis, CRON_ARALIK_MS);
  return teshis;
}

// POST ?khz=1&abone=1  { token, acik }
async function aboneIslem(req, res) {
  const { token, acik } = req.body || {};
  if (typeof token !== "string" || token.length < 20 || token.length > 4096 || typeof acik !== "boolean") {
    return res.status(400).json({ hata: "'token' ve boolean 'acik' zorunlu" });
  }
  try {
    if (!acik) { await redis.hdel(KV_ABONE, token); return res.status(200).json({ basarili: true, abone: false }); }
    await redis.hset(KV_ABONE, { [token]: JSON.stringify({ ts: Date.now() }) });
    return res.status(200).json({ basarili: true, abone: true });
  } catch (e) {
    return res.status(500).json({ hata: "Alarm kaydedilemedi", detay: e.message });
  }
}

// ── Hız sınırı (evds-proxy ile aynı mantık) ────────────────────────────────
function istemciIp(req) {
  const x = req.headers["x-forwarded-for"];
  if (typeof x === "string" && x) return x.split(",")[0].trim();
  return req.headers["x-real-ip"] || "bilinmeyen";
}
async function hizSiniriAsildiMi(req) {
  try {
    const ip = istemciIp(req); if (ip === "bilinmeyen") return false;
    const p = Math.floor(Date.now() / 60000);
    const a = `rl:khz:${ip}:${p}`;
    const n = await redis.incr(a); if (n === 1) await redis.expire(a, 120);
    return n > 40;
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (await hizSiniriAsildiMi(req)) {
    res.setHeader("Retry-After", "60"); res.setHeader("Cache-Control", "no-store");
    return res.status(429).json({ hata: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin." });
  }
  if (req.method === "POST") { res.setHeader("Cache-Control", "no-store"); return aboneIslem(req, res); }
  const apiKey = process.env.EVDS_KEY;
  const teshis = {};
  const teshisModu = req.query.teshis === "1";
  const zorla = req.query.guncelle === "1" || teshisModu;

  let v;
  try {
    v = apiKey ? await guncelle(apiKey, zorla, teshis) : await veriOku();
  } catch (e) {
    teshis.hata = e.message;
    try { v = await veriOku(); } catch { v = { kayitlar: [TOHUM], sonKontrol: null }; }
  }
  const bugun = istanbulBugunIso();
  // Henüz yürürlüğe girmemiş (gelecek tarihli) kayıtlar gösterilmez
  const kayitlar = v.kayitlar.filter((k) => k.gecerli <= bugun);
  const son = kayitlar[kayitlar.length - 1] || v.kayitlar[0];
  const govde = {
    kayitlar,
    sonGuncelleme: son.gecerli,
    sonKontrol: v.sonKontrol || null,
    bugun,
    kaynak: "TCMB · EVDS",
  };
  if (teshisModu) { govde._teshis = teshis; res.setHeader("Cache-Control", "no-store"); }
  else res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
  return res.status(200).json(govde);
}
