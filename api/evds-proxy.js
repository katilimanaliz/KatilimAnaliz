// api/evds-proxy.js - FINAL v11
// Haftalık kredi oranları + Aylık stok + Enflasyon + TLREF (oran, endeksten türetilmiş) + AOFM
// + Dış Ticaret & Ödemeler Dengesi (v10) + SPK Kira Sertifikası İhraçları (v11)
//
// TLREF DÜZELTMESİ (2026-07): TP.BISTTLREF.KAPANIS ham değeri bir ORAN (%) değil,
// bir ENDEKS seviyesidir (örn. 6223.01) — TLREF'in her gün bileşik olarak
// büyüttüğü bir toplam getiri endeksi. Gerçek günlük/yıllıklandırılmış TLREF
// ORANINI elde etmek için ardışık iki günün endeks değerinden türetiyoruz.
//
// TÜFE NOTU (2026-07, ÇÖZÜLDÜ): TCMB'nin baz yıl güncellemesi (2025=100)
// nedeniyle eski TP.FE.OKTG01 serisi Aralık 2025'te donmuştu. Doğru yeni seri
// kodu (TP_TUKFIY2025_GENEL) EVDS üzerinden bulunup doğrulandı, Haziran 2026'ya
// kadar güncel veri veriyor. ENFLASYON dizisi buna göre güncellendi.
//
// TÜFE SERİ DÜZELTMESİ (2026-07, v7): Ana kart (anlık TUFE_YILLIK) değeri ile
// detay tablosundaki (TUFE_YILLIK_SERI) en son satır birbirinden farklı
// görünüyordu (örn. %32,11 vs %33,92). Kök neden: YoY (yıllık değişim) hesabı
// "12 ay önceki" veriyle kıyaslanmalıyken, seri döngüsü yanlışlıkla "13 ay
// önceki" veriyle kıyaslıyordu (index i-13, doğrusu i-12). Ana karttaki tekil
// hesap zaten doğruydu (tufeDizi.length-13, ki bu length-1'den 12 geridir);
// sadece seri döngüsündeki indeks kayması düzeltildi — artık ikisi birebir
// aynı ayı, aynı yöntemle hesaplayıp aynı sonucu veriyor.
//
// DIŞ TİCARET & ÖDEMELER DENGESİ (2026-07, v10): Seri kodları EVDS katalog
// keşfiyle (?katalog=1&filtre=DIS TICARET / ODEMELER DENGESI / EFEKTIF DOVIZ)
// bulunup doğrulandı:
//   TP.IHRACATBEC.9999    İhracat toplamı (Genel Ticaret Sistemi, aylık, USD)
//   TP.ITHALATBEC.9999    İthalat toplamı (Genel Ticaret Sistemi, aylık, USD)
//   TP.ODANA6.Q01         Cari İşlemler Hesabı (Analitik Sunum, aylık, USD)
//   TP.HARICCARIACIK.K10  Altın ve Enerji Hariç Cari İşlemler Hesabı (aylık)
//   TP.RK.T1.Y            TÜFE Bazlı Reel Efektif Döviz Kuru (2025=100, endeks)
// Türetilenler: Dış Ticaret Dengesi (ihracat-ithalat), Karşılama Oranı
// (ihracat/ithalat*100) ve ihracat/ithalat/denge/cari için 12 AYLIK KÜMÜLATİF
// (yıllıklandırılmış) toplamlar — takvim yılına kilitli olmadığından her ay
// güncellenir; ekstra EVDS isteği gerektirmez.
//
// SPK KİRA SERTİFİKASI (2026-07-28, v11): Sermaye Piyasası Kurulu'nun resmi
// açık web servisinden (ws.spk.gov.tr) tür bazında kira sertifikası ihraç
// tutarları. Bu, EVDS/FRED'den TAMAMEN AYRI bir kaynak ve ayrı bir şube
// (?spk=sukuk) olarak eklendi — ana uca eklenmedi çünkü:
//   (a) ana uç zaten 12 EVDS + 11 FRED isteği yapıyor, 5 istek daha eklemek
//       Vercel zaman aşımı riskini artırırdı,
//   (b) SPK verisi AYDA BİR güncelleniyor; 6 saatlik ana TTL yerine çok daha
//       uzun (12 saat) önbelleklenebilir, gereksiz istek yapılmaz.
// Kimlik doğrulama GEREKTİRMEZ (kamuya açık devlet servisi) — Midas/BigPara
// gibi kaynaklardaki lisans belirsizliği burada yok.
// BİRİM UYARISI: Bu uç MİLYON TL döndürür. SPK'nın "İhraççı Bazında" ucu ise
// (ileride eklenirse) HAM TL döndürüyor — ikisi karıştırılırsa rakamlar bin
// kat şişer. Yanıtta "birim" alanı bilerek açıkça bildiriliyor.

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis";

// ── KALICI ÖNBELLEK (Vercel KV / Upstash Redis) ────────────────────────────
// ÖNEMLİ: "let cacheAnlik = {...}" gibi bellek-içi (in-memory) değişkenler
// serverless ortamda GÜVENİLİR DEĞİL — Vercel her istekte aynı "sıcak" fonksiyon
// örneğini kullanacağını garanti etmez, sık sık sıfırlanıp her kullanıcı için
// ayrı ayrı TCMB/FRED'e sorgu atabilir. Bu yüzden tefas-proxy'de kurduğumuz aynı
// Upstash Redis'i burada da kullanıyoruz — TÜM kullanıcılar gerçekten aynı,
// kalıcı önbelleklenmiş veriyi görsün.
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
// NOT (2026-07-04): v1 → v2 sürüm değişikliği BİLEREK yapıldı. TLREF hesaplama
// mantığı düzeltildi (DÜZELTME 3, aşağıda) ama eski v1 anahtarı altında Redis'te
// 6 saatlik TTL ile ESKİ (hatalı) hesaplanmış değer önbellekte duruyordu — kod
// deploy edilse bile önbellek kontrolü hesaplamadan ÖNCE çalıştığı için kullanıcı
// hâlâ eski %119,98 değerini görüyordu. Anahtar versiyonunu artırarak eski cache
// otomatik olarak "yok" sayılıyor, ilk istekte taze (düzeltilmiş) veri hesaplanıp
// yeni anahtar altında cache'leniyor. İleride benzer bir hesaplama mantığı
// değişikliği yapılırsa yine bu versiyonu artırmak gerekir.
// NOT (2026-07-05): v4 → v5 sürüm değişikliği — DÜZELTME 5 ile TLREF hesaplama
// yöntemi (regresyon → medyan + tam formül) değiştiği için tekrar artırıldı.
// NOT (2026-07): v5 → v6 sürüm değişikliği — TÜFE serisindeki off-by-one
// (13 ay yerine 12 ay geri kıyaslama) düzeltmesi eski cache'i geçersiz kılmak
// için yapıldı; aksi halde kod deploy edilse bile kullanıcı 6 saat boyunca
// hâlâ hatalı önbelleklenmiş TUFE_YILLIK_SERI'yi görmeye devam ederdi.
// NOT (2026-07-09): v6 → v7 sürüm değişikliği — ABD tahvil faizleri (DGS2/5/10),
// FED (DFF) ve ECB (ECBDFR) FRED serileri eklendiği için yapıldı. Versiyon
// artırılmazsa eski v6 önbelleği (bu alanları içermeyen) 6 saat boyunca
// döndürülmeye devam eder — yeni alanlar "—" görünür (tam bu hatayı yaşadık).
// NOT (2026-07-09b): v7 → v8 sürüm değişikliği — SOFR 3M/6M (SOFR90DAYAVG/
// SOFR180DAYAVG) eklendiği için yapıldı. Versiyon artırılmazsa eski önbellek
// bu yeni alanları içermeden 6 saat daha döner (bkz. bir önceki v6→v7 dersi).
// NOT (2026-07-09c): v8 → v9 sürüm değişikliği — FED Üst/Alt Bant (DFEDTARU/
// DFEDTARL) eklendiği için yapıldı.
// NOT (2026-07-11): v9 → v10 sürüm değişikliği — Dış Ticaret & Ödemeler
// Dengesi serileri (DT_* / CARI_* / REK_*) eklendiği için yapıldı. Aynı ders:
// versiyon artırılmazsa eski önbellek yeni alanları 6 saat boyunca göstermez.
// NOT (2026-07-28): SPK kira sertifikası AYRI bir anahtar/şube kullandığı için
// (KV_SPK_SUKUK_KEY) ana anahtarın versiyonu ARTIRILMADI — ana yanıtın içeriği
// hiç değişmedi, mevcut önbelleği boşuna geçersiz kılmaya gerek yok.
// NOT (2026-07-30): v17 → v18 — REZERV_TOPLAM/ALTIN/DOVIZ alanları eklendi ve
// rezerv kaynağı aylık B grubundan haftalık C grubuna geçirildi. Versiyon
// artırılmazsa eski önbellek 6 saat boyunca hem yeni alanları göstermez hem de
// ESKİ YANLIŞ rezerv rakamını döndürmeye devam eder.
// v19 (2026-07-30 ikinci tur): REZERV_NET / REZERV_SWAP / REZERV_NET_SWAPSIZ eklendi.
// v20 (2026-08-01): Enflasyon beklentisi alanları eklendi.
const KV_ANLIK_KEY = "evds:anlik:v20";
const KV_TARIHSEL_PREFIX = "evds:tarihsel:v20:";

// Vercel'in varsayılan fonksiyon süresi (Hobby planda genelde 10sn) artık 8 dış
// isteğe (5 EVDS + 3 FRED) yetmiyor — bu yüzden ERR_CONNECTION_CLOSED alınıyordu
// (fonksiyon yanıt vermeden aniden kesiliyordu). Süreyi uzatıyoruz.
export const config = { maxDuration: 60 };

// Her dış isteğe ayrı bir zaman sınırı — tek bir yavaş/asılı kalan istek tüm
// fonksiyonu bloke etmesin diye.
async function fetchZamanli(url, opsiyonlar={}, msTimeout=8000){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), msTimeout);
  try {
    return await fetch(url, { ...opsiyonlar, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
const CACHE_TTL_SANIYE = 6 * 3600; // 6 saat, Redis TTL saniye cinsinden ister

// ── HIZ SINIRI + CDN ÖNBELLEĞİ (2026-08-02 güvenlik taraması) ──────────────
// Bu uç kimlik doğrulaması olmadan herkese açık. Kötü niyetli biri saniyede
// yüzlerce istek atarsa uygulama "çökmez" ama FATURA çöker: her istek bir
// serverless çağrısı + Upstash komutu demek.
//
// İki katmanlı savunma kuruldu:
//   1) CDN önbelleği (asıl kalkan) — Cache-Control ile Vercel'in kenar
//      sunucusu aynı URL'e gelen tekrarları fonksiyonu HİÇ uyandırmadan
//      yanıtlar. Saldırıda saniyede 1000 istek gelse bile fonksiyon URL
//      başına 2 dakikada bir kez çalışır.
//   2) IP başına hız sınırı — CDN'i atlatan (rastgele parametreli) istekler
//      için son savunma.
//
// Not: buradaki süre backend önbelleğinden (6-12 saat) çok daha kısa tutuldu;
// amaç tazelik kaybetmeden ani yük emmek.
const HIZ_SINIRI_ADET   = 60;   // IP başına dakikada izin verilen istek
const HIZ_SINIRI_PENCERE = 60;  // saniye
const EDGE_TTL          = 120;  // CDN önbelleği (saniye)
const EDGE_SWR          = 600;  // bayat yanıtı sunarken arkada tazele (saniye)

// İstemci IP'si. Vercel gerçek IP'yi x-forwarded-for başlığına koyar; ilk
// değer istemcidir, sonrakiler proxy zinciridir.
function istemciIp(req){
  const x = req.headers["x-forwarded-for"];
  if(typeof x === "string" && x) return x.split(",")[0].trim();
  return req.headers["x-real-ip"] || "bilinmeyen";
}

// Dakikalık sayaç. Pencere anahtarı zamandan türetiliyor, ayrı temizlik
// gerekmiyor: TTL dolunca kendisi siliniyor.
//
// ÖNEMLİ: Redis'e ulaşılamazsa İZİN VERİLİR (fail-open). Aksi halde Upstash
// kesintisi tüm kullanıcıları kilitler — çaresi hastalıktan kötü olurdu.
async function hizSiniriAsildiMi(req){
  try{
    const ip = istemciIp(req);
    if(ip === "bilinmeyen") return false;
    const pencere = Math.floor(Date.now() / (HIZ_SINIRI_PENCERE * 1000));
    const anahtar = `rl:${ip}:${pencere}`;
    const sayac = await redis.incr(anahtar);
    if(sayac === 1) await redis.expire(anahtar, HIZ_SINIRI_PENCERE * 2);
    return sayac > HIZ_SINIRI_ADET;
  }catch{
    return false;   // fail-open
  }
}

// ── SPK KİRA SERTİFİKASI (v11) ─────────────────────────────────────────────
const SPK_BASE = "https://ws.spk.gov.tr/BorclanmaAraclari/api";
const KV_SPK_SUKUK_KEY = "spk:sukuk:v3";   // v1→v2: ihraccilar alani eklendi. v2→v3: sonAy artik BOS AYI SAYMIYOR (bkz. spkYilOzeti) — eski onbellekteki hatali sonAy/degisimYuzde/aylikOrtalama degerleri gecersiz kilinmali
const SPK_CACHE_TTL = 12 * 3600;   // 12 saat — veri ayda bir güncelleniyor
const SPK_YIL_SAYISI = 5;          // trend grafiği için kaç yıl geriye gidilsin

// SPK'nın alan adları ile Türkiye'deki resmi kira sertifikası türlerinin
// eşlemesi. "fikhi" alanı, kullanıcıya tanıdık gelen İslami finans terimini
// veriyor (ekranda parantez içinde gösterilecek).
// NOT (2026-07 canlı veri gözlemi): 2026'nın ilk 7 ayında bu 6 türden yalnızca
// "yonetim" (~%89) ve "alimSatim" (~%11) kullanılmış; diğer 4'ü sıfır. Bu,
// hatalı veri DEĞİL — Türkiye'de sukuk ihraçlarının fiilen bu iki yapıda
// yoğunlaştığını gösteriyor. Frontend sıfır olan türleri gizleyip bunu
// açıkça belirtmeli (yoksa 4 boş dilimli anlamsız bir grafik çıkar).
const SPK_SUKUK_TURLERI = [
  { anahtar:"yonetim",   alan:"yonetimSozlesmesineDayaliKiraSertifikasi", ad:"Yönetim Sözleşmesine Dayalı", fikhi:"Vekâlet" },
  { anahtar:"alimSatim", alan:"alimSatimaDayaliKiraSertifikasi",          ad:"Alım-Satıma Dayalı",          fikhi:"Murabaha" },
  { anahtar:"sahiplik",  alan:"sahipligeDayaliKiraSertifikasi",           ad:"Sahipliğe Dayalı",            fikhi:"İcâre" },
  { anahtar:"ortaklik",  alan:"ortakligaDayaliKiraSertifikasi",           ad:"Ortaklığa Dayalı",            fikhi:"Müşâreke / Mudârebe" },
  { anahtar:"eser",      alan:"eserSozlesmesineDayaliKiraSertifikasi",    ad:"Eser Sözleşmesine Dayalı",    fikhi:"İstisnâ" },
  { anahtar:"diger",     alan:"digerKiraSertifikasi",                     ad:"Diğer",                       fikhi:null },
];

// SPK şemasında TÜM sayısal alanlar "nullable: true" — null/eksik gelen değeri
// 0 saymak toplamları bozmaz ama "veri yok" ile "sıfır ihraç" ayrımını da
// kaybettirmez, çünkü ay satırının kendisi gelmezse zaten hiç toplanmaz.
function spkSayi(v){ return (typeof v === "number" && isFinite(v)) ? v : 0; }

async function spkSukukYilCek(yil){
  const url = `${SPK_BASE}/SermayePiyasasiAraclariKiraSertifikasi?yil=${yil}`;
  const r = await fetchZamanli(url, { headers:{ "Accept":"application/json" } }, 10000);
  if(r.status < 200 || r.status >= 300) throw new Error(`SPK HTTP ${r.status}`);
  const text = await r.text();
  if(text.trim().startsWith("<")) throw new Error(`SPK HTML döndü: ${text.slice(0,150)}`);
  const j = JSON.parse(text);
  return Array.isArray(j) ? j : [];
}

// Bir yılın satırlarından toplamları çıkarır. sonAySiniri verilirse yalnızca
// o aya kadar olan satırlar toplanır — yıl-içi karşılaştırmanın DÜRÜST
// olabilmesi için şart: 7 aylık 2026 ile 12 aylık 2025 kıyaslanamaz.
//
// ⚠️ 2 AĞUSTOS 2026'DA YAKALANAN HATA — sonAy'ın tanımı değişti.
// SPK, henüz VERİSİ OLMAYAN ay için de satır döndürüyor:
//     {"ay":8,"donem":"2026 / 08","toplam":0,"yurtIci":0,"yurtDisi":0}
// Eski kod "gelen en büyük ay" mantığıyla sonAy=8 diyordu. Sonuç:
//   • Ekranda "İLK 8 AY" yazıyordu (ayın 2. günü!)
//   • gecenYilAyniDonem 2025'in 8 AYINI topluyordu → taban şişti
//   • degisimYuzde %99 yerine %58 görünüyordu
//   • aylikOrtalama 7 yerine 8'e bölünüyordu (%14 düşük)
// Artık sonAy = TOPLAMI SIFIRDAN BÜYÜK olan en son ay.
// Aradaki (sondan önceki) sıfır aylar korunur: max alındığı için onlar zaten
// sınırın altında kalır ve toplamlara dahil edilmeye devam eder. Yalnızca
// SONDAKİ boş aylar sayılmaz — ki istenen davranış budur.
function spkYilOzeti(satirlar, sonAySiniri){
  const turToplam = {};
  for(const t of SPK_SUKUK_TURLERI) turToplam[t.anahtar] = 0;
  let toplam = 0, yurtIci = 0, yurtDisi = 0, sonAy = 0;
  for(const s of (satirlar||[])){
    const ay = spkSayi(s.ay);
    // sonAySiniri === 0 geçerli bir sınırdır ("hiç dolu ay yok") — bu yüzden
    // truthy kontrolü DEĞİL, null kontrolü yapılıyor. Aksi halde yılın en
    // başında geçen yılın TAMAMI taban olarak toplanırdı.
    if(sonAySiniri != null && ay > sonAySiniri) continue;
    const ayToplam = spkSayi(s.kiraSertifikasiToplam);
    toplam   += ayToplam;
    yurtIci  += spkSayi(s.kiraSertifikasiToplamYurtIci);
    yurtDisi += spkSayi(s.kiraSertifikasiToplamYurtDisi);
    if(ayToplam > 0 && ay > sonAy) sonAy = ay;
    for(const t of SPK_SUKUK_TURLERI) turToplam[t.anahtar] += spkSayi(s[t.alan + "Toplam"]);
  }
  return { toplam, yurtIci, yurtDisi, sonAy, turToplam };
}

// ── İHRAÇÇI BAZINDA SPK ONAYLARI (v11) ─────────────────────────────────────
// ÖNEMLİ AYRIM: Bu uç, tür bazındaki uçtan FARKLI bir şey ölçüyor.
//   • SermayePiyasasiAraclariKiraSertifikasi → FİİLEN SATIŞI GERÇEKLEŞEN
//     tutarlar (milyon TL)
//   • DigerSermayePiyasasiAraclariIhracciBazindaIhracVerileri → SPK'nın
//     ONAYLADIĞI İHRAÇ TAVANI (ham TL). Tavan bir ÜST SINIRDIR; ihraççı bu
//     tutarın tamamını kullanmak zorunda değildir.
// Canlı veri gözlemi (2026): satisiGerceklestirilenTutarTL alanı düzensiz
// dolduruluyor — bazı kayıtlarda gerçek tutar var, çoğunda 0. Bu yüzden
// ekranda ASIL gösterilen değer "onaylanan tavan" olmalı ve etiketi de
// dürüstçe böyle yazılmalı; satış bilgisi yalnızca varsa ek olarak verilir.
// kaynakKurulus alanı da canlı veride hep null geliyor (fon kullanıcısını
// öğrenme umudumuz bu uçtan karşılanmıyor).
const SPK_IHRACCI_LIMIT = 25;  // ekranda gösterilecek en büyük N ihraççı

// Türkçe karakterleri de doğru büyütüp karşılaştırma yapar (İ/ı sorunu).
function spkNormalizeMetin(s){
  return String(s==null?"":s).toLocaleUpperCase("tr-TR")
    .split("\u0130").join("I").split("\u015E").join("S")
    .split("\u00C7").join("C").split("\u00D6").join("O")
    .split("\u00DC").join("U").split("\u011E").join("G");
}

async function spkIhracciYilCek(yil){
  const url = `${SPK_BASE}/DigerSermayePiyasasiAraclariIhracciBazindaIhracVerileri?yil=${yil}`;
  const r = await fetchZamanli(url, { headers:{ "Accept":"application/json" } }, 12000);
  if(r.status < 200 || r.status >= 300) throw new Error(`SPK ihracci HTTP ${r.status}`);
  const text = await r.text();
  if(text.trim().startsWith("<")) throw new Error(`SPK ihracci HTML döndü: ${text.slice(0,150)}`);
  const j = JSON.parse(text);
  return Array.isArray(j) ? j : [];
}

// Karışık gelen listeden (borçlanma araçları + kira sertifikası) yalnızca
// kira sertifikalarını süzüp ihraççı bazında gruplar.
function spkIhraccilariGrupla(kayitlar){
  const gruplar = {};
  let toplamKayit = 0;
  for(const k of (kayitlar||[])){
    const tur = spkNormalizeMetin(k.ihracTavaniAracTuru);
    if(tur.indexOf("KIRA SERTIFIKA") < 0) continue;   // sadece sukuk
    toplamKayit++;
    const unvan = (k.ihracciUnvani || "Bilinmiyor").trim();
    if(!gruplar[unvan]){
      gruplar[unvan] = {
        unvan,
        onayliTavan: 0,
        satisBildirilen: 0,
        onaySayisi: 0,
        sonOnayTarihi: null,
        satisYontemleri: {},
        paraBirimleri: {},
        ihracciTipi: k.ihracciTipi || null,
      };
    }
    const g = gruplar[unvan];
    g.onayliTavan   += spkSayi(k.kurulcaOnaylananIhracTavaniTutari);
    g.satisBildirilen += spkSayi(k.satisiGerceklestirilenTutarTL);
    g.onaySayisi++;
    const t = k.kurulKararTarihi ? String(k.kurulKararTarihi).slice(0,10) : null;
    if(t && (!g.sonOnayTarihi || t > g.sonOnayTarihi)) g.sonOnayTarihi = t;
    // "Tahsisli,Nitelikli" gibi virgüllü gelebiliyor — tek tek ayırıyoruz.
    for(const y of String(k.tavanSatisYontemi||"").split(",").map(s=>s.trim()).filter(Boolean)){
      g.satisYontemleri[y] = true;
    }
    if(k.ihracTavaniParaBirimi) g.paraBirimleri[k.ihracTavaniParaBirimi] = true;
  }
  const liste = Object.values(gruplar).map(g=>({
    unvan: g.unvan,
    ihracciTipi: g.ihracciTipi,
    onayliTavan: g.onayliTavan,
    satisBildirilen: g.satisBildirilen,
    onaySayisi: g.onaySayisi,
    sonOnayTarihi: g.sonOnayTarihi,
    satisYontemleri: Object.keys(g.satisYontemleri),
    paraBirimleri: Object.keys(g.paraBirimleri),
  })).sort((a,b)=> b.onayliTavan - a.onayliTavan);
  return {
    liste: liste.slice(0, SPK_IHRACCI_LIMIT),
    ihracciSayisi: liste.length,
    kayitSayisi: toplamKayit,
    toplamOnayliTavan: liste.reduce((t,g)=>t+g.onayliTavan, 0),
  };
}

// ── KAP KİRA SERTİFİKASI BİLDİRİMLERİ (v12) ────────────────────────────────
// Kaynak: Kamuyu Aydınlatma Platformu'nun kendi web arayüzünün kullandığı
// POST /tr/api/disclosure/list/main ucu. Kimlik doğrulama gerektirmiyor.
//
// NEDEN BU KAYNAK: SPK'nın kendi servislerinde (tür bazı, ihraççı bazı, özel
// durum açıklamaları) kira sertifikası ihraçlarının HANGİ KURUM ADINA
// yapıldığı bilgisi yok — `kaynakKurulus` alanı canlı veride hep null.
// KAP'ta ise `relatedStocks` alanı bu bilgiyi veriyor (örn. KATILIM VARLIK
// KİRALAMA'nın bildiriminde relatedStocks="HDFFL" → fon kullanıcısı).
//
// ⚠️ KIRILGANLIK UYARISI: Bu BELGELENMEMİŞ bir iç uçtur. KAP arayüzünü
// yenilerse alan adları veya yol değişebilir. Bu yüzden:
//   • Ayrı bir şube (?kap=sukuk) — çökerse diğer ekranlar etkilenmez
//   • Hata durumunda boş liste döner, frontend bölümü gizler
//   • Uzun önbellek (2 saat) — KAP'ın sunucusu gereksiz yorulmasın
// Bildirimler kanunen kamuya açıklanmak zorunda olan bilgilerdir; Borsa
// İstanbul'un lisanslı fiyat verisinden farklı bir hukuki zemindedir.
const KAP_LISTE_URL = "https://kap.org.tr/tr/api/disclosure/list/main";
const KV_KAP_SUKUK_KEY = "kap:sukuk:v6";   // v6: tekillestirme ozet-basi bazli
const KAP_CACHE_TTL = 2 * 3600;   // 2 saat
const KAP_GUN_ARALIK = 14;        // 14 GÜN — canlı ölçüm: 7 günde 82 sukuk
                                  // bildirimi, 1.321 ham kayıt. 14 gün hem
                                  // listeyi doldurmaya fazlasıyla yetiyor hem
                                  // de KAP'i gereksiz yormuyor.
const KAP_LIMIT = 30;             // ekranda en fazla kaç bildirim gösterilsin
// BOYUT KORUMASI (2026-07-28, canlı çöküşten sonra eklendi):
// İlk sürüm 120 günlük, TÜM şirketleri kapsayan bir istek atıyordu ve Vercel
// fonksiyonu FUNCTION_INVOCATION_FAILED ile çöktü — dönen JSON'u ayrıştırmak
// belleği taşırdı (tarayıcıda 250 kayıt bile ~1,9 MB). Artık:
//   • varsayılan pencere 30 gün,
//   • yanıt bu eşiği aşarsa hiç ayrıştırılmadan reddediliyor.
// Eşik cömert tutuldu; asıl amaç patolojik büyüklükte yanıtta çökmemek.
const KAP_MAX_BAYT = 8 * 1024 * 1024;   // 8 MB
const KAP_MAX_GUN = 90;                  // ?gun= ile bunun üstü istenemez

// KAP tarih formatı: GG.AA.YYYY
function kapTarih(d){
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}

// Bir bildirimin kira sertifikasıyla ilgili olup olmadığını belirler.
// İki yoldan yakalıyoruz: (a) ihraççı bir varlık kiralama şirketiyse,
// (b) başlık/özet metninde kira sertifikası geçiyorsa. İkisi de gerekli —
// bazı bildirimleri VKŞ dışı kurumlar da yapabiliyor (örn. MKK'nın toplu
// itfa/kupon bildirimleri).
// KAP kaydının asıl gövdesi "disclosureBasic" anahtarının altında geliyor.
// (İlk sürümde "basic" varsayılmıştı — canlı veride öyle olmadığı görüldü,
// süzgeç hiçbir kaydı yakalayamıyordu. Yine de birkaç varyantı deniyoruz ki
// KAP alan adını değiştirirse tek noktadan uyarlanabilsin.)
function kapTemel(k){
  return k?.disclosureBasic || k?.basic || k || {};
}

function kapSukukMu(k){
  const sirket = spkNormalizeMetin(k?.companyTitle);
  const metin  = spkNormalizeMetin((k?.title||"") + " " + (k?.summary||""));
  if(sirket.indexOf("VARLIK KIRALAMA") >= 0) return true;
  if(metin.indexOf("KIRA SERTIFIKA") >= 0) return true;
  return false;
}

async function kapSukukCek(gunAralik, tipler){
  const bitis = new Date();
  const baslangic = new Date();
  baslangic.setDate(baslangic.getDate() - (gunAralik || KAP_GUN_ARALIK));

  const govde = {
    fromDate: kapTarih(baslangic),
    toDate: kapTarih(bitis),
    // ODA = Özel Durum Açıklaması, DG = Diğer (İhraç Belgesi burada),
    // DUY = Duyuru. FR (finansal rapor) ve CA (hak kullanımı) bizi
    // ilgilendirmiyor, isteği küçük tutmak için dışarıda bırakıldı.
    // Çağıran taraf tip listesi verebilir. Sukuk sorgusu dar (ODA/DG/DUY),
    // hisse sorgusu geniş tutuluyor — hisse detayında en değerli bildirimler
    // FR (finansal rapor / bilanço) ve CA (hak kullanımı / temettü).
    disclosureTypes: Array.isArray(tipler) && tipler.length ? tipler : ["ODA", "DG", "DUY"],
    // memberTypes ZORUNLU (2026-07-28): ilk sürümde bu alan yoktu ve KAP
    // HTTP 500 döndürdü. Tarayıcının kendi isteğinde bu alan gönderiliyor.
    // Kodlar KAP'ın şirket kategorileriyle örtüşüyor:
    //   IGS=İşlem Gören Şirketler, DDK=Diğer KAP üyeleri/işlem görmeyenler,
    //   YK=Yatırım Kuruluşları, PYS=Portföy Yönetim Şirketleri,
    //   BDK=Bağımsız Denetim, DCS=Derecelendirme, KVH=Kripto Varlık Hizmet.
    // Varlık kiralama şirketleri IGS/DDK altında görünüyor; yine de listeyi
    // geniş tutuyoruz — süzmeyi zaten kendimiz yapıyoruz.
    memberTypes: ["IGS", "DDK", "YK", "PYS", "BDK", "DCS", "KVH"],
  };

  const r = await fetchZamanli(KAP_LISTE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      // KAP bazı otomatik istekleri tarayıcı dışı sayıp reddedebiliyor.
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    body: JSON.stringify(govde),
  }, 15000);

  if(r.status < 200 || r.status >= 300){
    // KAP'ın kendi hata mesajını da taşıyoruz — "HTTP 500" tek başına
    // körlemesine tahmin yürütmeye zorluyor (yaşanmış: eksik memberTypes).
    let govdeOrnek = "";
    try { govdeOrnek = (await r.text()).slice(0, 200); } catch {}
    throw new Error(`KAP HTTP ${r.status}${govdeOrnek ? " — " + govdeOrnek : ""}`);
  }

  // Ayrıştırmadan ÖNCE boyut kontrolü — dev bir yanıtı JSON.parse etmek
  // fonksiyonu OOM ile düşürüyor (yaşanmış vaka, bkz. yukarıdaki not).
  const uzunlukBasligi = parseInt(r.headers.get("content-length") || "0", 10);
  if(uzunlukBasligi && uzunlukBasligi > KAP_MAX_BAYT){
    throw new Error(`KAP yanıtı çok büyük (${Math.round(uzunlukBasligi/1048576)} MB) — daha dar tarih aralığı gerekiyor`);
  }

  const text = await r.text();
  // content-length gzip'li geldiğinde gerçek boyutu yansıtmayabiliyor;
  // açılmış metni de ayrıca ölçüyoruz.
  if(text.length > KAP_MAX_BAYT){
    throw new Error(`KAP yanıtı çok büyük (${Math.round(text.length/1048576)} MB açılmış) — daha dar tarih aralığı gerekiyor`);
  }
  if(text.trim().startsWith("<")) throw new Error(`KAP HTML döndü: ${text.slice(0,150)}`);

  let j;
  try { j = JSON.parse(text); }
  catch(e){ throw new Error(`KAP JSON ayrıştırılamadı: ${String(e.message).slice(0,120)}`); }
  // Yanıt ya doğrudan dizi ya da { basic: [...] } benzeri sarmalanmış olabilir;
  // ikisini de karşılıyoruz.
  const ham = Array.isArray(j) ? j
            : Array.isArray(j?.data) ? j.data
            : Array.isArray(j?.basic) ? j.basic
            : Array.isArray(j?.disclosures) ? j.disclosures
            : [];
  return { ham, hamSayi: ham.length };
}

// KAP kaydını sadeleştirip frontend'in ihtiyacı olan alanlara indirger.
// İkinci süzgeç: sukuk bildirimleri arasından SADECE İHRAÇLA İLGİLİ olanları
// bırakır. Canlı veride 7 günde 82 sukuk bildirimi çıkıyor ama çoğu kupon
// ödemesi / itfa duyurusu — kullanıcı için gürültü. Burada işe yarayanlar:
//   • İhraç Belgesi, Tertip İhraç Belgesi
//   • İhraç Tavanına İlişkin Bildirim (yönetim kurulu kararı)
//   • İzahname / Sermaye Piyasası Aracı Notu (halka arz)
//   • "...Satışının Tamamlanması" (fiilen gerçekleşen ihraç)
// Dışarıda bırakılanlar: kupon ödemesi, itfa, getiri ödemesi.
// NOT: "Kupon Oranının Belirlenmesi" bildirimleri de eleniyor — bunlar getiri
// oranı içerdiği için ileride ayrı bir bölümde değerlendirilebilir.
const KAP_IHRAC_OLUMLU = ["IHRAC", "IZAHNAME", "TERTIP", "HALKA ARZ", "SATIS"];
// "İhraç Tavanına İlişkin Bildirim" de eleniyor: ekranın üst kısmındaki
// "SPK Onayı Alan İhraççılar" bölümü zaten aynı bilgiyi TUTARLARIYLA
// gösteriyor, burada tekrar etmek gürültü yapıyor.
const KAP_IHRAC_OLUMSUZ = ["ITFA", "KUPON", "ODEME", "IHRAC TAVAN"];

function kapIhracMi(k){
  const metin = spkNormalizeMetin((k?.title||"") + " " + (k?.summary||""));
  if(KAP_IHRAC_OLUMSUZ.some(x => metin.indexOf(x) >= 0)) return false;
  return KAP_IHRAC_OLUMLU.some(x => metin.indexOf(x) >= 0);
}

// ── HİSSE BAZLI KAP BİLDİRİMLERİ (v13) ─────────────────────────────────────
// Hisse detay ekranında o hisseye ait son KAP bildirimlerini göstermek için.
//
// TASARIM: Her hisse için ayrı KAP isteği atmak israf olur — tek istekte
// zaten TÜM piyasanın bildirimleri geliyor (21 günde birkaç bin kayıt).
// Bunun yerine liste BİR KEZ çekilip sadeleştirilmiş hâli önbelleğe alınıyor,
// hisse sorguları bu önbellekten süzülüyor. Böylece 600+ hisse tek bir KAP
// isteğiyle karşılanıyor.
const KV_KAP_TUM_KEY = "kap:tum:v3";
const KAP_TUM_TTL = 3600;          // 1 saat
// PENCERE/TAVAN AYARI (2026-07-28, canlı testten sonra): İlk sürüm 21 gün
// isteyip 1.500 kayıtta kesiyordu — 21 gün ~3.500 kayıt olduğu için fiilen
// yalnızca son ~9 günü kapsıyor, üstelik hangi güne kadar kapsadığı
// öngörülemiyordu (THYAO gibi büyük bir hissede hiç bildirim çıkmamasının
// sebebi buydu). Artık DAR AMA TAM kapsama tercih ediliyor: 10 gün, tavan
// bunu rahatça alacak kadar yüksek.
const KAP_TUM_GUN = 15;
const KAP_TUM_MAX = 4000;
// Hisse detayı için geniş tip listesi — FR = Finansal Rapor (bilanço),
// CA = hak kullanımı (temettü, bedelsiz, rüçhan). Bunlar kullanıcı için
// en değerli bildirimler ve ilk sürümde dışarıda kalmışlardı.
const KAP_HISSE_TIPLER = ["ODA", "DG", "DUY", "FR", "CA"];
const KAP_HISSE_LIMIT = 8;         // hisse detayında gösterilecek bildirim sayısı

// Sadeleştirilmiş kayıt — önbelleği küçük tutmak için yalnızca gerekli alanlar.
function kapSadeKayit(k){
  const b = kapTemel(k);
  const idx = b.disclosureIndex;
  return {
    id: idx || null,
    kod: b.stockCode || null,
    ilgili: b.relatedStocks || null,
    sirket: b.companyTitle || null,
    baslik: b.title || null,
    // Özet bazen çok uzun oluyor; önbelleği şişirmemek için kırpılıyor
    // (ekranda zaten 2-3 satır gösteriliyor, tam metin KAP sayfasında).
    ozet: b.summary ? String(b.summary).slice(0, 170) : null,
    tarih: b.publishDate || null,
    ek: typeof b.attachmentCount === "number" ? b.attachmentCount : 0,
    link: idx ? `https://www.kap.org.tr/tr/Bildirim/${idx}` : null,
  };
}

// Bir kaydın belirtilen hisseye ait olup olmadığı. İki yol: bildirimi yapan
// şirketin kodu (stockCode) ya da bildirimde ilgili gösterilen şirketler
// (relatedStocks — virgül/boşlukla ayrılmış olabiliyor).
function kapHisseEslesir(kayit, kod){
  const K = String(kod||"").toUpperCase().trim();
  if(!K) return false;
  if(String(kayit.kod||"").toUpperCase().trim() === K) return true;
  const ilgili = String(kayit.ilgili||"").toUpperCase();
  if(!ilgili) return false;
  // Parçalara ayırıp TAM eşleşme aranıyor — indexOf kullanılsaydı "AKBNK"
  // ararken "AKBNKX" gibi bir kodu da yanlışlıkla yakalardı.
  return ilgili.split(/[,;\s]+/).filter(Boolean).includes(K);
}

// Tüm bildirimleri (sadeleştirilmiş) getirir; önce Redis, yoksa KAP.
async function kapTumBildirimler(){
  try{
    const onbellek = await redis.get(KV_KAP_TUM_KEY);
    if(Array.isArray(onbellek) && onbellek.length) return { liste: onbellek, cached: true };
  }catch{}

  const { ham } = await kapSukukCek(KAP_TUM_GUN, KAP_HISSE_TIPLER);
  const liste = ham
    .map(kapSadeKayit)
    .filter(k => k.id && (k.kod || k.ilgili))   // hiçbir hisseyle ilişkisi yoksa taşımaya gerek yok
    .slice(0, KAP_TUM_MAX);

  try{ await redis.set(KV_KAP_TUM_KEY, liste, {ex: KAP_TUM_TTL}); }catch{}
  return { liste, cached: false };
}

function kapNormalize(k){
  // Kayıt bazen düz, bazen {basic:{...}} şeklinde sarmalanmış geliyor.
  const b = kapTemel(k);
  const idx = b.disclosureIndex;
  return {
    id: idx || null,
    sirket: b.companyTitle || null,
    kod: b.stockCode || null,
    ilgiliKurum: b.relatedStocks || null,   // fon kullanıcısı (SPK'da yok!)
    baslik: b.title || null,
    ozet: b.summary || null,
    tarih: b.publishDate || null,
    ekSayisi: typeof b.attachmentCount === "number" ? b.attachmentCount : 0,
    link: idx ? `https://www.kap.org.tr/tr/Bildirim/${idx}` : null,
  };
}

const HAFTALIK = [
  "TP.KTF10","TP.KTF11","TP.KTF12",
  "TP.KTF101",
  "TP.KTF17","TP.KTF171","TP.KTF172",
  "TP.KTF1",
  "TP.KTF1.USD","TP.KTF1.EUR",
  "TP.KTF1.K","TP.KTF1.K.USD","TP.KTF1.K.EUR",
  "TP.KTF17.TL","TP.KTF17.USD","TP.KTF17.EUR",
];

// ── REZERVLER — İKİ AYRI GRUP, KARIŞTIRILMAMALI (2026-07-30 DÜZELTMESİ) ────
//
// bie_abreserv (TP.AB.B*) — AYLIK, "Uluslararası Rezervler ve Döviz Likiditesi
//   Tablosu"nun özeti. ~2-3 ay gecikmeli yayımlanıyor. B6 "Toplam Rezervler"
//   ise B3'ü (Bankalar Muhabir Mevcudu ve Efektif Kasası) de İÇERİYOR — bu
//   ~49 milyar $ ticari bankaların muhabir bakiyesi, TCMB'nin rezervi DEĞİL.
//   Kamuoyunun/basının "TCMB rezervi" dediği rakam bu değil.
//
// bie_abres2 (TP.AB.C1/C2/TOPLAM) — HAFTALIK, "Merkez Bankası Rezervleri".
//   Her perşembe 14:30'da yayımlanıyor, ~1 hafta gecikmeli. Basının her hafta
//   alıntıladığı rakam BUDUR.
//
// ⚠️ 23 TEMMUZ TEŞHİSİ YANLIŞTI: O tarihte devir belgesine "TP.AB.TOPLAM
// geçersiz/eski kod, hiç veri döndürmüyor" diye yazılmış ve B6'ya geçilmişti.
// Kod geçerli, veri kusursuz. Sorun, HAFTALIK C serisinin AYLIK B serileriyle
// AYNI istekte gönderilmesiydi — EVDS'in bilinen davranışı: listede tek bir
// uyumsuz kod olsa bile TÜM isteği reddediyor (bkz. devir belgesi 6.3).
// Bu yüzden C grubu KENDİ AYRI çağrısında gidiyor. Asla B ile birleştirme.
//
// Canlı doğrulama (2026-07-30, ?grafik=1&seri=TP.AB.TOPLAM) — basınla birebir:
//   30-01-2026: 218.157,8  ("218,2 milyar, tarihi zirve")
//   26-06-2026: 149.204,7  ("149,2 milyar dolara indi")
//   03-07-2026: 159.694,3  ("159,7 milyar dolar")
//   10-07-2026: 163.302,4  ("163 milyar 302 milyon dolar")
// Son nokta 24-07-2026 → bir haftalık gecikme.
const REZERV = ["TP.AB.B6", "TP.AB.B4", "TP.AB.B1", "TP.AB.B2", "TP.AB.B3"];   // AYLIK (B4 = Resmi Rezerv Varlıklar, haftalık alınamazsa yedek)
const REZERV_HAFTALIK = ["TP.AB.TOPLAM", "TP.AB.C1", "TP.AB.C2"];  // HAFTALIK

// ── NET REZERV — STAND-BY BİLANÇOSU (2026-07-30, ikinci tur) ───────────────
// bie_abstc2 "Merkez Bankası Bilançosu – Stand By (Cari)" grubu. TCMB'nin
// 2002 Stand-By programından beri yayımladığı HAFTALIK cuma vaziyeti.
// Analistlerin (Eğilmez, Babuşcu vb.) "net rezerv" dediği kalem BURADA hazır:
//   TP.AB.N06 → "2A Net Uluslararası Rezervler (1+2+3)"   [BİN TL]
//   TP.AB.N12 → "2A3 Net Vadeli (Forward) İşlemler"       [BİN TL] (swap bacağı)
//   TP.DK.USD.A → USD alış kuru (dolara çevirmek için — analist geleneği de
//                 TCMB alış kuruna bölmek; aynı istekte gelirse tarih hizalı)
// Canlı doğrulama (2026-07-30):
//   24-07-2026: N06 = 2.409.957.051 bin TL ÷ ~47,3 ≈ 50,95 milyar $ — Babuşcu
//   tablosundaki "Net Rezerv 51,0" ile birebir. 13-03 noktası da Eğilmez'in
//   okur örneğiyle (69 milyar $) tutuyor.
// ⚠️ İlk teşhis "EVDS'te net rezerv yok" idi ve YANLIŞTI — analitik bilanço
// ve rezerv gruplarına bakılmış, "Haftalık Vaziyet" kategorisi atlanmıştı.
const REZERV_STANDBY = ["TP.AB.N06", "TP.AB.N12", "TP.DK.USD.A"];

// ── URDL HAFTALIK XLS (2026-07-30, üçüncü tur) ─────────────────────────────
// "Uluslararası Rezervler ve Döviz Likiditesi" tablosunun HAFTALIK versiyonu
// EVDS API'sinde YOK — TCMB'nin kendi sayfası aylık tablonun EVDS'te
// yayımlandığını açıkça yazıyor. Haftalık versiyon SABİT URL'li bir XLS
// olarak her hafta güncelleniyor; Bloomberg/analistlerin haftalık swap ve
// net rezerv rakamlarının kaynağı bu dosya.
// Üç gün boyunca EVDS'te aranan veri EVDS'te hiç olmamıştı — ders: kaynak
// yayını API'de yoksa dosya yayınına bakılmalı.
// v8 (ayni gece): /XLS kabugu gercek dosya linki icermiyordu (icindeki tum
// uuid linkleri normalize.css/webfont.js/favicon gibi site varliklariydi —
// canli teshiste goruldu). Asil dosya linkleri LISTELEME sayfasinda; once o
// deneniyor, /XLS kabugu yedek.
const URDL_KAYNAK_SAYFALAR = [
  "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Odemeler+Dengesi+ve+Ilgili+Istatistikler/Uluslararasi+Rezervler+ve+Doviz+Likiditesi/Veri+(Tablolar)+-+Haftalik",
  "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Odemeler+Dengesi+ve+Ilgili+Istatistikler/Uluslararasi+Rezervler+ve+Doviz+Likiditesi/Veri+(Tablolar)+-+Haftalik/XLS",
];
const URDL_XLS_URL = URDL_KAYNAK_SAYFALAR[0];
const KV_URDL_KEY = "urdl:haftalik:v1";
const URDL_TTL = 12 * 3600;   // dosya haftada bir değişiyor; 12 saat fazlasıyla taze

// Türkçe metni arama için düzleştir: küçük harf + aksan temizliği.
function urdlNorm(t) {
  return String(t || "").toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/\s+/g, " ").trim();
}

// Satırdaki etiketten SONRAKİ ilk sayısal hücre — IMF şablonunda ilk sayı
// sütunu "Toplam". Parantezli negatifleri de tanır: "(13.500)".
function urdlSatirdakiIlkSayi(hucreler) {
  let etiketGorulduMu = false;
  for (const h of hucreler) {
    if (typeof h === "number" && isFinite(h)) { if (etiketGorulduMu) return h; continue; }
    const m = String(h ?? "").trim();
    if (!m) continue;
    if (/[a-zçğıöşü]/i.test(m)) { etiketGorulduMu = true; continue; }
    const temiz = m.replace(/[()\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(temiz);
    if (etiketGorulduMu && isFinite(n)) return m.includes("(") ? -n : n;
  }
  // Etiket hücresi sayıdan önce hiç görülmediyse (etiket ayrı sütunda vb.)
  for (const h of hucreler) if (typeof h === "number" && isFinite(h)) return h;
  return null;
}

// XLS çalışma kitabından hedef kalemleri etikete göre çıkarır. Hücre/satır
// KONUMUNA asla güvenilmiyor — TCMB düzeni değiştirirse etiket araması
// dayanır, konum araması sessizce yanlış değer okurdu.
function urdlAyristir(XLSX, wb) {
  const bulunan = {};
  const eslesen = {};      // eşleşen satırların ham hücreleri (teşhis için)
  const basliklar = [];    // ilk satırlar — sütun düzenini görmek için
  const kesif = [];
  let tarih = null;
  for (const sayfaAdi of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sayfaAdi], { header: 1, raw: true, defval: null });
    for (let i = 0; i < rows.length; i++) {
      const metin = urdlNorm(rows[i].filter((h) => typeof h === "string").join(" "));
      if (kesif.length < 60 && metin) kesif.push(`${sayfaAdi}#${i}: ${metin.slice(0, 110)}`);
      if (i < 8 && basliklar.length < 8) basliklar.push(rows[i].slice(0, 12));

      if (!tarih) {
        const m = (rows[i] || []).map((h) => String(h ?? "")).join(" ").match(/(\d{2})[.\/](\d{2})[.\/](\d{4})/);
        if (m) tarih = `${m[1]}-${m[2]}-${m[3]}`;
      }
      // 2026-07-31: Eşleşen satırın TÜM hücreleri teşhise yazılıyor. Canlıda
      // swap 17,67 çıktı ama referans 12,8 — hangi sütunun okunduğunu görmeden
      // düzeltmek tahmin olurdu. Sütun başlıkları da (ilk 3 satır) kaydediliyor.
      const kaydet = (ad, deger) => {
        bulunan[ad] = deger;
        eslesen[ad] = { satir: i, sayfa: sayfaAdi, hucreler: rows[i].slice(0, 12) };
      };
      if (bulunan.resmiRezerv == null && metin.includes("resmi rezerv varlik")) {
        kaydet("resmiRezerv", urdlSatirdakiIlkSayi(rows[i]));
      }
      if (bulunan.swapVadeli == null && metin.includes("yurt ici para karsiliginda") && metin.includes("forward")) {
        kaydet("swapVadeli", urdlSatirdakiIlkSayi(rows[i]));
      }
      if (bulunan.netRezerv == null && metin.includes("net uluslararasi rezerv")) {
        kaydet("netRezerv", urdlSatirdakiIlkSayi(rows[i]));
      }
    }
  }
  return { bulunan, eslesen, basliklar, kesif, tarih };
}

// TCMB WCM sayfası dosyanın kendisi değil, HTML kabuk döndürüyor. İlk
// sürüm kabuktan tek link seçiyordu ve CANLIDA KENDİNE REFERANS YAKALADI:
// "/…/Haftalik/XLS" ile biten navigasyon linki "xls" desenine uyduğu için
// sayfa kendi kendini indirdi ("Ikinci istek de HTML dondu"). Artık:
//   1) kendine/ayni-sayfaya referanslar eleniyor,
//   2) TEK aday yerine öncelik sıralı ADAY LİSTESİ dönülüyor ve urdlOku
//      bunları sırayla deneyip binary döneni kabul ediyor.
// Öncelik: gerçek .xls/.xlsx uzantısı > WCM dosya deseni (MOD=AJPERES,
// genelde /connect/<uuid>/ altında) > diğer "xls" geçenler.
function urdlHtmldenXlsAdaylari(html, kendiUrl) {
  const ham = [];
  const re = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) ham.push(m[1]);
  const tam = (h) => /^https?:\/\//i.test(h)
    ? h
    : "https://www.tcmb.gov.tr" + (h.startsWith("/") ? "" : "/") + h;
  const kendiNorm = decodeURIComponent(String(kendiUrl || "")).toLocaleLowerCase();
  const benzersiz = [];
  for (const h of ham) {
    const t = tam(h);
    const tNorm = decodeURIComponent(t).toLocaleLowerCase();
    if (tNorm === kendiNorm) continue;                    // kendine referans
    if (tNorm.endsWith("/xls")) continue;                 // ayni tur kabuk sayfalar
    // SITE VARLIKLARI ELENIR (canli vaka: normalize.css secilmisti) —
    // uuid'li olsalar bile bunlar veri dosyasi degil.
    if (/\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|eot)([?#]|$)/i.test(tNorm)) continue;
    if (/normalize|webfont|favicon/i.test(tNorm)) continue;
    // Aday olabilmesi icin YA .xls uzantisi YA da adinda konuyla ilgili bir
    // ipucu olmali (URDL_Gelismeleri.pdf ornegindeki adlandirma deseni).
    const dosyaIpucu = /\.xlsx?([?#]|$)/i.test(tNorm) ||
      ((/MOD=AJPERES/i.test(t)) && /urdl|rezerv|likidit|haftalik/i.test(tNorm));
    if (!dosyaIpucu) continue;
    if (!benzersiz.includes(t)) benzersiz.push(t);
  }
  const puan = (t) =>
    /\.xlsx?([?#]|$)/i.test(t) ? 0 :                           // gerçek dosya uzantısı en önde
    /\/connect\/[0-9a-f]{8}-[0-9a-f-]{20,}\//i.test(t) ? 1 :  // uuid'li WCM dosyası
    2;
  benzersiz.sort((x, y) => puan(x) - puan(y));
  return benzersiz.slice(0, 6);
}

// ── MİNİMAL ZIP ÇIKARICI (2026-07-30 gece, son halka) ──────────────────────
// TCMB haftalık dosyası ZIP ARŞİVİ çıktı (URDL_YYYYAAGG.zip) ve SheetJS
// "Unsupported ZIP file" dedi — çünkü bu XLSX değil, içinde XLS barındıran
// gerçek bir arşiv. Ek bağımlılık yok: ZIP merkez dizini elle okunuyor,
// DEFLATE ise Node yerleşik zlib.inflateRawSync ile açılıyor.
// Dönüş: {xlsxKendisi:true} (dosya zaten XLSX'miş) | {icerik,ad} | null
function zipIcindenXlsCikar(buf, zlib) {
  let eocd = -1;
  const alt = Math.max(0, buf.length - 65557);   // EOCD + azami yorum alanı
  for (let i = buf.length - 22; i >= alt; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const toplam = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);           // merkez dizin başlangıcı
  const girdiler = [];
  for (let k = 0; k < toplam && p + 46 <= buf.length; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    girdiler.push({ ad: buf.slice(p + 46, p + 46 + nlen).toString("utf8"), method, compSize, lho });
    p += 46 + nlen + elen + clen;
  }
  // XLSX dosyaları da ZIP'tir — ayırt edici: [Content_Types].xml
  if (girdiler.some((g) => g.ad === "[Content_Types].xml")) return { xlsxKendisi: true };
  const hedef = girdiler.find((g) => /\.xlsx?$/i.test(g.ad)) || girdiler[0];
  if (!hedef) return null;
  const lp = hedef.lho;
  if (lp + 30 > buf.length || buf.readUInt32LE(lp) !== 0x04034b50) return null;
  const veriBas = lp + 30 + buf.readUInt16LE(lp + 26) + buf.readUInt16LE(lp + 28);
  const ham = buf.slice(veriBas, veriBas + hedef.compSize);
  try {
    const icerik = hedef.method === 8 ? zlib.inflateRawSync(ham)
                 : hedef.method === 0 ? ham : null;
    return icerik ? { icerik, ad: hedef.ad } : null;
  } catch { return null; }
}

// URDL verisini Redis-öncelikli getirir. Her adım kendi try/catch'inde:
// XLS inmezse/ayrışmazsa ana EVDS yanıtı ETKİLENMEZ, ilgili alanlar boş kalır.
async function urdlOku(teshis) {
  try {
    const onbellek = await redis.get(KV_URDL_KEY);
    if (onbellek?.bulunan) { teshis.urdl = { kaynak: "onbellek", ...onbellek.ozet }; return onbellek; }
  } catch {}
  try {
    const XLSX = await import("xlsx");
    // Kaynak sayfalari sirayla dene; ilk erisilebilen kabugu kullan.
    let buf = null, xlsUrl = null, kabukHatalari = [];
    for (const kaynakUrl of URDL_KAYNAK_SAYFALAR) {
      try {
        const r = await fetch(kaynakUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)", Accept: "*/*" },
          redirect: "follow",
        });
        if (!r.ok) { kabukHatalari.push(`${kaynakUrl} → HTTP ${r.status}`); continue; }
        buf = Buffer.from(await r.arrayBuffer());
        xlsUrl = kaynakUrl;
        break;
      } catch (e) { kabukHatalari.push(`${kaynakUrl} → ${e.message}`); }
    }
    if (!buf) { teshis.urdl = { hata: "Kaynak sayfalara erisilemedi", kabukHatalari }; return null; }
    // HTML dönerse (dosya yerine kabuk sayfa — canlıda görülen durum):
    // içinden gerçek XLS bağlantısını çıkar ve İKİNCİ istekle dosyayı indir.
    // ÜÇ TUR KARA LİSTEYLE UĞRAŞILDI ("HTML mi?"): once <html kacti
    // (<!DOCTYPE), sonra CSS kacti (hic HTML imzasi yok). Dogru soru
    // "XLS Mİ?" — beyaz liste: XLS'in iki kesin binary imzasi var:
    //   BIFF (eski .xls): D0 CF 11 E0   |   ZIP (.xlsx): 50 4B 03 04
    // Bunlarla baslamayan hicbir icerik dosya kabul edilmez; HTML, CSS,
    // JSON, duz metin — hepsi tek kontrolle elenir.
    const xlsMi = (b) =>
      b.length > 8 && (
        (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) ||
        (b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04)
      );
    const htmlMi = (b) => !xlsMi(b);   // eski adla uyum: "dosya degil" testi
    if (htmlMi(buf)) {
      const adaylar = urdlHtmldenXlsAdaylari(buf.toString("utf8"), xlsUrl);
      if (adaylar.length === 0) {
        teshis.urdl = { hata: "HTML dondu ve icinde XLS baglantisi bulunamadi" };
        return null;
      }
      const denenen = [];
      let bulundu = false;
      for (const link of adaylar) {
        try {
          const r2 = await fetch(link, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; KatilimPlus/1.0)", Accept: "*/*" },
            redirect: "follow",
          });
          if (!r2.ok) { denenen.push(`${link} → HTTP ${r2.status}`); continue; }
          const b2buf = Buffer.from(await r2.arrayBuffer());
          if (htmlMi(b2buf)) { denenen.push(`${link} → HTML`); continue; }
          buf = b2buf; xlsUrl = link; bulundu = true; break;
        } catch (e) { denenen.push(`${link} → ${e.message}`); }
      }
      if (!bulundu) {
        teshis.urdl = { hata: "Hicbir aday binary dondurmedi", denenen, adaylar };
        return null;
      }
      teshis.urdlAdaylar = adaylar;   // başarılı yolda da hangi listeden seçildiği görünsün
    }
    // ZIP imzalıysa önce arşiv mi XLSX mi ayır: TCMB haftalık veriyi
    // URDL_YYYYAAGG.zip arşivi olarak yayımlıyor (canlıda görüldü —
    // "Unsupported ZIP file"). Arşivse içindeki XLS çıkarılıp okunur.
    let okunacak = buf;
    if (buf[0] === 0x50 && buf[1] === 0x4B) {
      const zlib = await import("zlib");
      const zip = zipIcindenXlsCikar(buf, zlib.default || zlib);
      if (zip && !zip.xlsxKendisi && zip.icerik) {
        okunacak = zip.icerik;
        teshis.urdlZipDosya = zip.ad;
      } else if (!zip) {
        teshis.urdl = { hata: "ZIP acilamadi", xlsUrl };
        return null;
      }
      // xlsxKendisi ise okunacak=buf kalır, SheetJS doğrudan okur.
    }
    const wb = XLSX.read(okunacak, { type: "buffer" });
    const { bulunan, eslesen, basliklar, kesif, tarih } = urdlAyristir(XLSX, wb);
    const ozet = { tarih, resmiRezerv: bulunan.resmiRezerv ?? null, swapVadeli: bulunan.swapVadeli ?? null, netRezerv: bulunan.netRezerv ?? null };
    const kayit = { bulunan, tarih, ozet, ts: Date.now() };
    // Hiçbir kalem bulunamadıysa keşif dökümünü teşhise koy — ayrıştırıcıyı
    // gerçek yapıya göre düzeltmek için gereken tek şey bu çıktı.
    if (bulunan.resmiRezerv == null && bulunan.swapVadeli == null && bulunan.netRezerv == null) {
      teshis.urdl = { hata: "hicbir kalem eslesmedi", xlsUrl, sayfalar: wb.SheetNames, kesif: kesif.slice(0, 40) };
      return null;
    }
    try { await redis.set(KV_URDL_KEY, kayit, { ex: URDL_TTL }); } catch {}
    teshis.urdl = { kaynak: "xls", xlsUrl, ...ozet, sayfalar: wb.SheetNames, eslesen, basliklar };
    return kayit;
  } catch (e) {
    teshis.urdl = { hata: e.message };
    return null;
  }
}

// GECICI TEST (silinecek) - GSYH frekansini bulmak icin
const TEST_GSYH = ["TP.GSYIH30.HY.B1GQ"]; // B1=Altın, B2=Döviz

// GÖSTERGELER (2026-07-23) — Ekonomik Aktivite + Enflasyon detayı, EVDS katalog
// keşfiyle doğrulandı. KKO/RKGE/TGE/İşsizlik doğrudan oran/endeks puanı;
// Sanayi/Yİ-ÜFE/Çekirdek TÜFE/Enerji/Gıda/Kira birer ENDEKS olduğu için
// backend'de yıllık(+aylık) % değişime çevriliyor (endeksYoYHesapla ile).
const GOSTERGE = [
  "TP.TSANAYMT2021.Y1",
  "TP.KKO2.IS.TOP",
  "TP.GY1.N2",
  "TP.TG2.Y01",
  "TP.TIG08",
  "TP.TUFE1YI.T1",
  "TP.FE25.OKTG04",
  "TP.FE25.OKTG09",
  "TP.FE25.OKTG10",
  "TP.YKKE.TR",
  // ── ENFLASYON BEKLENTİLERİ (2026-08-01) ─────────────────────────────────
  // TCMB anketlerinden 12 ay sonrası yıllık TÜFE beklentisi. İkisi de AYLIK,
  // bu yüzden GOSTERGE dizisine (frequency=5) güvenle eklenebiliyor —
  // farklı frekanslı seri karıştırmak EVDS'te tüm isteği reddettiriyor.
  //
  // NOT: Bunlar ENDEKS DEĞİL, doğrudan YÜZDE. endeksYoYHesapla'dan geçmemeli.
  // Canlı doğrulama (2026-07): PKA %23,95 — TCMB'nin Temmuz PKA raporundaki
  // "12 ay sonrası TÜFE beklentisi yüzde 23,95" ifadesiyle birebir.
  //
  // Aylık TÜFE nokta tahmini (takvimde "beklenti" göstermek için) EVDS'te
  // YOK — yalnızca aylık PDF raporunda. Beş ayrı katalog araması yapıldı,
  // BEKA grubu tamamen "(Arşiv)", BEKODTUFE de arşiv. Aranmasın.
  "TP.ENFBEK.PKA12ENF",   // Piyasa katılımcıları, 12 ay sonrası (%)
  "TP.ENFBEK.HBA12ENF",   // Hanehalkı, 12 ay sonrası (%)
];

// KÂR PAYI — HAFTALIK AKIM (2026-07-23) — EVDS menü keşfiyle doğrulandı:
// "Kredi Kâr Oranları (Akım)" = gerçek katılım bankaları haftalık akım verisi
// (kod öneki KBK = Katılım Bankaları Kredi). Kullanıcının EVDS3 ekranındaki
// 10 seçili seri + Excel export sütun başlıkları birebir sırayla eşleşerek
// doğrulandı. Önceki "TP.KTF17" (HAFTALIK dizisi) katılıma özel DEĞİLDİ —
// genel/konvansiyonel bankacılık verisiydi, hiç canlıya alınmamıştı.
const HAFTALIK_KBK = [
  "TP.KBK.TRY.18",       // Konut
  "TP.KBK.TRY.17",       // Taşıt
  "TP.KBK.TRY.KBTF10",   // İhtiyaç
  "TP.KBK.TRY.1",        // Ticari TL
  "TP.KBK.USD.KBTF17",   // Ticari USD
  "TP.KBK.EUR.KBTF17",   // Ticari EUR
];

const AYLIK_BKR = [
  "TP.BKR.TRY.KTF10","TP.BKR.TRY.17","TP.BKR.TRY.18",
  "TP.BKR.TRY.1","TP.BKR.USD.1","TP.BKR.EUR.1",
];
const AYLIK_KBK = [
  "TP.KBK.TRY.KBTF10","TP.KBK.TRY.17","TP.KBK.TRY.18",
  "TP.KBK.TRY.1","TP.KBK.USD.KBTF17","TP.KBK.EUR.KBTF17",
];
const AYLIK_KKP = [
  "TP.KKP.TRY.KTF10","TP.KKP.TRY.17","TP.KKP.TRY.18",
  "TP.KKP.TRY.1","TP.KKP.USD.KTF17","TP.KKP.EUR.KTF17",
];

const ENFLASYON = [
  "TP.TUKFIY2025.GENEL",
];

const POLITIKA = [
  "TP.APIFON4",
];

const GUNLUK = [
  "TP.BISTTLREF.KAPANIS",
];

// Dış Ticaret & Ödemeler Dengesi (v10) — kodlar katalog keşfiyle doğrulandı.
const DISTICARET = [
  "TP.IHRACATBEC.9999",
  "TP.ITHALATBEC.9999",
  "TP.ODANA6.Q01",
  "TP.HARICCARIACIK.K10",
  "TP.RK.T1.Y",
];

const FRED_API_URL = (seri, apiKey) =>
  `https://api.stlouisfed.org/fred/series/observations?series_id=${seri}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=30`;

function fredJsonParse(json) {
  const obs = (json?.observations || []).filter(o => o.value !== "." && !isNaN(parseFloat(o.value)));
  if (obs.length === 0) return { son: null, seri: [] };
  const son = { deger: parseFloat(obs[0].value), tarih: obs[0].date };
  const seri = obs.slice(0, 24).reverse().map(o => ({ tarih: o.date, deger: parseFloat(o.value) }));
  return { son, seri };
}

function tarihStr(d) {
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function onceki(gun) { const d=new Date(); d.setDate(d.getDate()-gun); return tarihStr(d); }

function normalizeTarih(t) {
  if(!t) return null;
  const s=String(t);
  if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){
    const[y,m,d]=s.split("-");
    return `${d.padStart(2,"0")}-${m.padStart(2,"0")}-${y}`;
  }
  if(/^\d{4}-\d{1,2}$/.test(s)){
    const[y,m]=s.split("-");
    return `01-${m.padStart(2,"0")}-${y}`;
  }
  if(/^\d{4}$/.test(s)) return null;
  return s;
}

function sonDeger(items, seri) {
  const keys=[seri, seri.replace(/\./g,"_"), seri.replace(/_/g,".")];
  for(let i=items.length-1;i>=0;i--){
    for(const k of keys){
      const v=items[i][k];
      if(v!==null&&v!==undefined&&v!=="")
        return {deger:parseFloat(v),tarih:normalizeTarih(items[i].Tarih)};
    }
  }
  return null;
}

function tumDegerler(items, seri) {
  const keys=[seri, seri.replace(/\./g,"_"), seri.replace(/_/g,".")];
  return items.map(row=>{
    for(const k of keys){
      const v=row[k];
      if(v!==null&&v!==undefined&&v!==""){
        const tarih=normalizeTarih(row.Tarih);
        if(!tarih) return null;
        return {deger:parseFloat(v),tarih};
      }
    }
    return null;
  }).filter(Boolean);
}

// ── DIŞ TİCARET yardımcıları (v10) ─────────────────────────────────────────
// BİRİM NORMALİZASYONU: EVDS bu serileri kaynağına göre "Bin USD" ya da
// "Milyon USD" olarak verebiliyor; hangisi olduğu API yanıtında yazmıyor.
// Seri bazında MEDYAN mutlak büyüklükten tespit edip her şeyi MİLYON USD'a
// çeviriyoruz: medyan > 100.000 ise değerler Bin USD kabul edilir (aylık
// hiçbir dış ticaret/cari kalemi 100 milyar USD'ı aşmadığından, milyon USD
// cinsinden hiçbir aylık değer bu eşiği geçemez — güvenli ayrım noktası).
function milyonUSDNormalize(dizi){
  if(!dizi || dizi.length===0) return dizi||[];
  const mutlak = dizi.map(n=>Math.abs(n.deger)).filter(v=>v>0).sort((a,b)=>a-b);
  if(mutlak.length===0) return dizi;
  const medyan = mutlak[Math.floor(mutlak.length/2)];
  if(medyan > 100000) return dizi.map(n=>({tarih:n.tarih, deger:n.deger/1000}));
  return dizi;
}
// 12 aylık kümülatif (hareketli) toplam — i. nokta, i dahil geriye doğru 12
// aylık pencerenin toplamıdır. İlk 11 nokta (eksik pencere) atlanır.
function kumulatif12Ay(dizi){
  const sonuc=[];
  for(let i=11;i<dizi.length;i++){
    let toplam=0;
    for(let j=i-11;j<=i;j++) toplam+=dizi[j].deger;
    sonuc.push({tarih:dizi[i].tarih, deger:toplam});
  }
  return sonuc;
}
// İki aylık seriyi tarihe göre eşleştirip f(a,b) ile birleştirir (denge,
// karşılama oranı gibi türetilmiş seriler için). Yalnızca iki seride de aynı
// ay varsa nokta üretir — yayın gecikmeleri farklıysa uçtaki aylar atlanır.
function seriBirlestir(a, b, f){
  const map={};
  for(const n of b) map[n.tarih]=n.deger;
  const sonuc=[];
  for(const n of a){
    const v=map[n.tarih];
    if(v===undefined) continue;
    const r=f(n.deger, v);
    if(r==null || !isFinite(r)) continue;
    sonuc.push({tarih:n.tarih, deger:r});
  }
  return sonuc;
}
function sonNokta(dizi){
  if(!dizi || dizi.length===0) return null;
  const s=dizi[dizi.length-1];
  return {deger:s.deger, tarih:s.tarih};
}

function tarihParseDDMMYYYY(s) {
  if(!s) return null;
  const [d,m,y] = s.split("-").map(Number);
  if(!d||!m||!y) return null;
  return new Date(Date.UTC(y, m-1, d));
}
function gunFarki(tarihSonStr, tarihOncekiStr) {
  const a = tarihParseDDMMYYYY(tarihSonStr);
  const b = tarihParseDDMMYYYY(tarihOncekiStr);
  if(!a||!b) return 1;
  const fark = Math.round((a - b) / (1000*60*60*24));
  return fark > 0 ? fark : 1;
}

function ayinNIsGunu(yil, ay, gun){
  let d = new Date(Date.UTC(yil, ay, gun));
  while(d.getUTCDay()===0 || d.getUTCDay()===6){ d.setUTCDate(d.getUTCDate()+1); }
  return d;
}
function tufeAcikilanmaTarihi(referansTarihStr){
  const d = tarihParseDDMMYYYY(referansTarihStr);
  if(!d) return referansTarihStr;
  const yil = d.getUTCFullYear();
  const ay = d.getUTCMonth();
  const acikilanma = ayinNIsGunu(yil, ay+1, 3);
  const dd=String(acikilanma.getUTCDate()).padStart(2,"0");
  const mm=String(acikilanma.getUTCMonth()+1).padStart(2,"0");
  const yy=acikilanma.getUTCFullYear();
  return `${dd}-${mm}-${yy}`;
}

function gunlukTlrefOranlari(dizi){
  const oranlar=[];
  for(let i=1;i<dizi.length;i++){
    const g = gunFarki(dizi[i].tarih, dizi[i-1].tarih);
    if(g<=0 || !dizi[i-1].deger || !dizi[i].deger) continue;
    const oran = ((dizi[i].deger/dizi[i-1].deger)-1) * (365/g) * 100;
    oranlar.push({tarih:dizi[i].tarih, deger:oran, gun:g});
  }
  return oranlar;
}
function medyanTlrefOrani(gunlukOranlar, sonIndex, pencereNokta=9){
  const baslangic = Math.max(0, sonIndex - pencereNokta + 1);
  const dilim = gunlukOranlar.slice(baslangic, sonIndex+1).map(o=>o.deger).sort((a,b)=>a-b);
  if(dilim.length===0) return null;
  const orta = Math.floor(dilim.length/2);
  return dilim.length%2 ? dilim[orta] : (dilim[orta-1]+dilim[orta])/2;
}
const TLREF_PENCERE_NOKTA = 9;

function ceyrekYoYHesapla(dizi){
  if(!dizi || dizi.length<5) return {son:null, seri:[]};
  const son=dizi[dizi.length-1];
  const oncekiYilAyniCeyrek=dizi[dizi.length-5];
  const yillikDeger=(son.deger-oncekiYilAyniCeyrek.deger)/oncekiYilAyniCeyrek.deger*100;
  const seri=[];
  for(let i=dizi.length-1;i>=4;i--){
    const s=dizi[i], oY=dizi[i-4];
    seri.unshift({tarih:s.tarih, deger:(s.deger-oY.deger)/oY.deger*100});
    if(seri.length>=16) break;
  }
  return {
    son: {deger:yillikDeger, tarih:son.tarih},
    seri
  };
}

function tufe12AyOrtalamaHesapla(dizi){
  if(!dizi || dizi.length<24) return {son:null, seri:[]};
  const ortalama=(dilim)=>dilim.reduce((t,n)=>t+n.deger,0)/dilim.length;
  const hesapla=(i)=>{
    if(i-23<0) return null;
    const son12=dizi.slice(i-11,i+1);
    const onceki12=dizi.slice(i-23,i-11);
    if(son12.length<12||onceki12.length<12) return null;
    const ortSon=ortalama(son12);
    const ortOnceki=ortalama(onceki12);
    return (ortSon/ortOnceki-1)*100;
  };
  const sonIdx=dizi.length-1;
  const sonDegerHesap=hesapla(sonIdx);
  const seri=[];
  for(let i=sonIdx;i>=23;i--){
    const oran=hesapla(i);
    if(oran==null) break;
    seri.unshift({tarih:tufeAcikilanmaTarihi(dizi[i].tarih), deger:oran});
    if(seri.length>=24) break;
  }
  return {
    son: sonDegerHesap!=null?{deger:sonDegerHesap, tarih:tufeAcikilanmaTarihi(dizi[sonIdx].tarih)}:null,
    seri
  };
}

// Endeks tipi GÖSTERGE serilerinden (Sanayi Üretimi, Yİ-ÜFE, Çekirdek TÜFE,
// Enerji, Gıda, Kira Endeksi) yıllık/aylık % değişim hesaplar — TÜFE'deki
// mantığın genelleştirilmiş hali; ham EVDS tarihi kullanılıyor.
function endeksYoYHesapla(dizi, aylikDaHesapla){
  if(!dizi || dizi.length<13) return {yillik:null, aylik:null, yillikSeri:[], aylikSeri:[]};
  const son=dizi[dizi.length-1];
  const oncekiAy=dizi[dizi.length-2];
  const oncekiYil=dizi[dizi.length-13];
  const yillik={deger:(son.deger-oncekiYil.deger)/oncekiYil.deger*100, tarih:son.tarih};
  const aylik=aylikDaHesapla?{deger:(son.deger-oncekiAy.deger)/oncekiAy.deger*100, tarih:son.tarih}:null;
  const yillikSeri=[], aylikSeri=[];
  for(let i=dizi.length-1;i>=12;i--){
    const s=dizi[i], oA=dizi[i-1], oY=dizi[i-12];
    yillikSeri.unshift({tarih:s.tarih, deger:(s.deger-oY.deger)/oY.deger*100});
    if(aylikDaHesapla) aylikSeri.unshift({tarih:s.tarih, deger:(s.deger-oA.deger)/oA.deger*100});
    if(yillikSeri.length>=24) break;
  }
  return {yillik, aylik, yillikSeri, aylikSeri};
}

async function evdsFetch(url,apiKey){
  const r=await fetchZamanli(url,{headers:{"key":apiKey,"Accept":"application/json"}},10000);
  const text=await r.text();
  if(text.trim().startsWith("<")) throw new Error(`HTML döndü (HTTP ${r.status}) — ilk 200 karakter: ${text.slice(0,200)}`);
  let json;
  try { json = JSON.parse(text); }
  catch(e){ throw new Error(`JSON parse hatası (HTTP ${r.status}): ${text.slice(0,200)}`); }
  if(r.status<200||r.status>=300) throw new Error(`HTTP ${r.status}: ${text.slice(0,200)}`);
  return { json, httpStatus: r.status };
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();

  // ── HIZ SINIRI ────────────────────────────────────────────────────────────
  // Her şeyden önce çalışır; sınır aşılmışsa hiçbir dış servise gidilmez.
  if(await hizSiniriAsildiMi(req)){
    res.setHeader("Retry-After", String(HIZ_SINIRI_PENCERE));
    res.setHeader("Cache-Control","no-store");   // 429 asla önbelleklenmesin
    return res.status(429).json({
      hata: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.",
      limit: `${HIZ_SINIRI_ADET}/${HIZ_SINIRI_PENCERE}sn`,
    });
  }

  // ── CDN ÖNBELLEĞİ ─────────────────────────────────────────────────────────
  // res.json sarmalanıyor: yalnızca BAŞARILI yanıtlara önbellek başlığı
  // ekleniyor. Hata yanıtlarının CDN'de takılıp kalması, hatayı geçici
  // olmaktan çıkarıp dakikalarca sürekli hale getirirdi.
  // Bir şube kendi Cache-Control'ünü ayarlarsa ona dokunulmuyor.
  const _json = res.json.bind(res);
  res.json = (govde)=>{
    const kod = res.statusCode || 200;
    if(kod >= 200 && kod < 300 && !res.getHeader("Cache-Control")){
      res.setHeader("Cache-Control",
        `public, s-maxage=${EDGE_TTL}, stale-while-revalidate=${EDGE_SWR}`);
    }
    return _json(govde);
  };

  // debug=1 önbelleği atlamak için var; CDN'in bunu da atlaması gerekiyor,
  // yoksa "önbelleksiz sorgu" yine bayat yanıt döndürür.
  if(req.query.debug === "1") res.setHeader("Cache-Control","no-store");

  // ── SPK KİRA SERTİFİKASI İHRAÇLARI (v11): /api/evds-proxy?spk=sukuk ──────
  // EVDS_KEY kontrolünden ÖNCE, çünkü bu şube TCMB'ye hiç gitmiyor — SPK'nın
  // kamuya açık servisini kullanıyor, EVDS anahtarı olmasa bile çalışmalı.
  if(req.query.spk === "sukuk"){
    const kilitAnahtariSpk = `lock:${KV_SPK_SUKUK_KEY}`;
    let kilitBizdeMiSpk = false;

    if(req.query.debug !== "1"){
      try{
        const onbellek = await redis.get(KV_SPK_SUKUK_KEY);
        if(onbellek) return res.status(200).json({...onbellek, cached:true});
      }catch{}
      // Aynı anda gelen isteklerin hepsi SPK'ya gitmesin (thundering herd) —
      // diğer şubelerdeki kilit deseninin aynısı.
      try{
        const s = await redis.set(kilitAnahtariSpk, "1", {nx:true, ex:30});
        kilitBizdeMiSpk = (s === "OK" || s === true);
      }catch{}
      if(!kilitBizdeMiSpk){
        for(let i=0;i<5;i++){
          await new Promise(r=>setTimeout(r,400));
          try{
            const onbellek = await redis.get(KV_SPK_SUKUK_KEY);
            if(onbellek) return res.status(200).json({...onbellek, cached:true});
          }catch{}
        }
      }
    }

    try{
      const buYil = new Date().getFullYear();
      const yillar = [];
      for(let y = buYil - SPK_YIL_SAYISI + 1; y <= buYil; y++) yillar.push(y);

      const spkTeshis = {};
      const ham = await Promise.all(yillar.map(async (y)=>{
        try{
          const satirlar = await spkSukukYilCek(y);
          spkTeshis[y] = { basarili:true, satirSayisi:satirlar.length };
          return { yil:y, satirlar };
        }catch(e){
          spkTeshis[y] = { basarili:false, hata:e.message };
          return { yil:y, satirlar:[] };
        }
      }));

      const buYilSatirlar = (ham.find(h=>h.yil===buYil)||{satirlar:[]}).satirlar;
      const buYilOzet = spkYilOzeti(buYilSatirlar);
      const sonAy = buYilOzet.sonAy;

      // Teşhis: SPK'nın döndürdüğü en büyük ay ile FİİLEN SAYILAN son ay
      // farklıysa, aradaki fark boş (toplam:0) satırlardır. Bu iki sayı
      // birbirinden ayrıldığında ekrandaki "N aylık" etiketi ve kıyas tabanı
      // kayar; ileride benzer bir sapma olursa buradan görülür.
      const spkGelenEnBuyukAy = (buYilSatirlar||[]).reduce((m,s)=>Math.max(m, spkSayi(s.ay)), 0);
      spkTeshis.sonAyHesabi = {
        gelenEnBuyukAy: spkGelenEnBuyukAy,
        sayilanSonAy: sonAy,
        bosSondakiAy: Math.max(0, spkGelenEnBuyukAy - sonAy),
      };

      // İHRAÇÇI BAZINDA SPK ONAYLARI — yalnızca güncel yıl için çekiliyor.
      // Başarısız olursa ekranın geri kalanı çalışmaya devam etsin diye
      // hata yutuluyor (bölüm frontend'de gizlenir).
      let ihraccilar = null;
      try{
        const hamIhracci = await spkIhracciYilCek(buYil);
        ihraccilar = spkIhraccilariGrupla(hamIhracci);
        spkTeshis.ihracci = { basarili:true, hamKayit:hamIhracci.length, sukukKayit:ihraccilar.kayitSayisi, ihracciSayisi:ihraccilar.ihracciSayisi };
      }catch(e){
        spkTeshis.ihracci = { basarili:false, hata:e.message };
      }

      // DÜRÜST KIYAS: geçen yılın YALNIZCA aynı ay aralığı toplanır.
      // (7 aylık 2026'yı 12 aylık 2025 ile kıyaslamak yanıltıcı olurdu.)
      const gecenYilSatirlar = (ham.find(h=>h.yil===buYil-1)||{satirlar:[]}).satirlar;
      const gecenYilAyniDonem = spkYilOzeti(gecenYilSatirlar, sonAy).toplam;
      const degisimYuzde = gecenYilAyniDonem > 0
        ? ((buYilOzet.toplam - gecenYilAyniDonem) / gecenYilAyniDonem * 100)
        : null;

      const turler = SPK_SUKUK_TURLERI.map(t=>({
        anahtar: t.anahtar,
        ad: t.ad,
        fikhi: t.fikhi,
        toplam: buYilOzet.turToplam[t.anahtar],
        pay: buYilOzet.toplam > 0 ? (buYilOzet.turToplam[t.anahtar] / buYilOzet.toplam * 100) : 0,
      })).sort((a,b)=> b.toplam - a.toplam);

      // SPK, verisi henüz gelmemiş ay için de sıfırlı satır döndürüyor
      // (2 Ağustos 2026'da "2026 / 08" satırı toplam:0 olarak geliyordu).
      // Bu satırlar grafikte hayalet bir boş sütun çiziyor — sondaki boş
      // ayları kırpıyoruz. sonAy'a kadar olanlar (aradaki gerçek sıfırlar
      // dahil) aynen korunuyor.
      const aylik = (buYilSatirlar||[])
        .map(s=>({
          ay: spkSayi(s.ay),
          donem: s.donem || null,
          toplam: spkSayi(s.kiraSertifikasiToplam),
          yurtIci: spkSayi(s.kiraSertifikasiToplamYurtIci),
          yurtDisi: spkSayi(s.kiraSertifikasiToplamYurtDisi),
        }))
        .sort((a,b)=> a.ay - b.ay)
        .filter(r => r.ay <= sonAy);

      // Yıllık trend — her yılın TAM toplamı (bu yıl hariç, o kısmi).
      const yillik = ham.map(h=>{
        const o = spkYilOzeti(h.satirlar);
        return {
          yil: h.yil,
          toplam: o.toplam,
          yurtIci: o.yurtIci,
          yurtDisi: o.yurtDisi,
          kismi: h.yil === buYil,   // frontend "2026 (7 aylık)" diye yazabilsin
          sonAy: o.sonAy,
        };
      });

      const yanit = {
        kaynak: "SPK (Sermaye Piyasası Kurulu) — ws.spk.gov.tr",
        birim: "milyon TL",
        guncelYil: buYil,
        sonAy,
        ozet: {
          yilToplam: buYilOzet.toplam,
          yurtIci: buYilOzet.yurtIci,
          yurtDisi: buYilOzet.yurtDisi,
          yurtDisiPay: buYilOzet.toplam>0 ? (buYilOzet.yurtDisi/buYilOzet.toplam*100) : 0,
          gecenYilAyniDonem,
          degisimYuzde,
          aylikOrtalama: sonAy>0 ? (buYilOzet.toplam/sonAy) : 0,
        },
        turler,
        aylik,
        yillik,
        // İhraççı bazında SPK ONAYLARI — birim HAM TL (tür bazındaki milyon
        // TL'den FARKLI!). Frontend'in yanlış birimle göstermemesi için
        // ayrıca bildiriliyor.
        ihraccilar: ihraccilar ? {
          birim: "TL",
          aciklama: "SPK tarafından onaylanan ihraç tavanı üst sınırdır; fiilen ihraç edilen tutar bundan düşük olabilir.",
          ...ihraccilar,
        } : null,
        _teshis: spkTeshis,
      };

      try{ await redis.set(KV_SPK_SUKUK_KEY, yanit, {ex: SPK_CACHE_TTL}); }catch{}
      if(kilitBizdeMiSpk){ try{ await redis.del(kilitAnahtariSpk); }catch{} }
      return res.status(200).json(yanit);
    }catch(err){
      if(kilitBizdeMiSpk){ try{ await redis.del(kilitAnahtariSpk); }catch{} }
      // Hata olsa bile eski önbellek varsa onu ver — ekran boş kalmasın.
      try{
        const eski = await redis.get(KV_SPK_SUKUK_KEY);
        if(eski) return res.status(200).json({...eski, cached:true, hata:err.message});
      }catch{}
      return res.status(500).json({error: err.message});
    }
  }

  // ── KAP KİRA SERTİFİKASI BİLDİRİMLERİ (v12): /api/evds-proxy?kap=sukuk ──
  // SPK şubesi gibi, EVDS_KEY kontrolünden ÖNCE — TCMB'ye hiç gitmiyor.
  if(req.query.kap === "sukuk"){
    const kilitKap = `lock:${KV_KAP_SUKUK_KEY}`;
    let kilitBizdeMiKap = false;
    const hamGoster = req.query.ham === "1";   // teşhis: ham KAP kaydını göster

    if(req.query.debug !== "1" && !hamGoster){
      try{
        const onbellek = await redis.get(KV_KAP_SUKUK_KEY);
        if(onbellek) return res.status(200).json({...onbellek, cached:true});
      }catch{}
      try{
        const s = await redis.set(kilitKap, "1", {nx:true, ex:30});
        kilitBizdeMiKap = (s === "OK" || s === true);
      }catch{}
      if(!kilitBizdeMiKap){
        for(let i=0;i<5;i++){
          await new Promise(r=>setTimeout(r,400));
          try{
            const onbellek = await redis.get(KV_KAP_SUKUK_KEY);
            if(onbellek) return res.status(200).json({...onbellek, cached:true});
          }catch{}
        }
      }
    }

    try{
      // ?gun= ile istenen pencere üst sınırla kısıtlanıyor — kullanıcı
      // yanlışlıkla (ya da bilerek) devasa bir aralık isteyip fonksiyonu
      // düşüremesin.
      const istenenGun = parseInt(req.query.gun,10) || KAP_GUN_ARALIK;
      const gun = Math.max(1, Math.min(istenenGun, KAP_MAX_GUN));
      const { ham, hamSayi } = await kapSukukCek(gun);

      // Teşhis modu: ilk 2 ham kaydı olduğu gibi göster (alan adlarını
      // canlı doğrulamak için — KAP arayüzü değişirse buradan anlaşılır).
      if(hamGoster){
        return res.status(200).json({
          gun,
          hamSayi,
          ilkIkiHamKayit: ham.slice(0,2),
          ornekAlanlar: ham[0] ? Object.keys(kapTemel(ham[0])) : [],
        });
      }

      // İki aşamalı süzme: önce sukukla ilgili olanlar, sonra bunlar
      // arasından SADECE ihraç bildirimleri (kupon/itfa gürültüsü elenir).
      // ?tumu=1 ile ikinci süzgeç atlanabilir (teşhis/ileride kullanım için).
      const sukukHam = ham.filter(k => kapSukukMu(kapTemel(k)));
      const tumunuGoster = req.query.tumu === "1";
      let suzulmus = (tumunuGoster ? sukukHam : sukukHam.filter(k => kapIhracMi(kapTemel(k))))
        .map(kapNormalize);

      // TEKRAR TEMİZLİĞİ: Bir halka arz / ihraç için şirket aynı gün birkaç
      // ayrı belge bildiriyor (İzahname, İhraççı Bilgi Dokümanı, SP Aracı
      // Notu, Getiri Oranı...). Özet metinleri BİREBİR AYNI OLMUYOR ama aynı
      // olayı anlatıyor — örn. VAKVK'nin 27.07 tarihli üç bildirimi:
      //   "Yurt İçi Kira Sertifikası Halka Arzı İçin SPK Tarafından Onaylanan Belgeler"
      //   "Yurt İçi Kira Sertifikası Halka Arzına İlişkin SPK Onayı"
      //   "Yurt İçi Kira Sertifikası Halka Arzı Getiri Oranı"
      // Bu yüzden tam metin yerine ŞİRKET + GÜN + ÖZETİN İLK 5 KELİMESİ
      // karşılaştırılıyor. Yukarıdaki üçü de "YURT ICI KIRA SERTIFIKASI HALKA"
      // ile başladığı için teke iniyor.
      // Farklı ihraçlar ISIN kodu / fon kullanıcısı adı gibi ayırt edici
      // ifadelerle başladığından yanlışlıkla birleşmiyor (örn.
      // "TRDKTSKA2630 ISIN KODLU..." vs "TRDGLVK92627 ISIN KODLU...").
      // Liste en yeniden eskiye sıralı olduğu için her gruptan EN YENİ kayıt
      // korunuyor.
      const ozetAnahtari = (b)=>{
        const kelimeler = spkNormalizeMetin(b.ozet || b.baslik || "")
          .replace(/[^A-Z0-9ĞÜŞİÖÇ ]/g, " ")
          .split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
        const gun = String(b.tarih || "").slice(0, 10);   // GG.AA.YYYY
        return `${b.sirket || ""}|${gun}|${kelimeler}`;
      };
      const gorulen = new Set();
      suzulmus = suzulmus.filter(b=>{
        const anahtar = ozetAnahtari(b);
        if(gorulen.has(anahtar)) return false;
        gorulen.add(anahtar);
        return true;
      });
      // En yeniden eskiye. publishDate "GG.AA.YYYY SS:DD:ss" formatında
      // geldiği için doğrudan string sıralaması yanlış olur — çeviriyoruz.
      const zaman = (t)=>{
        if(!t) return 0;
        const m = String(t).match(/^(\d{2})\.(\d{2})\.(\d{4})[ T]?(\d{2})?:?(\d{2})?/);
        if(!m) return 0;
        return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0)).getTime();
      };
      suzulmus.sort((a,b)=> zaman(b.tarih) - zaman(a.tarih));

      const yanit = {
        kaynak: "KAP (Kamuyu Aydınlatma Platformu)",
        gunAralik: gun,
        toplamTaranan: hamSayi,
        sukukToplam: sukukHam.length,      // kira sertifikasıyla ilgili tüm bildirimler
        sukukSayisi: suzulmus.length,      // bunlardan yalnızca ihraçla ilgili olanlar
        sadeceIhrac: !tumunuGoster,
        bildirimler: suzulmus.slice(0, KAP_LIMIT),
        guncelleme: new Date().toISOString(),
      };

      try{ await redis.set(KV_KAP_SUKUK_KEY, yanit, {ex: KAP_CACHE_TTL}); }catch{}
      if(kilitBizdeMiKap){ try{ await redis.del(kilitKap); }catch{} }
      return res.status(200).json(yanit);
    }catch(err){
      if(kilitBizdeMiKap){ try{ await redis.del(kilitKap); }catch{} }
      try{
        const eski = await redis.get(KV_KAP_SUKUK_KEY);
        if(eski) return res.status(200).json({...eski, cached:true, hata:err.message});
      }catch{}
      // Hata durumunda 200 + boş liste — frontend bölümü sessizce gizler,
      // ekranın geri kalanı çalışmaya devam eder.
      return res.status(200).json({
        kaynak: "KAP (Kamuyu Aydınlatma Platformu)",
        bildirimler: [],
        sukukSayisi: 0,
        hata: err.message,
      });
    }
  }

  // ── HİSSE BAZLI KAP BİLDİRİMLERİ: /api/evds-proxy?kap=hisse&kod=ASELS ────
  // Hisse detay ekranı için. Tüm liste ortak önbellekten geldiği için her
  // hisse sorgusu KAP'a gitmiyor (bkz. kapTumBildirimler notu).
  if(req.query.kap === "hisse"){
    const kod = String(req.query.kod || "").toUpperCase().trim();
    if(!kod) return res.status(200).json({ kod:null, bildirimler:[], hata:"kod parametresi gerekli" });
    try{
      const { liste, cached } = await kapTumBildirimler();
      const bulunan = liste.filter(k => kapHisseEslesir(k, kod)).slice(0, KAP_HISSE_LIMIT);
      return res.status(200).json({
        kaynak: "KAP (Kamuyu Aydınlatma Platformu)",
        kod,
        gunAralik: KAP_TUM_GUN,
        bildirimler: bulunan,
        cached,
      });
    }catch(err){
      // Hata durumunda 200 + boş liste — hisse detay ekranı bölümü gizler,
      // sayfanın geri kalanı etkilenmez.
      return res.status(200).json({ kod, bildirimler:[], hata: err.message });
    }
  }

  const apiKey=process.env.EVDS_KEY;
  if(!apiKey) return res.status(500).json({error:"EVDS_KEY eksik"});

  // ── KATALOG KESFI (yardimci): /api/evds-proxy?katalog=1[&filtre=IHALE,HAZINE]
  // EVDS veri gruplarini ve seri kodlarini listeler (2Y/5Y tahvil ihale faiz
  // serilerini bulmak icin eklendi). Anahtar sunucuda kalir, disari sizmez.
  if(req.query.katalog==="1"){
    try{
      const filtreParam = String(req.query.filtre||"IHALE,HAZINE,DIBS,BORCLANMA");
      const N = function(s){ return String(s==null?"":s).toLocaleUpperCase("tr-TR")
        .split("\u0130").join("I").split("\u015E").join("S")
        .split("\u00C7").join("C").split("\u00D6").join("O")
        .split("\u00DC").join("U").split("\u011E").join("G"); };
      const filtreler = filtreParam.split(",").map(function(s){return N(s.trim());}).filter(Boolean);
      const kataloglar = ["https://evds2.tcmb.gov.tr/service/evds", BASE];
      let gruplar=null, kullanilan=null;
      for(const kb of kataloglar){
        try{
          const r = await fetchZamanli(kb+"/datagroups/mode=0&code=0&type=json",{headers:{"key":apiKey,"Accept":"application/json"}},10000);
          const t = await r.text();
          if(t.trim().startsWith("[")){ gruplar=JSON.parse(t); kullanilan=kb; break; }
        }catch(e){}
      }
      if(!gruplar) return res.status(502).json({error:"datagroups alinamadi"});
      const ilgili = gruplar.filter(function(g){
        const ad=N(g.DATAGROUP_ADI||g.DATAGROUP_NAME);
        return filtreler.some(function(f){return ad.indexOf(f)>=0;});
      }).slice(0,40);
      const sonuc=[];
      for(const g of ilgili){
        const kod=g.DATAGROUP_KODU||g.DATAGROUP_CODE;
        let seriler=[];
        try{
          const r2=await fetchZamanli(kullanilan+"/serieList/type=json&code="+kod,{headers:{"key":apiKey,"Accept":"application/json"}},10000);
          const t2=await r2.text();
          if(t2.trim().startsWith("[")){
            seriler=JSON.parse(t2).map(function(s){return {kod:s.SERIE_CODE, ad:s.SERIE_NAME};});
          }
        }catch(e){}
        sonuc.push({grupKodu:kod, grupAdi:g.DATAGROUP_ADI||g.DATAGROUP_NAME, seriler:seriler});
      }
      return res.status(200).json({kaynak:kullanilan, grupSayisi:sonuc.length, gruplar:sonuc});
    }catch(err){
      return res.status(500).json({error:err.message});
    }
  }


  const {grafik,seri,debug}=req.query;
  const now=Date.now();

  if(grafik==="1"&&seri){
    const kvAnahtar = KV_TARIHSEL_PREFIX+seri;
    const kilitAnahtariSeri = `lock:${kvAnahtar}`;
    let kilitBizdeMiSeri = false;
    try{
      const onbellek = await redis.get(kvAnahtar);
      if(onbellek) return res.status(200).json({tarihsel:{[seri]:onbellek},cached:true});
    }catch{}

    try{
      const sonuc = await redis.set(kilitAnahtariSeri, "1", {nx:true, ex:20});
      kilitBizdeMiSeri = sonuc === "OK" || sonuc === true;
    }catch{}
    if(!kilitBizdeMiSeri){
      for(let i=0;i<5;i++){
        await new Promise(r=>setTimeout(r,400));
        try{
          const onbellek = await redis.get(kvAnahtar);
          if(onbellek) return res.status(200).json({tarihsel:{[seri]:onbellek},cached:true});
        }catch{}
      }
    }

    try{
      const isGunluk=seri.includes("TLREF")||seri.includes("BISTTL");
      const isHaftalik=seri.includes(".")&&!isGunluk&&!seri.startsWith("TP.FE");
      const freq=isGunluk?"1":isHaftalik?"3":"5";
      const period=isGunluk?90:isHaftalik?200:400;
      const url=`${BASE}/series=${seri}&startDate=${onceki(period)}&endDate=${tarihStr(new Date())}&type=json&frequency=${freq}`;
      const {json}=await evdsFetch(url,apiKey);
      const degerler=tumDegerler(json?.items||[],seri);
      try{ await redis.set(kvAnahtar, degerler, {ex: CACHE_TTL_SANIYE}); }catch{}
      if(kilitBizdeMiSeri){ try{ await redis.del(kilitAnahtariSeri); }catch{} }
      return res.status(200).json({tarihsel:{[seri]:degerler}});
    }catch(err){
      if(kilitBizdeMiSeri){ try{ await redis.del(kilitAnahtariSeri); }catch{} }
      try{
        const eskiOnbellek = await redis.get(kvAnahtar);
        if(eskiOnbellek) return res.status(200).json({tarihsel:{[seri]:eskiOnbellek},cached:true});
      }catch{}
      return res.status(500).json({error:err.message});
    }
  }

  const kilitAnahtari = `lock:${KV_ANLIK_KEY}`;
  let kilitBizdeMi = false;

  if(debug!=="1"){
    try{
      const onbellek = await redis.get(KV_ANLIK_KEY);
      if(onbellek) return res.status(200).json({...onbellek,cached:true});
    }catch{}

    try{
      const sonuc = await redis.set(kilitAnahtari, "1", {nx:true, ex:50});
      kilitBizdeMi = sonuc === "OK" || sonuc === true;
    }catch{}

    if(!kilitBizdeMi){
      for(let i=0;i<6;i++){
        await new Promise(r=>setTimeout(r,400));
        try{
          const onbellek = await redis.get(KV_ANLIK_KEY);
          if(onbellek) return res.status(200).json({...onbellek,cached:true});
        }catch{}
      }
    }
  }

  const teshis = {};
  async function guvenliCek(ad, url) {
    try {
      const { json, httpStatus } = await evdsFetch(url, apiKey);
      const itemSayisi = (json?.items || []).length;
      teshis[ad] = { basarili: true, httpStatus, itemSayisi };
      return json;
    } catch (err) {
      teshis[ad] = { basarili: false, hata: err.message };
      return { items: [] };
    }
  }
  async function guvenliCekFred(ad, seri) {
    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) {
      teshis[ad] = { basarili: false, hata: "FRED_API_KEY ortam değişkeni tanımlı değil" };
      return { son: null, seri: [] };
    }
    try {
      const r = await fetchZamanli(FRED_API_URL(seri, fredKey), {}, 15000);
      const text = await r.text();
      if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}: ${text.slice(0,200)}`);
      const json = JSON.parse(text);
      const { son, seri: seriDizi } = fredJsonParse(json);
      teshis[ad] = { basarili: son != null, httpStatus: r.status, sonDeger: son };
      return { son, seri: seriDizi };
    } catch (err) {
      teshis[ad] = {
        basarili: false,
        hata: err.message,
        hataAdi: err.name,
        hataKod: err.cause?.code || err.code || null,
      };
      return { son: null, seri: [] };
    }
  }

  try{
    const [hafJson,bkrJson,kbkJson,kkpJson,gunJson,enfJson,polJson,rezervJson,rezervHafJson,standbyJson,dtJson,gostJson,hkbkJson,testGsyhCeyrekJson]=await Promise.all([
      guvenliCek("haftalik", `${BASE}/series=${HAFTALIK.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
      guvenliCek("aylik_bkr", `${BASE}/series=${AYLIK_BKR.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("aylik_kbk", `${BASE}/series=${AYLIK_KBK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("aylik_kkp", `${BASE}/series=${AYLIK_KKP.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("gunluk_tlref", `${BASE}/series=${GUNLUK.join("-")}&startDate=${onceki(30)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("enflasyon", `${BASE}/series=${ENFLASYON.join("-")}&startDate=${onceki(820)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("politika_aofm", `${BASE}/series=${POLITIKA.join("-")}&startDate=${onceki(60)}&endDate=${tarihStr(new Date())}&type=json&frequency=1`),
      guvenliCek("rezerv", `${BASE}/series=${REZERV.join("-")}&startDate=${onceki(180)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      // HAFTALIK rezerv — AYRI çağrı olması ŞART (bkz. REZERV_HAFTALIK notu).
      // 400 günlük pencere: 24 noktalık grafik serisi için haftalıkta ~6 ay
      // yeterdi ama daha uzun bir geçmiş trend grafiğini de besliyor.
      guvenliCek("rezerv_haftalik", `${BASE}/series=${REZERV_HAFTALIK.join("-")}&startDate=${onceki(400)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
      // Stand-By bilançosu — net rezerv kalemleri + USD kuru, hepsi haftalık
      // AYNI istekte (tarih hizası kendiliğinden doğru olsun diye).
      guvenliCek("rezerv_standby", `${BASE}/series=${REZERV_STANDBY.join("-")}&startDate=${onceki(400)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
      // Dış ticaret (v10): 12 aylık kümülatif serinin 24 noktası için ~36 ay
      // ham aylık veri gerekir → 1150 günlük pencere (~38 ay), tek istek.
      guvenliCek("disticaret", `${BASE}/series=${DISTICARET.join("-")}&startDate=${onceki(1150)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("gosterge", `${BASE}/series=${GOSTERGE.join("-")}&startDate=${onceki(760)}&endDate=${tarihStr(new Date())}&type=json&frequency=5`),
      guvenliCek("haftalik_kbk", `${BASE}/series=${HAFTALIK_KBK.join("-")}&startDate=${onceki(90)}&endDate=${tarihStr(new Date())}&type=json&frequency=3`),
      // 2026-07-30: Buradaki 13. istek ("test_gsyh_aylik") KALDIRILDI.
      // Promise.all 13 istek yapıyor ama sol taraftaki destructuring 12
      // değişken tanımlıyordu — sonuncusunun sonucu hiç kullanılmıyor,
      // her önbellek ıskasında TCMB'ye boşuna gidiliyordu. 23 Temmuz'daki
      // GSYH frekans araştırmasından kalma, kodda zaten "silinecek" notu vardı.
      guvenliCek("test_gsyh_ceyrek", `${BASE}/series=${TEST_GSYH.join("-")}&startDate=${onceki(2000)}&endDate=${tarihStr(new Date())}&type=json&frequency=6`),
    ]);

    const [sofr,eur3m,us2y,us5y,us10y,fedFonlama,ecbMevduat,sofr3m,sofr6m,fedUst,fedAlt]=await Promise.all([
      guvenliCekFred("fred_sofr", "SOFR"),
      guvenliCekFred("fred_euribor3m", "IR3TIB01EZM156N"),
      // ABD Hazine tahvil faizleri (2/5/10 yıl) — FRED'in günlük "Constant
      // Maturity" serileri, en güvenilir ve güncel kaynak (bkz. DGS2/DGS5/DGS10).
      guvenliCekFred("fred_us2y", "DGS2"),
      guvenliCekFred("fred_us5y", "DGS5"),
      guvenliCekFred("fred_us10y", "DGS10"),
      // FED — Federal Funds Effective Rate (günlük, FOMC'nin belirlediği HEDEF
      // BANT içinde piyasada FİİLEN GERÇEKLEŞEN gecelik faiz — bandın kendisi
      // değil). TCMB'deki "AOFM" ile aynı mantık: gerçekleşen oran.
      guvenliCekFred("fred_fedfunds", "DFF"),
      // ECB — Mevduat İmkanı Faizi (Deposit Facility Rate). Mart 2024'ten beri
      // ECB'nin para politikasını yönlendirdiği ASIL politika faizi budur
      // (Ana Refinansman Faizi değil) — bkz. ECB'nin kendi açıklaması.
      guvenliCekFred("fred_ecb", "ECBDFR"),
      // SOFR 3M/6M — NY Fed'in resmi "SOFR Averages" serileri (90/180 günlük
      // bileşik ortalama). NOT: CME'nin piyasada asıl kullanılan "Term SOFR"u
      // değildir (o ileriye dönük ve lisanslı/ücretli) — bu, geriye dönük
      // gerçekleşmiş SOFR'un ortalaması. Ücretsiz ve resmi tek alternatif budur.
      guvenliCekFred("fred_sofr3m", "SOFR90DAYAVG"),
      guvenliCekFred("fred_sofr6m", "SOFR180DAYAVG"),
      // FED HEDEF BANT (2026-07 eklendi) — FOMC oranı TCMB gibi tek sayı değil,
      // bir ARALIK olarak açıklıyor (örn. %3,50-%3,75). DFF bu aralığın
      // İÇİNDE gerçekleşen fiili orandır, aralığın kendisi değil — kullanıcı
      // karışıklığını önlemek için üst/alt bandı ayrıca gösteriyoruz.
      guvenliCekFred("fred_fed_ust", "DFEDTARU"),
      guvenliCekFred("fred_fed_alt", "DFEDTARL"),
    ]);

    const sonuclar={};
    for(const s of HAFTALIK) sonuclar[s]=sonDeger(hafJson?.items||[],s);
    for(const s of AYLIK_BKR) sonuclar[s]=sonDeger(bkrJson?.items||[],s);
    for(const s of AYLIK_KBK) sonuclar[s]=sonDeger(kbkJson?.items||[],s);
    for(const s of AYLIK_KKP) sonuclar[s]=sonDeger(kkpJson?.items||[],s);
    for(const s of POLITIKA) sonuclar[s]=sonDeger(polJson?.items||[],s);
    for(const s of REZERV)   sonuclar[s]=sonDeger(rezervJson?.items||[],s);
    sonuclar["FRED_SOFR"]=sofr.son;
    sonuclar["FRED_SOFR_SERI"]=sofr.seri;
    sonuclar["FRED_EUR3M"]=eur3m.son;
    sonuclar["FRED_EUR3M_SERI"]=eur3m.seri;
    sonuclar["FRED_US2Y"]=us2y.son;
    sonuclar["FRED_US2Y_SERI"]=us2y.seri;
    sonuclar["FRED_US5Y"]=us5y.son;
    sonuclar["FRED_US5Y_SERI"]=us5y.seri;
    sonuclar["FRED_US10Y"]=us10y.son;
    sonuclar["FRED_US10Y_SERI"]=us10y.seri;
    sonuclar["FRED_FEDFUNDS"]=fedFonlama.son;
    sonuclar["FRED_FEDFUNDS_SERI"]=fedFonlama.seri;
    sonuclar["FRED_ECB"]=ecbMevduat.son;
    sonuclar["FRED_ECB_SERI"]=ecbMevduat.seri;
    sonuclar["FRED_SOFR3M"]=sofr3m.son;
    sonuclar["FRED_SOFR3M_SERI"]=sofr3m.seri;
    sonuclar["FRED_SOFR6M"]=sofr6m.son;
    sonuclar["FRED_SOFR6M_SERI"]=sofr6m.seri;
    sonuclar["FRED_FED_UST"]=fedUst.son;
    sonuclar["FRED_FED_UST_SERI"]=fedUst.seri;
    sonuclar["FRED_FED_ALT"]=fedAlt.son;
    sonuclar["FRED_FED_ALT_SERI"]=fedAlt.seri;

    sonuclar["TP.APIFON4_SERI"]=tumDegerler(polJson?.items||[], "TP.APIFON4").slice(-24);
    sonuclar["TP_AB_B6_SERI"]=tumDegerler(rezervJson?.items||[], "TP.AB.B6").slice(-24);
    sonuclar["TP_AB_B1_SERI"]=tumDegerler(rezervJson?.items||[], "TP.AB.B1").slice(-24);
    sonuclar["TP_AB_B2_SERI"]=tumDegerler(rezervJson?.items||[], "TP.AB.B2").slice(-24);
    sonuclar["TP_AB_B3_SERI"]=tumDegerler(rezervJson?.items||[], "TP.AB.B3").slice(-24);

    // ── REZERVLER: HAFTALIK ASIL, AYLIK YEDEK (2026-07-30) ────────────────
    // Frontend artık REZERV_* anahtarlarını okumalı. Eski TP.AB.B* anahtarları
    // geriye dönük uyumluluk için bırakıldı ama ARTIK KULLANILMAMALI:
    // B6 "Toplam Rezervler" banka muhabir mevcudunu içerdiği için kamuoyunun
    // konuştuğu rakamdan ~46 milyar $ yüksek çıkıyor (yaşanmış vaka).
    const rezHafItems = rezervHafJson?.items || [];
    const rezHafToplam = sonDeger(rezHafItems, "TP.AB.TOPLAM");
    const rezHafAltin  = sonDeger(rezHafItems, "TP.AB.C1");
    const rezHafDoviz  = sonDeger(rezHafItems, "TP.AB.C2");
    const haftalikVarMi = rezHafToplam != null;

    sonuclar["REZERV_TOPLAM"] = haftalikVarMi ? rezHafToplam : sonDeger(rezervJson?.items||[], "TP.AB.B4");
    sonuclar["REZERV_ALTIN"]  = haftalikVarMi ? rezHafAltin  : sonDeger(rezervJson?.items||[], "TP.AB.B1");
    sonuclar["REZERV_DOVIZ"]  = haftalikVarMi ? rezHafDoviz  : sonDeger(rezervJson?.items||[], "TP.AB.B2");
    sonuclar["REZERV_TOPLAM_SERI"] = haftalikVarMi
      ? tumDegerler(rezHafItems, "TP.AB.TOPLAM").slice(-24)
      : tumDegerler(rezervJson?.items||[], "TP.AB.B4").slice(-24);
    sonuclar["REZERV_ALTIN_SERI"] = haftalikVarMi
      ? tumDegerler(rezHafItems, "TP.AB.C1").slice(-24)
      : tumDegerler(rezervJson?.items||[], "TP.AB.B1").slice(-24);
    sonuclar["REZERV_DOVIZ_SERI"] = haftalikVarMi
      ? tumDegerler(rezHafItems, "TP.AB.C2").slice(-24)
      : tumDegerler(rezervJson?.items||[], "TP.AB.B2").slice(-24);
    // Frontend bu iki alanı ekranda gösterebilsin: kullanıcı verinin haftalık
    // mı aylık mı olduğunu ve hangi tarihe ait olduğunu görmeli. Rakamın
    // yanında tarih olsaydı yanlış rezerv verisi üç ay gizli kalmazdı.
    sonuclar["REZERV_KAYNAK"] = haftalikVarMi ? "haftalik" : "aylik";
    sonuclar["REZERV_ACIKLAMA"] = haftalikVarMi
      ? "TCMB haftalık brüt rezervleri (her perşembe yayımlanır)"
      : "TCMB aylık rezerv tablosu — haftalık seri alınamadı";
    // ── NET REZERV / SWAP — Stand-By bilançosundan HESAPLANIR ────────────
    // N06 ve N12 BİN TL; USD'ye çevirmek için AYNI HAFTANIN kuru kullanılıyor
    // (aynı istekte geldiği için tarih eşleşmesi garanti). Çıktı MİLYON $ —
    // frontend'in fmtRezerv'i /1000 ile milyar gösteriyor.
    // Swap Hariç Net = N06 − N12 (2A = 2A1−2A2+2A3 yapısından; 2A3 net vadeli
    // işlemler pozitif kayıtlı olduğu için çıkarılıyor).
    {
      const sbItems = standbyJson?.items || [];
      const n06 = sonDeger(sbItems, "TP.AB.N06");
      const n12 = sonDeger(sbItems, "TP.AB.N12");
      const kur = sonDeger(sbItems, "TP.DK.USD.A");
      if (n06?.deger != null && kur?.deger > 0) {
        const netMilyon = (n06.deger / kur.deger) / 1000;
        sonuclar["REZERV_NET"] = { deger: netMilyon, tarih: n06.tarih };
        if (n12?.deger != null) {
          const swapMilyon = (n12.deger / kur.deger) / 1000;
          sonuclar["REZERV_SWAP"] = { deger: swapMilyon, tarih: n12.tarih };
          sonuclar["REZERV_NET_SWAPSIZ"] = { deger: netMilyon - swapMilyon, tarih: n06.tarih };
        }
      }
      teshis.rezerv_standby = {
        n06_binTL: n06?.deger ?? null, n12_binTL: n12?.deger ?? null,
        kur: kur?.deger ?? null, tarih: n06?.tarih ?? null,
        nokta: tumDegerler(sbItems, "TP.AB.N06").length,
      };
    }

    // ── URDL HAFTALIK XLS: swap ve resmi net rezerv ──────────────────────
    // Kalemler bulunursa ekrana girer; bulunamazsa alanlar hiç oluşmaz ve
    // frontend satırları gizler (sessizce yanlış yerine sessizce yok).
    {
      const urdl = await urdlOku(teshis);
      const b = urdl?.bulunan;
      // ⚠️ TARİH ŞARTI (2026-07-31): Tarihi çıkarılamayan XLS verisi
      // YAYIMLANMAZ. Bugün üç aylık yanlış rezerv rakamının fark edilmemesinin
      // sebebi tam olarak ekranda tarih olmamasıydı. Ayrıca swap değeri
      // referansla (Babuşcu 24.07: 12,8) doğrulanana kadar bu kapı kapalı
      // kalıyor — teşhisteki "eslesen" alanı hangi sütunun okunduğunu gösterir.
      if (b?.swapVadeli != null && urdl?.tarih) {
        const swapMutlak = Math.abs(b.swapVadeli);
        sonuclar["URDL_SWAP"] = { deger: swapMutlak, tarih: urdl.tarih };
        // Net rezerv önceliği: XLS'teki RESMİ rakam varsa o; yoksa Stand-By
        // hesabımız (REZERV_NET). Resmi ile hesap arasındaki fark ~%0,2
        // (TCMB kendi değerleme kurunu kullanıyor).
        const netKaynak = b.netRezerv != null
          ? { deger: b.netRezerv, tarih: urdl.tarih, resmi: true }
          : (sonuclar["REZERV_NET"] ? { ...sonuclar["REZERV_NET"], resmi: false } : null);
        if (netKaynak) {
          sonuclar["URDL_NET"] = netKaynak;
          sonuclar["URDL_NET_SWAPSIZ"] = { deger: netKaynak.deger - swapMutlak, tarih: netKaynak.tarih, resmi: netKaynak.resmi };
        }
      }
      if (b?.resmiRezerv != null) sonuclar["URDL_BRUT_KONTROL"] = { deger: b.resmiRezerv, tarih: urdl?.tarih };
    }

    teshis.rezerv_secim = {
      haftalik_nokta: tumDegerler(rezHafItems, "TP.AB.TOPLAM").length,
      haftalik_son: rezHafToplam,
      aylik_son_B4: sonDeger(rezervJson?.items||[], "TP.AB.B4"),
      kullanilan: haftalikVarMi ? "haftalik" : "aylik",
    };

    // ── HAFTALIK AKIM KÂR PAYI (2026-07-23) ─────────────────────────────
    for(const s of HAFTALIK_KBK) sonuclar[s]=sonDeger(hkbkJson?.items||[],s);

    // ── GÖSTERGELER (2026-07-23) ────────────────────────────────────────
    const gostItems = gostJson?.items||[];
    sonuclar["GOSTERGE_KKO"]=sonDeger(gostItems, "TP.KKO2.IS.TOP");
    sonuclar["GOSTERGE_KKO_SERI"]=tumDegerler(gostItems, "TP.KKO2.IS.TOP").slice(-24);
    sonuclar["GOSTERGE_RKGE"]=sonDeger(gostItems, "TP.GY1.N2");
    sonuclar["GOSTERGE_RKGE_SERI"]=tumDegerler(gostItems, "TP.GY1.N2").slice(-24);
    sonuclar["GOSTERGE_TGE"]=sonDeger(gostItems, "TP.TG2.Y01");
    sonuclar["GOSTERGE_TGE_SERI"]=tumDegerler(gostItems, "TP.TG2.Y01").slice(-24);
    sonuclar["GOSTERGE_ISSIZLIK"]=sonDeger(gostItems, "TP.TIG08");
    sonuclar["GOSTERGE_ISSIZLIK_SERI"]=tumDegerler(gostItems, "TP.TIG08").slice(-24);

    const gsyhDizi = tumDegerler((testGsyhCeyrekJson?.items||[]), "TP.GSYIH30.HY.B1GQ");
    const gsyhYoY = ceyrekYoYHesapla(gsyhDizi);
    sonuclar["GSYH_YILLIK"] = gsyhYoY.son;
    sonuclar["GSYH_YILLIK_SERI"] = gsyhYoY.seri;
    teshis.gsyh_hesap = { nokta_sayisi: gsyhDizi.length, son_deger: gsyhYoY.son };

    const sanayiDizi = tumDegerler(gostItems, "TP.TSANAYMT2021.Y1");
    const sanayiYoY = endeksYoYHesapla(sanayiDizi, false);
    sonuclar["GOSTERGE_SANAYI_YILLIK"]=sanayiYoY.yillik;
    sonuclar["GOSTERGE_SANAYI_YILLIK_SERI"]=sanayiYoY.yillikSeri;

    const yiufeDizi = tumDegerler(gostItems, "TP.TUFE1YI.T1");
    const yiufeYoY = endeksYoYHesapla(yiufeDizi, true);
    sonuclar["GOSTERGE_YIUFE_YILLIK"]=yiufeYoY.yillik;
    sonuclar["GOSTERGE_YIUFE_YILLIK_SERI"]=yiufeYoY.yillikSeri;
    sonuclar["GOSTERGE_YIUFE_AYLIK"]=yiufeYoY.aylik;
    sonuclar["GOSTERGE_YIUFE_AYLIK_SERI"]=yiufeYoY.aylikSeri;

    const cekirdekDizi = tumDegerler(gostItems, "TP.FE25.OKTG04");
    const cekirdekYoY = endeksYoYHesapla(cekirdekDizi, false);
    sonuclar["GOSTERGE_CEKIRDEK_YILLIK"]=cekirdekYoY.yillik;
    sonuclar["GOSTERGE_CEKIRDEK_YILLIK_SERI"]=cekirdekYoY.yillikSeri;

    const enerjiDizi = tumDegerler(gostItems, "TP.FE25.OKTG09");
    const enerjiYoY = endeksYoYHesapla(enerjiDizi, false);
    sonuclar["GOSTERGE_ENERJI_YILLIK"]=enerjiYoY.yillik;
    sonuclar["GOSTERGE_ENERJI_YILLIK_SERI"]=enerjiYoY.yillikSeri;

    const gidaDizi = tumDegerler(gostItems, "TP.FE25.OKTG10");
    const gidaYoY = endeksYoYHesapla(gidaDizi, false);
    sonuclar["GOSTERGE_GIDA_YILLIK"]=gidaYoY.yillik;
    sonuclar["GOSTERGE_GIDA_YILLIK_SERI"]=gidaYoY.yillikSeri;

    // Beklenti serileri doğrudan yüzde — endeks dönüşümü uygulanmıyor.
    sonuclar["BEKLENTI_PIYASA_12AY"]=sonDeger(gostItems, "TP.ENFBEK.PKA12ENF");
    sonuclar["BEKLENTI_PIYASA_12AY_SERI"]=tumDegerler(gostItems, "TP.ENFBEK.PKA12ENF").slice(-24);
    sonuclar["BEKLENTI_HANE_12AY"]=sonDeger(gostItems, "TP.ENFBEK.HBA12ENF");
    sonuclar["BEKLENTI_HANE_12AY_SERI"]=tumDegerler(gostItems, "TP.ENFBEK.HBA12ENF").slice(-24);

    const kiraDizi = tumDegerler(gostItems, "TP.YKKE.TR");
    const kiraYoY = endeksYoYHesapla(kiraDizi, false);
    sonuclar["GOSTERGE_KIRA_YILLIK"]=kiraYoY.yillik;
    sonuclar["GOSTERGE_KIRA_YILLIK_SERI"]=kiraYoY.yillikSeri;

    teshis.gosterge_hesap = {
      sanayi_nokta: sanayiDizi.length, yiufe_nokta: yiufeDizi.length,
      cekirdek_nokta: cekirdekDizi.length, enerji_nokta: enerjiDizi.length,
      gida_nokta: gidaDizi.length, kira_nokta: kiraDizi.length,
    };

    // ── DIŞ TİCARET & ÖDEMELER DENGESİ (v10) ──────────────────────────────
    // Tüm parasal değerler milyonUSDNormalize ile MİLYON USD'a normalize
    // edilir; UI tarafı "milyon$" birimiyle Milyar $ olarak biçimlendirir.
    const dtItems = dtJson?.items||[];
    const ihrDizi  = milyonUSDNormalize(tumDegerler(dtItems, "TP.IHRACATBEC.9999"));
    const ithDizi  = milyonUSDNormalize(tumDegerler(dtItems, "TP.ITHALATBEC.9999"));
    const cariDizi = milyonUSDNormalize(tumDegerler(dtItems, "TP.ODANA6.Q01"));
    const cariAEDizi = milyonUSDNormalize(tumDegerler(dtItems, "TP.HARICCARIACIK.K10"));
    const rekDizi  = tumDegerler(dtItems, "TP.RK.T1.Y"); // endeks, normalize edilmez
    // Türetilmiş aylık seriler (tarih eşleştirmeli — yayın gecikmesi farkları
    // uçtaki ayları güvenle atlar):
    const dengeDizi     = seriBirlestir(ihrDizi, ithDizi, (ih,it)=>ih-it);
    const karsilamaDizi = seriBirlestir(ihrDizi, ithDizi, (ih,it)=>it!==0?(ih/it*100):null);
    // 12 aylık kümülatifler:
    const ihr12  = kumulatif12Ay(ihrDizi);
    const ith12  = kumulatif12Ay(ithDizi);
    const denge12= kumulatif12Ay(dengeDizi);
    const cari12 = kumulatif12Ay(cariDizi);
    teshis.disticaret_hesap = {
      ihracat_nokta: ihrDizi.length, ithalat_nokta: ithDizi.length,
      cari_nokta: cariDizi.length, cariAE_nokta: cariAEDizi.length,
      rek_nokta: rekDizi.length,
      ihracat_son: sonNokta(ihrDizi), ithalat_son: sonNokta(ithDizi),
      cari_son: sonNokta(cariDizi),
    };
    sonuclar["DT_IHRACAT"]=sonNokta(ihrDizi);
    sonuclar["DT_IHRACAT_SERI"]=ihrDizi.slice(-24);
    sonuclar["DT_IHRACAT_12AY"]=sonNokta(ihr12);
    sonuclar["DT_IHRACAT_12AY_SERI"]=ihr12.slice(-24);
    sonuclar["DT_ITHALAT"]=sonNokta(ithDizi);
    sonuclar["DT_ITHALAT_SERI"]=ithDizi.slice(-24);
    sonuclar["DT_ITHALAT_12AY"]=sonNokta(ith12);
    sonuclar["DT_ITHALAT_12AY_SERI"]=ith12.slice(-24);
    sonuclar["DT_DENGE"]=sonNokta(dengeDizi);
    sonuclar["DT_DENGE_SERI"]=dengeDizi.slice(-24);
    sonuclar["DT_DENGE_12AY"]=sonNokta(denge12);
    sonuclar["DT_DENGE_12AY_SERI"]=denge12.slice(-24);
    sonuclar["DT_KARSILAMA"]=sonNokta(karsilamaDizi);
    sonuclar["DT_KARSILAMA_SERI"]=karsilamaDizi.slice(-24);
    sonuclar["CARI_DENGE"]=sonNokta(cariDizi);
    sonuclar["CARI_DENGE_SERI"]=cariDizi.slice(-24);
    sonuclar["CARI_DENGE_12AY"]=sonNokta(cari12);
    sonuclar["CARI_DENGE_12AY_SERI"]=cari12.slice(-24);
    sonuclar["CARI_DENGE_AE"]=sonNokta(cariAEDizi);
    sonuclar["CARI_DENGE_AE_SERI"]=cariAEDizi.slice(-24);
    sonuclar["REK_TUFE"]=sonNokta(rekDizi);
    sonuclar["REK_TUFE_SERI"]=rekDizi.slice(-24);

    const tlrefEndeksDizi=tumDegerler(gunJson?.items||[], "TP.BISTTLREF.KAPANIS");
    teshis.tlrefEndeksDizi_uzunluk = tlrefEndeksDizi.length;
    const gunlukOranlarDizi = gunlukTlrefOranlari(tlrefEndeksDizi);
    const sonIdx = gunlukOranlarDizi.length-1;
    const sonYillikOran = sonIdx>=0 ? medyanTlrefOrani(gunlukOranlarDizi, sonIdx, TLREF_PENCERE_NOKTA) : null;
    if(sonIdx>=0 && sonYillikOran!=null){
      const son=tlrefEndeksDizi[tlrefEndeksDizi.length-1];
      sonuclar["TP.BISTTLREF.KAPANIS"]={deger:sonYillikOran, tarih:son.tarih, endeksHam:son.deger};
      teshis.tlref_hesap = {
        yontem:"medyan_tam_formul",
        pencere_nokta:TLREF_PENCERE_NOKTA,
        son_endeks:son.deger,
        son_tarih:son.tarih,
        yillik_oran_pct:sonYillikOran,
        son_9_gunluk_oran:gunlukOranlarDizi.slice(-9),
      };
      const tlrefSeri=[];
      for(let i=0;i<gunlukOranlarDizi.length;i++){
        const oran=medyanTlrefOrani(gunlukOranlarDizi, i, TLREF_PENCERE_NOKTA);
        if(oran==null) continue;
        tlrefSeri.push({tarih:gunlukOranlarDizi[i].tarih, deger:oran});
      }
      sonuclar["TP.BISTTLREF.KAPANIS_SERI"]=tlrefSeri.slice(-24);
    } else {
      sonuclar["TP.BISTTLREF.KAPANIS"]=null;
      sonuclar["TP.BISTTLREF.KAPANIS_SERI"]=[];
    }

    const TLREFK_TLREF_FARKI = 0.096;
    if(sonuclar["TP.BISTTLREF.KAPANIS"]){
      sonuclar["TP.BISTTLREFK.KAPANIS"] = {
        deger: sonuclar["TP.BISTTLREF.KAPANIS"].deger - TLREFK_TLREF_FARKI,
        tarih: sonuclar["TP.BISTTLREF.KAPANIS"].tarih,
        tahmini: true,
      };
      sonuclar["TP.BISTTLREFK.KAPANIS_SERI"] = (sonuclar["TP.BISTTLREF.KAPANIS_SERI"]||[])
        .map(n => ({ tarih: n.tarih, deger: n.deger - TLREFK_TLREF_FARKI }));
    } else {
      sonuclar["TP.BISTTLREFK.KAPANIS"]=null;
      sonuclar["TP.BISTTLREFK.KAPANIS_SERI"]=[];
    }

    const enfItems=enfJson?.items||[];
    const tufeDizi=tumDegerler(enfItems,"TP_TUKFIY2025_GENEL");
    teshis.tufeDizi_uzunluk = tufeDizi.length;
    teshis.tufeDizi_son3 = tufeDizi.slice(-3);
    if(tufeDizi.length>=13){
      const son=tufeDizi[tufeDizi.length-1];
      const oncekiAy=tufeDizi[tufeDizi.length-2];
      const oncekiYil=tufeDizi[tufeDizi.length-13]; // 12 ay önce (length-1 - 12)
      sonuclar["TUFE_YILLIK"]={deger:((son.deger-oncekiYil.deger)/oncekiYil.deger*100),tarih:tufeAcikilanmaTarihi(son.tarih)};
      sonuclar["TUFE_AYLIK"]={deger:((son.deger-oncekiAy.deger)/oncekiAy.deger*100),tarih:tufeAcikilanmaTarihi(son.tarih)};

      // DÜZELTME (2026-07, v7): oY indeksi "i-13" idi (13 ay önce), doğrusu
      // "i-12" (12 ay önce) — artık ana karttaki hesapla birebir aynı ayı,
      // aynı yöntemle kıyaslıyor. Döngü koşulu da i>=12'ye çekildi.
      const yillikSeri=[], aylikSeri=[];
      for(let i=tufeDizi.length-1;i>=12;i--){
        const s=tufeDizi[i], oA=tufeDizi[i-1], oY=tufeDizi[i-12];
        const acikilanmaTarihi = tufeAcikilanmaTarihi(s.tarih);
        yillikSeri.unshift({tarih:acikilanmaTarihi, deger:(s.deger-oY.deger)/oY.deger*100});
        aylikSeri.unshift({tarih:acikilanmaTarihi, deger:(s.deger-oA.deger)/oA.deger*100});
        if(yillikSeri.length>=24) break;
      }
      sonuclar["TUFE_YILLIK_SERI"]=yillikSeri;
      sonuclar["TUFE_AYLIK_SERI"]=aylikSeri;
    } else {
      sonuclar["TUFE_YILLIK"]=null;
      sonuclar["TUFE_AYLIK"]=null;
      sonuclar["TUFE_YILLIK_SERI"]=[];
      sonuclar["TUFE_AYLIK_SERI"]=[];
    }

    const tufe12Ay = tufe12AyOrtalamaHesapla(tufeDizi);
    sonuclar["TUFE_12AY_ORTALAMA"] = tufe12Ay.son;
    sonuclar["TUFE_12AY_ORTALAMA_SERI"] = tufe12Ay.seri;

    const yanit={tarih:tarihStr(new Date()),seriler:sonuclar, _teshis: teshis};
    try{ await redis.set(KV_ANLIK_KEY, yanit, {ex: CACHE_TTL_SANIYE}); }catch{}
    if(kilitBizdeMi){ try{ await redis.del(kilitAnahtari); }catch{} }
    return res.status(200).json(yanit);
  }catch(err){
    if(kilitBizdeMi){ try{ await redis.del(kilitAnahtari); }catch{} }
    try{
      const eskiOnbellek = await redis.get(KV_ANLIK_KEY);
      if(eskiOnbellek) return res.status(200).json({...eskiOnbellek,cached:true,hata:err.message});
    }catch{}
    return res.status(500).json({error:err.message});
  }
}
