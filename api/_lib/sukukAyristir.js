// api/_lib/sukukAyristir.js — Hazine kira sertifikası duyurularını ayrıştırma (bağımlılıksız, saf fonksiyonlar)
const AYLAR = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12 };
const ascii = (s) => String(s || "").toLocaleLowerCase("tr-TR")
  .split("ı").join("i").split("ş").join("s").split("ç").join("c").split("ö").join("o").split("ü").join("u").split("ğ").join("g").split("â").join("a");

export function bosluk(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
export function htmlMetne(h) {
  let t = String(h || "").replace(/<[^>]*>/g, " ");
  t = t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return bosluk(t);
}
function trSayi(s) { // "32.206.100.000,00" | "18,30" | "17.885"
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}
function trOran(s) { const n = parseFloat(String(s).replace(",", ".")); return isFinite(n) ? n : null; }
function isoGunAy(g, ay, y) { return `${y}-${String(ay).padStart(2, "0")}-${String(g).padStart(2, "0")}`; }
export function noktaliTarih(s) { const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }
export function yaziTarih(s) { // "7 Ekim 2026"
  const m = /(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/.exec(s || "");
  if (!m) return null; const ay = AYLAR[ascii(m[2])]; return ay ? isoGunAy(+m[1], ay, m[3]) : null;
}
export function turBelirle(baslik) {
  const a = ascii(baslik);
  if (a.includes("altin")) return "altin";
  if (a.includes("tlrefk")) return "tlrefk";
  if (a.includes("abd dolari")) return "usd";
  if (a.includes("avro")) return "eur";
  return "sabit";
}
export function postTipi(baslik) {
  const a = ascii(baslik);
  if (!a.includes("kira sertifikasi")) return null;
  if (a.includes("sonuc")) return "sonuc";
  if (a.includes("ihracina iliskin")) return "duyuru";
  return null;
}

// İhraç duyurusu PDF metni → [{isin, valor, itfa, vadeGun, donemOran, odemeler, ihaleNo}]
export function duyuruPdfAyristir(metin) {
  const t = bosluk(metin);
  const parcalar = t.split(/[İI]hale\s*Numaras[ıi]/).slice(1);
  const out = [];
  for (const p of parcalar) {
    const isin = /ISIN\s*Kodu\s*(TRD[0-9A-Z]{9})/.exec(p); if (!isin) continue;
    const valor = noktaliTarih((/Val[öo]r\s*(\d{2}\.\d{2}\.\d{4})/.exec(p) || [])[0]);
    const itfa = noktaliTarih((/[İI]tfa\s*Tarihi\s*(\d{2}\.\d{2}\.\d{4})/.exec(p) || [])[0]);
    const vade = /Vade\s*\(G[üu]n\)\s*(\d+)/.exec(p);
    const oran = /(?:Kira|Kupon)\s*Oran[ıi]\s*\(6\s*Ay\)\s*%?\s*([\d.,]+)\s*%?/.exec(p);
    const ihale = /^\s*(\d{4,6})/.exec(p);
    const odemeler = [];
    const re = /\d\.\s*Kira\s*[ÖO]demesi(?:\s*ve\s*[İI]tfa\s*Bedeli)?\s*(\d{2}\.\d{2}\.\d{4})/g; let m;
    while ((m = re.exec(p))) { const d = noktaliTarih(m[1]); if (d && !odemeler.includes(d)) odemeler.push(d); }
    out.push({ isin: isin[1], valor, itfa, vadeGun: vade ? +vade[1] : null, donemOran: oran ? trOran(oran[1]) : null, odemeler, ihaleNo: ihale ? ihale[1] : null });
  }
  return out;
}

// İhraç sonucu duyuru metni (HTML'den düz metin) → {isin, tutar, birim, valor, itfa, donemOran?}
export function sonucAyristir(metin, baslik) {
  const t = bosluk(metin); const tur = turBelirle(baslik);
  const isinler = [...t.matchAll(/(TRD[0-9A-Z]{9})\s*ISIN/g)].map((m) => m[1]);
  if (!isinler.length) return null;
  const o = { tur, isin: isinler[isinler.length - 1], tutar: null, birim: null, valor: null, itfa: null, donemOran: null };
  const v = /(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4})\s*val[öo]rl[üu]/i.exec(t); if (v) o.valor = yaziTarih(v[1]);
  const i = /(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4})\s*itfa\s*tarihli/i.exec(t); if (i) o.itfa = yaziTarih(i[1]);
  if (tur === "altin") {
    const a = /(TRD[0-9A-Z]{9})\s*ISIN\s*kodlu\s*6\s*ayda\s*bir\s*%\s*([\d,]+)\s*kira\s*[öo]demeli\s*([\d.]+)\s*kilogram/i.exec(t);
    if (!a) return null;
    o.isin = a[1]; o.donemOran = trOran(a[2]); o.tutar = trSayi(a[3]); o.birim = "kg";
  } else if (tur === "usd" || tur === "eur") {
    const a = /([\d.]+,\d{2})\s*(ABD\s*dolar[ıi]|Avro)\s*tutar[ıi]nda\s*(?:ABD\s*dolar[ıi]|Avro)\s*cinsi\s*kira/i.exec(t);
    if (a) { o.tutar = trSayi(a[1]); o.birim = tur === "usd" ? "USD" : "EUR"; }
  } else {
    const a = /([\d.]+,\d{2})\s*TL\s*tutar/i.exec(t); if (a) { o.tutar = trSayi(a[1]); o.birim = "TL"; }
  }
  return o;
}
