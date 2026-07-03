// api/tefas-proxy.js
// PUBLIC endpoint — kullanıcı isteklerinin hepsi buraya gelir.
// Normal akışta Fonoloji'ye HİÇ canlı istek atmaz: veri, api/cron-tefas-guncelle.js
// tarafından günde 3 kez (08:00/09:00/10:00 TR) Vercel KV'ye yazılır, burası
// sadece KV'yi okur. Bu sayede:
//  - Gün içinde binlerce kullanıcı isteği tek bir hızlı KV okumasına gider
//  - Herkes aynı, tutarlı veriyi görür (önceki "bazı kullanıcıda eksik geliyor"
//    sorununun kök nedeni, her edge node'un kendi ayrı cache'i olmasıydı)
//  - Fonoloji'ye giden istek sayısı günde ~birkaç düzine ile sınırlı kalır
//
// GÜVENLİK AĞI: KV boşsa (ilk kurulum) ya da anormal derecede bayatsa (cron uzun
// süredir çalışmamış — ör. KV henüz bağlanmamış), bir kerelik canlı çekim yapılır
// ve sonucu KV'ye de yazar; sonraki istekler yine KV'den hızlıca okur.

import { kv } from "@vercel/kv";
import { fonVerisiCek } from "./_lib/fonFetch.js";

const KV_ANAHTAR = "tefas:katilim-fonlari";
const BAYATLIK_SINIRI_SAAT = 20; // bu kadar saattir güncellenmediyse "bootstrap" say

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    let kayit = await kv.get(KV_ANAHTAR).catch(() => null);

    const bayatMi = !kayit || (Date.now() - new Date(kayit.guncelleme).getTime()) > BAYATLIK_SINIRI_SAAT*3600*1000;

    if (bayatMi) {
      // KV boş/çok bayat — muhtemelen ilk kurulum ya da cron bir süredir çalışmadı.
      try {
        const taze = await fonVerisiCek();
        if (taze.count > 0) {
          await kv.set(KV_ANAHTAR, taze).catch(() => {});
          kayit = taze;
        }
      } catch (e) {
        // Canlı çekim de başarısız — elimizde ne varsa (bayat da olsa) onu döneceğiz.
      }
    }

    if (!kayit) {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=30");
      return res.status(200).json({
        success: false,
        error: "Veri henüz mevcut değil (KV boş ve canlı çekim de başarısız oldu). Vercel KV'nin projeye bağlı olduğunu ve cron job'ın en az bir kez çalıştığını kontrol edin.",
        count: 0,
        data: [],
      });
    }

    // KV okuması ucuz olduğu için CDN cache kısa tutulabilir — asıl "günde birkaç
    // kez tazelenme" garantisi cron+KV'den geliyor, bu sadece ek bir tampon.
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=900");
    return res.status(200).json({
      success: true,
      count: kayit.count,
      guncelleme: kayit.guncelleme,
      kaynakBayat: bayatMi,
      kategori_dagilim: kayit.kategori_dagilim,
      data: kayit.data,
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message, count: 0, data: [] });
  }
}
