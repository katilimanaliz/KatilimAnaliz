// api/_lib/hazineSukuk.js — Hazine Kira Sertifikası (sukuk) Takibi (2026-10-16)
//
// KAYNAK: hmb.gov.tr herkese açık REST arayüzü (/portal/v2/posts). İki tür duyuru okunur:
//   • "…İhraç Sonucuna İlişkin" (düz metin): ISIN, tutar, valör, itfa (altın için ayrıca %0,45 kira oranı ve kg)
//   • "…İhracına İlişkin Basın Duyurusu" (PDF eki): ISIN, 6 aylık kira oranı, valör, itfa, kira ödeme tarihleri
// Her ihraç ISIN ile birleştirilir; bir kez işlenen duyuru Redis'e yazılır (sukuk:veri:v1), tekrar çekilmez.
// SEED: ilk kurulum / Hazine erişilemezse ekran boş kalmasın diye Hazine duyurularından elle alınmış son ihraçlar.
// PDF metni 'unpdf' paketiyle çıkarılır (dinamik import; paket yoksa/başarısızsa ekran SEED + duyuru metinleriyle çalışır).
// Ayrı Vercel fonksiyonu AÇILMAZ (Hobby 12 sınırı): /api/evds-proxy?sukuk=1 üzerinden çağrılır.

import { Redis } from "@upstash/redis";
import { htmlMetne, postTipi, turBelirle, yaziTarih, duyuruPdfAyristir, sonucAyristir } from "./sukukAyristir.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
export const config = { maxDuration: 60 };

const HMB = "https://www.hmb.gov.tr/portal/v2";
const KV_VERI = "sukuk:veri:v1";
const KV_KILIT = "sukuk:kilit";
const KONTROL_ARALIK_MS = 3 * 3600 * 1000;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0; +https://katilimplus.com)", Accept: "application/json,*/*" };

// Hazine duyurularından (Ağu–Eki 2026). tutar: TL / USD / kg. tutarı bilinmeyen null.
const SEED = [
  { isin: "TRD130928T10", tur: "sabit",  ihale: "2026-09-15", valor: "2026-09-16", itfa: "2028-09-13", vadeGun: 728, donemOran: 18.3,  tutar: 32206100000, birim: "TL",
    odemeler: ["2027-03-17", "2027-09-15", "2028-03-15", "2028-09-13"] },
  { isin: "TRD041028T26", tur: "tlrefk", ihale: "2026-10-05", valor: "2026-10-07", itfa: "2028-10-04", vadeGun: 728, donemOran: 18.9,  tutar: 59255500000, birim: "TL",
    odemeler: ["2027-04-07", "2027-10-06", "2028-04-05", "2028-10-04"] },
  { isin: "TRD090828T17", tur: "tlrefk", ihale: "2026-08-10", valor: "2026-08-12", itfa: "2028-08-09", vadeGun: 728, donemOran: 19.5,  tutar: null, birim: "TL",
    odemeler: ["2027-02-10", "2027-08-11", "2028-02-09", "2028-08-09"] },
  { isin: "TRD041028T18", tur: "altin",  ihale: "2026-10-05", valor: "2026-10-07", itfa: "2028-10-04", vadeGun: 728, donemOran: 0.45,  tutar: 17885, birim: "kg", odemeler: [] },
  { isin: "TRD200827F19", tur: "usd",    ihale: "2026-08-20", valor: "2026-08-21", itfa: "2027-08-20", vadeGun: 364, donemOran: 2.72,  tutar: 105427000, birim: "USD",
    odemeler: ["2027-02-19", "2027-08-20"] },
];

async function fetchZamanli(url, ms = 12000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { headers: UA, signal: c.signal }); } finally { clearTimeout(t); }
}
function birles(eski, yeni) {
  const o = { ...(eski || {}) };
  for (const k of Object.keys(yeni || {})) {
    const v = yeni[k];
    if (v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
    o[k] = v;
  }
  return o;
}
async function pdfMetni(url) {
  const r = await fetchZamanli(url, 20000);
  if (!r.ok) throw new Error(`PDF HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : String(text || "");
}
function pdfLinki(icerikHtml) {
  const m = /href=["']([^"']+\.pdf)["']/i.exec(String(icerikHtml || ""));
  return m ? (m[1].startsWith("http") ? m[1] : "https://www.hmb.gov.tr" + m[1]) : null;
}

async function veriOku() {
  let v = null; try { v = await redis.get(KV_VERI); } catch {}
  if (!v || typeof v !== "object") v = { ihraclar: {}, islenen: [], sonKontrol: 0 };
  v.ihraclar = v.ihraclar || {}; v.islenen = v.islenen || [];
  return v;
}

// Hazine'den yeni duyuruları işler. teshis verilirse ayrıntı toplar.
async function yenile(v, teshis) {
  const log = teshis || [];
  const r = await fetchZamanli(`${HMB}/posts?search=kira+sertifikas%C4%B1&per_page=30&orderby=date&order=desc&_fields=slug,date,title,content`);
  if (!r.ok) throw new Error(`Hazine HTTP ${r.status}`);
  const posts = await r.json();
  if (!Array.isArray(posts)) throw new Error("Hazine yanıtı beklenmedik");
  let pdfSayisi = 0;
  // eskiden yeniye işle: yeni duyuru eskinin üstüne yazsın
  for (const p of posts.slice().reverse()) {
    const baslik = htmlMetne(p?.title?.rendered ?? p?.title ?? "");
    const tip = postTipi(baslik); if (!tip) continue;
    const slug = String(p.slug || ""); if (v.islenen.includes(slug)) continue;
    const icerik = p?.content?.rendered ?? p?.content ?? "";
    const tur = turBelirle(baslik); const ihale = yaziTarih(baslik) || String(p.date || "").slice(0, 10);
    try {
      if (tip === "sonuc") {
        const s = sonucAyristir(htmlMetne(icerik), baslik);
        if (!s) { log.push({ baslik, tip, sonuc: "ayrıştırılamadı" }); continue; }
        v.ihraclar[s.isin] = birles(v.ihraclar[s.isin], { isin: s.isin, tur: s.tur, ihale, valor: s.valor, itfa: s.itfa, donemOran: s.donemOran, tutar: s.tutar, birim: s.birim });
        v.islenen.push(slug); log.push({ baslik, tip, isin: s.isin, tutar: s.tutar });
      } else if (tur !== "altin") {
        const link = pdfLinki(icerik);
        if (!link) { v.islenen.push(slug); log.push({ baslik, tip, sonuc: "PDF yok" }); continue; }
        if (pdfSayisi >= 6) continue; pdfSayisi++;
        const metin = await pdfMetni(link);
        const liste = duyuruPdfAyristir(metin);
        if (teshis) log.push({ baslik, link, metinIlk600: metin.slice(0, 600), ayristirilan: liste });
        if (!liste.length) continue;   // ayrıştırılamadı: yeniden denenebilsin
        for (const d of liste) {
          v.ihraclar[d.isin] = birles(v.ihraclar[d.isin], { isin: d.isin, tur, ihale, valor: d.valor, itfa: d.itfa, vadeGun: d.vadeGun, donemOran: d.donemOran, odemeler: d.odemeler });
        }
        v.islenen.push(slug);
      } else { v.islenen.push(slug); }
    } catch (e) { log.push({ baslik, tip, hata: String(e?.message || e).slice(0, 160) }); }
  }
  v.islenen = v.islenen.slice(-200);
  v.sonKontrol = Date.now();
  await redis.set(KV_VERI, v);
  return v;
}

function liste(v) {
  const m = {};
  for (const s of SEED) m[s.isin] = { ...s };
  for (const k of Object.keys(v.ihraclar)) m[k] = birles(m[k], v.ihraclar[k]);
  return Object.values(m)
    .filter((x) => x.isin && x.itfa && (x.donemOran != null || x.tutar != null))
    .sort((a, b) => String(b.valor || b.ihale || "").localeCompare(String(a.valor || a.ihale || "")));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  const teshis = req.query.teshis !== undefined ? [] : null;
  let v = await veriOku(); let hata = null;
  const eski = Date.now() - (v.sonKontrol || 0) > KONTROL_ARALIK_MS;
  if (eski || teshis || req.query.yenile !== undefined) {
    let kilit = false; try { kilit = !!(await redis.set(KV_KILIT, "1", { nx: true, ex: 90 })); } catch {}
    if (kilit || teshis) {
      try { v = await Promise.race([yenile(v, teshis), new Promise((_, rj) => setTimeout(() => rj(new Error("zaman aşımı")), 40000))]); }
      catch (e) { hata = String(e?.message || e).slice(0, 160); try { v.sonKontrol = Date.now() - KONTROL_ARALIK_MS + 15 * 60 * 1000; await redis.set(KV_VERI, v); } catch {} }
    }
  }
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  const govde = { ihraclar: liste(v), guncelleme: v.sonKontrol || null, kaynak: "hmb.gov.tr" };
  if (teshis) { govde.teshis = teshis; govde.hata = hata; govde.islenen = v.islenen.length; }
  return res.status(200).json(govde);
}
