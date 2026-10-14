// api/_lib/tcmbKur.js  (2026-10-13)
//
// TCMB Kur İzleme: TCMB gösterge döviz kurları (alış/satış), gram altın ve gram gümüş, günlük tarihçe, alarm.
// Vercel 12 fonksiyon sınırı nedeniyle ayrı fonksiyon DEĞİL: api/evds-proxy.js içinden `?kur=1` ile çağrılır.
//
//   GET  /api/evds-proxy?kur=1                → { gunler:{iso:{USD:[alis,satis],…,ALTIN:[..],GUMUS:[..]}}, sonGuncelleme, sonKontrol, kaynak, madenKaynak }
//   GET  /api/evds-proxy?kur=1&teshis=1       → aynı + _teshis (seri eşleşmesi, altın/gümüş kaynağı)
//   POST /api/evds-proxy?kur=1&abone=1        { token, ozet:boolean, hedefler:[{k,yon:"ust"|"alt",hedef}] }  (alarm; tam durum yazılır)
//
// Döviz: EVDS gösterge kur serileri (TP.DK.<KOD>.A.YTL / .S.YTL); bulunamazsa katalogdan ad ile aranır.
// Altın/gümüş: EVDS kataloğunda TL/gram fiyat serisi aranır; seri bulunsa bile Yahoo (GC=F, SI=F) × TCMB USD kuru
// ile hesaplanan değerle ±%12 içinde uyuşmuyorsa KULLANILMAZ. Seri yoksa değer hesaplanır ve ekranda öyle belirtilir.
//
// Dış zamanlayıcı (alarm-kontrol) kurCronKontrol()'ü çağırır: yeni gün verisi gelince alarmlar değerlendirilir.
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";
const KV_VERI = "kur:veri:v1";
const KV_KILIT = "kur:kilit";
const KV_ABONE = "kur:abone:v1";           // hash: token → { ozet, hedefler:[…] }
const KV_BILDIRILDI = "kur:bildirildi:v1"; // son bildirim yapılan gün
const SAKLAMA_GUN = 400;
const KONTROL_ARALIK_MS = 30 * 60 * 1000;  // ekran açılışı
const CRON_ARALIK_MS = 10 * 60 * 1000;     // zamanlayıcı
const DOVIZLER = ["USD", "EUR", "GBP", "CHF"];
const OUNCE_GRAM = 31.1034768;
const AD = { USD: "ABD Doları", EUR: "Euro", GBP: "İngiliz Sterlini", CHF: "İsviçre Frangı", EURUSD: "EUR/USD", GBPUSD: "GBP/USD", ALTIN: "Gram Altın", GUMUS: "Gram Gümüş" };

// ── Yardımcılar ────────────────────────────────────────────────────────────
async function fetchZamanli(url, opsiyonlar = {}, msTimeout = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), msTimeout);
  try { return await fetch(url, { ...opsiyonlar, signal: c.signal }); } finally { clearTimeout(t); }
}
const N = (s) => String(s == null ? "" : s).toLocaleUpperCase("tr-TR")
  .split("İ").join("I").split("Ş").join("S").split("Ç").join("C")
  .split("Ö").join("O").split("Ü").join("U").split("Ğ").join("G");
function istanbulBugunIso() { return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); }
function isoToUtc(iso) { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); }
function gunEkle(iso, n) { return new Date(isoToUtc(iso) + n * 86400000).toISOString().slice(0, 10); }
function tarihCoz(t) {
  const s = String(t || "").trim();
  let m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}
function tarihEvds(iso) { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; }
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
async function evdsJson(url, apiKey, ms = 12000) {
  const r = await fetchZamanli(url, { headers: { key: apiKey, Accept: "application/json" } }, ms);
  const t = await r.text();
  if (t.trim().startsWith("<")) throw new Error(`HTML döndü (HTTP ${r.status})`);
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`);
  return JSON.parse(t);
}
const yuvarla = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;
const kurGecerli = (v) => typeof v === "number" && isFinite(v) && v > 0.01 && v < 100000;

// ── Redis ──────────────────────────────────────────────────────────────────
async function veriOku() {
  let v = null;
  try { v = await redis.get(KV_VERI); } catch {}
  if (v && v.gunler) return v;
  return { gunler: {}, sonKontrol: null, seri: null, maden: null };
}
async function veriYaz(v) { await redis.set(KV_VERI, v); }

// ── EVDS katalog ───────────────────────────────────────────────────────────
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
async function katalogSeriler(apiKey, filtre, teshis, anahtar) {
  const kat = await katalogGruplari(apiKey);
  if (!kat) { teshis[anahtar + "Hata"] = "datagroups alinamadi"; return []; }
  const ilgili = kat.gruplar.filter((g) => filtre(N(g.DATAGROUP_ADI || g.DATAGROUP_NAME))).slice(0, 25);
  teshis[anahtar + "Gruplar"] = ilgili.map((g) => g.DATAGROUP_ADI || g.DATAGROUP_NAME).slice(0, 12);
  const seriler = [];
  await Promise.all(ilgili.map(async (g) => {
    const kod = g.DATAGROUP_KODU || g.DATAGROUP_CODE;
    try {
      const r = await fetchZamanli(`${kat.kb}/serieList/type=json&code=${kod}`, { headers: { key: apiKey, Accept: "application/json" } }, 10000);
      const t = await r.text();
      if (t.trim().startsWith("[")) for (const s of JSON.parse(t)) seriler.push({ kod: s.SERIE_CODE, ad: s.SERIE_NAME, grup: g.DATAGROUP_ADI || g.DATAGROUP_NAME });
    } catch {}
  }));
  return seriler;
}

// Döviz serileri: önce bilinen kodlar, boş dönerse katalog
function varsayilanDovizSerileri() {
  const m = {};
  for (const c of DOVIZLER) m[c] = { a: `TP.DK.${c}.A.YTL`, s: `TP.DK.${c}.S.YTL` };
  return m;
}
async function dovizSeriBul(apiKey, teshis) {
  const seriler = await katalogSeriler(apiKey, (ad) => ad.includes("DOVIZ KURLARI") || ad.includes("GOSTERGE"), teshis, "dovizKatalog");
  const m = {};
  const adlar = { USD: ["ABD DOLARI", "(USD)", " USD"], EUR: ["EURO", "(EUR)", " EUR"], GBP: ["STERLIN", "(GBP)", " GBP"], CHF: ["ISVICRE", "(CHF)", " CHF"] };
  for (const c of DOVIZLER) {
    const aday = seriler.filter((s) => {
      const ad = N(s.ad);
      return adlar[c].some((x) => ad.includes(x)) && !ad.includes("EFEKTIF") && !ad.includes("CAPRAZ");
    });
    const a = aday.find((s) => N(s.ad).includes("ALIS")), sa = aday.find((s) => N(s.ad).includes("SATIS"));
    if (a && sa) m[c] = { a: a.kod, s: sa.kod };
  }
  teshis.dovizKatalogEslesen = Object.keys(m);
  return DOVIZLER.every((c) => m[c]) ? m : null;
}

async function dovizGozlemleri(apiKey, harita, bas, bit) {
  const kodlar = DOVIZLER.flatMap((c) => [harita[c].a, harita[c].s]);
  const j = await evdsJson(`${BASE}/series=${kodlar.join("-")}&startDate=${tarihEvds(bas)}&endDate=${tarihEvds(bit)}&type=json`, apiKey, 15000);
  const gunler = {};
  for (const row of (j.items || [])) {
    const iso = tarihCoz(row.Tarih); if (!iso) continue;
    const g = {};
    for (const c of DOVIZLER) {
      const a = degerOku(row, harita[c].a), s = degerOku(row, harita[c].s);
      if (kurGecerli(a) && kurGecerli(s)) g[c] = [yuvarla(a), yuvarla(s)];
    }
    if (Object.keys(g).length) gunler[iso] = g;
  }
  return gunler;
}

// ── Altın / gümüş ──────────────────────────────────────────────────────────
async function yahooOns(sembol) {
  try {
    const r = await fetchZamanli(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sembol)}?range=2y&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)" } }, 7000);
    if (!r.ok) return null;
    const j = await r.json();
    const s = j?.chart?.result?.[0];
    const kap = s?.indicators?.quote?.[0]?.close, zam = s?.timestamp;
    if (!Array.isArray(kap) || !Array.isArray(zam)) return null;
    const out = {};
    for (let i = 0; i < zam.length; i++) {
      if (typeof kap[i] !== "number" || !isFinite(kap[i])) continue;
      out[new Date((zam[i] + 3 * 3600) * 1000).toISOString().slice(0, 10)] = kap[i];
    }
    return out;
  } catch { return null; }
}
function sonDeger(harita, iso) {          // iso veya öncesindeki en yakın değer
  for (let i = 0; i < 6; i++) { const v = harita[gunEkle(iso, -i)]; if (typeof v === "number") return v; }
  return null;
}
async function madenSeriAra(apiKey, teshis) {
  const seriler = await katalogSeriler(apiKey, (ad) => ad.includes("ALTIN") || ad.includes("GUMUS") || ad.includes("KIYMETLI MADEN") || ad.includes("REESKONT") || ad.includes("DOVIZ KURLARI") || ad.includes("GOSTERGE"), teshis, "maden");
  const bul = (anahtar, kodlar) => seriler.filter((s) => {
    const ad = N(s.ad), kod = String(s.kod || "").toUpperCase();
    const eslesir = ad.includes(anahtar) || kodlar.some((k) => kod.includes(k) || ad.includes("(" + k + ")"));
    return eslesir && !ad.includes("USD/") && !ad.includes("SWAP") && !ad.includes("MEVDUAT") && !ad.includes("KG") && !ad.includes("TON");
  }).slice(0, 12);
  // bilinen/tahmini kodlar (listede yoksa da denenir)
  const tahmin = (xk) => [`TP.DK.${xk}.A.YTL`, `TP.DK.${xk}.S.YTL`].map((kod) => ({ kod, ad: kod + " (tahmin)" }));
  const birlestir = (a, b) => [...b, ...a.filter((x) => !b.some((y) => y.kod === x.kod))];
  return { altin: birlestir(bul("ALTIN", ["XAU", "XAS"]), tahmin("XAU")), gumus: birlestir(bul("GUMUS", ["XAG"]), tahmin("XAG")) };
}
// Aday seriyi son 30 günde hesaplanan değerle doğrula. Değer TL/gram ya da TL/ons olabilir (ölçek 1 veya 31,1035).
async function madenDogrula(apiKey, aday, hesap, teshis, ad) {
  const bit = istanbulBugunIso(), bas = gunEkle(bit, -30);
  for (const s of aday) {
    try {
      const j = await evdsJson(`${BASE}/series=${s.kod}&startDate=${tarihEvds(bas)}&endDate=${tarihEvds(bit)}&type=json`, apiKey, 10000);
      const satirlar = (j.items || []).map((r) => ({ iso: tarihCoz(r.Tarih), v: degerOku(r, s.kod) })).filter((x) => x.iso && kurGecerli(x.v));
      const sonuc = { kod: s.kod, ad: s.ad, satir: satirlar.length };
      let bulundu = null;
      for (const olcek of [1, OUNCE_GRAM]) {
        let uyus = 0, say = 0;
        for (const x of satirlar) { const h = hesap[x.iso]; if (typeof h === "number") { say++; if (Math.abs(x.v / olcek / h - 1) <= 0.12) uyus++; } }
        sonuc["olcek" + (olcek === 1 ? "1" : "ons")] = `${uyus}/${say}`;
        if (!bulundu && say >= 3 && uyus === say) bulundu = { kod: s.kod, olcek };
      }
      (teshis[ad + "Adaylar"] = teshis[ad + "Adaylar"] || []).push(sonuc);
      if (bulundu) return bulundu;
    } catch {}
  }
  return null;
}

// ── Güncelleme ─────────────────────────────────────────────────────────────
// TCMB'nin kendi güncel bülteni (today.xml): EVDS'ten önce/doğrudan yayımlanır; en son günü bununla düzeltiriz
async function tcmbBultenOku(teshis) {
  try {
    const r = await fetchZamanli("https://www.tcmb.gov.tr/kurlar/today.xml", { headers: { "User-Agent": "Mozilla/5.0" } }, 8000);
    if (!r.ok) { teshis.xmlHata = "http " + r.status; return null; }
    const x = await r.text();
    const tm = /<Tarih_Date[^>]*\sTarih="(\d{2})\.(\d{2})\.(\d{4})"/.exec(x);
    if (!tm) { teshis.xmlHata = "tarih yok"; return null; }
    const iso = `${tm[3]}-${tm[2]}-${tm[1]}`;
    const bn = (/Bulten_No="([^"]+)"/.exec(x) || [])[1] || "";
    const g = {};
    for (const c of DOVIZLER) {
      const m = new RegExp(`<Currency[^>]*CurrencyCode="${c}"[^>]*>([\\s\\S]*?)</Currency>`).exec(x);
      if (!m) continue;
      const al = parseFloat((/<ForexBuying>([^<]+)</.exec(m[1]) || [])[1]);
      const sa = parseFloat((/<ForexSelling>([^<]+)</.exec(m[1]) || [])[1]);
      if (kurGecerli(al) && kurGecerli(sa)) g[c] = [al, sa];
    }
    if (!DOVIZLER.every((c) => g[c])) { teshis.xmlHata = "eksik kur"; return null; }
    // TCMB'nin kendi çapraz kuru (EUR/USD, GBP/USD): alış=satış tek değer; yönü TL kurlarından doğrula
    for (const [c, k] of [["EUR", "EURUSD"], ["GBP", "GBPUSD"]]) {
      const m = new RegExp(`<Currency[^>]*CurrencyCode="${c}"[^>]*>([\\s\\S]*?)</Currency>`).exec(x);
      if (!m) continue;
      const hesap = g[c][0] / g.USD[0];
      for (const et of ["CrossRateUSD", "CrossRateOther"]) {
        const cv = parseFloat((new RegExp(`<${et}>([^<]+)<`).exec(m[1]) || [])[1]);
        if (!kurGecerli(cv)) continue;
        if (Math.abs(cv / hesap - 1) < 0.01) { g[k] = [cv, cv]; break; }
        if (Math.abs(1 / cv / hesap - 1) < 0.01) { const t = Math.round((1 / cv) * 10000) / 10000; g[k] = [t, t]; break; }
      }
    }
    teshis.xmlCapraz = { EURUSD: g.EURUSD || null, GBPUSD: g.GBPUSD || null };
    teshis.xml = { iso, bulten: bn, USD: g.USD };
    return { iso, g, bulten: bn };
  } catch (e) { teshis.xmlHata = e.message; return null; }
}

async function guncelle(apiKey, zorla, teshis, aralikMs = KONTROL_ARALIK_MS) {
  const v = await veriOku();
  const simdi = Date.now();
  if (!zorla && v.sonKontrol && simdi - v.sonKontrol < aralikMs) return v;
  let kilit = false;
  try { const s = await redis.set(KV_KILIT, "1", { nx: true, ex: zorla ? 25 : 90 }); kilit = (s === "OK" || s === true); } catch {}
  if (!kilit) return v;
  try {
    const bit = istanbulBugunIso();
    const ilk = Object.keys(v.gunler).length === 0;
    const bas = ilk ? gunEkle(bit, -SAKLAMA_GUN) : gunEkle(bit, -12);
    const eskiSon = Object.keys(v.gunler).sort().pop() || null;

    // 1) döviz
    let harita = v.seri || varsayilanDovizSerileri();
    let gozlem = {};
    try { gozlem = await dovizGozlemleri(apiKey, harita, bas, bit); } catch (e) { teshis.dovizHata = e.message; }
    if (!Object.keys(gozlem).length || !DOVIZLER.every((c) => Object.values(gozlem).some((g) => g[c]))) {
      const bulunan = await dovizSeriBul(apiKey, teshis);
      if (bulunan) { harita = bulunan; try { gozlem = await dovizGozlemleri(apiKey, harita, bas, bit); } catch (e) { teshis.dovizHata = e.message; } }
    }
    teshis.dovizGun = Object.keys(gozlem).length;
    if (!Object.keys(gozlem).length) { teshis.seri = "bulunamadi"; v.sonKontrol = simdi; await veriYaz(v); return v; }
    v.seri = harita; teshis.seri = "hazir";
    for (const [iso, g] of Object.entries(gozlem)) v.gunler[iso] = { ...(v.gunler[iso] || {}), ...g };
    // Bülten tarihi = AÇIKLANMA günü (15:30); kur ertesi iş günü için geçerli (EVDS de geçerlilik gününe yazar).
    // v2: ilk sürümün yanlış güne yazdığı bülten kayıtlarını temizle (EVDS değerleri o günleri yeniden doldurur)
    if (v.xmlSurum !== 2) {
      for (const i of Object.keys(v.xmlGun || {})) if (v.gunler[i]) { delete v.gunler[i].EURUSD; delete v.gunler[i].GBPUSD; }
      v.xmlGun = {}; v.xmlSurum = 2;
    }
    const xml = await tcmbBultenOku(teshis);
    if (xml) {
      const yakin = (a, b) => Array.isArray(a) && Array.isArray(b) && Math.abs(a[0] - b[0]) < 0.00005 && Math.abs(a[1] - b[1]) < 0.00005;
      let hedef = null;   // EVDS bu bülteni zaten yayımladıysa onun tarihini kullan
      for (const [i, g] of Object.entries(gozlem)) if (yakin(g.USD, xml.g.USD) && yakin(g.EUR, xml.g.EUR) && yakin(g.GBP, xml.g.GBP)) hedef = i;
      if (!hedef) { hedef = gunEkle(xml.iso, 1); while ([0, 6].includes(new Date(isoToUtc(hedef)).getUTCDay())) hedef = gunEkle(hedef, 1); }
      teshis.xmlHedefGun = hedef;
      v.xmlGun = v.xmlGun || {}; v.xmlGun[hedef] = xml.g; v.bulten = { iso: hedef, acik: xml.iso, no: xml.bulten };
    }
    for (const [iso, g] of Object.entries(v.xmlGun || {})) v.gunler[iso] = { ...(v.gunler[iso] || {}), ...g };
    for (const iso of Object.keys(v.xmlGun || {})) if (iso < gunEkle(bit, -SAKLAMA_GUN)) delete v.xmlGun[iso];

    // 2) altın / gümüş (hesaplanan; uygun EVDS serisi doğrulanırsa o)
    const [gc, si] = await Promise.all([yahooOns("GC=F"), yahooOns("SI=F")]);
    teshis.yahoo = { altin: !!gc, gumus: !!si };
    const hesap = { ALTIN: {}, GUMUS: {} };
    for (const iso of Object.keys(v.gunler)) {
      const usd = v.gunler[iso].USD; if (!usd) continue;
      for (const [k, ons] of [["ALTIN", gc], ["GUMUS", si]]) {
        const o = ons ? sonDeger(ons, iso) : null;
        if (o) hesap[k][iso] = [yuvarla(o * usd[0] / OUNCE_GRAM, 2), yuvarla(o * usd[1] / OUNCE_GRAM, 2)];
      }
    }
    if (!v.maden || v.maden.surum !== 2 || !v.maden.denendi || simdi - v.maden.denendi > 24 * 3600 * 1000) {
      const m = { altin: null, gumus: null, denendi: simdi, surum: 2 };
      try {
        const aday = await madenSeriAra(apiKey, teshis);
        const ort = (k) => Object.fromEntries(Object.entries(hesap[k]).map(([i, x]) => [i, (x[0] + x[1]) / 2]));
        if (Object.keys(hesap.ALTIN).length) m.altin = await madenDogrula(apiKey, aday.altin, ort("ALTIN"), teshis, "altin");
        if (Object.keys(hesap.GUMUS).length) m.gumus = await madenDogrula(apiKey, aday.gumus, ort("GUMUS"), teshis, "gumus");
      } catch (e) { teshis.madenHata = e.message; }
      v.maden = m;
    }
    for (const [k, anahtar] of [["ALTIN", "altin"], ["GUMUS", "gumus"]]) {
      const ms = v.maden?.[anahtar];
      const kod = ms && typeof ms === "object" ? ms.kod : (typeof ms === "string" ? ms : null);
      const olcek = ms && typeof ms === "object" && ms.olcek ? ms.olcek : 1;
      let evdsGun = {};
      if (kod) {
        try {
          const j = await evdsJson(`${BASE}/series=${kod}&startDate=${tarihEvds(bas)}&endDate=${tarihEvds(bit)}&type=json`, apiKey, 10000);
          for (const r of (j.items || [])) { const iso = tarihCoz(r.Tarih), x = degerOku(r, kod); if (iso && kurGecerli(x)) evdsGun[iso] = [yuvarla(x / olcek, 2), yuvarla(x / olcek, 2)]; }
        } catch {}
      }
      for (const iso of Object.keys(v.gunler)) {
        const x = evdsGun[iso] || hesap[k][iso];
        if (x) v.gunler[iso][k] = x;
      }
    }

    // eski günleri buda
    const keep = gunEkle(bit, -SAKLAMA_GUN - 10);
    for (const iso of Object.keys(v.gunler)) if (iso < keep) delete v.gunler[iso];
    v.sonKontrol = simdi;
    await veriYaz(v);
    const yeniSon = Object.keys(v.gunler).sort().pop();
    teshis.sonGun = yeniSon;
    if (yeniSon && yeniSon !== eskiSon && eskiSon !== null) {
      try { teshis.bildirim = await alarmlariDegerlendir(v, yeniSon); } catch (e) { teshis.bildirimHata = e.message; }
    }
  } catch (e) {
    teshis.hata = e.message;
  } finally {
    try { await redis.del(KV_KILIT); } catch {}
  }
  return v;
}

// ── Alarmlar ───────────────────────────────────────────────────────────────
const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function tarihYazi(iso) { const [y, m, d] = String(iso).split("-").map(Number); return `${d} ${AYLAR[m - 1]} ${y}`; }
function trSayi(v, n) {
  const [t, o] = Number(v).toFixed(n).split(".");
  return t.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (o ? "," + o : "");
}
const nSayi = (k, v) => trSayi(v, k === "ALTIN" || k === "GUMUS" ? 2 : 4);

async function alarmlariDegerlendir(v, iso) {
  if ((await redis.get(KV_BILDIRILDI)) === iso) return { gonderilen: 0, not: "zaten bildirildi" };
  await redis.set(KV_BILDIRILDI, iso);
  const aboneler = await redis.hgetall(KV_ABONE);
  const tokenlar = Object.keys(aboneler || {});
  if (!tokenlar.length) return { gonderilen: 0, not: "abone yok" };
  const bugun = { ...v.gunler[iso] };
  const r4 = (x) => Math.round(x * 10000) / 10000;
  if (!bugun.EURUSD && bugun.EUR && bugun.USD) bugun.EURUSD = [r4(bugun.EUR[0] / bugun.USD[0]), r4(bugun.EUR[1] / bugun.USD[1])];
  if (!bugun.GBPUSD && bugun.GBP && bugun.USD) bugun.GBPUSD = [r4(bugun.GBP[0] / bugun.USD[0]), r4(bugun.GBP[1] / bugun.USD[1])];
  const mesajlar = [];   // {token, baslik, govde}
  const guncelAbone = {};
  for (const t of tokenlar) {
    let a = aboneler[t]; if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = {}; } }
    const kalan = [];
    for (const h of (a.hedefler || [])) {
      const x = bugun[h.k]; if (!x) { kalan.push(h); continue; }
      const s = x[1];
      const tetik = h.yon === "ust" ? s >= h.hedef : s <= h.hedef;
      if (tetik) mesajlar.push({ token: t, baslik: `${AD[h.k]} hedefe ulaştı`, govde: `${AD[h.k]} satış ${nSayi(h.k, s)}${h.k === "EURUSD" || h.k === "GBPUSD" ? "" : " ₺"} (hedef ${h.yon === "ust" ? "üstü" : "altı"} ${nSayi(h.k, h.hedef)}). TCMB ${tarihYazi(iso)}.` });
      else kalan.push(h);
    }
    if (a.ozet) {
      const par = (k) => bugun[k] ? `${k === "ALTIN" ? "Altın" : k === "GUMUS" ? "Gümüş" : k} ${nSayi(k, bugun[k][1])}` : null;
      mesajlar.push({ token: t, baslik: "TCMB kurları yayımlandı", govde: ["USD", "EUR", "GBP", "ALTIN", "GUMUS"].map(par).filter(Boolean).join(" · ") });
    }
    if (kalan.length !== (a.hedefler || []).length) guncelAbone[t] = { ...a, hedefler: kalan };
  }
  if (!mesajlar.length) return { gonderilen: 0, abone: tokenlar.length };
  const { admin } = await import("./firebaseAdmin.js");
  let gonderilen = 0; const gecersiz = [];
  const grup = new Map();   // başlık|gövde → tokenlar
  for (const m of mesajlar) { const k = m.baslik + "\n" + m.govde; if (!grup.has(k)) grup.set(k, []); grup.get(k).push(m.token); }
  for (const [k, liste] of grup) {
    const [baslik, govde] = k.split("\n");
    for (let i = 0; i < liste.length; i += 500) {
      const parca = liste.slice(i, i + 500);
      const sonuc = await admin.messaging().sendEachForMulticast({
        notification: { title: baslik, body: govde },
        data: { tip: "tcmb-kur", gun: iso },
        tokens: parca,
        android: { notification: { sound: "default", channelId: "default" } },
        apns: { payload: { aps: { sound: "default" } } },
      });
      gonderilen += sonuc.successCount;
      sonuc.responses.forEach((r, idx) => {
        const kod = r.error?.code || "";
        if (!r.success && (kod.includes("registration-token-not-registered") || kod.includes("invalid-argument"))) gecersiz.push(parca[idx]);
      });
    }
  }
  // tetiklenen hedef alarmları tek seferlik: kaldır
  for (const [t, a] of Object.entries(guncelAbone)) {
    if (!a.ozet && !(a.hedefler || []).length) await redis.hdel(KV_ABONE, t);
    else await redis.hset(KV_ABONE, { [t]: JSON.stringify(a) });
  }
  if (gecersiz.length) { try { await redis.hdel(KV_ABONE, ...gecersiz); } catch {} }
  return { gonderilen, abone: tokenlar.length, temizlenen: gecersiz.length };
}

export async function kurCronKontrol() {
  const apiKey = process.env.EVDS_KEY; if (!apiKey) return { not: "EVDS_KEY yok" };
  const teshis = {};
  await guncelle(apiKey, false, teshis, CRON_ARALIK_MS);
  return teshis;
}

// POST ?kur=1&abone=1 { token, ozet, hedefler }
async function aboneIslem(req, res) {
  const { token, ozet, hedefler } = req.body || {};
  if (typeof token !== "string" || token.length < 20 || token.length > 4096 || typeof ozet !== "boolean" || !Array.isArray(hedefler)) {
    return res.status(400).json({ hata: "'token', boolean 'ozet' ve 'hedefler' dizisi zorunlu" });
  }
  const temiz = [];
  for (const h of hedefler.slice(0, 5)) {
    if (!h || !(h.k in AD) || (h.yon !== "ust" && h.yon !== "alt") || typeof h.hedef !== "number" || !isFinite(h.hedef) || h.hedef <= 0) {
      return res.status(400).json({ hata: "Geçersiz hedef alarmı" });
    }
    temiz.push({ k: h.k, yon: h.yon, hedef: h.hedef });
  }
  try {
    if (!ozet && !temiz.length) { await redis.hdel(KV_ABONE, token); return res.status(200).json({ basarili: true, abone: false }); }
    await redis.hset(KV_ABONE, { [token]: JSON.stringify({ ozet, hedefler: temiz, ts: Date.now() }) });
    return res.status(200).json({ basarili: true, abone: true, hedefler: temiz.length });
  } catch (e) {
    return res.status(500).json({ hata: "Alarm kaydedilemedi", detay: e.message });
  }
}

// ── Hız sınırı ─────────────────────────────────────────────────────────────
function istemciIp(req) {
  const x = req.headers["x-forwarded-for"];
  if (typeof x === "string" && x) return x.split(",")[0].trim();
  return req.headers["x-real-ip"] || "bilinmeyen";
}
async function hizSiniriAsildiMi(req) {
  try {
    const ip = istemciIp(req); if (ip === "bilinmeyen") return false;
    const p = Math.floor(Date.now() / 60000);
    const a = `rl:kur:${ip}:${p}`;
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
  let v;
  try { v = apiKey ? await guncelle(apiKey, req.query.guncelle === "1" || teshisModu, teshis) : await veriOku(); }
  catch (e) { teshis.hata = e.message; v = await veriOku(); }
  const gunler = v.gunler || {};
  const tarihler = Object.keys(gunler).sort();
  const govde = {
    gunler,
    sonGuncelleme: tarihler[tarihler.length - 1] || null,
    sonKontrol: v.sonKontrol || null,
    bugun: istanbulBugunIso(),
    kaynak: "TCMB · EVDS",
    madenKaynak: { altin: v.maden?.altin ? "evds" : "hesap", gumus: v.maden?.gumus ? "evds" : "hesap" },
  };
  if (teshisModu) govde._teshis = { ...teshis, seri: v.seri, maden: v.maden, gunSayisi: tarihler.length, ilk: tarihler[0], son: tarihler[tarihler.length - 1] };
  res.setHeader("Cache-Control", teshisModu ? "no-store" : "public, s-maxage=120, stale-while-revalidate=600");
  return res.status(200).json(govde);
}
