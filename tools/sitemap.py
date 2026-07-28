#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/sitemap.py

public/ klasörünü tarayarak public/sitemap.xml dosyasını yeniden üretir ve
public/robots.txt içinde sitemap satırının bulunduğundan emin olur.

NEDEN BÖYLE:
Sitemap'i elle tutmak, yeni sayfa eklendiğinde unutulmaya çok açık — nitekim
kar-payi-oranlari sayfası eklendiğinde Search Console "Yönlendiren site
haritası algılanmadı" dedi. Bu script dosya sistemini kaynak kabul ediyor:
diske bir sayfa koyduğun anda sitemap'e giriyor.

ÖNEMLİ — MEVCUT KAYITLAR KORUNUYOR:
1) Halihazırdaki sitemap.xml okunuyor. Diskte KARŞILIĞI OLMAYAN adresler
   (React uygulamasının SPA rotaları gibi) silinmiyor, olduğu gibi taşınıyor.
2) Zaten kayıtlı bir adresin <lastmod> değeri korunuyor. Her çalıştırmada
   tüm tarihleri "bugün" yapmak Google'a yanlış sinyal verir ve güveni azaltır;
   yalnızca YENİ adresler bugünün tarihini alır.

KULLANIM:
    python3 tools/sitemap.py
"""

import os
import re
import sys
from datetime import date

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(KOK, "public")
SITEMAP = os.path.join(PUBLIC, "sitemap.xml")
ROBOTS = os.path.join(PUBLIC, "robots.txt")
SITE = "https://www.katilimplus.com"
BUGUN = date.today().isoformat()

# Sitemap'e girmemesi gereken dosyalar: doğrulama dosyaları, yalnızca
# uygulama içinden açılan yardımcı sayfalar vb.
HARIC = {
    "bildirim-gonder.html",      # yalnızca yönetim amaçlı
}
HARIC_DESEN = re.compile(r"^google[0-9a-f]+\.html$")   # Search Console doğrulama

# Öncelik: ana sayfa > oran sayfası > blog dizini > blog yazıları
def oncelik(yol):
    if yol == "/":
        return "1.0", "daily"
    if yol.startswith("/kar-payi-oranlari"):
        return "0.9", "weekly"
    if yol == "/blog/":
        return "0.8", "weekly"
    if yol.startswith("/blog/"):
        return "0.7", "monthly"
    return "0.5", "monthly"


def diskteki_adresler():
    """public/ altındaki yayımlanabilir sayfaları URL yoluna çevirir."""
    yollar = set()
    for kok, klasorler, dosyalar in os.walk(PUBLIC):
        klasorler[:] = [k for k in klasorler if not k.startswith(".")]
        for d in dosyalar:
            if not d.endswith(".html"):
                continue
            if d in HARIC or HARIC_DESEN.match(d):
                continue
            tam = os.path.join(kok, d)
            bagil = os.path.relpath(tam, PUBLIC).replace(os.sep, "/")
            if bagil == "index.html":
                yollar.add("/")
            elif bagil.endswith("/index.html"):
                yollar.add("/" + bagil[: -len("index.html")])
            else:
                yollar.add("/" + bagil)
    return yollar


def mevcut_sitemap():
    """Var olan sitemap'ten {adres: lastmod} sözlüğü çıkarır."""
    if not os.path.exists(SITEMAP):
        return {}
    icerik = open(SITEMAP, encoding="utf-8").read()
    kayitlar = {}
    for blok in re.findall(r"<url>(.*?)</url>", icerik, re.S):
        loc = re.search(r"<loc>\s*(.*?)\s*</loc>", blok, re.S)
        if not loc:
            continue
        mod = re.search(r"<lastmod>\s*(.*?)\s*</lastmod>", blok, re.S)
        kayitlar[loc.group(1).strip()] = mod.group(1).strip() if mod else None
    return kayitlar


def robots_kontrol():
    """robots.txt içinde Sitemap satırı yoksa ekler."""
    satir = f"Sitemap: {SITE}/sitemap.xml"
    if os.path.exists(ROBOTS):
        icerik = open(ROBOTS, encoding="utf-8").read()
        if "sitemap.xml" in icerik.lower():
            return "zaten vardı"
        yeni = icerik.rstrip("\n") + "\n\n" + satir + "\n"
    else:
        yeni = "User-agent: *\nAllow: /\n\n" + satir + "\n"
    open(ROBOTS, "w", encoding="utf-8").write(yeni)
    return "eklendi"


def main():
    if not os.path.isdir(PUBLIC):
        print(f"HATA: {PUBLIC} yok.", file=sys.stderr)
        sys.exit(1)

    eski = mevcut_sitemap()
    disk_yollari = diskteki_adresler()
    disk_adresleri = {SITE + y for y in disk_yollari}

    # Diskte karşılığı olmayan eski adresler (SPA rotaları) korunuyor
    korunan = {a: m for a, m in eski.items() if a not in disk_adresleri}

    girdiler = []
    yeni_sayi = 0

    for yol in sorted(disk_yollari, key=lambda y: (y != "/", y)):
        adres = SITE + yol
        p, cf = oncelik(yol)
        lastmod = eski.get(adres)
        if not lastmod:
            lastmod = BUGUN
            yeni_sayi += 1
        girdiler.append((adres, lastmod, cf, p))

    for adres, lastmod in sorted(korunan.items()):
        yol = adres[len(SITE):] or "/"
        p, cf = oncelik(yol)
        girdiler.append((adres, lastmod or BUGUN, cf, p))

    govde = "\n".join(
        f"""  <url>
    <loc>{a}</loc>
    <lastmod>{m}</lastmod>
    <changefreq>{c}</changefreq>
    <priority>{p}</priority>
  </url>""" for a, m, c, p in girdiler)

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{govde}
</urlset>
"""
    open(SITEMAP, "w", encoding="utf-8").write(xml)
    robots_durum = robots_kontrol()

    print(f"✅ sitemap.xml yazıldı — toplam {len(girdiler)} adres")
    print(f"   Diskten bulunan : {len(disk_yollari)}")
    print(f"   Yeni eklenen    : {yeni_sayi}")
    print(f"   Korunan (SPA vb): {len(korunan)}")
    print(f"   robots.txt      : Sitemap satırı {robots_durum}")
    print(f"   Boyut           : {len(xml):,} bayt")
    if yeni_sayi:
        print("\n   Yeni adresler:")
        for a, m, _, _ in girdiler:
            if m == BUGUN and a not in eski:
                print("     +", a)


if __name__ == "__main__":
    main()
