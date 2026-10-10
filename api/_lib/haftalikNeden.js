// api/_lib/haftalikNeden.js
//
// Haftalık Piyasa Özeti — "Piyasalarda Ne Etkili Oldu?" bölümü için SAF
// (ağ/Redis kullanmayan) yardımcılar. Gemini çağrısı ve Redis yazımı
// api/getiri.js'te; burada yalnızca (1) prompt kurulumu ve (2) modelin
// yanıtını güvenli biçimde ayrıştırma var — böylece Node ile ağsız test edilebilir.
//
// TASARIM İLKESİ: Fiyat verisi tek başına "NEDEN" sorusunu cevaplayamaz.
// Bu yüzden model Google Search ile haber arar ve yalnızca kaynakta AÇIKÇA
// geçen sebepleri yazar; kaynak yoksa o enstrüman için satır YAZILMAZ.
// Ekranda gösterilen yüzde/ad/yön her zaman bizim tablomuzdan gelir
// (modelden değil) — model yalnızca bir cümle ve (grounding'den) kaynak üretir.

export const NEDEN_SURUM = 2; // v2 (2026-10-03): cümleler "Haberlere göre ..." biçiminde, özet metnine gömülür
export const NEDEN_MODEL = "gemini-3.6-flash"; // api/asistan-ai.js ile aynı; emekli edilirse iki yerde güncelle
export const NEDEN_MAKS_SATIR = 6;

export function trTarih(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul",
    });
  } catch {
    return null;
  }
}

const SISTEM = `Sen KatılımPlus uygulamasının haftalık piyasa özeti editörüsün. Görevin, verilen haftalık hareketlerin NEDENLERİNİ, yalnızca Google Search ile bulduğun güvenilir haber kaynaklarında AÇIKÇA belirtilmişse kısa cümlelerle yazmaktır.

KURALLAR:
1. Yalnızca verilen tarih aralığındaki gelişmeleri kullan. Başka bir haftanın haberini kullanma.
2. Bir hareketin nedeni arama sonuçlarında açıkça belirtilmiyorsa o enstrüman için SATIR YAZMA. Tahmin, çıkarım veya genel piyasa klişesi ancak kaynakta aynen geçiyorsa yazılır.
3. Cümlede yüzde veya fiyat rakamını TEKRARLAMA (rakamlar özet metninde zaten var); yalnızca SEBEBİ anlat. Haberdeki bir olayı (örn. "Fed faizi sabit tuttu") ancak kaynakta yazdığı kadarıyla ve olayın kendisiyle sınırlı olarak yaz.
4. Cümle, hareketin yönüyle tutarlı olmalı (tablodaki işarete göre: eksi = düşüş, artı = yükseliş).
5. Yatırım tavsiyesi, fiyat tahmini, beklenti, "alınmalı/satılmalı/fırsat" gibi ifadeler YASAK.
6. Her satır tek cümle, en fazla 200 karakter, Türkçe, düz metin ve "Haberlere göre " ifadesiyle BAŞLAMALI. Markdown, bağlantı, köşeli parantez, kaynak numarası YOK. Örnek: "Haberlere göre düşüşte bankacılık hisselerindeki satışlar öne çıktı."
7. En fazla ${NEDEN_MAKS_SATIR} satır; en çok değişen enstrümanlara öncelik ver.

ÇIKTI BİÇİMİ: her satır "KOD|cümle". KOD, tablodaki kodlardan biri olmalı. Hiçbir neden doğrulanamıyorsa yalnızca "YOK" yaz. Başka hiçbir şey yazma.`;

export function nedenPromptlari(kayit) {
  const satirlar = (kayit?.satirlar || []).filter(
    (s) => s && s.kod && typeof s.getiri === "number" && isFinite(s.getiri)
  );
  const kodlar = new Set(satirlar.map((s) => s.kod));
  const ilk = trTarih(kayit?.donem?.ilkTarih);
  const son = trTarih(kayit?.donem?.sonTarih);
  const tablo = satirlar
    .map((s) => {
      const isaret = s.getiri >= 0 ? "+" : "";
      const sonDeger = typeof s.son === "number" && isFinite(s.son) ? s.son.toFixed(2) : "-";
      return `${s.kod} | ${s.ad} | haftalık değişim ${isaret}%${s.getiri} | hafta sonu değeri ${sonDeger}`;
    })
    .join("\n");
  const kullanici =
    `Dönem: ${ilk || "?"} kapanışından ${son || "?"} kapanışına kadar (Türkiye saatiyle bir piyasa haftası).\n\n` +
    `Haftalık hareketler:\n${tablo}\n\n` +
    `Bu tarihler arasındaki Türkiye ve küresel piyasa haberlerini ara: BIST 100, dolar/TL, altın, gümüş, Brent petrol, ` +
    `Fed/TCMB/ECB kararları ve açıklamaları, ABD ve Avrupa makro verileri. Yalnızca kaynakta açıkça geçen sebepleri yaz.`;
  return { sistem: SISTEM, kullanici, kodlar };
}

// Grounding kaynak adı: chunk.web.title (genelde alan adı). uri bir yönlendirme
// bağlantısıdır (vertexaisearch...), kullanıcıya anlamsız — bilerek KULLANILMIYOR.
function kaynakAdi(chunk) {
  const ham = String(chunk?.web?.title || "").trim();
  if (!ham) return null;
  const a = ham.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].slice(0, 40);
  return a || null;
}

function cumleTemizle(c) {
  return String(c)
    .replace(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, "") // [1] [2, 3] kaynak numaraları
    .replace(/[*_`#>]/g, "")                        // markdown kalıntıları
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1") // "[1]" silinince kalan boşluk-noktalama
    .trim();
}

const YASAK_DESEN = /(https?:\/\/|www\.|\.com\b|\.tr\b|tavsiye|öneririz|almalı|satmalı|fırsat|kesinlikle|garanti)/i;

// metin: modelin ham yanıtı. gm: candidate.groundingMetadata. kodlar: izin verilen KOD kümesi.
// Dönüş: { satirlar:[{kod,metin,kaynaklar}], kaynaklar:[...] }  veya  { hata:"..." }
export function nedenCozumle(metin, gm, kodlar) {
  const ham = String(metin || "");
  const chunks = Array.isArray(gm?.groundingChunks) ? gm.groundingChunks : [];
  const destekler = Array.isArray(gm?.groundingSupports) ? gm.groundingSupports : [];

  const adaylar = [];
  let konum = 0;
  for (const hamSatir of ham.split("\n")) {
    const baslangic = konum;
    konum += hamSatir.length + 1;
    const m = hamSatir.trim().match(/^([A-Z0-9_]+)\s*\|\s*(.+)$/);
    if (!m) continue;
    const kod = m[1];
    if (!kodlar.has(kod)) continue;
    if (adaylar.some((a) => a.kod === kod)) continue; // enstrüman başına tek satır
    const cumle = cumleTemizle(m[2]);
    if (cumle.length < 20 || cumle.length > 260) continue;
    // Cümle özet paragrafının ortasına gömülecek: biçim "Haberlere göre ..." değilse atılır
    // (büyük/küçük harf dönüştürerek düzeltmeye ÇALIŞILMAZ: "Fed", "TCMB" gibi özel adlar bozulur)
    if (!/^Haberlere göre\s/.test(cumle)) continue;
    if (YASAK_DESEN.test(cumle)) continue;
    // grounding segment indeksleri UTF-8 BAYT cinsindendir (Türkçe karakterler 2 bayt)
    const byteBas = Buffer.byteLength(ham.slice(0, baslangic), "utf8");
    const byteSon = Buffer.byteLength(ham.slice(0, baslangic + hamSatir.length), "utf8");
    adaylar.push({ kod, metin: cumle, byteBas, byteSon });
    if (adaylar.length >= NEDEN_MAKS_SATIR) break;
  }

  if (adaylar.length === 0) return { satirlar: [], kaynaklar: [] }; // "YOK" ya da doğrulanabilir neden yok

  // Arama hiç yapılmadıysa (kaynak yok) model kendi bilgisinden yazmıştır → ATIL
  if (chunks.length === 0) return { hata: "kaynaksiz" };

  const blok = [];
  chunks.forEach((c) => {
    const a = kaynakAdi(c);
    if (a && !blok.includes(a)) blok.push(a);
  });

  adaylar.forEach((a) => {
    const set = new Set();
    destekler.forEach((d) => {
      const bas = d?.segment?.startIndex ?? 0;
      const son = d?.segment?.endIndex ?? 0;
      if (son > a.byteBas && bas < a.byteSon) {
        (d.groundingChunkIndices || []).forEach((ci) => {
          const ad = kaynakAdi(chunks[ci]);
          if (ad) set.add(ad);
        });
      }
    });
    a.kaynaklar = [...set].slice(0, 3);
  });

  // Satır bazında eşleşme varsa YALNIZCA kaynağı eşleşen satırlar kalır;
  // hiç eşleşme çıkmadıysa (alan eksik/biçim farkı) satırlar blok kaynaklarıyla tutulur.
  const eslesen = adaylar.filter((a) => a.kaynaklar.length > 0);
  const secilen = eslesen.length > 0 ? eslesen : adaylar;
  return {
    satirlar: secilen.map((a) => ({
      kod: a.kod,
      metin: a.metin,
      kaynaklar: a.kaynaklar.length > 0 ? a.kaynaklar : blok.slice(0, 3),
    })),
    kaynaklar: blok.slice(0, 6),
  };
}
