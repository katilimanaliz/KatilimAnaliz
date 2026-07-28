#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/kar-payi-html.py

public/kar-payi.json dosyasından ARAMA MOTORLARI İÇİN statik bir HTML sayfası
üretir: public/kar-payi-oranlari/index.html

NEDEN GEREKLİ:
Oran karşılaştırma tablosu React uygulamasının içinde yaşıyor; Google bunu ya
hiç göremiyor ya da çok zayıf görüyor. Search Console verisi bunu doğruladı —
"katılım bankası kâr payı oranları" gibi asıl güçlü olduğumuz aramalarda hiç
görünmüyoruz, sadece marka aramasından ("katılım plus") tıklama alıyoruz.
Bu script, aynı veriden Google'ın okuyabileceği gerçek bir HTML tablo üretir.

KULLANIM:
    python3 tools/kar-payi-html.py

Oranları güncelledikten SONRA çalıştırılmalı; ikisi birlikte commit edilir.
"""

import json, os, sys
from datetime import datetime

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_YOL = os.path.join(KOK, "public", "kar-payi.json")
CIKTI_KLASOR = os.path.join(KOK, "public", "kar-payi-oranlari")
CIKTI_YOL = os.path.join(CIKTI_KLASOR, "index.html")
SITE = "https://www.katilimplus.com"

AYLAR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
         "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def tarih_oku(s):
    """'2026-07-28' -> (datetime, '28 Temmuz 2026')"""
    try:
        d = datetime.strptime(s, "%Y-%m-%d")
        return d, f"{d.day} {AYLAR[d.month]} {d.year}"
    except Exception:
        return None, s or "—"


def yuzde(v):
    """1.81 -> '%1,81' · None -> '—'"""
    if v is None:
        return "—"
    return "%" + f"{v:.2f}".replace(".", ",")


def taksit(anapara, aylik_oran, ay):
    """Eşit taksitli (annüite) ödeme tutarı."""
    i = aylik_oran / 100.0
    return anapara * i * (1 + i) ** ay / ((1 + i) ** ay - 1)


def tl(v):
    return f"{v:,.0f}".replace(",", ".")


def en_iyi_en_kotu(bankalar, kolon):
    """Bir sütunda en düşük ve en yüksek oranı olan bankaları döndürür."""
    dolu = [b for b in bankalar if b.get(kolon) is not None]
    if len(dolu) < 2:
        return None, None
    dolu.sort(key=lambda b: b[kolon])
    return dolu[0], dolu[-1]


def main():
    if not os.path.exists(JSON_YOL):
        print(f"HATA: {JSON_YOL} bulunamadı.", file=sys.stderr)
        sys.exit(1)

    with open(JSON_YOL, encoding="utf-8") as f:
        veri = json.load(f)

    kat_bankalar = veri.get("bankalar", [])
    fin_bankalar = veri.get("finansman", {}).get("bankalar", [])
    fin_tarihler = veri.get("finansman", {}).get("guncelleme", {})

    kat_dt, kat_tarih = tarih_oku(veri.get("guncelleme", ""))
    fin_dt, fin_tarih = tarih_oku(fin_tarihler.get("konut", ""))

    # Sıralamalar: katılma yüksekten düşüğe (mevduat sahibi için iyi olan
    # yüksek), finansman düşükten yükseğe (borçlanan için iyi olan düşük).
    kat_sirali = sorted(
        [b for b in kat_bankalar if b.get("tl") is not None],
        key=lambda b: -b["tl"])
    fin_sirali = sorted(
        [b for b in fin_bankalar if b.get("konut120") is not None],
        key=lambda b: b["konut120"])

    # ── Somut karşılaştırma: 1.000.000 TL / 120 ay konut ────────────────
    ucuz, pahali = en_iyi_en_kotu(fin_bankalar, "konut120")
    ornek_html = ""
    if ucuz and pahali:
        A, N = 1_000_000, 120
        t1 = taksit(A, ucuz["konut120"], N)
        t2 = taksit(A, pahali["konut120"], N)
        fark_toplam = (t2 - t1) * N
        ornek_html = f"""
    <section class="kutu vurgu">
      <h2>Oran farkı ne kadar önemli?</h2>
      <p>
        <strong>1.000.000 TL</strong> tutarında, <strong>120 ay</strong> vadeli bir konut
        finansmanında en düşük ve en yüksek oran arasındaki fark:
      </p>
      <ul class="ornek">
        <li><span>{ucuz['ad']}</span> — {yuzde(ucuz['konut120'])} · aylık <strong>{tl(t1)} TL</strong></li>
        <li><span>{pahali['ad']}</span> — {yuzde(pahali['konut120'])} · aylık <strong>{tl(t2)} TL</strong></li>
      </ul>
      <p class="sonuc">
        Vade boyunca toplam fark: <strong>{tl(fark_toplam)} TL</strong>
      </p>
      <p class="minik">
        Eşit taksitli (annüite) yöntemle hesaplanmıştır; vergi, masraf ve sigorta
        tutarları dâhil değildir. Bilgilendirme amaçlıdır.
      </p>
    </section>"""

    # ── Finansman tablosu ────────────────────────────────────────────────
    fin_satirlar = "\n".join(
        f"""        <tr>
          <th scope="row">{b['ad']}</th>
          <td>{yuzde(b.get('konut60'))}</td>
          <td>{yuzde(b.get('konut120'))}</td>
          <td>{yuzde(b.get('tasit12'))}</td>
          <td>{yuzde(b.get('tasit24'))}</td>
          <td>{yuzde(b.get('ihtiyac12'))}</td>
          <td>{yuzde(b.get('ihtiyac24'))}</td>
        </tr>""" for b in fin_sirali)

    # ── Katılma hesabı tablosu ───────────────────────────────────────────
    kat_satirlar = "\n".join(
        f"""        <tr>
          <th scope="row">{b['ad']}</th>
          <td>{yuzde(b.get('tl'))}</td>
          <td>{yuzde(b.get('usd'))}</td>
          <td>{yuzde(b.get('eur'))}</td>
          <td>{yuzde(b.get('altin'))}</td>
        </tr>""" for b in kat_sirali)

    # ── SSS (FAQPage şeması için de kullanılıyor) ────────────────────────
    sss = [
        ("Katılım bankalarında kâr payı oranı nedir?",
         "Katılım bankaları faiz yerine kâr payı esasına göre çalışır. Katılma "
         "hesabına yatırılan para, bankanın faizsiz finansman faaliyetlerinde "
         "değerlendirilir ve elde edilen kâr, önceden belirlenmiş bir orana göre "
         "hesap sahibiyle paylaşılır. Oran ileriye yönelik bir taahhüt değil, "
         "gösterge niteliğindedir."),
        ("Konut finansmanında en uygun katılım bankası hangisi?",
         f"{fin_tarih} tarihli verilere göre 120 ay vadeli konut finansmanında en "
         f"düşük oran {ucuz['ad'] if ucuz else '—'} "
         f"({yuzde(ucuz['konut120']) if ucuz else '—'}) seviyesindedir. Oranlar "
         "sık değiştiği için başvuru öncesinde bankadan güncel teklif alınmalıdır."),
        ("Kâr payı oranları ne sıklıkla değişiyor?",
         "Bankalar oranlarını piyasa koşullarına göre günceller; değişiklikler "
         "genellikle haftalık olarak yaşanır. Bu sayfadaki tablolar her güncellemede "
         "yenilenmektedir."),
        ("Bu oranlar kesin teklif midir?",
         "Hayır. Buradaki oranlar bankaların kamuya açıkladığı gösterge oranlardır. "
         "Size uygulanacak nihai oran; tutar, vade, kredi notu ve bankanın "
         "değerlendirmesine göre farklılık gösterebilir."),
    ]
    sss_html = "\n".join(
        f"""      <details>
        <summary>{s}</summary>
        <p>{c}</p>
      </details>""" for s, c in sss)

    jsonld_sss = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": s,
             "acceptedAnswer": {"@type": "Answer", "text": c}}
            for s, c in sss
        ],
    }
    jsonld_sayfa = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Katılım Bankası Kâr Payı ve Finansman Oranları",
        "description": (
            "Türkiye'deki katılım bankalarının güncel kâr payı ve finansman "
            "oranlarının karşılaştırmalı tablosu."),
        "url": f"{SITE}/kar-payi-oranlari/",
        "inLanguage": "tr-TR",
        "dateModified": veri.get("guncelleme", ""),
        "isPartOf": {"@type": "WebSite", "name": "Katılım Plus", "url": SITE},
    }

    # ── İLGİLİ YAZILAR ───────────────────────────────────────────────────
    # SEO amaçlı iç bağlantı. Search Console'da bu yazılar "Keşfedildi ancak
    # dizine eklenmedi · Son tarama: Yok" durumundaydı — Google adreslerini
    # biliyor ama henüz hiç ziyaret etmemişti. Yeni sitelerde tarama bütçesi
    # kısıtlı olduğu için, taranan bir sayfadan verilen bağlantı keşif yolu
    # açıyor. Bu sayfa dizine ekleme talebiyle öne alındığı için buradan
    # verilen linkler işe yarar.
    ilgili = [
        ("/blog/kar-payi-nedir-nasil-hesaplanir/",
         "Kâr payı nedir, nasıl hesaplanır?"),
        ("/blog/enflasyon-korumali-katilma-hesabi-nedir/",
         "Enflasyon korumalı katılma hesabı nedir?"),
        ("/blog/katilim-bankaciligi-faizsiz-mi-helal-mi/",
         "Katılım bankacılığı faizsiz mi, helal mi?"),
        ("/blog/tlref-nedir-nasil-hesaplanir/",
         "TLREF nedir, nasıl hesaplanır?"),
        ("/blog/konut-finansmani-murabaha/",
         "Konut finansmanı ve murabaha yöntemi"),
        ("/blog/katilma-hesabi-getirisi-adim-adim-hesaplama/",
         "Katılma hesabı getirisi: adım adım hesaplama"),
        ("/blog/halka-arz-katilim-endeksi-uygunlugu/",
         "Halka arzlarda katılım endeksi uygunluğu"),
        ("/blog/katilim-hesabi-stopaj-hesaplama/",
         "Katılma hesabında stopaj nasıl hesaplanır?"),
    ]
    ilgili_html = "\n".join(
        f'      <li><a href="{SITE}{y}">{b}</a></li>' for y, b in ilgili)

    baslik = f"Katılım Bankası Kâr Payı Oranları ({kat_tarih}) — Karşılaştırma"
    aciklama = (
        f"Katılım bankalarının {kat_tarih} tarihli güncel kâr payı ve konut, taşıt, "
        "ihtiyaç finansmanı oranları tek tabloda. Ücretsiz karşılaştırma.")

    html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{baslik}</title>
<meta name="description" content="{aciklama}">
<link rel="canonical" href="{SITE}/kar-payi-oranlari/">
<meta property="og:type" content="website">
<meta property="og:title" content="{baslik}">
<meta property="og:description" content="{aciklama}">
<meta property="og:url" content="{SITE}/kar-payi-oranlari/">
<meta property="og:site_name" content="Katılım Plus">
<meta property="og:locale" content="tr_TR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{baslik}">
<meta name="twitter:description" content="{aciklama}">
<script type="application/ld+json">{json.dumps(jsonld_sayfa, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(jsonld_sss, ensure_ascii=False)}</script>
<style>
  :root {{ --mavi:#1A4F9C; --yesil:#189656; --metin:#16222E; --soluk:#5A6B7C;
           --cizgi:#E3E9EF; --zemin:#F5F8FB; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,
          "Helvetica Neue",Arial,sans-serif; color:var(--metin); background:var(--zemin);
          line-height:1.6; }}
  .sar {{ max-width:900px; margin:0 auto; padding:20px 16px 60px; }}
  header a {{ color:var(--mavi); text-decoration:none; font-weight:700; font-size:15px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:18px 0 8px; }}
  h2 {{ font-size:19px; margin:32px 0 6px; }}
  .tarih {{ color:var(--soluk); font-size:14px; margin:0 0 4px; }}
  .giris {{ color:var(--soluk); font-size:15px; margin:10px 0 0; }}
  .kutu {{ background:#fff; border:1px solid var(--cizgi); border-radius:12px;
           padding:16px 18px; margin-top:18px; }}
  .vurgu {{ border-color:#CFE0F5; background:#F7FAFF; }}
  .tablo-sar {{ overflow-x:auto; -webkit-overflow-scrolling:touch;
                border:1px solid var(--cizgi); border-radius:12px; background:#fff;
                margin-top:10px; }}
  table {{ border-collapse:collapse; width:100%; min-width:560px; font-size:14px; }}
  caption {{ text-align:left; padding:12px 14px 4px; font-size:13px; color:var(--soluk); }}
  th, td {{ padding:11px 12px; text-align:right; border-bottom:1px solid var(--cizgi);
            white-space:nowrap; }}
  thead th {{ background:#F0F4F9; font-size:12px; color:var(--soluk); text-align:right;
              position:sticky; top:0; }}
  thead th:first-child, tbody th {{ text-align:left; }}
  tbody th {{ font-weight:700; }}
  tbody tr:last-child th, tbody tr:last-child td {{ border-bottom:none; }}
  tbody tr:first-child th {{ color:var(--yesil); }}
  .ornek {{ list-style:none; padding:0; margin:10px 0; }}
  .ornek li {{ padding:8px 0; border-bottom:1px dashed var(--cizgi); font-size:15px; }}
  .ornek li:last-child {{ border-bottom:none; }}
  .ornek span {{ font-weight:700; }}
  .sonuc {{ font-size:17px; margin:12px 0 0; }}
  .sonuc strong {{ color:var(--mavi); }}
  .minik {{ font-size:12.5px; color:var(--soluk); margin-top:8px; }}
  details {{ background:#fff; border:1px solid var(--cizgi); border-radius:10px;
             padding:12px 14px; margin-top:8px; }}
  summary {{ font-weight:700; cursor:pointer; font-size:15px; }}
  details p {{ margin:8px 0 0; font-size:14.5px; color:var(--soluk); }}
  .cta {{ display:block; text-align:center; background:var(--mavi); color:#fff;
          text-decoration:none; font-weight:700; padding:14px; border-radius:12px;
          margin-top:24px; }}
  .ilgili {{ list-style:none; padding:0; margin:0; }}
  .ilgili li {{ padding:9px 0; border-bottom:1px solid var(--cizgi); }}
  .ilgili li:last-child {{ border-bottom:none; }}
  .ilgili a {{ color:var(--mavi); text-decoration:none; font-size:15px; font-weight:600; }}
  .ilgili a:hover {{ text-decoration:underline; }}
  footer {{ margin-top:34px; font-size:12.5px; color:var(--soluk); }}
  footer a {{ color:var(--mavi); }}
</style>
</head>
<body>
<div class="sar">

<header><a href="{SITE}/">← Katılım Plus</a></header>

<h1>Katılım Bankası Kâr Payı ve Finansman Oranları</h1>
<p class="tarih">Finansman oranları: <strong>{fin_tarih}</strong> · Katılma hesabı: <strong>{kat_tarih}</strong></p>
<p class="giris">
  Türkiye'de faaliyet gösteren katılım bankalarının güncel konut, taşıt ve ihtiyaç
  finansmanı oranları ile katılma hesabı kâr payı oranları tek tabloda.
  Veriler bankaların kamuya açıkladığı gösterge oranlardır.
</p>
{ornek_html}

<h2>Finansman Oranları (aylık %)</h2>
<div class="tablo-sar">
  <table>
    <caption>120 ay vadeli konut oranına göre en uygundan pahalıya sıralanmıştır.</caption>
    <thead>
      <tr>
        <th scope="col">Banka</th>
        <th scope="col">Konut 60 Ay</th>
        <th scope="col">Konut 120 Ay</th>
        <th scope="col">Taşıt 12 Ay</th>
        <th scope="col">Taşıt 24 Ay</th>
        <th scope="col">İhtiyaç 12 Ay</th>
        <th scope="col">İhtiyaç 24 Ay</th>
      </tr>
    </thead>
    <tbody>
{fin_satirlar}
    </tbody>
  </table>
</div>

<h2>Katılma Hesabı Kâr Payı Oranları (brüt yıllık %)</h2>
<div class="tablo-sar">
  <table>
    <caption>100.000 TL / 100.000 USD / 100.000 EUR / 1.000 gr altın, 1 ay vade. TL oranına göre yüksekten düşüğe sıralanmıştır.</caption>
    <thead>
      <tr>
        <th scope="col">Banka</th>
        <th scope="col">TL</th>
        <th scope="col">USD</th>
        <th scope="col">EUR</th>
        <th scope="col">Altın</th>
      </tr>
    </thead>
    <tbody>
{kat_satirlar}
    </tbody>
  </table>
</div>

<h2>Sıkça Sorulan Sorular</h2>
{sss_html}

<h2>İlgili Yazılar</h2>
<div class="kutu">
  <ul class="ilgili">
{ilgili_html}
  </ul>
</div>

<a class="cta" href="{SITE}/">Tüm hesaplama araçlarını ücretsiz kullan →</a>

<footer>
  <p>
    Bu sayfadaki oranlar bilgilendirme amaçlıdır; kesin teklif, resmi belge veya
    hukuki taahhüt niteliği taşımaz. Kâr payı oranları ileriye yönelik bir taahhüt
    değil, gösterge niteliğindedir. Nihai oran ve koşullar için ilgili banka ile
    iletişime geçiniz.
  </p>
  <p><a href="{SITE}/">Katılım Plus</a> · Katılım finansının akıllı asistanı</p>
</footer>

</div>
</body>
</html>
"""

    os.makedirs(CIKTI_KLASOR, exist_ok=True)
    with open(CIKTI_YOL, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✅ Üretildi: {os.path.relpath(CIKTI_YOL, KOK)}")
    print(f"   Finansman: {len(fin_sirali)} banka · Katılma: {len(kat_sirali)} banka")
    print(f"   Tarihler  : finansman {fin_tarih} · katılma {kat_tarih}")
    print(f"   Boyut     : {len(html):,} bayt")


if __name__ == "__main__":
    main()
